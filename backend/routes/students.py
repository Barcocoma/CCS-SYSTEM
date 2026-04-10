from datetime import datetime
import os
import sys

from flask import Blueprint, jsonify, request

# Add parent directory to path for imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from audit import log_audit_event
from authz import get_request_actor, require_roles, resolve_actor_department, resolve_effective_role
from models import (
    Student,
    StudentAcademicHistory,
    StudentAffiliation,
    StudentNonAcademicActivity,
    StudentSkill,
    StudentViolation,
    User,
    db,
    or_,
)

students_bp = Blueprint('students', __name__, url_prefix='/api/students')


def normalize_filter(value):
    if not value:
        return None
    stripped = value.strip()
    if not stripped or stripped.lower().startswith('all '):
        return None
    return stripped


def resolve_actor_scope():
    actor = get_request_actor()
    actor_role = resolve_effective_role(actor)
    department = resolve_actor_department(actor) if actor_role == 'CHAIR' else None
    return actor_role, department


def resolve_actor_student_profile(actor=None):
    actor = actor or get_request_actor()
    if not actor:
        return None

    lookup_tokens = {
        (actor.email or '').strip(),
        (actor.username or '').strip(),
    }

    for token in lookup_tokens:
        if not token:
            continue

        query = Student.query
        if actor.tenant_id:
            query = query.filter(Student.tenant_id == actor.tenant_id)

        profile = query.filter(
            or_(
                Student.student_id.ilike(token),
                Student.email.ilike(token),
            )
        ).first()
        if profile:
            return profile
    return None


def same_course(left, right):
    return (left or '').strip().upper() == (right or '').strip().upper()


