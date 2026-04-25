import os
import sys

from flask import Blueprint, jsonify, request

parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from academic_defaults import COURSE_OPTIONS, SECTION_CAPACITY
from academic_logic import ensure_default_sections, list_sections, normalize_course, normalize_section
from audit import log_audit_event
from authz import require_roles
from models import Section, db

sections_bp = Blueprint("sections", __name__, url_prefix="/api/sections")


def parse_bool(value):
    return str(value or "").strip().lower() in {"1", "true", "yes", "y"}


@sections_bp.route("", methods=["GET"])
def get_sections():
    tenant_id = (request.args.get("tenant_id") or "").strip() or None
    course = (request.args.get("course") or "").strip() or None
    year_level = (request.args.get("year_level") or "").strip() or None
    include_section = (request.args.get("include_section") or "").strip() or None
    student_record_id = request.args.get("student_record_id")
    available_only = parse_bool(request.args.get("available_only"))

    exclude_student_record_id = None
    if student_record_id and student_record_id.isdigit():
        exclude_student_record_id = int(student_record_id)

    ensure_default_sections(tenant_id=tenant_id)
    data = list_sections(
        course=course,
        year_level=year_level,
        tenant_id=tenant_id,
        available_only=available_only,
        exclude_student_record_id=exclude_student_record_id,
        include_section=include_section,
    )
    return jsonify({"success": True, "data": data})


@sections_bp.route("", methods=["POST"])
@require_roles(["DEAN", "CHAIR", "SECRETARY"])
def create_section():
    data = request.get_json(silent=True) or {}
    course = normalize_course(data.get("course"))
    year_level = (data.get("year_level") or "").strip()
    section_name = normalize_section(data.get("section") or data.get("name"))
    tenant_id = (data.get("tenant_id") or "").strip() or None

    if course not in COURSE_OPTIONS:
        return jsonify({"success": False, "message": "Course must be either BSIT or BSCS"}), 400
    if not year_level:
        return jsonify({"success": False, "message": "year_level is required"}), 400
    if not section_name:
        return jsonify({"success": False, "message": "section is required"}), 400

    try:
        capacity = int(data.get("capacity") or SECTION_CAPACITY)
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "capacity must be a valid number"}), 400

    if capacity <= 0:
        return jsonify({"success": False, "message": "capacity must be greater than zero"}), 400

    query = Section.query.filter(
        Section.course == course,
        Section.year_level == year_level,
        Section.name == section_name,
    )
    if tenant_id:
        query = query.filter(Section.tenant_id == tenant_id)
    existing = query.first()
    if existing:
        return jsonify({"success": False, "message": f"Section {section_name} already exists"}), 400

    section = Section(
        course=course,
        year_level=year_level,
        name=section_name,
        capacity=capacity,
        is_active=True,
        tenant_id=tenant_id,
    )
    db.session.add(section)
    db.session.commit()

    log_audit_event(
        "CREATE",
        "SECTION",
        entity_id=section.id,
        entity_name=f"{section.course} {section.year_level} Section {section.name}",
        details={"capacity": section.capacity},
        req=request,
        tenant_id=section.tenant_id,
    )
    return jsonify({"success": True, "message": "Section created successfully", "data": section.to_dict()}), 201
