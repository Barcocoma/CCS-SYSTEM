from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

from academic_defaults import (
    COURSE_OPTIONS,
    DEFAULT_CURRICULUM_YEAR,
    DEFAULT_SECTION_NAMES,
    ROOM_POOLS,
    SECTION_CAPACITY,
    SEMESTER_OPTIONS,
    TIME_BLOCKS,
    YEAR_LEVEL_OPTIONS,
    get_default_curriculum,
)
from models import Curriculum, Faculty, Schedule, Section, Student, db


ALLOWED_COURSES = {course.upper() for course in COURSE_OPTIONS}
ALLOWED_SEMESTERS = set(SEMESTER_OPTIONS)


def normalize_course(value: str | None) -> str:
    return (value or "").strip().upper()


def normalize_section(value: str | None) -> str:
    return (value or "").strip().upper()


def normalize_year_level(value: str | None) -> str:
    return (value or "").strip()


def normalize_semester(value: str | None) -> str:
    return (value or "").strip()


def parse_meridiem_time(value: str | None):
    return datetime.strptime((value or "").strip(), "%I:%M %p")


def times_overlap(start_one: str, end_one: str, start_two: str, end_two: str) -> bool:
    return parse_meridiem_time(start_one) < parse_meridiem_time(end_two) and parse_meridiem_time(start_two) < parse_meridiem_time(end_one)


def slot_key(day: str | None, start_time: str | None, end_time: str | None) -> str:
    return f"{(day or '').strip()}|{(start_time or '').strip()}|{(end_time or '').strip()}"


def section_key(course: str | None, year_level: str | None, section: str | None) -> str:
    return f"{normalize_course(course)}|{normalize_year_level(year_level)}|{normalize_section(section)}"


def serialize_curriculum_semesters(value: Any) -> str:
    if isinstance(value, str):
        return value
    return json.dumps(normalize_curriculum_terms(value or []))


def _extract_term_metadata(term: dict[str, Any]) -> tuple[str, str]:
    raw_year_level = normalize_year_level(term.get("year_level"))
    raw_semester = normalize_semester(term.get("semester"))
    raw_term_label = normalize_year_level(term.get("term_label"))
    combined = " ".join(part for part in [raw_year_level, raw_semester, raw_term_label] if part)

    if not raw_year_level and combined:
        for candidate in YEAR_LEVEL_OPTIONS:
            if candidate.lower() in combined.lower():
                raw_year_level = candidate
                break
        if not raw_year_level:
            year_match = re.search(r"\b([1-4](?:st|nd|rd|th)\s+Year)\b", combined, re.IGNORECASE)
            if year_match:
                raw_year_level = year_match.group(1).title()

    if raw_semester not in ALLOWED_SEMESTERS and combined:
        for candidate in SEMESTER_OPTIONS:
            if candidate.lower() in combined.lower():
                raw_semester = candidate
                break

    return raw_year_level, raw_semester


def normalize_curriculum_subject(subject: Any) -> dict[str, Any]:
    if not isinstance(subject, dict):
        return {}

    prerequisites = subject.get("prerequisites") or []
    if not isinstance(prerequisites, list):
        prerequisites = [item.strip() for item in str(prerequisites).split(",") if item.strip()]

    units = subject.get("units")
    try:
        units = int(units)
    except (TypeError, ValueError):
        units = 0

    return {
        "code": (subject.get("code") or "").strip(),
        "name": (subject.get("name") or subject.get("subject") or "").strip(),
        "units": units,
        "room_preference": (subject.get("room_preference") or "CLASSROOM").strip() or "CLASSROOM",
        "prerequisites": prerequisites,
    }