def parse_birthday(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError as exc:
        raise ValueError('birthday must be YYYY-MM-DD') from exc


def normalize_account_identifier(value):
    return (value or '').strip()


def build_student_user_account(student_number, birthday, tenant_id):
    account_identifier = normalize_account_identifier(student_number)
    if not account_identifier:
        raise ValueError('student_id is required to create an account')

    if User.query.filter(User.email.ilike(account_identifier)).first():
        raise ValueError('A user account with this student ID already exists')

    if User.query.filter(User.username.ilike(account_identifier)).first():
        raise ValueError('A username with this student ID already exists')

    if not birthday:
        raise ValueError('birthday is required to create an account')

    account = User(
        username=account_identifier,
        email=account_identifier,
        role='STUDENT',
        tenant_id=tenant_id,
    )
    account.set_password(birthday.isoformat())
    return account


def validate_student_payload(data, is_update=False, current_student=None):
    required_fields = ['student_id', 'first_name', 'last_name', 'birthday', 'course', 'year_level']
    if not is_update:
        missing = [field for field in required_fields if not (data.get(field) or '').strip()]
        if missing:
            return f"Missing required fields: {', '.join(missing)}"

    student_number = (data.get('student_id') or '').strip()
    if student_number:
        existing = Student.query.filter_by(student_id=student_number).first()
        if existing and (not current_student or existing.id != current_student.id):
            return 'Student ID already exists'

    return None


@students_bp.route('', methods=['GET'])
def get_students():
    """Get students with optional filters for search, course, year level, section, skill, activity, and affiliation."""
    actor = get_request_actor()
    actor_role = resolve_effective_role(actor)
    chair_department = resolve_actor_department(actor) if actor_role == 'CHAIR' else None
    tenant_id = normalize_filter(request.args.get('tenant_id'))
    search = normalize_filter(request.args.get('search'))
    course = normalize_filter(request.args.get('course'))
    year_level = normalize_filter(request.args.get('year_level'))
    section = normalize_filter(request.args.get('section'))
    skill = normalize_filter(request.args.get('skill'))
    activity = normalize_filter(request.args.get('activity'))
    affiliation = normalize_filter(request.args.get('affiliation'))

    query = Student.query

    if actor_role == 'STUDENT':
        profile = resolve_actor_student_profile(actor)
        if not profile:
            return jsonify({'success': False, 'message': 'Student account is not linked to a student profile'}), 404

        if profile.course:
            query = query.filter(Student.course == profile.course)
        if profile.year_level:
            query = query.filter(Student.year_level == profile.year_level)
        if profile.section:
            query = query.filter(Student.section.ilike(profile.section))
        if profile.tenant_id:
            query = query.filter(Student.tenant_id == profile.tenant_id)

    if actor_role == 'CHAIR':
        if not chair_department:
            return jsonify({'success': True, 'data': []})
        query = query.filter(Student.course == chair_department)

    if tenant_id:
        query = query.filter(Student.tenant_id == tenant_id)

    if course:
        query = query.filter(Student.course == course)

    if year_level:
        query = query.filter(Student.year_level == year_level)

    if section:
        query = query.filter(Student.section.ilike(section))

    if search:
        search_term = f'%{search}%'
        query = query.filter(
            or_(
                Student.student_id.ilike(search_term),
                Student.first_name.ilike(search_term),
                Student.last_name.ilike(search_term),
                Student.middle_name.ilike(search_term),
                Student.email.ilike(search_term),
                Student.contact_number.ilike(search_term),
                Student.course.ilike(search_term),
                Student.section.ilike(search_term),
            )
        )

    if skill:
        query = query.join(StudentSkill).filter(StudentSkill.skill_name.ilike(f'%{skill}%'))

    if activity:
        activity_term = f'%{activity}%'
        query = query.join(StudentNonAcademicActivity).filter(
            or_(
                StudentNonAcademicActivity.activity_name.ilike(activity_term),
                StudentNonAcademicActivity.activity_type.ilike(activity_term),
            )
        )

    if affiliation:
        affiliation_term = f'%{affiliation}%'
        query = query.join(StudentAffiliation).filter(
            or_(
                StudentAffiliation.name.ilike(affiliation_term),
                StudentAffiliation.category.ilike(affiliation_term),
                StudentAffiliation.role.ilike(affiliation_term),
            )
        )

    students = query.distinct().order_by(Student.last_name, Student.first_name).all()
    return jsonify({'success': True, 'data': [student.to_dict() for student in students]})


@students_bp.route('/me', methods=['GET'])
@require_roles(['STUDENT'])
def get_my_student_profile():
    actor = get_request_actor()
    student_profile = resolve_actor_student_profile(actor)
    if not student_profile:
        return jsonify({'success': False, 'message': 'Student account is not linked to a student profile'}), 404
    return jsonify({'success': True, 'data': student_profile.to_dict()})


@students_bp.route('', methods=['POST'])
@require_roles(['DEAN', 'CHAIR', 'SECRETARY'])
def create_student():
    """Create a new student."""
    data = request.get_json(silent=True) or {}
    actor_role, chair_department = resolve_actor_scope()

    if actor_role == 'CHAIR':
        if not chair_department:
            return jsonify({'success': False, 'message': 'Chair account is not linked to any department'}), 403
        requested_course = (data.get('course') or '').strip()
        if requested_course and not same_course(requested_course, chair_department):
            return jsonify({'success': False, 'message': f'Chair accounts can only manage {chair_department} students'}), 403
        data['course'] = chair_department

    validation_error = validate_student_payload(data)
    if validation_error:
        return jsonify({'success': False, 'message': validation_error}), 400

    try:
        student_number = data.get('student_id', '').strip()
        birthday = parse_birthday((data.get('birthday') or '').strip())
        tenant_id = (data.get('tenant_id') or '').strip() or None

        account = build_student_user_account(student_number, birthday, tenant_id)

        student = Student(
            student_id=student_number,
            first_name=data.get('first_name', '').strip(),
            last_name=data.get('last_name', '').strip(),
            middle_name=(data.get('middle_name') or '').strip() or None,
            birthday=birthday,
            email=(data.get('email') or '').strip() or None,
            contact_number=(data.get('contact_number') or '').strip() or None,
            course=(data.get('course') or '').strip() or None,
            year_level=(data.get('year_level') or '').strip() or None,
            section=(data.get('section') or '').strip() or None,
            enrollment_status=(data.get('enrollment_status') or 'Enrolled').strip(),
            tenant_id=tenant_id,
        )
        db.session.add(account)
        db.session.add(student)
        db.session.commit()

        log_audit_event(
            'CREATE',
            'USER',
            entity_id=account.id,
            entity_name=account.username,
            details={
                'email': account.email,
                'role': account.role,
                'linked_student_id': student.student_id,
            },
            req=request,
            tenant_id=account.tenant_id,
        )

        log_audit_event(
            'CREATE',
            'STUDENT',
            entity_id=student.id,
            entity_name=f'{student.first_name} {student.last_name}',
            details={'student_id': student.student_id},
            req=request,
            tenant_id=student.tenant_id,
        )

        return jsonify({
            'success': True,
            'message': 'Student created successfully',
            'data': student.to_dict(),
            'account': {
                'email': account.email,
                'password': birthday.isoformat(),
                'role': account.role,
            },
        }), 201
    except ValueError as exc:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(exc) or 'birthday must be YYYY-MM-DD'}), 400
    except Exception as exc:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to create student: {exc}'}), 500


