
from __future__ import annotations

import copy
import json
import re
from datetime import date, datetime, timezone
from typing import Any, Iterable

from flask import abort
from pymongo import ASCENDING, DESCENDING, MongoClient, ReturnDocument

try:
    import mongomock  # type: ignore
except Exception:  # pragma: no cover
    mongomock = None

from werkzeug.security import check_password_hash, generate_password_hash


class _NoopEngine:
    def dispose(self) -> None:
        return None


class MongoSession:
    def __init__(self, mongo_db: "MongoDB"):
        self._mongo_db = mongo_db
        self._tracked: set[BaseModel] = set()

    def track(self, instance: "BaseModel") -> None:
        if instance is not None:
            self._tracked.add(instance)

    def add(self, instance: "BaseModel") -> None:
        self.track(instance)
        if instance.id is None:
            instance.save()

    def delete(self, instance: "BaseModel") -> None:
        if instance is None:
            return
        instance.delete()
        self._tracked.discard(instance)

    def commit(self) -> None:
        for instance in list(self._tracked):
            if getattr(instance, "_deleted", False):
                self._tracked.discard(instance)
                continue
            if getattr(instance, "_dirty", False):
                instance.save()

    def flush(self) -> None:
        self.commit()

    def rollback(self) -> None:
        return None

    def remove(self) -> None:
        self._tracked.clear()