def normalize_curriculum_term(term: Any) -> dict[str, Any]:
    if not isinstance(term, dict):
        return {}

    year_level, semester = _extract_term_metadata(term)
    subjects = [
        normalized_subject
        for normalized_subject in (normalize_curriculum_subject(subject) for subject in (term.get("subjects") or []))
        if normalized_subject.get("code") or normalized_subject.get("name")
    ]

    total_units = term.get("total_units")
    try:
        total_units = int(total_units)
    except (TypeError, ValueError):
        total_units = sum(subject.get("units") or 0 for subject in subjects)

    return {
        "year_level": year_level,
        "semester": semester,
        "term_label": (term.get("term_label") or f"{year_level} - {semester}").strip(" -"),
        "total_units": total_units,
        "subjects": subjects,
    }


def normalize_curriculum_terms(terms: Any) -> list[dict[str, Any]]:
    if not isinstance(terms, list):
        return []

    normalized_terms = []
    for term in terms:
        normalized_term = normalize_curriculum_term(term)
        if not normalized_term.get("subjects"):
            continue
        normalized_terms.append(normalized_term)
    return normalized_terms


def parse_curriculum_semesters(value: Any) -> list[dict[str, Any]]:
    if not value:
        return []
    if isinstance(value, list):
        return normalize_curriculum_terms(value)
    try:
        parsed = json.loads(value)
        return normalize_curriculum_terms(parsed if isinstance(parsed, list) else [])
    except Exception:
        return []


def get_active_curriculum(course: str | None, tenant_id: str | None = None) -> Curriculum | None:
    normalized_course = normalize_course(course)
    if not normalized_course:
        return None

    query = Curriculum.query.filter(Curriculum.course == normalized_course)
    if tenant_id:
        query = query.filter(Curriculum.tenant_id == tenant_id)

    matching = query.order_by(Curriculum.updated_at.desc(), Curriculum.created_at.desc()).all()
    if not matching:
        return None

    active = [item for item in matching if (item.status or "").strip().lower() == "active"]
    preferred = active or matching

    default_year_match = next((item for item in preferred if str(item.year or "").strip() == DEFAULT_CURRICULUM_YEAR), None)
    return default_year_match or preferred[0]


def get_term_subjects(curriculum: Curriculum | None, year_level: str | None, semester: str | None) -> list[dict[str, Any]]:
    if not curriculum:
        return []

    target_year_level = normalize_year_level(year_level)
    target_semester = (semester or "").strip()

    for term in parse_curriculum_semesters(curriculum.semesters):
        if normalize_year_level(term.get("year_level")) != target_year_level:
            continue
        if (term.get("semester") or "").strip() != target_semester:
            continue
        subjects = term.get("subjects") or []
        return subjects if isinstance(subjects, list) else []
    return []


def ensure_default_curricula(tenant_id: str | None = None) -> bool:
    changed = False
    for course in COURSE_OPTIONS:
        default_payload = get_default_curriculum(course)
        if not default_payload:
            continue

        query = Curriculum.query.filter(Curriculum.course == course)
        if tenant_id:
            query = query.filter(Curriculum.tenant_id == tenant_id)

        curriculum = query.filter(Curriculum.year == DEFAULT_CURRICULUM_YEAR).first()
        if curriculum:
            updated = False
            if not curriculum.program:
                curriculum.program = default_payload["program"]
                updated = True
            if not curriculum.semesters:
                curriculum.semesters = serialize_curriculum_semesters(default_payload["semesters"])
                updated = True
            if not curriculum.total_units:
                curriculum.total_units = sum(term["total_units"] for term in default_payload["semesters"])
                updated = True
            if not curriculum.status:
                curriculum.status = "Active"
                updated = True
            if updated:
                changed = True
            continue

        curriculum = Curriculum(
            course=course,
            program=default_payload["program"],
            year=DEFAULT_CURRICULUM_YEAR,
            total_units=sum(term["total_units"] for term in default_payload["semesters"]),
            semesters=serialize_curriculum_semesters(default_payload["semesters"]),
            status="Active",
            tenant_id=tenant_id,
        )
        db.session.add(curriculum)
        changed = True
    return changed