@students_bp.route('/<int:student_id>', methods=['GET'])
def get_student(student_id):
    """Get a specific student."""
    student = Student.query.get_or_404(student_id)
    actor_role, chair_department = resolve_actor_scope()
    if actor_role == 'CHAIR':
        if not chair_department:
            return jsonify({'success': False, 'message': 'Chair account is not linked to any department'}), 403
        if not same_course(student.course, chair_department):
            return jsonify({'success': False, 'message': f'Chair accounts can only access {chair_department} students'}), 403
    return jsonify({'success': True, 'data': student.to_dict()})


@students_bp.route('/<int:student_id>', methods=['PUT'])
def update_student(student_id):
    """Update a student."""
    student = Student.query.get_or_404(student_id)
    data = request.get_json(silent=True) or {}
    actor_role, chair_department = resolve_actor_scope()

    if actor_role == 'CHAIR':
        if not chair_department:
            return jsonify({'success': False, 'message': 'Chair account is not linked to any department'}), 403
        if not same_course(student.course, chair_department):
            return jsonify({'success': False, 'message': f'Chair accounts can only access {chair_department} students'}), 403

        next_course = (data.get('course') or student.course or '').strip()
        if next_course and not same_course(next_course, chair_department):
            return jsonify({'success': False, 'message': f'Chair accounts can only manage {chair_department} students'}), 403
        data['course'] = chair_department

    validation_error = validate_student_payload(data, is_update=True, current_student=student)
    if validation_error:
        return jsonify({'success': False, 'message': validation_error}), 400

    if 'birthday' in data:
        try:
            student.birthday = parse_birthday((data.get('birthday') or '').strip())
        except ValueError:
            return jsonify({'success': False, 'message': 'birthday must be YYYY-MM-DD'}), 400

    student.student_id = (data.get('student_id') or student.student_id).strip()
    student.first_name = (data.get('first_name') or student.first_name).strip()
    student.last_name = (data.get('last_name') or student.last_name).strip()
    student.middle_name = (data.get('middle_name') or '').strip() or None
    student.email = (data.get('email') or '').strip() or None
    student.contact_number = (data.get('contact_number') or '').strip() or None
    student.course = (data.get('course') or student.course or '').strip() or None
    student.year_level = (data.get('year_level') or student.year_level or '').strip() or None
    student.section = (data.get('section') or student.section or '').strip() or None
    student.enrollment_status = (data.get('enrollment_status') or student.enrollment_status or 'Enrolled').strip()
    student.tenant_id = (data.get('tenant_id') or student.tenant_id or '').strip() or None

    db.session.commit()
    log_audit_event(
        'UPDATE',
        'STUDENT',
        entity_id=student.id,
        entity_name=f'{student.first_name} {student.last_name}',
        details={'student_id': student.student_id},
        req=request,
        tenant_id=student.tenant_id,
    )

    return jsonify({
        'success': True,
        'message': 'Student updated successfully',
        'data': student.to_dict(),
    })


@students_bp.route('/<int:student_id>', methods=['DELETE'])
@require_roles(['DEAN'])
def delete_student(student_id):
    """Delete a student."""
    student = Student.query.get_or_404(student_id)
    entity_name = f'{student.first_name} {student.last_name}'
    tenant_id = student.tenant_id
    student_number = student.student_id
    db.session.delete(student)
    db.session.commit()
    log_audit_event(
        'DELETE',
        'STUDENT',
        entity_id=student_id,
        entity_name=entity_name,
        details={'student_id': student_number},
        req=request,
        tenant_id=tenant_id,
    )
    return jsonify({'success': True, 'message': 'Student deleted successfully'})


@students_bp.route('/<int:student_id>/skills', methods=['POST'])
def add_skill(student_id):
    """Add a skill to a student."""
    student = Student.query.get_or_404(student_id)
    data = request.get_json(silent=True) or {}
    skill_name = (data.get('skill_name') or '').strip()
    level = (data.get('level') or '').strip() or None

    if not skill_name:
        return jsonify({'success': False, 'message': 'skill_name is required'}), 400

    item = StudentSkill.query.filter_by(student_id=student.id, skill_name=skill_name).first()
    if item:
        return jsonify({'success': False, 'message': 'Skill already exists for this student'}), 400

    item = StudentSkill(student_id=student.id, skill_name=skill_name, level=level)
    db.session.add(item)
    db.session.commit()
    log_audit_event(
        'CREATE',
        'STUDENT_SKILL',
        entity_id=item.id,
        entity_name=skill_name,
        details={'student_id': student.id},
        req=request,
        tenant_id=student.tenant_id,
    )
    return jsonify({'success': True, 'message': 'Skill added successfully', 'data': item.id}), 201


