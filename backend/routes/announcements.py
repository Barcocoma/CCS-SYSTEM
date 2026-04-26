import os
import sys

from flask import Blueprint, jsonify, request

parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from academic_logic import normalize_course, schedule_matches_faculty, section_key
from audit import log_audit_event
from authz import get_request_actor, require_roles, resolve_actor_faculty_profile, resolve_actor_student_profile, resolve_effective_role
from models import Announcement, Schedule, db

announcements_bp = Blueprint("announcements", __name__, url_prefix="/api/announcements")


def student_can_access_schedule(student, schedule):
    if not student or not schedule:
        return False
    if normalize_course(student.course) != normalize_course(schedule.course):
        return False
    if schedule.year_level and (schedule.year_level or "").strip() != (student.year_level or "").strip():
        return False
    if getattr(student, "semester", None) and (schedule.semester or "").strip() and (schedule.semester or "").strip() != (student.semester or "").strip():
        return False
    if schedule.section and (schedule.section or "").strip().upper() != (student.section or "").strip().upper():
        return False
    return True


def actor_can_access_schedule(actor, schedule):
    role = resolve_effective_role(actor)
    if role in {"DEAN", "SECRETARY"}:
        return True

    if role == "STUDENT":
        student = resolve_actor_student_profile(actor)
        return student_can_access_schedule(student, schedule)

    if role in {"FACULTY", "CHAIR"}:
        faculty = resolve_actor_faculty_profile(actor)
        return schedule_matches_faculty(schedule, faculty) if faculty else False

    return False


@announcements_bp.route("", methods=["GET"])
def get_announcements():
    try:
        actor = get_request_actor()
        schedule_id = request.args.get("schedule_id")
        query = Announcement.query

        if schedule_id and schedule_id.isdigit():
            schedule = Schedule.query.get(int(schedule_id))
            if not schedule:
                return jsonify({"success": False, "message": "Schedule not found"}), 404
            if actor and not actor_can_access_schedule(actor, schedule):
                return jsonify({"success": False, "message": "Forbidden"}), 403
            query = query.filter(Announcement.schedule_id == int(schedule_id))

        announcements = query.order_by(Announcement.created_at.desc()).all()

        if actor and not schedule_id:
            role = resolve_effective_role(actor)
            if role == "STUDENT":
                student = resolve_actor_student_profile(actor)
                if not student:
                    return jsonify({"success": False, "message": "Student account is not linked to a student profile"}), 404
                announcements = [
                    item
                    for item in announcements
                    if normalize_course(item.course) == normalize_course(student.course)
                    and (not item.year_level or (item.year_level or "").strip() == (student.year_level or "").strip())
                    and (not item.semester or (item.semester or "").strip() == (student.semester or "").strip())
                    and (not item.section or (item.section or "").strip().upper() == (student.section or "").strip().upper())
                ]
            elif role in {"FACULTY", "CHAIR"}:
                faculty = resolve_actor_faculty_profile(actor)
                if not faculty:
                    return jsonify({"success": True, "data": []})
                announcements = [
                    item
                    for item in announcements
                    if item.faculty_id == faculty.id
                    or item.schedule_id
                    and schedule_matches_faculty(Schedule.query.get(item.schedule_id), faculty)
                ]

        return jsonify({"success": True, "data": [item.to_dict() for item in announcements]})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@announcements_bp.route("", methods=["POST"])
@require_roles(["FACULTY", "CHAIR", "DEAN", "SECRETARY"])
def create_announcement():
    try:
        actor = get_request_actor()
        role = resolve_effective_role(actor)
        data = request.get_json(silent=True) or {}

        raw_schedule_id = data.get("schedule_id")
        if raw_schedule_id in ("", None):
            return jsonify({"success": False, "message": "schedule_id is required"}), 400

        try:
            schedule_id = int(raw_schedule_id)
        except (TypeError, ValueError):
            return jsonify({"success": False, "message": "schedule_id must be a valid number"}), 400

        title = (data.get("title") or "").strip()
        content = (data.get("content") or "").strip()
        if not title or not content:
            return jsonify({"success": False, "message": "title and content are required"}), 400

        schedule = Schedule.query.get(schedule_id)
        if not schedule:
            return jsonify({"success": False, "message": "Schedule not found"}), 404

        faculty_profile = resolve_actor_faculty_profile(actor) if role in {"FACULTY", "CHAIR"} else None
        if role == "FACULTY":
            if not faculty_profile or not schedule_matches_faculty(schedule, faculty_profile):
                return jsonify({"success": False, "message": "Faculty accounts can only post to their assigned schedules"}), 403

        faculty_id = faculty_profile.id if faculty_profile else schedule.faculty_id
        faculty_name = (
            " ".join(part for part in [faculty_profile.first_name, faculty_profile.middle_name, faculty_profile.last_name] if part).strip()
            if faculty_profile
            else (schedule.instructor or "Faculty")
        )

        announcement = Announcement(
            schedule_id=schedule.id,
            faculty_id=faculty_id,
            faculty_name=faculty_name,
            course=schedule.course,
            year_level=schedule.year_level,
            section=schedule.section,
            semester=schedule.semester,
            subject_code=schedule.subject_code,
            subject=schedule.subject,
            title=title,
            content=content,
            tenant_id=schedule.tenant_id,
        )
        db.session.add(announcement)
        db.session.commit()

        log_audit_event(
            "CREATE",
            "ANNOUNCEMENT",
            entity_id=announcement.id,
            entity_name=announcement.title,
            details={
                "schedule_id": announcement.schedule_id,
                "section_key": section_key(schedule.course, schedule.year_level, schedule.semester, schedule.section),
            },
            req=request,
            tenant_id=announcement.tenant_id,
        )
        return jsonify({"success": True, "message": "Announcement posted successfully", "data": announcement.to_dict()}), 201
    except Exception as exc:
        db.session.rollback()
        return jsonify({"success": False, "message": str(exc)}), 500


@announcements_bp.route("/<int:announcement_id>", methods=["DELETE"])
@require_roles(["FACULTY", "CHAIR", "DEAN", "SECRETARY"])
def delete_announcement(announcement_id):
    try:
        actor = get_request_actor()
        role = resolve_effective_role(actor)
        faculty_profile = resolve_actor_faculty_profile(actor) if role in {"FACULTY", "CHAIR"} else None

        announcement = Announcement.query.get(announcement_id)
        if not announcement:
            return jsonify({"success": False, "message": "Announcement not found"}), 404

        if role == "FACULTY" and faculty_profile and announcement.faculty_id != faculty_profile.id:
            return jsonify({"success": False, "message": "Faculty accounts can only delete their own announcements"}), 403

        entity_name = announcement.title
        tenant_id = announcement.tenant_id
        db.session.delete(announcement)
        db.session.commit()

        log_audit_event(
            "DELETE",
            "ANNOUNCEMENT",
            entity_id=announcement_id,
            entity_name=entity_name,
            details={"schedule_id": announcement.schedule_id},
            req=request,
            tenant_id=tenant_id,
        )
        return jsonify({"success": True, "message": "Announcement deleted successfully"})
    except Exception as exc:
        db.session.rollback()
        return jsonify({"success": False, "message": str(exc)}), 500