def ensure_default_sections(tenant_id: str | None = None) -> bool:
    changed = False
    for course in COURSE_OPTIONS:
        for year_level in ("1st Year", "2nd Year", "3rd Year", "4th Year"):
            for name in DEFAULT_SECTION_NAMES:
                query = Section.query.filter(
                    Section.course == course,
                    Section.year_level == year_level,
                    Section.name == name,
                )
                if tenant_id:
                    query = query.filter(Section.tenant_id == tenant_id)
                if query.first():
                    continue

                db.session.add(
                    Section(
                        course=course,
                        year_level=year_level,
                        name=name,
                        capacity=SECTION_CAPACITY,
                        is_active=True,
                        tenant_id=tenant_id,
                    )
                )
                changed = True
    return changed


def count_students_in_section(
    course: str | None,
    year_level: str | None,
    section: str | None,
    tenant_id: str | None = None,
    exclude_student_record_id: int | None = None,
) -> int:
    query = Student.query.filter(Student.course == normalize_course(course))

    normalized_year_level = normalize_year_level(year_level)
    if normalized_year_level:
        query = query.filter(Student.year_level == normalized_year_level)

    if tenant_id:
        query = query.filter(Student.tenant_id == tenant_id)

    students = query.all()
    normalized_section = normalize_section(section)
    filtered = [
        student
        for student in students
        if normalize_section(student.section) == normalized_section
        and (exclude_student_record_id is None or student.id != exclude_student_record_id)
    ]
    return len(filtered)


def get_section_snapshot(
    section: Section,
    tenant_id: str | None = None,
    exclude_student_record_id: int | None = None,
) -> dict[str, Any]:
    enrolled = count_students_in_section(
        course=section.course,
        year_level=section.year_level,
        section=section.name,
        tenant_id=tenant_id or section.tenant_id,
        exclude_student_record_id=exclude_student_record_id,
    )
    capacity = int(section.capacity or SECTION_CAPACITY)
    remaining = max(0, capacity - enrolled)
    return {
        "id": section.id,
        "course": section.course,
        "year_level": section.year_level,
        "section": section.name,
        "name": section.name,
        "capacity": capacity,
        "enrolled": enrolled,
        "remaining_slots": remaining,
        "is_full": remaining <= 0,
        "is_active": bool(section.is_active),
        "created_at": section.created_at.isoformat() if section.created_at else None,
        "updated_at": section.updated_at.isoformat() if section.updated_at else None,
    }


def list_sections(
    course: str | None = None,
    year_level: str | None = None,
    tenant_id: str | None = None,
    available_only: bool = False,
    exclude_student_record_id: int | None = None,
    include_section: str | None = None,
) -> list[dict[str, Any]]:
    query = Section.query
    normalized_course = normalize_course(course)
    normalized_year_level = normalize_year_level(year_level)
    normalized_include_section = normalize_section(include_section)

    if normalized_course:
        query = query.filter(Section.course == normalized_course)
    if normalized_year_level:
        query = query.filter(Section.year_level == normalized_year_level)
    if tenant_id:
        query = query.filter(Section.tenant_id == tenant_id)

    sections = query.order_by(Section.course, Section.year_level, Section.name).all()
    snapshots = [
        get_section_snapshot(section, tenant_id=tenant_id, exclude_student_record_id=exclude_student_record_id)
        for section in sections
        if bool(section.is_active)
    ]

    if not available_only:
        return snapshots

    return [
        item
        for item in snapshots
        if not item["is_full"] or normalize_section(item["section"]) == normalized_include_section
    ]