@students_bp.route('/<int:student_id>/skills/<int:skill_id>', methods=['DELETE'])
def delete_skill(student_id, skill_id):
    """Delete a skill from a student."""
    item = StudentSkill.query.filter_by(id=skill_id, student_id=student_id).first()
    if not item:
        return jsonify({'success': False, 'message': 'Skill not found'}), 404
    skill_name = item.skill_name
    db.session.delete(item)
    db.session.commit()
    log_audit_event(
        'DELETE',
        'STUDENT_SKILL',
        entity_id=skill_id,
        entity_name=skill_name,
        details={'student_id': student_id},
        req=request,
    )
    return jsonify({'success': True, 'message': 'Skill deleted successfully'})


@students_bp.route('/<int:student_id>/skills/<int:skill_id>', methods=['PUT'])
def update_skill(student_id, skill_id):
    """Update a student's skill."""
    item = StudentSkill.query.filter_by(id=skill_id, student_id=student_id).first()
    if not item:
        return jsonify({'success': False, 'message': 'Skill not found'}), 404

    data = request.get_json(silent=True) or {}
    skill_name = (data.get('skill_name') or '').strip()
    level = (data.get('level') or '').strip() or None

    if not skill_name:
        return jsonify({'success': False, 'message': 'skill_name is required'}), 400

    existing = StudentSkill.query.filter_by(student_id=student_id, skill_name=skill_name).first()
    if existing and existing.id != item.id:
        return jsonify({'success': False, 'message': 'Skill already exists for this student'}), 400

    item.skill_name = skill_name
    item.level = level
    db.session.commit()
    log_audit_event(
        'UPDATE',
        'STUDENT_SKILL',
        entity_id=item.id,
        entity_name=skill_name,
        details={'student_id': student_id},
        req=request,
    )
    return jsonify({'success': True, 'message': 'Skill updated successfully', 'data': item.id})


@students_bp.route('/<int:student_id>/academic-history', methods=['POST'])
def add_academic_history(student_id):
    """Add academic history record to a student."""
    student = Student.query.get_or_404(student_id)
    data = request.get_json(silent=True) or {}

    academic_year = (data.get('academic_year') or '').strip() or None
    course = (data.get('course') or '').strip() or None
    details = (data.get('details') or '').strip() or None

    item = StudentAcademicHistory(
        student_id=student.id,
        academic_year=academic_year,
        course=course,
        details=details,
    )
    db.session.add(item)
    db.session.commit()
    log_audit_event(
        'CREATE',
        'STUDENT_ACADEMIC_HISTORY',
        entity_id=item.id,
        entity_name=course or academic_year or 'Academic History',
        details={'student_id': student.id},
        req=request,
        tenant_id=student.tenant_id,
    )
    return jsonify({'success': True, 'message': 'Academic history added successfully', 'data': item.id}), 201


@students_bp.route('/<int:student_id>/academic-history/<int:history_id>', methods=['DELETE'])
def delete_academic_history(student_id, history_id):
    """Delete academic history record."""
    item = StudentAcademicHistory.query.filter_by(id=history_id, student_id=student_id).first()
    if not item:
        return jsonify({'success': False, 'message': 'Academic history not found'}), 404
    entity_name = item.course or item.academic_year or 'Academic History'
    db.session.delete(item)
    db.session.commit()
    log_audit_event(
        'DELETE',
        'STUDENT_ACADEMIC_HISTORY',
        entity_id=history_id,
        entity_name=entity_name,
        details={'student_id': student_id},
        req=request,
    )
    return jsonify({'success': True, 'message': 'Academic history deleted successfully'})


@students_bp.route('/<int:student_id>/academic-history/<int:history_id>', methods=['PUT'])
def update_academic_history(student_id, history_id):
    """Update academic history record."""
    item = StudentAcademicHistory.query.filter_by(id=history_id, student_id=student_id).first()
    if not item:
        return jsonify({'success': False, 'message': 'Academic history not found'}), 404

    data = request.get_json(silent=True) or {}
    item.academic_year = (data.get('academic_year') or '').strip() or None
    item.course = (data.get('course') or '').strip() or None
    item.details = (data.get('details') or '').strip() or None
    db.session.commit()
    log_audit_event(
        'UPDATE',
        'STUDENT_ACADEMIC_HISTORY',
        entity_id=item.id,
        entity_name=item.course or item.academic_year or 'Academic History',
        details={'student_id': student_id},
        req=request,
    )
    return jsonify({'success': True, 'message': 'Academic history updated successfully', 'data': item.id})


