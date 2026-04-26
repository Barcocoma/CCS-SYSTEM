from datetime import datetime

from flask import Blueprint, jsonify, request

from academic_defaults import COURSE_OPTIONS, SEMESTER_OPTIONS
from academic_logic import (
    build_faculty_assignment_options,
    cleanup_inactive_sections_and_schedules,
    count_students_in_section,
    ensure_schedule_offerings,
    get_schedule_conflict_details,
    list_sections,
    normalize_course,
    normalize_section,
    normalize_year_level,
    parse_meridiem_time,
    refresh_schedule_student_counts,
    schedule_matches_faculty,
)
from audit import log_audit_event
from authz import (
    get_request_actor,
    require_roles,
    resolve_actor_department,
    resolve_actor_faculty_profile,
    resolve_actor_student_profile,
    resolve_effective_role,
)
from models import Faculty, Schedule, Student, db

schedules_bp = Blueprint("schedules", __name__, url_prefix="/api/schedules")


def parse_bool(value):
    return str(value or "").strip().lower() in {"1", "true", "yes", "y"}


def count_matching_students(course, year_level=None, semester=None, section=None, tenant_id=None):
    normalized_course = normalize_course(course)
    normalized_year_level = normalize_year_level(year_level)
    normalized_semester = (semester or "").strip()
    normalized_section = normalize_section(section)

    if normalized_section:
        return count_students_in_section(
            course=normalized_course,
            year_level=normalized_year_level,
            semester=normalized_semester,
            section=normalized_section,
            tenant_id=tenant_id,
        )

    query = Student.query.filter(Student.course == normalized_course)
    if normalized_year_level:
        query = query.filter(Student.year_level == normalized_year_level)
    if normalized_semester:
        query = query.filter(Student.semester == normalized_semester)
    if tenant_id:
        query = query.filter(Student.tenant_id == tenant_id)
    return query.count()


def student_matches_schedule(student, schedule):
    if not student or not schedule:
        return False
    if normalize_course(schedule.course) != normalize_course(student.course):
        return False
    if schedule.year_level and normalize_year_level(schedule.year_level) != normalize_year_level(student.year_level):
        return False
    if getattr(student, "semester", None) and (schedule.semester or "").strip() and (schedule.semester or "").strip() != (student.semester or "").strip():
        return False
    if schedule.section and normalize_section(schedule.section) != normalize_section(student.section):
        return False
    return True


def validate_schedule_payload(payload, schedule_id=None):
    required_fields = ["course", "subject", "room", "day", "start_time", "end_time", "semester"]
    missing = [field for field in required_fields if not str(payload.get(field) or "").strip()]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"

    course = normalize_course(payload.get("course"))
    if course not in COURSE_OPTIONS:
        return "Course must be either BSIT or BSCS"

    semester = (payload.get("semester") or "").strip()
    if semester not in SEMESTER_OPTIONS:
        return "semester must be either 1st Semester or 2nd Semester"

    try:
        start_time = parse_meridiem_time(payload.get("start_time"))
        end_time = parse_meridiem_time(payload.get("end_time"))
    except ValueError:
        return "Times must use the format h:mm AM/PM"

    if end_time <= start_time:
        return "End time must be later than start time"

    year_level = normalize_year_level(payload.get("year_level"))
    section = normalize_section(payload.get("section"))
    if section and year_level:
        available_sections = list_sections(
            course=course,
            year_level=year_level,
            semester=semester,
            tenant_id=payload.get("tenant_id"),
            available_only=False,
        )
        if not any(normalize_section(item["section"]) == section for item in available_sections):
            return f"Section {section} has no enrolled students yet for {course} {year_level} {semester}"

    faculty_id = payload.get("faculty_id")
    if faculty_id is not None:
        faculty = Faculty.query.get(int(faculty_id))
        if not faculty:
            return "Selected faculty member was not found"
        if normalize_course(faculty.department) != course:
            return f"{faculty.first_name} {faculty.last_name} does not belong to the {course} department"

    conflicts = get_schedule_conflict_details(
        schedule_id=schedule_id,
        course=course,
        year_level=year_level,
        section=section,
        semester=semester,
        room=(payload.get("room") or "").strip(),
        day=(payload.get("day") or "").strip(),
        start_time=(payload.get("start_time") or "").strip(),
        end_time=(payload.get("end_time") or "").strip(),
        faculty_id=int(faculty_id) if faculty_id is not None else None,
    )
    if conflicts:
        return conflicts[0]

    return None