def validate_student_section_availability(
    course: str | None,
    year_level: str | None,
    section: str | None,
    tenant_id: str | None = None,
    current_student_id: int | None = None,
) -> str | None:
    normalized_course = normalize_course(course)
    normalized_year_level = normalize_year_level(year_level)
    normalized_section = normalize_section(section)

    if normalized_course not in ALLOWED_COURSES:
        return "Course must be either BSIT or BSCS"
    if not normalized_year_level:
        return "year_level is required"
    if not normalized_section:
        return "section is required"

    available_sections = list_sections(
        course=normalized_course,
        year_level=normalized_year_level,
        tenant_id=tenant_id,
        available_only=True,
        exclude_student_record_id=current_student_id,
        include_section=normalized_section if current_student_id is not None else None,
    )

    if any(normalize_section(item["section"]) == normalized_section for item in available_sections):
        return None

    existing_sections = list_sections(
        course=normalized_course,
        year_level=normalized_year_level,
        tenant_id=tenant_id,
    )
    if not any(normalize_section(item["section"]) == normalized_section for item in existing_sections):
        return f"Section {normalized_section} is not configured for {normalized_course} {normalized_year_level}"

    return f"Section {normalized_section} is already full"


def refresh_schedule_student_counts(
    course: str | None = None,
    year_level: str | None = None,
    section: str | None = None,
    tenant_id: str | None = None,
) -> bool:
    query = Schedule.query
    normalized_course = normalize_course(course)
    normalized_year_level = normalize_year_level(year_level)
    normalized_section = normalize_section(section)

    if normalized_course:
        query = query.filter(Schedule.course == normalized_course)
    if normalized_year_level:
        query = query.filter(Schedule.year_level == normalized_year_level)
    if normalized_section:
        query = query.filter(Schedule.section == normalized_section)
    if tenant_id:
        query = query.filter(Schedule.tenant_id == tenant_id)

    changed = False
    for schedule in query.all():
        student_count = count_students_in_section(
            course=schedule.course,
            year_level=schedule.year_level,
            section=schedule.section,
            tenant_id=schedule.tenant_id,
        )
        if int(schedule.students or 0) != student_count:
            schedule.students = student_count
            changed = True
    return changed


def schedule_matches_faculty(schedule: Schedule, faculty: Faculty) -> bool:
    if not schedule or not faculty:
        return False

    if schedule.faculty_id and faculty.id and int(schedule.faculty_id) == int(faculty.id):
        return True

    instructor = (schedule.instructor or "").lower()
    employee_number = (faculty.employee_number or "").lower()
    tokens = [faculty.first_name, faculty.middle_name, faculty.last_name]
    tokens = [token.lower() for token in tokens if token]

    if employee_number and employee_number in instructor:
        return True
    return bool(tokens) and all(token in instructor for token in tokens)


def get_schedule_conflict_details(
    *,
    schedule_id: int | None = None,
    course: str,
    year_level: str | None,
    section: str | None,
    semester: str | None,
    room: str,
    day: str,
    start_time: str,
    end_time: str,
    faculty_id: int | None = None,
) -> list[str]:
    conflicts: list[str] = []
    query = Schedule.query.filter(Schedule.day == day)
    if semester:
        query = query.filter(Schedule.semester == semester)

    for existing in query.all():
        if schedule_id is not None and existing.id == schedule_id:
            continue
        if not times_overlap(start_time, end_time, existing.start_time, existing.end_time):
            continue

        if (existing.room or "").strip().lower() == room.strip().lower():
            conflicts.append(
                f"Room conflict: {room} is already used by {existing.subject_code or existing.subject} "
                f"for {existing.course} {existing.year_level} Section {existing.section}."
            )

        if (
            normalize_course(existing.course) == normalize_course(course)
            and normalize_year_level(existing.year_level) == normalize_year_level(year_level)
            and normalize_section(existing.section) == normalize_section(section)
        ):
            conflicts.append(
                f"Section conflict: {course} {year_level} Section {section} already has "
                f"{existing.subject_code or existing.subject} at this time."
            )

        if faculty_id and existing.faculty_id and int(existing.faculty_id) == int(faculty_id):
            conflicts.append(
                f"Faculty conflict: this instructor already handles "
                f"{existing.subject_code or existing.subject} for {existing.course} {existing.year_level} "
                f"Section {existing.section} at this time."
            )

    return conflicts