class MongoDB:
    def __init__(self):
        self.client: MongoClient | None = None
        self.database = None
        self.session = MongoSession(self)
        self.engine = _NoopEngine()

    def init_app(self, app) -> None:
        uri = app.config.get("MONGO_URI", "mongodb://localhost:27017/ccs_system")
        db_name = app.config.get("MONGO_DB_NAME")
        use_mock = bool(app.config.get("MONGO_MOCK", False))

        if use_mock:
            if mongomock is None:
                raise RuntimeError("MONGO_MOCK=true but mongomock is not installed")
            self.client = mongomock.MongoClient()
        else:
            self.client = MongoClient(uri)

        if db_name:
            self.database = self.client[db_name]
        else:
            try:
                self.database = self.client.get_default_database()
            except Exception:
                self.database = None
            if self.database is None:
                self.database = self.client["ccs_system"]

        self.create_all()

    def get_collection(self, collection_name: str):
        if self.database is None:
            raise RuntimeError("Database is not initialized. Call db.init_app(app) first.")
        return self.database[collection_name]

    def next_id(self, collection_name: str) -> int:
        counters = self.get_collection("_counters")
        updated = counters.find_one_and_update(
            {"_id": collection_name},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return int(updated["seq"])

    def create_all(self) -> None:
        for model in MODEL_REGISTRY:
            collection = self.get_collection(model.collection_name)
            collection.create_index([("id", ASCENDING)], unique=True)
            for index in getattr(model, "indexes", []):
                if not index:
                    continue
                keys = []
                for entry in index:
                    if isinstance(entry, tuple):
                        keys.append(entry)
                    else:
                        keys.append((entry, ASCENDING))
                collection.create_index(keys)
            for unique_index in getattr(model, "unique_indexes", []):
                if not unique_index:
                    continue
                keys = []
                for entry in unique_index:
                    if isinstance(entry, tuple):
                        keys.append(entry)
                    else:
                        keys.append((entry, ASCENDING))
                collection.create_index(keys, unique=True)

    def drop_all(self) -> None:
        for model in MODEL_REGISTRY:
            self.get_collection(model.collection_name).drop()
        self.get_collection("_counters").drop()
        self.session.remove()


class Condition:
    def __init__(self, model_cls: type["BaseModel"], field_name: str, op: str, value: Any):
        self.model_cls = model_cls
        self.field_name = field_name
        self.op = op
        self.value = value


class OrCondition:
    def __init__(self, conditions: Iterable[Any]):
        self.conditions = list(conditions)


class SortSpec:
    def __init__(self, field_name: str, direction: int):
        self.field_name = field_name
        self.direction = direction


class Field:
    def __init__(self, name: str | None = None):
        self.name = name
        self.model_cls: type[BaseModel] | None = None

    def __set_name__(self, owner, name):
        self.model_cls = owner
        if self.name is None:
            self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        return instance.__dict__.get(self.name)

    def __set__(self, instance, value):
        instance._set_field(self.name, value)

    def _build_condition(self, op: str, value: Any) -> Condition:
        if self.model_cls is None or self.name is None:
            raise RuntimeError("Field is not bound to a model class")
        return Condition(self.model_cls, self.name, op, value)

    def __eq__(self, other: Any):  # type: ignore[override]
        return self._build_condition("eq", other)

    def __ne__(self, other: Any):  # type: ignore[override]
        return self._build_condition("ne", other)

    def __ge__(self, other: Any):
        return self._build_condition("ge", other)

    def __le__(self, other: Any):
        return self._build_condition("le", other)

    def ilike(self, pattern: str):
        return self._build_condition("ilike", pattern)

    def desc(self) -> SortSpec:
        return SortSpec(self.name, DESCENDING)

    def asc(self) -> SortSpec:
        return SortSpec(self.name, ASCENDING)

class QueryDescriptor:
    def __get__(self, instance, owner):
        return Query(owner)


def or_(*conditions):
    return OrCondition(conditions)


def _coerce_numeric_pair(left: Any, right: Any):
    if isinstance(left, int) and isinstance(right, str) and right.isdigit():
        return left, int(right)
    if isinstance(right, int) and isinstance(left, str) and left.isdigit():
        return int(left), right
    return left, right


def _coerce_date_pair(left: Any, right: Any):
    if isinstance(left, date) and not isinstance(left, datetime) and isinstance(right, str):
        try:
            return left, date.fromisoformat(right)
        except ValueError:
            return left, right
    if isinstance(right, date) and not isinstance(right, datetime) and isinstance(left, str):
        try:
            return date.fromisoformat(left), right
        except ValueError:
            return left, right
    return left, right


def _normalize_datetime(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    return value


def _matches_ilike(value: Any, pattern: str) -> bool:
    if value is None:
        return False
    text = str(value)
    regex = re.escape(pattern)
    regex = regex.replace(r"%", ".*").replace(r"_", ".")
    return re.match(f"^{regex}$", text, re.IGNORECASE) is not None


class Query:
    def __init__(self, model_cls: type["BaseModel"]):
        self.model_cls = model_cls
        self._conditions: list[Any] = []
        self._order_by: list[SortSpec] = []
        self._limit: int | None = None
        self._offset: int = 0
        self._distinct: bool = False
        self._joins: list[type[BaseModel]] = []

    def _clone(self) -> "Query":
        cloned = Query(self.model_cls)
        cloned._conditions = list(self._conditions)
        cloned._order_by = list(self._order_by)
        cloned._limit = self._limit
        cloned._offset = self._offset
        cloned._distinct = self._distinct
        cloned._joins = list(self._joins)
        return cloned

    def filter_by(self, **kwargs):
        cloned = self._clone()
        for key, value in kwargs.items():
            cloned._conditions.append(Condition(self.model_cls, key, "eq", value))
        return cloned

    def filter(self, *conditions):
        cloned = self._clone()
        for condition in conditions:
            if condition is not None:
                cloned._conditions.append(condition)
        return cloned

    def join(self, model_cls):
        cloned = self._clone()
        if model_cls not in cloned._joins:
            cloned._joins.append(model_cls)
        return cloned

    def distinct(self):
        cloned = self._clone()
        cloned._distinct = True
        return cloned

    def order_by(self, *items):
        cloned = self._clone()
        parsed: list[SortSpec] = []
        for item in items:
            if isinstance(item, SortSpec):
                parsed.append(item)
            elif isinstance(item, Field):
                parsed.append(item.asc())
            else:
                raise ValueError(f"Unsupported order_by item: {item!r}")
        cloned._order_by = parsed
        return cloned

    def limit(self, value: int):
        cloned = self._clone()
        cloned._limit = int(value)
        return cloned

    def offset(self, value: int):
        cloned = self._clone()
        cloned._offset = int(value)
        return cloned

    def count(self) -> int:
        return len(self._evaluate(apply_pagination=False))

    def all(self):
        return self._evaluate(apply_pagination=True)

    def first(self):
        results = self._evaluate(apply_pagination=True)
        return results[0] if results else None

    def get(self, value: int):
        if value is None:
            return None
        doc = self.model_cls.collection().find_one({"id": int(value)})
        if not doc:
            return None
        instance = self.model_cls.from_document(doc)
        db.session.track(instance)
        return instance

    def get_or_404(self, value: int):
        instance = self.get(value)
        if instance is None:
            abort(404)
        return instance

    def _evaluate(self, apply_pagination: bool):
        docs = list(self.model_cls.collection().find({}))
        instances = [self.model_cls.from_document(doc) for doc in docs]
        for instance in instances:
            db.session.track(instance)

        related_cache = self._build_related_cache(instances)
        filtered = [inst for inst in instances if self._matches_conditions(inst, related_cache)]

        if self._distinct:
            deduped = []
            seen: set[int] = set()
            for inst in filtered:
                identifier = getattr(inst, "id", None)
                if identifier in seen:
                    continue
                seen.add(identifier)
                deduped.append(inst)
            filtered = deduped

        for sort_spec in reversed(self._order_by):
            filtered.sort(
                key=lambda item: self._sortable_value(getattr(item, sort_spec.field_name, None)),
                reverse=sort_spec.direction == DESCENDING,
            )

        if apply_pagination:
            if self._offset:
                filtered = filtered[self._offset :]
            if self._limit is not None:
                filtered = filtered[: self._limit]

        return filtered

    def _sortable_value(self, value: Any):
        if value is None:
            return ""
        if isinstance(value, datetime):
            return value.timestamp()
        if isinstance(value, date):
            return value.toordinal()
        if isinstance(value, str):
            return value.lower()
        return value

    def _build_related_cache(self, base_instances: list["BaseModel"]):
        related_models = self._collect_related_models(self._conditions)
        if not related_models:
            return {}

        base_ids = [instance.id for instance in base_instances if instance.id is not None]
        cache: dict[type[BaseModel], dict[int, list[BaseModel]]] = {}
        for model_cls in related_models:
            grouped: dict[int, list[BaseModel]] = {}
            if not base_ids:
                cache[model_cls] = grouped
                continue
            related_docs = model_cls.collection().find({"student_id": {"$in": base_ids}})
            for doc in related_docs:
                instance = model_cls.from_document(doc)
                db.session.track(instance)
                student_id = getattr(instance, "student_id", None)
                if student_id is None:
                    continue
                grouped.setdefault(student_id, []).append(instance)
            cache[model_cls] = grouped
        return cache

    def _collect_related_models(self, conditions: list[Any]):
        models: set[type[BaseModel]] = set()

        def _visit(cond):
            if isinstance(cond, OrCondition):
                for nested in cond.conditions:
                    _visit(nested)
                return
            if isinstance(cond, Condition) and cond.model_cls is not self.model_cls:
                models.add(cond.model_cls)

        for condition in conditions:
            _visit(condition)
        return models

    def _matches_conditions(self, instance: "BaseModel", related_cache):
        for condition in self._conditions:
            if not self._evaluate_condition(instance, condition, related_cache):
                return False
        return True

    def _evaluate_condition(self, instance: "BaseModel", condition: Any, related_cache):
        if isinstance(condition, OrCondition):
            return any(self._evaluate_condition(instance, nested, related_cache) for nested in condition.conditions)

        if not isinstance(condition, Condition):
            return True

        if condition.model_cls is self.model_cls:
            value = getattr(instance, condition.field_name, None)
            return self._evaluate_simple(value, condition)

        related_instances = related_cache.get(condition.model_cls, {}).get(instance.id, [])
        for related in related_instances:
            value = getattr(related, condition.field_name, None)
            if self._evaluate_simple(value, condition):
                return True
        return False

    def _evaluate_simple(self, left: Any, condition: Condition):
        right = condition.value

        if condition.op == "ilike":
            return _matches_ilike(left, str(right))

        left, right = _coerce_numeric_pair(left, right)
        left, right = _coerce_date_pair(left, right)

        left = _normalize_datetime(left)
        right = _normalize_datetime(right)

        if condition.op == "eq":
            return left == right
        if condition.op == "ne":
            return left != right
        if condition.op == "ge":
            return left is not None and right is not None and left >= right
        if condition.op == "le":
            return left is not None and right is not None and left <= right

        raise ValueError(f"Unsupported condition operator: {condition.op}")


MODEL_REGISTRY: list[type["BaseModel"]] = []

class ModelMeta(type):
    def __new__(mcls, name, bases, attrs):
        cls = super().__new__(mcls, name, bases, attrs)
        schema = getattr(cls, "schema", None)
        if schema:
            for field_name in schema.keys():
                if getattr(cls, field_name, None) is not None:
                    continue
                descriptor = Field(field_name)
                descriptor.__set_name__(cls, field_name)
                setattr(cls, field_name, descriptor)
            if cls not in MODEL_REGISTRY:
                MODEL_REGISTRY.append(cls)
        return cls


class BaseModel(metaclass=ModelMeta):
    query = QueryDescriptor()
    collection_name = ""
    schema: dict[str, Any] = {}
    date_fields: set[str] = set()
    datetime_fields: set[str] = set()
    indexes: list[list[Any]] = []
    unique_indexes: list[list[Any]] = []

    def __init__(self, **kwargs):
        object.__setattr__(self, "_dirty", True)
        object.__setattr__(self, "_deleted", False)
        object.__setattr__(self, "_initializing", True)

        for field_name, default in self.schema.items():
            if field_name in kwargs:
                value = kwargs[field_name]
            else:
                value = self._default_value(default)
            self.__dict__[field_name] = value

        object.__setattr__(self, "_initializing", False)

    def _set_field(self, name: str, value: Any) -> None:
        current = self.__dict__.get(name)
        self.__dict__[name] = value
        if not getattr(self, "_initializing", False) and current != value:
            object.__setattr__(self, "_dirty", True)

    @classmethod
    def _default_value(cls, default):
        if callable(default):
            return default()
        return copy.deepcopy(default)

    @classmethod
    def collection(cls):
        return db.get_collection(cls.collection_name)

    def save(self) -> None:
        if "updated_at" in self.schema and not getattr(self, "_initializing", False):
            self.__dict__["updated_at"] = datetime.utcnow()

        if self.id is None:
            self.__dict__["id"] = db.next_id(self.collection_name)

        payload = self.to_document()
        self.collection().replace_one({"id": self.id}, payload, upsert=True)
        object.__setattr__(self, "_dirty", False)
        object.__setattr__(self, "_deleted", False)

    def delete(self) -> None:
        if self.id is None:
            return
        self.collection().delete_one({"id": self.id})
        object.__setattr__(self, "_deleted", True)

    def to_document(self) -> dict[str, Any]:
        payload = {}
        for field_name in self.schema.keys():
            payload[field_name] = self._serialize_field(field_name, getattr(self, field_name, None))
        return payload

    @classmethod
    def from_document(cls, doc: dict[str, Any]) -> "BaseModel":
        instance = cls.__new__(cls)
        object.__setattr__(instance, "_dirty", False)
        object.__setattr__(instance, "_deleted", False)
        object.__setattr__(instance, "_initializing", True)

        for field_name, default in cls.schema.items():
            if field_name in doc:
                value = doc[field_name]
            else:
                value = cls._default_value(default)
            instance.__dict__[field_name] = cls._deserialize_field(field_name, value)

        object.__setattr__(instance, "_initializing", False)
        return instance

    @classmethod
    def _serialize_field(cls, field_name: str, value: Any):
        if value is None:
            return None
        if field_name in cls.date_fields and isinstance(value, date) and not isinstance(value, datetime):
            return value.isoformat()
        if field_name in cls.datetime_fields and isinstance(value, str):
            try:
                return datetime.fromisoformat(value)
            except ValueError:
                return value
        return value

    @classmethod
    def _deserialize_field(cls, field_name: str, value: Any):
        if value is None:
            return None
        if field_name in cls.date_fields and isinstance(value, str):
            try:
                return date.fromisoformat(value)
            except ValueError:
                return None
        if field_name in cls.datetime_fields and isinstance(value, str):
            try:
                return datetime.fromisoformat(value)
            except ValueError:
                return None
        return value


class User(BaseModel):
    """User model for authentication with multitenant support"""

    collection_name = "users"
    schema = {
        "id": None,
        "username": None,
        "email": None,
        "password_hash": None,
        "role": None,
        "tenant_id": None,
        "is_active": True,
        "created_at": datetime.utcnow,
        "updated_at": datetime.utcnow,
    }
    datetime_fields = {"created_at", "updated_at"}
    unique_indexes = [["username"], ["email"]]
    indexes = [["tenant_id"]]

    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Check if password is correct"""
        return check_password_hash(self.password_hash or "", password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "tenant_id": self.tenant_id,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def to_dict_safe(self):
        """Return user dict without sensitive info"""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "tenant_id": self.tenant_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Student(BaseModel):
    """Student records model"""

    collection_name = "students"
    schema = {
        "id": None,
        "student_id": None,
        "first_name": None,
        "last_name": None,
        "middle_name": None,
        "birthday": None,
        "email": None,
        "contact_number": None,
        "course": None,
        "year_level": None,
        "section": None,
        "enrollment_status": "Enrolled",
        "tenant_id": None,
        "created_at": datetime.utcnow,
    }
    date_fields = {"birthday"}
    datetime_fields = {"created_at"}
    indexes = [["student_id"], ["tenant_id"], ["course"], ["year_level"], ["section"], ["last_name"], ["first_name"]]

    @property
    def skills(self):
        return StudentSkill.query.filter_by(student_id=self.id).all()

    @property
    def academic_history(self):
        return StudentAcademicHistory.query.filter_by(student_id=self.id).all()

    @property
    def activities(self):
        return StudentNonAcademicActivity.query.filter_by(student_id=self.id).all()

    @property
    def violations(self):
        return StudentViolation.query.filter_by(student_id=self.id).all()

    @property
    def affiliations(self):
        return StudentAffiliation.query.filter_by(student_id=self.id).all()

    def delete(self) -> None:
        if self.id is None:
            return
        for model in [
            StudentSkill,
            StudentAcademicHistory,
            StudentNonAcademicActivity,
            StudentViolation,
            StudentAffiliation,
        ]:
            items = model.query.filter_by(student_id=self.id).all()
            for item in items:
                item.delete()
        super().delete()

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "middle_name": self.middle_name,
            "birthday": self.birthday.isoformat() if self.birthday else None,
            "email": self.email,
            "contact_number": self.contact_number,
            "course": self.course,
            "year_level": self.year_level,
            "section": self.section,
            "enrollment_status": self.enrollment_status,
            "skills": [
                {
                    "id": s.id,
                    "skill_name": s.skill_name,
                    "level": s.level,
                }
                for s in (self.skills or [])
            ],
            "academic_history": [
                {
                    "id": h.id,
                    "academic_year": h.academic_year,
                    "course": h.course,
                    "details": h.details,
                }
                for h in (self.academic_history or [])
            ],
            "activities": [
                {
                    "id": a.id,
                    "activity_type": a.activity_type,
                    "activity_name": a.activity_name,
                    "details": a.details,
                }
                for a in (self.activities or [])
            ],
            "violations": [
                {
                    "id": v.id,
                    "violation_name": v.violation_name,
                    "severity": v.severity,
                    "date": v.date.isoformat() if v.date else None,
                    "details": v.details,
                }
                for v in (self.violations or [])
            ],
            "affiliations": [
                {
                    "id": af.id,
                    "name": af.name,
                    "category": af.category,
                    "role": af.role,
                }
                for af in (self.affiliations or [])
            ],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class StudentSkill(BaseModel):
    """Student skills model"""

    collection_name = "student_skills"
    schema = {
        "id": None,
        "student_id": None,
        "skill_name": None,
        "level": None,
        "created_at": datetime.utcnow,
    }
    datetime_fields = {"created_at"}
    indexes = [["student_id"], ["skill_name"]]


class StudentAcademicHistory(BaseModel):
    """Student academic history model"""

    collection_name = "student_academic_history"
    schema = {
        "id": None,
        "student_id": None,
        "academic_year": None,
        "course": None,
        "details": None,
        "created_at": datetime.utcnow,
    }
    datetime_fields = {"created_at"}
    indexes = [["student_id"], ["academic_year"], ["course"]]


class StudentNonAcademicActivity(BaseModel):
    """Non-academic activities model"""

    collection_name = "student_non_academic_activities"
    schema = {
        "id": None,
        "student_id": None,
        "activity_type": None,
        "activity_name": None,
        "details": None,
        "created_at": datetime.utcnow,
    }
    datetime_fields = {"created_at"}
    indexes = [["student_id"], ["activity_type"], ["activity_name"]]


class StudentViolation(BaseModel):
    """Violations model"""

    collection_name = "student_violations"
    schema = {
        "id": None,
        "student_id": None,
        "violation_name": None,
        "severity": None,
        "date": None,
        "details": None,
        "created_at": datetime.utcnow,
    }
    date_fields = {"date"}
    datetime_fields = {"created_at"}
    indexes = [["student_id"], ["violation_name"], ["severity"], ["date"]]


class StudentAffiliation(BaseModel):
    """Affiliations model (orgs, sports, teams, etc.)"""

    collection_name = "student_affiliations"
    schema = {
        "id": None,
        "student_id": None,
        "name": None,
        "category": None,
        "role": None,
        "created_at": datetime.utcnow,
    }
    datetime_fields = {"created_at"}
    indexes = [["student_id"], ["name"], ["category"]]


class Faculty(BaseModel):
    """Faculty records model"""

    collection_name = "faculty"
    schema = {
        "id": None,
        "employee_number": None,
        "first_name": None,
        "last_name": None,
        "middle_name": None,
        "birthday": None,
        "email": None,
        "contact_number": None,
        "department": None,
        "position": None,
        "employment_start_date": None,
        "employment_status": "Full-time",
        "tenant_id": None,
        "created_at": datetime.utcnow,
    }
    date_fields = {"birthday", "employment_start_date"}
    datetime_fields = {"created_at"}
    indexes = [["employee_number"], ["tenant_id"], ["last_name"], ["first_name"]]

    def to_dict(self):
        return {
            "id": self.id,
            "employee_number": self.employee_number,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "middle_name": self.middle_name,
            "birthday": self.birthday.isoformat() if self.birthday else None,
            "email": self.email,
            "contact_number": self.contact_number,
            "department": self.department,
            "position": self.position,
            "employment_start_date": self.employment_start_date.isoformat() if self.employment_start_date else None,
            "employment_status": self.employment_status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Schedule(BaseModel):
    """Scheduling model"""

    collection_name = "schedules"
    schema = {
        "id": None,
        "course": None,
        "subject": None,
        "instructor": None,
        "room": None,
        "day": None,
        "start_time": None,
        "end_time": None,
        "students": 0,
        "year_level": None,
        "section": None,
        "tenant_id": None,
        "created_at": datetime.utcnow,
        "updated_at": datetime.utcnow,
    }
    datetime_fields = {"created_at", "updated_at"}
    indexes = [["tenant_id"], ["course"], ["day"], ["start_time"]]

    def to_dict(self):
        return {
            "id": self.id,
            "course": self.course,
            "subject": self.subject,
            "instructor": self.instructor,
            "room": self.room,
            "day": self.day,
            "time": f"{self.start_time} - {self.end_time}",
            "start_time": self.start_time,
            "end_time": self.end_time,
            "students": self.students,
            "year_level": self.year_level,
            "section": self.section,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Research(BaseModel):
    """College research model"""

    collection_name = "research"
    schema = {
        "id": None,
        "title": None,
        "description": None,
        "authors": None,
        "category": None,
        "status": "Ongoing",
        "keywords": None,
        "citations": 0,
        "views": 0,
        "downloads": 0,
        "journal": None,
        "doi": None,
        "publication_date": None,
        "year": None,
        "tenant_id": None,
        "created_at": datetime.utcnow,
    }
    date_fields = {"publication_date"}
    datetime_fields = {"created_at"}
    indexes = [["tenant_id"], ["category"], ["status"], ["created_at"]]

    def to_dict(self):
        authors_list = []
        if self.authors:
            try:
                authors_list = json.loads(self.authors)
            except Exception:
                authors_list = [a.strip() for a in str(self.authors).split(",") if a.strip()]

        keywords_list = []
        if self.keywords:
            try:
                keywords_list = json.loads(self.keywords)
            except Exception:
                keywords_list = [k.strip() for k in str(self.keywords).split(",") if k.strip()]

        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "authors": authors_list,
            "category": self.category,
            "status": self.status,
            "keywords": keywords_list,
            "citations": self.citations,
            "views": self.views,
            "downloads": self.downloads,
            "journal": self.journal,
            "doi": self.doi,
            "date": self.publication_date.isoformat() if self.publication_date else None,
            "year": self.year,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Report(BaseModel):
    """Organization and events reports model"""

    collection_name = "reports"
    schema = {
        "id": None,
        "title": None,
        "report_type": None,
        "description": None,
        "organization": None,
        "date": None,
        "time": None,
        "venue": None,
        "status": "Upcoming",
        "participants": 0,
        "registered": 0,
        "category": None,
        "tenant_id": None,
        "created_at": datetime.utcnow,
    }
    date_fields = {"date"}
    datetime_fields = {"created_at"}
    indexes = [["tenant_id"], ["report_type"], ["organization"], ["status"], [("date", DESCENDING)]]

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "report_type": self.report_type,
            "description": self.description,
            "organization": self.organization,
            "date": self.date.isoformat() if self.date else None,
            "time": self.time,
            "venue": self.venue,
            "status": self.status,
            "participants": self.participants,
            "registered": self.registered,
            "category": self.category,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class Organization(BaseModel):
    """Organization model"""

    collection_name = "organizations"
    schema = {
        "id": None,
        "name": None,
        "full_name": None,
        "members": 0,
        "events_count": 0,
        "status": "Active",
        "color": None,
        "description": None,
        "tenant_id": None,
        "created_at": datetime.utcnow,
        "updated_at": datetime.utcnow,
    }
    datetime_fields = {"created_at", "updated_at"}
    indexes = [["tenant_id"], ["status"], ["name"]]

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "fullName": self.full_name,
            "full_name": self.full_name,
            "members": self.members,
            "events": self.events_count,
            "events_count": self.events_count,
            "status": self.status,
            "color": self.color,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Syllabus(BaseModel):
    """Syllabus model"""

    collection_name = "syllabus"
    schema = {
        "id": None,
        "course": None,
        "subject": None,
        "code": None,
        "instructor": None,
        "semester": None,
        "academic_year": None,
        "units": None,
        "hours": None,
        "description": None,
        "objectives": None,
        "topics": None,
        "requirements": None,
        "status": "Active",
        "tenant_id": None,
        "created_at": datetime.utcnow,
        "updated_at": datetime.utcnow,
    }
    datetime_fields = {"created_at", "updated_at"}
    indexes = [["tenant_id"], ["course"], ["semester"], ["code"]]

    def to_dict(self):
        objectives_list = []
        topics_list = []
        requirements_list = []

        if self.objectives:
            try:
                objectives_list = json.loads(self.objectives)
            except Exception:
                objectives_list = [o.strip() for o in str(self.objectives).split(",") if o.strip()]

        if self.topics:
            try:
                topics_list = json.loads(self.topics)
            except Exception:
                topics_list = []

        if self.requirements:
            try:
                requirements_list = json.loads(self.requirements)
            except Exception:
                requirements_list = []

        return {
            "id": self.id,
            "course": self.course,
            "subject": self.subject,
            "code": self.code,
            "instructor": self.instructor,
            "semester": self.semester,
            "academicYear": self.academic_year,
            "academic_year": self.academic_year,
            "units": self.units,
            "hours": self.hours,
            "description": self.description,
            "objectives": objectives_list,
            "topics": topics_list,
            "requirements": requirements_list,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Curriculum(BaseModel):
    """Curriculum model"""

    collection_name = "curriculum"
    schema = {
        "id": None,
        "course": None,
        "program": None,
        "year": None,
        "total_units": None,
        "semesters": None,
        "status": "Active",
        "tenant_id": None,
        "created_at": datetime.utcnow,
        "updated_at": datetime.utcnow,
    }
    datetime_fields = {"created_at", "updated_at"}
    indexes = [["tenant_id"], ["course"], ["year"]]

    def to_dict(self):
        semesters_list = []

        if self.semesters:
            try:
                semesters_list = json.loads(self.semesters)
            except Exception:
                semesters_list = []

        return {
            "id": self.id,
            "course": self.course,
            "program": self.program,
            "year": self.year,
            "totalUnits": self.total_units,
            "total_units": self.total_units,
            "semesters": semesters_list,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Lesson(BaseModel):
    """Lesson model"""

    collection_name = "lessons"
    schema = {
        "id": None,
        "syllabus_id": None,
        "title": None,
        "week": None,
        "duration": None,
        "type": "Lecture",
        "materials": None,
        "activities": None,
        "objectives": None,
        "status": "Published",
        "tenant_id": None,
        "created_at": datetime.utcnow,
        "updated_at": datetime.utcnow,
    }
    datetime_fields = {"created_at", "updated_at"}
    indexes = [["tenant_id"], ["syllabus_id"], ["week"], ["status"]]

    def to_dict(self):
        materials_list = []
        activities_list = []
        objectives_list = []

        if self.materials:
            try:
                materials_list = json.loads(self.materials)
            except Exception:
                materials_list = []

        if self.activities:
            try:
                activities_list = json.loads(self.activities)
            except Exception:
                activities_list = []

        if self.objectives:
            try:
                objectives_list = json.loads(self.objectives)
            except Exception:
                objectives_list = [o.strip() for o in str(self.objectives).split(",") if o.strip()]

        return {
            "id": self.id,
            "syllabus_id": self.syllabus_id,
            "title": self.title,
            "week": self.week,
            "duration": self.duration,
            "type": self.type,
            "materials": materials_list,
            "activities": activities_list,
            "objectives": objectives_list,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AuditLog(BaseModel):
    """Audit logs model for tracking system activities"""

    collection_name = "audit_logs"
    schema = {
        "id": None,
        "user_id": None,
        "username": None,
        "action": None,
        "entity_type": None,
        "entity_id": None,
        "entity_name": None,
        "details": None,
        "ip_address": None,
        "tenant_id": None,
        "created_at": datetime.utcnow,
    }
    datetime_fields = {"created_at"}
    indexes = [["tenant_id"], ["user_id"], ["action"], ["entity_type"], [("created_at", DESCENDING)]]

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "username": self.username,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "entity_name": self.entity_name,
            "details": self.details,
            "ip_address": self.ip_address,
            "tenant_id": self.tenant_id,
            "created_at": (
                self.created_at.replace(tzinfo=timezone.utc).isoformat()
                if self.created_at
                else None
            ),
        }


db = MongoDB()