@students_bp.route('/<int:student_id>/activities', methods=['POST'])
def add_activity(student_id):
    """Add a non-academic activity."""
    student = Student.query.get_or_404(student_id)
    data = request.get_json(silent=True) or {}

    activity_type = (data.get('activity_type') or '').strip() or None
    activity_name = (data.get('activity_name') or '').strip()
    details = (data.get('details') or '').strip() or None

    if not activity_name:
        return jsonify({'success': False, 'message': 'activity_name is required'}), 400

    item = StudentNonAcademicActivity(
        student_id=student.id,
        activity_type=activity_type,
        activity_name=activity_name,
        details=details,
    )
    db.session.add(item)
    db.session.commit()
    log_audit_event(
        'CREATE',
        'STUDENT_ACTIVITY',
        entity_id=item.id,
        entity_name=activity_name,
        details={'student_id': student.id},
        req=request,
        tenant_id=student.tenant_id,
    )
    return jsonify({'success': True, 'message': 'Activity added successfully', 'data': item.id}), 201


@students_bp.route('/<int:student_id>/activities/<int:activity_id>', methods=['DELETE'])
def delete_activity(student_id, activity_id):
    """Delete a non-academic activity."""
    item = StudentNonAcademicActivity.query.filter_by(id=activity_id, student_id=student_id).first()
    if not item:
        return jsonify({'success': False, 'message': 'Activity not found'}), 404
    activity_name = item.activity_name
    db.session.delete(item)
    db.session.commit()
    log_audit_event(
        'DELETE',
        'STUDENT_ACTIVITY',
        entity_id=activity_id,
        entity_name=activity_name,
        details={'student_id': student_id},
        req=request,
    )
    return jsonify({'success': True, 'message': 'Activity deleted successfully'})


@students_bp.route('/<int:student_id>/activities/<int:activity_id>', methods=['PUT'])
def update_activity(student_id, activity_id):
    """Update a non-academic activity."""
    item = StudentNonAcademicActivity.query.filter_by(id=activity_id, student_id=student_id).first()
    if not item:
        return jsonify({'success': False, 'message': 'Activity not found'}), 404

    data = request.get_json(silent=True) or {}
    activity_type = (data.get('activity_type') or '').strip() or None
    activity_name = (data.get('activity_name') or '').strip()
    details = (data.get('details') or '').strip() or None

    if not activity_name:
        return jsonify({'success': False, 'message': 'activity_name is required'}), 400

    item.activity_type = activity_type
    item.activity_name = activity_name
    item.details = details
    db.session.commit()
    log_audit_event(
        'UPDATE',
        'STUDENT_ACTIVITY',
        entity_id=item.id,
        entity_name=activity_name,
        details={'student_id': student_id},
        req=request,
    )
    return jsonify({'success': True, 'message': 'Activity updated successfully', 'data': item.id})


@students_bp.route('/<int:student_id>/violations', methods=['POST'])
def add_violation(student_id):
    """Add a violation record."""
    student = Student.query.get_or_404(student_id)
    data = request.get_json(silent=True) or {}

    violation_name = (data.get('violation_name') or '').strip()
    severity = (data.get('severity') or '').strip() or None
    date_str = (data.get('date') or '').strip() or None
    details = (data.get('details') or '').strip() or None

    if not violation_name:
        return jsonify({'success': False, 'message': 'violation_name is required'}), 400

    violation_date = None
    if date_str:
        try:
            violation_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'success': False, 'message': 'date must be YYYY-MM-DD'}), 400

    item = StudentViolation(
        student_id=student.id,
        violation_name=violation_name,
        severity=severity,
        date=violation_date,
        details=details,
    )
    db.session.add(item)
    db.session.commit()
    log_audit_event(
        'CREATE',
        'STUDENT_VIOLATION',
        entity_id=item.id,
        entity_name=violation_name,
        details={'student_id': student.id},
        req=request,
        tenant_id=student.tenant_id,
    )
    return jsonify({'success': True, 'message': 'Violation added successfully', 'data': item.id}), 201