def build_faculty_assignment_options(schedule: Schedule, tenant_id: str | None = None) -> list[dict[str, Any]]:
    query = Faculty.query.filter(Faculty.department == normalize_course(schedule.course))
    if tenant_id:
        query = query.filter(Faculty.tenant_id == tenant_id)

    options = []
    for faculty in query.order_by(Faculty.last_name, Faculty.first_name).all():
        full_name = " ".join(part for part in [faculty.first_name, faculty.middle_name, faculty.last_name] if part).strip()
        label = f"{full_name} ({faculty.employee_number})".strip()
        conflicts = get_schedule_conflict_details(
            schedule_id=schedule.id,
            course=schedule.course,
            year_level=schedule.year_level,
            section=schedule.section,
            semester=schedule.semester,
            room=schedule.room,
            day=schedule.day,
            start_time=schedule.start_time,
            end_time=schedule.end_time,
            faculty_id=faculty.id,
        )
        options.append(
            {
                "faculty_id": faculty.id,
                "employee_number": faculty.employee_number,
                "department": faculty.department,
                "label": label,
                "name": full_name,
                "available": len(conflicts) == 0,
                "reason": conflicts[0] if conflicts else "",
            }
        )
    return options


def _seed_value(*parts: str) -> int:
    return sum(ord(char) for part in parts for char in (part or ""))


def _rotate(items: list[Any], seed: int) -> list[Any]:
    if not items:
        return []
    pivot = seed % len(items)
    return items[pivot:] + items[:pivot]


def _choose_schedule_slot(
    *,
    course: str,
    year_level: str,
    section: str,
    semester: str,
    room_preference: str,
    used_section_slots: dict[str, set[str]],
    used_room_slots: dict[str, set[str]],
) -> dict[str, str]:
    section_identifier = section_key(course, year_level, section)
    section_seed = _seed_value(course, year_level, section, semester)
    slot_order = _rotate(list(TIME_BLOCKS), section_seed)

    preferred_rooms = list(ROOM_POOLS.get(room_preference, ROOM_POOLS["CLASSROOM"]))
    fallback_rooms = [room for pool in ROOM_POOLS.values() for room in pool if room not in preferred_rooms]
    room_order = _rotate(preferred_rooms + fallback_rooms, section_seed)

    for block in slot_order:
        current_slot_key = slot_key(block["day"], block["start_time"], block["end_time"])
        if current_slot_key in used_section_slots.setdefault(section_identifier, set()):
            continue

        for room in room_order:
            if current_slot_key in used_room_slots.setdefault(room, set()):
                continue
            used_section_slots[section_identifier].add(current_slot_key)
            used_room_slots[room].add(current_slot_key)
            return {
                "day": block["day"],
                "start_time": block["start_time"],
                "end_time": block["end_time"],
                "room": room,
            }

    raise RuntimeError(f"Unable to allocate a schedule slot for {course} {year_level} Section {section} ({semester})")


