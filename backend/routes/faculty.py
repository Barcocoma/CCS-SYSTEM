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
from models import Faculty, db

faculty_bp = Blueprint('faculty', __name__, url_prefix='/api/faculty')


def validate_faculty_payload(data, current_faculty=None):
    required_fields = ['employee_number', 'first_name', 'last_name', 'department']
    missing = [field for field in required_fields if not (data.get(field) or '').strip()]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"

    employee_number = (data.get('employee_number') or '').strip()
    existing = Faculty.query.filter_by(employee_number=employee_number).first()
    if existing and (not current_faculty or existing.id != current_faculty.id):
        return 'Employee number already exists'

    return None


def parse_employment_start_date(value):
    if not value:
        return None
    return datetime.strptime(value, '%Y-%m-%d').date()


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

        faculty = Faculty(
            employee_number=data.get('employee_number', '').strip(),
            first_name=data.get('first_name', '').strip(),
            last_name=data.get('last_name', '').strip(),
            middle_name=(data.get('middle_name') or '').strip() or None,
            email=(data.get('email') or '').strip() or None,
            contact_number=(data.get('contact_number') or '').strip() or None,
            department=(data.get('department') or '').strip() or None,
            position=(data.get('position') or '').strip() or None,
            employment_start_date=parse_employment_start_date((data.get('employment_start_date') or '').strip()),
            employment_status=(data.get('employment_status') or 'Full-time').strip(),
            tenant_id=(data.get('tenant_id') or '').strip() or None,
        )
        db.session.add(faculty)
        db.session.commit()

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
        }), 201
    except ValueError:
        return jsonify({'success': False, 'message': 'employment_start_date must be YYYY-MM-DD'}), 400
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

    validation_error = validate_faculty_payload(data, current_faculty=faculty)
    if validation_error:
        return jsonify({'success': False, 'message': validation_error}), 400

    try:
        faculty.employee_number = data.get('employee_number', faculty.employee_number).strip()
        faculty.first_name = data.get('first_name', faculty.first_name).strip()
        faculty.last_name = data.get('last_name', faculty.last_name).strip()
        faculty.middle_name = (data.get('middle_name') or '').strip() or None
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
    except ValueError:
        return jsonify({'success': False, 'message': 'employment_start_date must be YYYY-MM-DD'}), 400


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