@students_bp.route('/<int:student_id>/violations/<int:violation_id>', methods=['DELETE'])
def delete_violation(student_id, violation_id):
    """Delete a violation record."""
    item = StudentViolation.query.filter_by(id=violation_id, student_id=student_id).first()
    if not item:
        return jsonify({'success': False, 'message': 'Violation not found'}), 404
    violation_name = item.violation_name
    db.session.delete(item)
    db.session.commit()
    log_audit_event(
        'DELETE',
        'STUDENT_VIOLATION',
        entity_id=violation_id,
        entity_name=violation_name,
        details={'student_id': student_id},
        req=request,
    )
    return jsonify({'success': True, 'message': 'Violation deleted successfully'})


@students_bp.route('/<int:student_id>/violations/<int:violation_id>', methods=['PUT'])
def update_violation(student_id, violation_id):
    """Update a violation record."""
    item = StudentViolation.query.filter_by(id=violation_id, student_id=student_id).first()
    if not item:
        return jsonify({'success': False, 'message': 'Violation not found'}), 404

    data = request.get_json(silent=True) or {}
    violation_name = (data.get('violation_name') or '').strip()
    severity = (data.get('severity') or '').strip() or None
    date_str = (data.get('date') or '').strip() or None
    details = (data.get('details') or '').strip() or None

    if not violation_name:
        return jsonify({'success': False, 'message': 'violation_name is required'}), 400

    violation_date = None
    if date_str:
        try:
            violation_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'success': False, 'message': 'date must be YYYY-MM-DD'}), 400

    item.violation_name = violation_name
    item.severity = severity
    item.date = violation_date
    item.details = details
    db.session.commit()
    log_audit_event(
        'UPDATE',
        'STUDENT_VIOLATION',
        entity_id=item.id,
        entity_name=violation_name,
        details={'student_id': student_id},
        req=request,
    )
    return jsonify({'success': True, 'message': 'Violation updated successfully', 'data': item.id})


@students_bp.route('/<int:student_id>/affiliations', methods=['POST'])
def add_affiliation(student_id):
    """Add an affiliation record."""
    student = Student.query.get_or_404(student_id)
    data = request.get_json(silent=True) or {}

    name = (data.get('name') or '').strip()
    category = (data.get('category') or '').strip() or None
    role = (data.get('role') or '').strip() or None

    if not name:
        return jsonify({'success': False, 'message': 'name is required'}), 400

    item = StudentAffiliation(student_id=student.id, name=name, category=category, role=role)
    db.session.add(item)
    db.session.commit()
    log_audit_event(
        'CREATE',
        'STUDENT_AFFILIATION',
        entity_id=item.id,
        entity_name=name,
        details={'student_id': student.id},
        req=request,
        tenant_id=student.tenant_id,
    )
    return jsonify({'success': True, 'message': 'Affiliation added successfully', 'data': item.id}), 201


@students_bp.route('/<int:student_id>/affiliations/<int:affiliation_id>', methods=['DELETE'])
def delete_affiliation(student_id, affiliation_id):
    """Delete an affiliation record."""
    item = StudentAffiliation.query.filter_by(id=affiliation_id, student_id=student_id).first()
    if not item:
        return jsonify({'success': False, 'message': 'Affiliation not found'}), 404
    affiliation_name = item.name
    db.session.delete(item)
    db.session.commit()
    log_audit_event(
        'DELETE',
        'STUDENT_AFFILIATION',
        entity_id=affiliation_id,
        entity_name=affiliation_name,
        details={'student_id': student_id},
        req=request,
    )
    return jsonify({'success': True, 'message': 'Affiliation deleted successfully'})


@students_bp.route('/<int:student_id>/affiliations/<int:affiliation_id>', methods=['PUT'])
def update_affiliation(student_id, affiliation_id):
    """Update an affiliation record."""
    item = StudentAffiliation.query.filter_by(id=affiliation_id, student_id=student_id).first()
    if not item:
        return jsonify({'success': False, 'message': 'Affiliation not found'}), 404

    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    category = (data.get('category') or '').strip() or None
    role = (data.get('role') or '').strip() or None

    if not name:
        return jsonify({'success': False, 'message': 'name is required'}), 400

    item.name = name
    item.category = category
    item.role = role
    db.session.commit()
    log_audit_event(
        'UPDATE',
        'STUDENT_AFFILIATION',
        entity_id=item.id,
        entity_name=name,
        details={'student_id': student_id},
        req=request,
    )
    return jsonify({'success': True, 'message': 'Affiliation updated successfully', 'data': item.id})