def ensure_schedule_offerings(
    *,
    course: str | None = None,
    year_level: str | None = None,
    semester: str | None = None,
    tenant_id: str | None = None,
) -> bool:
    changed = False
    changed = ensure_default_curricula(tenant_id=tenant_id) or changed
    changed = ensure_default_sections(tenant_id=tenant_id) or changed

    query = Section.query.filter(Section.is_active == True)  # noqa: E712
    normalized_course = normalize_course(course)
    normalized_year_level = normalize_year_level(year_level)
    normalized_semester = (semester or "").strip()

    if normalized_course:
        query = query.filter(Section.course == normalized_course)
    if normalized_year_level:
        query = query.filter(Section.year_level == normalized_year_level)
    if tenant_id:
        query = query.filter(Section.tenant_id == tenant_id)

    sections = query.order_by(Section.course, Section.year_level, Section.name).all()
    if not sections:
        return changed

    existing_query = Schedule.query
    if normalized_course:
        existing_query = existing_query.filter(Schedule.course == normalized_course)
    if normalized_year_level:
        existing_query = existing_query.filter(Schedule.year_level == normalized_year_level)
    if normalized_semester:
        existing_query = existing_query.filter(Schedule.semester == normalized_semester)
    if tenant_id:
        existing_query = existing_query.filter(Schedule.tenant_id == tenant_id)
    existing_schedules = existing_query.all()

    schedule_lookup = {
        (
            normalize_course(item.course),
            normalize_year_level(item.year_level),
            normalize_section(item.section),
            (item.semester or "").strip(),
            (item.subject_code or "").strip() or (item.subject or "").strip(),
        ): item
        for item in existing_schedules
    }

    used_section_slots: dict[str, set[str]] = {}
    used_room_slots: dict[str, set[str]] = {}
    for existing in existing_schedules:
        if normalized_semester and (existing.semester or "").strip() != normalized_semester:
            continue
        current_slot_key = slot_key(existing.day, existing.start_time, existing.end_time)
        used_section_slots.setdefault(section_key(existing.course, existing.year_level, existing.section), set()).add(current_slot_key)
        used_room_slots.setdefault(existing.room, set()).add(current_slot_key)

    for section_record in sections:
        curriculum = get_active_curriculum(section_record.course, tenant_id=section_record.tenant_id)
        if not curriculum:
            continue

        terms = parse_curriculum_semesters(curriculum.semesters)
        for term in terms:
            term_year_level = normalize_year_level(term.get("year_level"))
            term_semester = (term.get("semester") or "").strip()
            if term_year_level != normalize_year_level(section_record.year_level):
                continue
            if normalized_semester and term_semester != normalized_semester:
                continue

            subjects = term.get("subjects") or []
            for subject in subjects:
                subject_code = (subject.get("code") or "").strip() or (subject.get("name") or "").strip()
                lookup_key = (
                    normalize_course(section_record.course),
                    normalize_year_level(section_record.year_level),
                    normalize_section(section_record.name),
                    term_semester,
                    subject_code,
                )
                existing = schedule_lookup.get(lookup_key)
                if existing:
                    updated = False
                    if not existing.subject:
                        existing.subject = subject.get("name")
                        updated = True
                    if not existing.subject_code:
                        existing.subject_code = subject_code
                        updated = True
                    if not existing.semester:
                        existing.semester = term_semester
                        updated = True
                    if not existing.units:
                        existing.units = subject.get("units")
                        updated = True
                    if not existing.curriculum_year:
                        existing.curriculum_year = curriculum.year
                        updated = True
                    if not existing.room or not existing.day or not existing.start_time or not existing.end_time:
                        slot = _choose_schedule_slot(
                            course=section_record.course,
                            year_level=section_record.year_level,
                            section=section_record.name,
                            semester=term_semester,
                            room_preference=subject.get("room_preference") or "CLASSROOM",
                            used_section_slots=used_section_slots,
                            used_room_slots=used_room_slots,
                        )
                        existing.room = slot["room"]
                        existing.day = slot["day"]
                        existing.start_time = slot["start_time"]
                        existing.end_time = slot["end_time"]
                        updated = True
                    if updated:
                        changed = True
                    continue

                slot = _choose_schedule_slot(
                    course=section_record.course,
                    year_level=section_record.year_level,
                    section=section_record.name,
                    semester=term_semester,
                    room_preference=subject.get("room_preference") or "CLASSROOM",
                    used_section_slots=used_section_slots,
                    used_room_slots=used_room_slots,
                )
                db.session.add(
                    Schedule(
                        course=section_record.course,
                        subject=subject.get("name"),
                        subject_code=subject_code,
                        instructor=None,
                        faculty_id=None,
                        room=slot["room"],
                        day=slot["day"],
                        start_time=slot["start_time"],
                        end_time=slot["end_time"],
                        students=count_students_in_section(
                            section_record.course,
                            section_record.year_level,
                            section_record.name,
                            tenant_id=section_record.tenant_id,
                        ),
                        year_level=section_record.year_level,
                        section=section_record.name,
                        semester=term_semester,
                        units=subject.get("units"),
                        curriculum_year=curriculum.year,
                        tenant_id=section_record.tenant_id,
                    )
                )
                changed = True
    return changed