def build_schedule_payload(data, current_schedule=None):
    payload = {
        "course": normalize_course(data.get("course") if "course" in data else getattr(current_schedule, "course", None)),
        "subject_code": (data.get("subject_code") if "subject_code" in data else getattr(current_schedule, "subject_code", None) or "").strip() or None,
        "subject": (data.get("subject") if "subject" in data else getattr(current_schedule, "subject", None) or "").strip(),
        "room": (data.get("room") if "room" in data else getattr(current_schedule, "room", None) or "").strip(),
        "day": (data.get("day") if "day" in data else getattr(current_schedule, "day", None) or "").strip(),
        "start_time": (data.get("start_time") if "start_time" in data else getattr(current_schedule, "start_time", None) or "").strip(),
        "end_time": (data.get("end_time") if "end_time" in data else getattr(current_schedule, "end_time", None) or "").strip(),
        "year_level": normalize_year_level(data.get("year_level") if "year_level" in data else getattr(current_schedule, "year_level", None)),
        "section": normalize_section(data.get("section") if "section" in data else getattr(current_schedule, "section", None)),
        "semester": (data.get("semester") if "semester" in data else getattr(current_schedule, "semester", None) or "1st Semester").strip(),
        "units": data.get("units") if "units" in data else getattr(current_schedule, "units", None),
        "curriculum_year": (data.get("curriculum_year") if "curriculum_year" in data else getattr(current_schedule, "curriculum_year", None) or "").strip() or None,
        "tenant_id": (data.get("tenant_id") if "tenant_id" in data else getattr(current_schedule, "tenant_id", None) or "").strip() or None,
    }

    raw_faculty_id = data.get("faculty_id") if "faculty_id" in data else getattr(current_schedule, "faculty_id", None)
    if raw_faculty_id in ("", None):
        payload["faculty_id"] = None
    else:
        payload["faculty_id"] = int(raw_faculty_id)

    provided_instructor = data.get("instructor") if "instructor" in data else getattr(current_schedule, "instructor", None)
    payload["instructor"] = (provided_instructor or "").strip() or None

    if payload["faculty_id"] is not None:
        faculty = Faculty.query.get(payload["faculty_id"])
        if faculty:
            payload["instructor"] = " ".join(
                part for part in [faculty.first_name, faculty.middle_name, faculty.last_name] if part
            ).strip()

    payload["students"] = count_matching_students(
        course=payload["course"],
        year_level=payload["year_level"],
        semester=payload["semester"],
        section=payload["section"],
        tenant_id=payload["tenant_id"],
    )
    return payload


@schedules_bp.route("", methods=["GET"])
def get_schedules():
    """Get schedules with filtering and role-aware scoping."""
    try:
        tenant_id = (request.args.get("tenant_id") or "").strip() or None
        course = (request.args.get("course") or "").strip() or None
        day = (request.args.get("day") or "").strip() or None
        year_level = (request.args.get("year_level") or "").strip() or None
        section = (request.args.get("section") or "").strip() or None
        semester = (request.args.get("semester") or "").strip() or None
        assignment_status = (request.args.get("assignment_status") or "").strip() or None
        auto_sync = not request.args.get("sync") or parse_bool(request.args.get("sync"))

        if auto_sync and ensure_schedule_offerings(
            course=course,
            year_level=year_level,
            semester=semester,
            tenant_id=tenant_id,
        ):
            db.session.commit()

        actor = get_request_actor()
        actor_role = resolve_effective_role(actor)
        actor_student = resolve_actor_student_profile(actor) if actor_role == "STUDENT" else None
        actor_faculty = resolve_actor_faculty_profile(actor) if actor_role in {"FACULTY", "CHAIR"} else None
        actor_department = resolve_actor_department(actor) if actor_role == "CHAIR" else None

        query = Schedule.query
        if tenant_id:
            query = query.filter(Schedule.tenant_id == tenant_id)
        if course and course != "All Courses":
            query = query.filter(Schedule.course == normalize_course(course))
        if day and day != "All Days":
            query = query.filter(Schedule.day == day)
        if year_level:
            query = query.filter(Schedule.year_level == year_level)
        if section:
            query = query.filter(Schedule.section == normalize_section(section))
        if semester and semester != "All Semesters":
            query = query.filter(Schedule.semester == semester)

        schedules = query.order_by(Schedule.semester, Schedule.day, Schedule.start_time, Schedule.course, Schedule.section).all()

        if actor_role == "STUDENT":
            if not actor_student:
                return jsonify({"success": False, "message": "Student account is not linked to a student profile"}), 404
            schedules = [schedule for schedule in schedules if student_matches_schedule(actor_student, schedule)]
        elif actor_role == "FACULTY":
            if not actor_faculty:
                return jsonify({"success": True, "data": []})
            schedules = [schedule for schedule in schedules if schedule_matches_faculty(schedule, actor_faculty)]
        elif actor_role == "CHAIR":
            if not actor_department:
                return jsonify({"success": True, "data": []})
            schedules = [schedule for schedule in schedules if normalize_course(schedule.course) == normalize_course(actor_department)]

        if assignment_status == "Assigned":
            schedules = [schedule for schedule in schedules if schedule.faculty_id or schedule.instructor]
        elif assignment_status == "Unassigned":
            schedules = [schedule for schedule in schedules if not schedule.faculty_id and not schedule.instructor]

        return jsonify({"success": True, "data": [schedule.to_dict() for schedule in schedules]})
    except Exception as exc:
        db.session.rollback()
        return jsonify({"success": False, "message": str(exc)}), 500


