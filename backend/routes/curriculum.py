from flask import Blueprint, request, jsonify
from academic_defaults import COURSE_OPTIONS
from academic_logic import ensure_default_curricula, normalize_course, serialize_curriculum_semesters
from audit import log_audit_event
from authz import require_roles
from models import db, Curriculum

curriculum_bp = Blueprint('curriculum', __name__, url_prefix='/api/curriculum')

@curriculum_bp.route('', methods=['GET'])
def get_curricula():
    """Get all curricula with optional filtering"""
    try:
        tenant_id = request.args.get('tenant_id')
        course = request.args.get('course')
        year = request.args.get('year')
        if ensure_default_curricula(tenant_id=tenant_id):
            db.session.commit()
        
        query = Curriculum.query
        
        if tenant_id:
            query = query.filter(Curriculum.tenant_id == tenant_id)
        if course:
            query = query.filter(Curriculum.course == course)
        if year:
            query = query.filter(Curriculum.year == year)
        
        curricula = query.order_by(Curriculum.course, Curriculum.year).all()
        
        return jsonify({
            'success': True,
            'data': [curriculum.to_dict() for curriculum in curricula]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@curriculum_bp.route('', methods=['POST'])
@require_roles(['DEAN', 'CHAIR', 'SECRETARY'])
def create_curriculum():
    """Create a new curriculum"""
    try:
        data = request.get_json() or {}
        
        # Validate required fields
        required_fields = ['course', 'program', 'year', 'total_units', 'semesters']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    'success': False,
                    'message': f'{field} is required'
                }), 400
        
        course = normalize_course(data.get('course'))
        if course not in COURSE_OPTIONS:
            return jsonify({
                'success': False,
                'message': 'course must be either BSIT or BSCS'
            }), 400

        curriculum = Curriculum(
            course=course,
            program=data['program'],
            year=data['year'],
            total_units=data['total_units'],
            semesters=serialize_curriculum_semesters(data['semesters']) if data.get('semesters') else '[]',
            status=data.get('status', 'Active'),
            tenant_id=data.get('tenant_id')
        )
        
        db.session.add(curriculum)
        db.session.commit()

        log_audit_event(
            action='CREATE',
            entity_type='CURRICULUM',
            entity_id=curriculum.id,
            entity_name=curriculum.program,
            details={'course': curriculum.course, 'year': curriculum.year},
            tenant_id=curriculum.tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Curriculum created successfully',
            'data': curriculum.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@curriculum_bp.route('/<int:curriculum_id>', methods=['GET'])
def get_curriculum(curriculum_id):
    """Get a specific curriculum by ID"""
    try:
        curriculum = Curriculum.query.get(curriculum_id)
        if not curriculum:
            return jsonify({
                'success': False,
                'message': 'Curriculum not found'
            }), 404
        
        return jsonify({
            'success': True,
            'data': curriculum.to_dict()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@curriculum_bp.route('/<int:curriculum_id>', methods=['PUT'])
@require_roles(['DEAN', 'CHAIR', 'SECRETARY'])
def update_curriculum(curriculum_id):
    """Update a curriculum"""
    try:
        curriculum = Curriculum.query.get(curriculum_id)
        if not curriculum:
            return jsonify({
                'success': False,
                'message': 'Curriculum not found'
            }), 404
        
        data = request.get_json() or {}
        
        if 'course' in data:
            course = normalize_course(data.get('course'))
            if course not in COURSE_OPTIONS:
                return jsonify({
                    'success': False,
                    'message': 'course must be either BSIT or BSCS'
                }), 400
            curriculum.course = course
        if 'program' in data:
            curriculum.program = data['program']
        if 'year' in data:
            curriculum.year = data['year']
        if 'total_units' in data:
            curriculum.total_units = data['total_units']
        if 'semesters' in data:
            curriculum.semesters = serialize_curriculum_semesters(data['semesters']) if data['semesters'] else '[]'
        if 'status' in data:
            curriculum.status = data['status']
        
        db.session.commit()

        log_audit_event(
            action='UPDATE',
            entity_type='CURRICULUM',
            entity_id=curriculum.id,
            entity_name=curriculum.program,
            details={'course': curriculum.course, 'year': curriculum.year},
            tenant_id=curriculum.tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Curriculum updated successfully',
            'data': curriculum.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@curriculum_bp.route('/<int:curriculum_id>', methods=['DELETE'])
@require_roles(['DEAN'])
def delete_curriculum(curriculum_id):
    """Delete a curriculum"""
    try:
        curriculum = Curriculum.query.get(curriculum_id)
        if not curriculum:
            return jsonify({
                'success': False,
                'message': 'Curriculum not found'
            }), 404
        
        tenant_id = curriculum.tenant_id
        name = curriculum.program
        db.session.delete(curriculum)
        db.session.commit()

        log_audit_event(
            action='DELETE',
            entity_type='CURRICULUM',
            entity_id=curriculum_id,
            entity_name=name,
            tenant_id=tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Curriculum deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

