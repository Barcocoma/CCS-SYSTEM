from datetime import datetime

from flask import Blueprint, jsonify, request

from audit import log_audit_event
from authz import require_roles
from models import Schedule, db

schedules_bp = Blueprint('schedules', __name__, url_prefix='/api/schedules')


def parse_meridiem_time(value):
    return datetime.strptime(value, '%I:%M %p')


def validate_schedule_payload(data):
    required_fields = ['course', 'subject', 'instructor', 'room', 'day', 'start_time', 'end_time']
    missing = [field for field in required_fields if not (data.get(field) or '').strip()]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"

    try:
        start_time = parse_meridiem_time(data['start_time'].strip())
        end_time = parse_meridiem_time(data['end_time'].strip())
    except ValueError:
        return 'Times must use the format h:mm AM/PM'

    if end_time <= start_time:
        return 'End time must be later than start time'

    return None


@schedules_bp.route('', methods=['GET'])
def get_schedules():
    """Get all schedules with optional filtering."""
    try:
        tenant_id = request.args.get('tenant_id')
        course = request.args.get('course')
        day = request.args.get('day')

        query = Schedule.query

        if tenant_id:
            query = query.filter(Schedule.tenant_id == tenant_id)
        if course and course != 'All Courses':
            query = query.filter(Schedule.course == course)
        if day and day != 'All Days':
            query = query.filter(Schedule.day == day)

        schedules = query.order_by(Schedule.day, Schedule.start_time).all()
        return jsonify({'success': True, 'data': [schedule.to_dict() for schedule in schedules]})
    except Exception as exc:
        return jsonify({'success': False, 'message': str(exc)}), 500


@schedules_bp.route('', methods=['POST'])
def create_schedule():
    """Create a new schedule."""
    try:
        data = request.get_json(silent=True) or {}
        validation_error = validate_schedule_payload(data)
        if validation_error:
            return jsonify({'success': False, 'message': validation_error}), 400

        schedule = Schedule(
            course=data['course'].strip(),
            subject=data['subject'].strip(),
            instructor=data['instructor'].strip(),
            room=data['room'].strip(),
            day=data['day'].strip(),
            start_time=data['start_time'].strip(),
            end_time=data['end_time'].strip(),
            students=data.get('students', 0),
            year_level=(data.get('year_level') or '').strip() or None,
            section=(data.get('section') or '').strip() or None,
            tenant_id=(data.get('tenant_id') or '').strip() or None,
        )

        db.session.add(schedule)
        db.session.commit()
        log_audit_event(
            'CREATE',
            'SCHEDULE',
            entity_id=schedule.id,
            entity_name=schedule.subject,
            details={'course': schedule.course, 'day': schedule.day},
            req=request,
            tenant_id=schedule.tenant_id,
        )

        return jsonify({
            'success': True,
            'message': 'Schedule created successfully',
            'data': schedule.to_dict(),
        }), 201
    except Exception as exc:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(exc)}), 500


@schedules_bp.route('/<int:schedule_id>', methods=['GET'])
def get_schedule(schedule_id):
    """Get a specific schedule by ID."""
    try:
        schedule = Schedule.query.get(schedule_id)
        if not schedule:
            return jsonify({'success': False, 'message': 'Schedule not found'}), 404

        return jsonify({'success': True, 'data': schedule.to_dict()})
    except Exception as exc:
        return jsonify({'success': False, 'message': str(exc)}), 500


@schedules_bp.route('/<int:schedule_id>', methods=['PUT'])
def update_schedule(schedule_id):
    """Update a schedule."""
    try:
        schedule = Schedule.query.get(schedule_id)
        if not schedule:
            return jsonify({'success': False, 'message': 'Schedule not found'}), 404

        data = request.get_json(silent=True) or {}
        merged = {
            'course': data.get('course', schedule.course),
            'subject': data.get('subject', schedule.subject),
            'instructor': data.get('instructor', schedule.instructor),
            'room': data.get('room', schedule.room),
            'day': data.get('day', schedule.day),
            'start_time': data.get('start_time', schedule.start_time),
            'end_time': data.get('end_time', schedule.end_time),
        }
        validation_error = validate_schedule_payload(merged)
        if validation_error:
            return jsonify({'success': False, 'message': validation_error}), 400

        schedule.course = merged['course'].strip()
        schedule.subject = merged['subject'].strip()
        schedule.instructor = merged['instructor'].strip()
        schedule.room = merged['room'].strip()
        schedule.day = merged['day'].strip()
        schedule.start_time = merged['start_time'].strip()
        schedule.end_time = merged['end_time'].strip()
        schedule.students = data.get('students', schedule.students)
        schedule.year_level = (data.get('year_level', schedule.year_level) or '').strip() or None
        schedule.section = (data.get('section', schedule.section) or '').strip() or None
        schedule.updated_at = datetime.utcnow()

        db.session.commit()
        log_audit_event(
            'UPDATE',
            'SCHEDULE',
            entity_id=schedule.id,
            entity_name=schedule.subject,
            details={'course': schedule.course, 'day': schedule.day},
            req=request,
            tenant_id=schedule.tenant_id,
        )

        return jsonify({
            'success': True,
            'message': 'Schedule updated successfully',
            'data': schedule.to_dict(),
        })
    except Exception as exc:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(exc)}), 500


@schedules_bp.route('/<int:schedule_id>', methods=['DELETE'])
@require_roles(['DEAN'])
def delete_schedule(schedule_id):
    """Delete a schedule."""
    try:
        schedule = Schedule.query.get(schedule_id)
        if not schedule:
            return jsonify({'success': False, 'message': 'Schedule not found'}), 404

        details = {'course': schedule.course, 'day': schedule.day}
        subject = schedule.subject
        tenant_id = schedule.tenant_id
        db.session.delete(schedule)
        db.session.commit()
        log_audit_event(
            'DELETE',
            'SCHEDULE',
            entity_id=schedule_id,
            entity_name=subject,
            details=details,
            req=request,
            tenant_id=tenant_id,
        )

        return jsonify({'success': True, 'message': 'Schedule deleted successfully'})
    except Exception as exc:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(exc)}), 500
