from datetime import datetime
import os
import sys

from flask import Blueprint, jsonify, request

# Add parent directory to path for imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from audit import log_audit_event
from authz import require_roles
from models import Faculty, User, db

faculty_bp = Blueprint('faculty', __name__, url_prefix='/api/faculty')


def validate_faculty_payload(data, is_update=False, current_faculty=None):
    required_fields = ['employee_number', 'first_name', 'last_name', 'department', 'birthday']
    if not is_update:
        missing = [field for field in required_fields if not (data.get(field) or '').strip()]
        if missing:
            return f"Missing required fields: {', '.join(missing)}"

    employee_number = (data.get('employee_number') or '').strip()
    if employee_number:
        existing = Faculty.query.filter_by(employee_number=employee_number).first()
        if existing and (not current_faculty or existing.id != current_faculty.id):
            return 'Employee number already exists'

    return None


def parse_employment_start_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError as exc:
        raise ValueError('employment_start_date must be YYYY-MM-DD') from exc


def parse_birthday(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError as exc:
        raise ValueError('birthday must be YYYY-MM-DD') from exc


def normalize_account_identifier(value):
    return (value or '').strip()


def build_faculty_user_account(employee_number, birthday, tenant_id):
    account_identifier = normalize_account_identifier(employee_number)
    if not account_identifier:
        raise ValueError('employee_number is required to create an account')

    if User.query.filter(User.email.ilike(account_identifier)).first():
        raise ValueError('A user account with this faculty ID already exists')

    if User.query.filter(User.username.ilike(account_identifier)).first():
        raise ValueError('A username with this faculty ID already exists')

    if not birthday:
        raise ValueError('birthday is required to create an account')

    account = User(
        username=account_identifier,
        email=account_identifier,
        role='FACULTY',
        tenant_id=tenant_id,
    )
    account.set_password(birthday.isoformat())
    return account


@faculty_bp.route('', methods=['GET'])
def get_faculty():
    """Get all faculty (filtered by tenant if provided)."""
    tenant_id = request.args.get('tenant_id')
    query = Faculty.query

    if tenant_id:
        query = query.filter_by(tenant_id=tenant_id)

    faculty_list = query.order_by(Faculty.last_name, Faculty.first_name).all()
    return jsonify({'success': True, 'data': [faculty.to_dict() for faculty in faculty_list]})


@faculty_bp.route('', methods=['POST'])
def create_faculty():
    """Create a new faculty member."""
    try:
        data = request.get_json(silent=True) or {}
        validation_error = validate_faculty_payload(data)
        if validation_error:
            return jsonify({'success': False, 'message': validation_error}), 400

        employee_number = data.get('employee_number', '').strip()
        birthday = parse_birthday((data.get('birthday') or '').strip())
        tenant_id = (data.get('tenant_id') or '').strip() or None

        account = build_faculty_user_account(employee_number, birthday, tenant_id)

        faculty = Faculty(
            employee_number=employee_number,
            first_name=data.get('first_name', '').strip(),
            last_name=data.get('last_name', '').strip(),
            middle_name=(data.get('middle_name') or '').strip() or None,
            birthday=birthday,
            email=(data.get('email') or '').strip() or None,
            contact_number=(data.get('contact_number') or '').strip() or None,
            department=(data.get('department') or '').strip() or None,
            position=(data.get('position') or '').strip() or None,
            employment_start_date=parse_employment_start_date((data.get('employment_start_date') or '').strip()),
            employment_status=(data.get('employment_status') or 'Full-time').strip(),
            tenant_id=tenant_id,
        )
        db.session.add(account)
        db.session.add(faculty)
        db.session.commit()

        log_audit_event(
            'CREATE',
            'USER',
            entity_id=account.id,
            entity_name=account.username,
            details={
                'email': account.email,
                'role': account.role,
                'linked_employee_number': faculty.employee_number,
            },
            req=request,
            tenant_id=account.tenant_id,
        )

        log_audit_event(
            'CREATE',
            'FACULTY',
            entity_id=faculty.id,
            entity_name=f'{faculty.first_name} {faculty.last_name}',
            details={'employee_number': faculty.employee_number},
            req=request,
            tenant_id=faculty.tenant_id,
        )

        return jsonify({
            'success': True,
            'message': 'Faculty created successfully',
            'data': faculty.to_dict(),
            'account': {
                'email': account.email,
                'password': birthday.isoformat(),
                'role': account.role,
            },
        }), 201
    except ValueError as exc:
        return jsonify({'success': False, 'message': str(exc)}), 400
    except Exception as exc:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Failed to create faculty: {exc}'}), 500


@faculty_bp.route('/<int:faculty_id>', methods=['GET'])
def get_faculty_member(faculty_id):
    """Get a specific faculty member."""
    faculty = Faculty.query.get_or_404(faculty_id)
    return jsonify({'success': True, 'data': faculty.to_dict()})


@faculty_bp.route('/<int:faculty_id>', methods=['PUT'])
def update_faculty(faculty_id):
    """Update a faculty member."""
    faculty = Faculty.query.get_or_404(faculty_id)
    data = request.get_json(silent=True) or {}

    validation_error = validate_faculty_payload(data, is_update=True, current_faculty=faculty)
    if validation_error:
        return jsonify({'success': False, 'message': validation_error}), 400

    try:
        faculty.employee_number = data.get('employee_number', faculty.employee_number).strip()
        faculty.first_name = data.get('first_name', faculty.first_name).strip()
        faculty.last_name = data.get('last_name', faculty.last_name).strip()
        faculty.middle_name = (data.get('middle_name') or '').strip() or None
        if 'birthday' in data:
            faculty.birthday = parse_birthday((data.get('birthday') or '').strip())
        faculty.email = (data.get('email') or '').strip() or None
        faculty.contact_number = (data.get('contact_number') or '').strip() or None
        faculty.department = (data.get('department') or faculty.department or '').strip() or None
        faculty.position = (data.get('position') or '').strip() or None
        faculty.employment_start_date = parse_employment_start_date((data.get('employment_start_date') or '').strip())
        faculty.employment_status = (data.get('employment_status') or faculty.employment_status or 'Full-time').strip()
        faculty.tenant_id = (data.get('tenant_id') or faculty.tenant_id or '').strip() or None

        db.session.commit()
        log_audit_event(
            'UPDATE',
            'FACULTY',
            entity_id=faculty.id,
            entity_name=f'{faculty.first_name} {faculty.last_name}',
            details={'employee_number': faculty.employee_number},
            req=request,
            tenant_id=faculty.tenant_id,
        )

        return jsonify({
            'success': True,
            'message': 'Faculty updated successfully',
            'data': faculty.to_dict(),
        })
    except ValueError as exc:
        return jsonify({'success': False, 'message': str(exc)}), 400


@faculty_bp.route('/<int:faculty_id>', methods=['DELETE'])
@require_roles(['DEAN'])
def delete_faculty(faculty_id):
    """Delete a faculty member."""
    faculty = Faculty.query.get_or_404(faculty_id)
    entity_name = f'{faculty.first_name} {faculty.last_name}'
    employee_number = faculty.employee_number
    tenant_id = faculty.tenant_id
    db.session.delete(faculty)
    db.session.commit()
    log_audit_event(
        'DELETE',
        'FACULTY',
        entity_id=faculty_id,
        entity_name=entity_name,
        details={'employee_number': employee_number},
        req=request,
        tenant_id=tenant_id,
    )
    return jsonify({'success': True, 'message': 'Faculty deleted successfully'})
