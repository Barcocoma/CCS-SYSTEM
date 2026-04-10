from flask import Blueprint, request, jsonify
from audit import log_audit_event
from authz import require_roles
from models import db, Lesson, Syllabus
import json

lessons_bp = Blueprint('lessons', __name__, url_prefix='/api/lessons')

@lessons_bp.route('', methods=['GET'])
def get_lessons():
    """Get all lessons with optional filtering"""
    try:
        tenant_id = request.args.get('tenant_id')
        syllabus_id = request.args.get('syllabus_id')
        week = request.args.get('week')
        status = request.args.get('status')
        
        query = Lesson.query
        
        if tenant_id:
            query = query.filter(Lesson.tenant_id == tenant_id)
        if syllabus_id:
            query = query.filter(Lesson.syllabus_id == syllabus_id)
        if week:
            query = query.filter(Lesson.week == week)
        if status:
            query = query.filter(Lesson.status == status)
        
        lessons = query.order_by(Lesson.syllabus_id, Lesson.week).all()
        
        return jsonify({
            'success': True,
            'data': [lesson.to_dict() for lesson in lessons]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@lessons_bp.route('', methods=['POST'])
def create_lesson():
    """Create a new lesson"""
    try:
        data = request.get_json() or {}
        
        # Validate required fields
        required_fields = ['syllabus_id', 'title', 'week']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    'success': False,
                    'message': f'{field} is required'
                }), 400
        
        syllabus = Syllabus.query.get(data['syllabus_id'])
        if not syllabus:
            return jsonify({
                'success': False,
                'message': 'Syllabus not found'
            }), 404

        lesson = Lesson(
            syllabus_id=data['syllabus_id'],
            title=data['title'],
            week=data['week'],
            duration=data.get('duration'),
            type=data.get('type', 'Lecture'),
            materials=json.dumps(data.get('materials', [])) if data.get('materials') else None,
            activities=json.dumps(data.get('activities', [])) if data.get('activities') else None,
            objectives=json.dumps(data.get('objectives', [])) if data.get('objectives') else None,
            status=data.get('status', 'Published'),
            tenant_id=data.get('tenant_id')
        )
        
        db.session.add(lesson)
        db.session.commit()

        log_audit_event(
            action='CREATE',
            entity_type='LESSON',
            entity_id=lesson.id,
            entity_name=lesson.title,
            details={'syllabus_id': lesson.syllabus_id, 'week': lesson.week},
            tenant_id=lesson.tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Lesson created successfully',
            'data': lesson.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@lessons_bp.route('/<int:lesson_id>', methods=['GET'])
def get_lesson(lesson_id):
    """Get a specific lesson by ID"""
    try:
        lesson = Lesson.query.get(lesson_id)
        if not lesson:
            return jsonify({
                'success': False,
                'message': 'Lesson not found'
            }), 404
        
        return jsonify({
            'success': True,
            'data': lesson.to_dict()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@lessons_bp.route('/<int:lesson_id>', methods=['PUT'])
def update_lesson(lesson_id):
    """Update a lesson"""
    try:
        lesson = Lesson.query.get(lesson_id)
        if not lesson:
            return jsonify({
                'success': False,
                'message': 'Lesson not found'
            }), 404
        
        data = request.get_json() or {}
        
        if 'syllabus_id' in data:
            syllabus = Syllabus.query.get(data['syllabus_id'])
            if not syllabus:
                return jsonify({
                    'success': False,
                    'message': 'Syllabus not found'
                }), 404
            lesson.syllabus_id = data['syllabus_id']
        if 'title' in data:
            lesson.title = data['title']
        if 'week' in data:
            lesson.week = data['week']
        if 'duration' in data:
            lesson.duration = data['duration']
        if 'type' in data:
            lesson.type = data['type']
        if 'materials' in data:
            lesson.materials = json.dumps(data['materials']) if data['materials'] else None
        if 'activities' in data:
            lesson.activities = json.dumps(data['activities']) if data['activities'] else None
        if 'objectives' in data:
            lesson.objectives = json.dumps(data['objectives']) if data['objectives'] else None
        if 'status' in data:
            lesson.status = data['status']
        
        db.session.commit()

        log_audit_event(
            action='UPDATE',
            entity_type='LESSON',
            entity_id=lesson.id,
            entity_name=lesson.title,
            details={'syllabus_id': lesson.syllabus_id, 'week': lesson.week},
            tenant_id=lesson.tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Lesson updated successfully',
            'data': lesson.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@lessons_bp.route('/<int:lesson_id>', methods=['DELETE'])
@require_roles(['DEAN'])
def delete_lesson(lesson_id):
    """Delete a lesson"""
    try:
        lesson = Lesson.query.get(lesson_id)
        if not lesson:
            return jsonify({
                'success': False,
                'message': 'Lesson not found'
            }), 404
        
        tenant_id = lesson.tenant_id
        title = lesson.title
        db.session.delete(lesson)
        db.session.commit()

        log_audit_event(
            action='DELETE',
            entity_type='LESSON',
            entity_id=lesson_id,
            entity_name=title,
            tenant_id=tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Lesson deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

