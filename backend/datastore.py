from __future__ import annotations

import base64
import copy
import json
from typing import Any

ASCENDING = 1
DESCENDING = -1


class _NoopEngine:
    def dispose(self) -> None:
        return None


def _matches_filter(document: dict[str, Any], filters: dict[str, Any] | None) -> bool:
    if not filters:
        return True

    for key, expected in filters.items():
        actual = document.get(key)
        if isinstance(expected, dict):
            if "$in" in expected:
                if actual not in expected["$in"]:
                    return False
                continue
            raise ValueError(f"Unsupported filter operator for {key!r}: {expected!r}")
        if actual != expected:
            return False
    return True


class InMemoryCollection:
    def __init__(self) -> None:
        self._documents: dict[str, dict[str, Any]] = {}

    def find(self, filters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return [
            copy.deepcopy(document)
            for document in self._documents.values()
            if _matches_filter(document, filters)
        ]

    def find_one(self, filters: dict[str, Any]) -> dict[str, Any] | None:
        for document in self._documents.values():
            if _matches_filter(document, filters):
                return copy.deepcopy(document)
        return None

    def replace_one(self, filters: dict[str, Any], payload: dict[str, Any], upsert: bool = False) -> None:
        existing = self.find_one(filters)
        if existing is None and not upsert:
            return

        document_id = payload.get("id")
        if document_id is None:
            document_id = filters.get("id")
        if document_id is None:
            raise ValueError("replace_one requires an id in the payload or filters")

        self._documents[str(document_id)] = copy.deepcopy(payload)

    def delete_one(self, filters: dict[str, Any]) -> None:
        existing = self.find_one(filters)
        if existing is None:
            return
        document_id = existing.get("id")
        if document_id is not None:
            self._documents.pop(str(document_id), None)

    def create_index(self, *_args, **_kwargs) -> None:
        return None

    def drop(self) -> None:
        self._documents.clear()


class FirestoreCollection:
    def __init__(self, client: Any, collection_name: str):
        self._collection = client.collection(collection_name)

    def _stream_all(self) -> list[dict[str, Any]]:
        documents: list[dict[str, Any]] = []
        for snapshot in self._collection.stream():
            payload = snapshot.to_dict() or {}
            documents.append(payload)
        return documents

    def find(self, filters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return [
            copy.deepcopy(document)
            for document in self._stream_all()
            if _matches_filter(document, filters)
        ]

    def find_one(self, filters: dict[str, Any]) -> dict[str, Any] | None:
        for document in self._stream_all():
            if _matches_filter(document, filters):
                return copy.deepcopy(document)
        return None

    def replace_one(self, filters: dict[str, Any], payload: dict[str, Any], upsert: bool = False) -> None:
        existing = self.find_one(filters)
        if existing is None and not upsert:
            return

        document_id = payload.get("id")
        if document_id is None:
            document_id = filters.get("id")
        if document_id is None:
            raise ValueError("replace_one requires an id in the payload or filters")

        self._collection.document(str(document_id)).set(copy.deepcopy(payload))

    def delete_one(self, filters: dict[str, Any]) -> None:
        existing = self.find_one(filters)
        if existing is None:
            return
        document_id = existing.get("id")
        if document_id is not None:
            self._collection.document(str(document_id)).delete()

    def create_index(self, *_args, **_kwargs) -> None:
        return None

    def drop(self) -> None:
        for document in self._collection.stream():
            document.reference.delete()


class FirestoreDocumentDB:
    def __init__(self):
        self.client = None
        self.session = None
        self.engine = _NoopEngine()
        self._collections: dict[str, InMemoryCollection] = {}
        self._mock_mode = False
        self._firestore_module = None
        self._database_id = None

    def init_app(self, app) -> None:
        self._mock_mode = bool(app.config.get("DB_MOCK", False))
        self._database_id = (app.config.get("FIREBASE_DATABASE_ID") or "").strip() or None

        if self._mock_mode:
            self.client = None
            self.create_all()
            return

        from firebase_admin import credentials, firestore, get_app, initialize_app

        self._firestore_module = firestore

        options = {}
        project_id = (app.config.get("FIREBASE_PROJECT_ID") or "").strip()
        if project_id:
            options["projectId"] = project_id

        credential = self._build_credential(
            credentials=credentials,
            service_account_json=(app.config.get("FIREBASE_SERVICE_ACCOUNT_JSON") or "").strip(),
            service_account_json_base64=(app.config.get("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64") or "").strip(),
            service_account_path=(app.config.get("FIREBASE_SERVICE_ACCOUNT_PATH") or "").strip(),
        )

        try:
            firebase_app = get_app()
        except ValueError:
            firebase_app = initialize_app(credential, options or None)

        client_kwargs = {"app": firebase_app}
        if self._database_id:
            client_kwargs["database_id"] = self._database_id
        self.client = firestore.client(**client_kwargs)
        self.create_all()

    def _build_credential(
        self,
        *,
        credentials,
        service_account_json: str,
        service_account_json_base64: str,
        service_account_path: str,
    ):
        if service_account_json:
            return credentials.Certificate(json.loads(service_account_json))

        if service_account_json_base64:
            decoded = base64.b64decode(service_account_json_base64).decode("utf-8")
            return credentials.Certificate(json.loads(decoded))

        if service_account_path:
            return credentials.Certificate(service_account_path)

        return credentials.ApplicationDefault()

    def get_collection(self, collection_name: str):
        if self._mock_mode:
            if collection_name not in self._collections:
                self._collections[collection_name] = InMemoryCollection()
            return self._collections[collection_name]

        if self.client is None:
            raise RuntimeError(
                "Firestore is not initialized. Set FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 "
                "or FIREBASE_SERVICE_ACCOUNT_PATH before starting the backend."
            )

        return FirestoreCollection(self.client, collection_name)

    def _counter_collection_name(self) -> str:
        return "meta_counters"

    def next_id(self, collection_name: str) -> int:
        if self._mock_mode:
            counters = self.get_collection(self._counter_collection_name())
            current = counters.find_one({"id": collection_name}) or {"id": collection_name, "seq": 0}
            next_value = int(current.get("seq", 0)) + 1
            counters.replace_one({"id": collection_name}, {"id": collection_name, "seq": next_value}, upsert=True)
            return next_value

        if self.client is None or self._firestore_module is None:
            raise RuntimeError("Firestore client is not initialized")

        counter_ref = self.client.collection(self._counter_collection_name()).document(collection_name)
        transaction = self.client.transaction()

        @self._firestore_module.transactional
        def increment(transaction_obj, doc_ref):
            snapshot = doc_ref.get(transaction=transaction_obj)
            payload = snapshot.to_dict() if snapshot.exists else {}
            next_value = int(payload.get("seq", 0)) + 1
            transaction_obj.set(doc_ref, {"seq": next_value})
            return next_value

        return int(increment(transaction, counter_ref))

    def set_counter(self, collection_name: str, value: int) -> None:
        if self._mock_mode:
            counters = self.get_collection(self._counter_collection_name())
            counters.replace_one({"id": collection_name}, {"id": collection_name, "seq": int(value)}, upsert=True)
            return

        if self.client is None:
            raise RuntimeError("Firestore client is not initialized")

        counter_ref = self.client.collection(self._counter_collection_name()).document(collection_name)
        counter_ref.set({"seq": int(value)})

    def create_all(self) -> None:
        return None

    def drop_all(self) -> None:
        from models import MODEL_REGISTRY

        for model in MODEL_REGISTRY:
            self.get_collection(model.collection_name).drop()
        self.get_collection(self._counter_collection_name()).drop()
        if self.session is not None:
            self.session.remove()