@schedules_bp.route("/bootstrap", methods=["POST"])
@require_roles(["DEAN", "CHAIR", "SECRETARY"])
def bootstrap_schedules():
    try:
        payload = request.get_json(silent=True) or {}
        tenant_id = (payload.get("tenant_id") or "").strip() or None
        course = (payload.get("course") or "").strip() or None
        year_level = (payload.get("year_level") or "").strip() or None
        semester = (payload.get("semester") or "").strip() or None

        changed = ensure_schedule_offerings(course=course, year_level=year_level, semester=semester, tenant_id=tenant_id)
        changed = cleanup_inactive_sections_and_schedules(
            course,
            year_level,
            semester,
            payload.get("section"),
            tenant_id=tenant_id,
        ) or changed
        changed = refresh_schedule_student_counts(course, year_level, semester, payload.get("section"), tenant_id=tenant_id) or changed
        if changed:
            db.session.commit()

        return jsonify({"success": True, "message": "Curriculum schedules synced successfully"})
    except Exception as exc:
        db.session.rollback()
        return jsonify({"success": False, "message": str(exc)}), 500


@schedules_bp.route("/<int:schedule_id>/faculty-options", methods=["GET"])
def get_schedule_faculty_options(schedule_id):
    try:
        schedule = Schedule.query.get(schedule_id)
        if not schedule:
            return jsonify({"success": False, "message": "Schedule not found"}), 404

        options = build_faculty_assignment_options(schedule, tenant_id=schedule.tenant_id)
        return jsonify({"success": True, "data": options})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@schedules_bp.route("", methods=["POST"])
@require_roles(["DEAN", "CHAIR", "SECRETARY"])
def create_schedule():
    """Create a manual schedule or custom offering."""
    try:
        data = request.get_json(silent=True) or {}
        payload = build_schedule_payload(data)
        validation_error = validate_schedule_payload(payload)
        if validation_error:
            return jsonify({"success": False, "message": validation_error}), 400

        schedule = Schedule(**payload)
        db.session.add(schedule)
        db.session.commit()
        refresh_schedule_student_counts(
            schedule.course,
            schedule.year_level,
            schedule.semester,
            schedule.section,
            tenant_id=schedule.tenant_id,
        )
        db.session.commit()

        log_audit_event(
            "CREATE",
            "SCHEDULE",
            entity_id=schedule.id,
            entity_name=schedule.subject_code or schedule.subject,
            details={"course": schedule.course, "day": schedule.day, "semester": schedule.semester},
            req=request,
            tenant_id=schedule.tenant_id,
        )

        return jsonify(
            {
                "success": True,
                "message": "Schedule created successfully",
                "data": schedule.to_dict(),
            }
        ), 201
    except Exception as exc:
        db.session.rollback()
        return jsonify({"success": False, "message": str(exc)}), 500


