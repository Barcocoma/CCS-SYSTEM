from flask import Blueprint, request, jsonify
from audit import log_audit_event
from authz import require_roles
from models import db, Syllabus
import json

syllabus_bp = Blueprint('syllabus', __name__, url_prefix='/api/syllabus')

@syllabus_bp.route('', methods=['GET'])
def get_syllabi():
    """Get all syllabi with optional filtering"""
    try:
        tenant_id = request.args.get('tenant_id')
        course = request.args.get('course')
        semester = request.args.get('semester')
        
        query = Syllabus.query
        
        if tenant_id:
            query = query.filter(Syllabus.tenant_id == tenant_id)
        if course:
            query = query.filter(Syllabus.course == course)
        if semester:
            query = query.filter(Syllabus.semester == semester)
        
        syllabi = query.order_by(Syllabus.course, Syllabus.code).all()
        
        return jsonify({
            'success': True,
            'data': [syllabus.to_dict() for syllabus in syllabi]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@syllabus_bp.route('', methods=['POST'])
def create_syllabus():
    """Create a new syllabus"""
    try:
        data = request.get_json() or {}
        
        # Validate required fields
        required_fields = ['course', 'subject', 'code', 'instructor', 'semester', 'academic_year', 'units', 'hours']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    'success': False,
                    'message': f'{field} is required'
                }), 400
        
        syllabus = Syllabus(
            course=data['course'],
            subject=data['subject'],
            code=data['code'],
            instructor=data['instructor'],
            semester=data['semester'],
            academic_year=data['academic_year'],
            units=data['units'],
            hours=data['hours'],
            description=data.get('description'),
            objectives=json.dumps(data.get('objectives', [])) if data.get('objectives') else None,
            topics=json.dumps(data.get('topics', [])) if data.get('topics') else None,
            requirements=json.dumps(data.get('requirements', [])) if data.get('requirements') else None,
            status=data.get('status', 'Active'),
            tenant_id=data.get('tenant_id')
        )
        
        db.session.add(syllabus)
        db.session.commit()

        log_audit_event(
            action='CREATE',
            entity_type='SYLLABUS',
            entity_id=syllabus.id,
            entity_name=f'{syllabus.code} - {syllabus.subject}',
            details={'course': syllabus.course, 'semester': syllabus.semester},
            tenant_id=syllabus.tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Syllabus created successfully',
            'data': syllabus.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@syllabus_bp.route('/<int:syllabus_id>', methods=['GET'])
def get_syllabus(syllabus_id):
    """Get a specific syllabus by ID"""
    try:
        syllabus = Syllabus.query.get(syllabus_id)
        if not syllabus:
            return jsonify({
                'success': False,
                'message': 'Syllabus not found'
            }), 404
        
        return jsonify({
            'success': True,
            'data': syllabus.to_dict()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@syllabus_bp.route('/<int:syllabus_id>', methods=['PUT'])
def update_syllabus(syllabus_id):
    """Update a syllabus"""
    try:
        syllabus = Syllabus.query.get(syllabus_id)
        if not syllabus:
            return jsonify({
                'success': False,
                'message': 'Syllabus not found'
            }), 404
        
        data = request.get_json() or {}
        
        if 'course' in data:
            syllabus.course = data['course']
        if 'subject' in data:
            syllabus.subject = data['subject']
        if 'code' in data:
            syllabus.code = data['code']
        if 'instructor' in data:
            syllabus.instructor = data['instructor']
        if 'semester' in data:
            syllabus.semester = data['semester']
        if 'academic_year' in data:
            syllabus.academic_year = data['academic_year']
        if 'units' in data:
            syllabus.units = data['units']
        if 'hours' in data:
            syllabus.hours = data['hours']
        if 'description' in data:
            syllabus.description = data['description']
        if 'objectives' in data:
            syllabus.objectives = json.dumps(data['objectives']) if data['objectives'] else None
        if 'topics' in data:
            syllabus.topics = json.dumps(data['topics']) if data['topics'] else None
        if 'requirements' in data:
            syllabus.requirements = json.dumps(data['requirements']) if data['requirements'] else None
        if 'status' in data:
            syllabus.status = data['status']
        
        db.session.commit()

        log_audit_event(
            action='UPDATE',
            entity_type='SYLLABUS',
            entity_id=syllabus.id,
            entity_name=f'{syllabus.code} - {syllabus.subject}',
            details={'course': syllabus.course, 'semester': syllabus.semester},
            tenant_id=syllabus.tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Syllabus updated successfully',
            'data': syllabus.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@syllabus_bp.route('/<int:syllabus_id>', methods=['DELETE'])
@require_roles(['DEAN'])
def delete_syllabus(syllabus_id):
    """Delete a syllabus"""
    try:
        syllabus = Syllabus.query.get(syllabus_id)
        if not syllabus:
            return jsonify({
                'success': False,
                'message': 'Syllabus not found'
            }), 404
        
        tenant_id = syllabus.tenant_id
        name = f'{syllabus.code} - {syllabus.subject}'
        db.session.delete(syllabus)
        db.session.commit()

        log_audit_event(
            action='DELETE',
            entity_type='SYLLABUS',
            entity_id=syllabus_id,
            entity_name=name,
            tenant_id=tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Syllabus deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