@schedules_bp.route("/<int:schedule_id>", methods=["GET"])
def get_schedule(schedule_id):
    try:
        schedule = Schedule.query.get(schedule_id)
        if not schedule:
            return jsonify({"success": False, "message": "Schedule not found"}), 404
        return jsonify({"success": True, "data": schedule.to_dict()})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@schedules_bp.route("/<int:schedule_id>", methods=["PUT"])
@require_roles(["DEAN", "CHAIR", "SECRETARY"])
def update_schedule(schedule_id):
    try:
        schedule = Schedule.query.get(schedule_id)
        if not schedule:
            return jsonify({"success": False, "message": "Schedule not found"}), 404

        data = request.get_json(silent=True) or {}
        old_scope = (schedule.course, schedule.year_level, schedule.semester, schedule.section, schedule.tenant_id)
        payload = build_schedule_payload(data, current_schedule=schedule)
        validation_error = validate_schedule_payload(payload, schedule_id=schedule.id)
        if validation_error:
            return jsonify({"success": False, "message": validation_error}), 400

        schedule.course = payload["course"]
        schedule.subject_code = payload["subject_code"]
        schedule.subject = payload["subject"]
        schedule.instructor = payload["instructor"]
        schedule.faculty_id = payload["faculty_id"]
        schedule.room = payload["room"]
        schedule.day = payload["day"]
        schedule.start_time = payload["start_time"]
        schedule.end_time = payload["end_time"]
        schedule.students = payload["students"]
        schedule.year_level = payload["year_level"]
        schedule.section = payload["section"]
        schedule.semester = payload["semester"]
        schedule.units = payload["units"]
        schedule.curriculum_year = payload["curriculum_year"]
        schedule.tenant_id = payload["tenant_id"]
        schedule.updated_at = datetime.utcnow()

        db.session.commit()
        refreshed = False
        for course_value, year_value, semester_value, section_value, tenant_value in {
            old_scope,
            (schedule.course, schedule.year_level, schedule.semester, schedule.section, schedule.tenant_id),
        }:
            refreshed = cleanup_inactive_sections_and_schedules(
                course_value,
                year_value,
                semester_value,
                section_value,
                tenant_id=tenant_value,
            ) or refreshed
            refreshed = refresh_schedule_student_counts(
                course_value,
                year_value,
                semester_value,
                section_value,
                tenant_id=tenant_value,
            ) or refreshed
        if refreshed:
            db.session.commit()

        log_audit_event(
            "UPDATE",
            "SCHEDULE",
            entity_id=schedule.id,
            entity_name=schedule.subject_code or schedule.subject,
            details={"course": schedule.course, "day": schedule.day, "semester": schedule.semester},
            req=request,
            tenant_id=schedule.tenant_id,
        )

        return jsonify(
            {
                "success": True,
                "message": "Schedule updated successfully",
                "data": schedule.to_dict(),
            }
        )
    except Exception as exc:
        db.session.rollback()
        return jsonify({"success": False, "message": str(exc)}), 500


@schedules_bp.route("/<int:schedule_id>", methods=["DELETE"])
@require_roles(["DEAN", "CHAIR", "SECRETARY"])
def delete_schedule(schedule_id):
    try:
        schedule = Schedule.query.get(schedule_id)
        if not schedule:
            return jsonify({"success": False, "message": "Schedule not found"}), 404

        details = {"course": schedule.course, "day": schedule.day, "semester": schedule.semester}
        entity_name = schedule.subject_code or schedule.subject
        scope = (schedule.course, schedule.year_level, schedule.semester, schedule.section, schedule.tenant_id)
        db.session.delete(schedule)
        db.session.commit()
        changed = cleanup_inactive_sections_and_schedules(scope[0], scope[1], scope[2], scope[3], tenant_id=scope[4])
        if refresh_schedule_student_counts(scope[0], scope[1], scope[2], scope[3], tenant_id=scope[4]):
            changed = True
        if changed:
            db.session.commit()

        log_audit_event(
            "DELETE",
            "SCHEDULE",
            entity_id=schedule_id,
            entity_name=entity_name,
            details=details,
            req=request,
            tenant_id=schedule.tenant_id,
        )

        return jsonify({"success": True, "message": "Schedule deleted successfully"})
    except Exception as exc:
        db.session.rollback()
        return jsonify({"success": False, "message": str(exc)}), 500
