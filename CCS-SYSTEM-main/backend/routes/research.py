from flask import Blueprint, request, jsonify
from audit import log_audit_event
from authz import require_roles
from models import db, Research
from datetime import datetime
import json

research_bp = Blueprint('research', __name__, url_prefix='/api/research')

@research_bp.route('', methods=['GET'])
def get_research():
    """Get all research with optional filtering"""
    try:
        tenant_id = request.args.get('tenant_id')
        category = request.args.get('category')
        status = request.args.get('status')
        
        query = Research.query
        
        if tenant_id:
            query = query.filter(Research.tenant_id == tenant_id)
        if category and category != 'All Categories':
            query = query.filter(Research.category == category)
        if status:
            query = query.filter(Research.status == status)
        
        research_list = query.order_by(Research.created_at.desc()).all()
        
        return jsonify({
            'success': True,
            'data': [r.to_dict() for r in research_list]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@research_bp.route('', methods=['POST'])
def create_research():
    """Create a new research"""
    try:
        data = request.get_json() or {}
        
        # Validate required fields
        if 'title' not in data or not data['title']:
            return jsonify({
                'success': False,
                'message': 'title is required'
            }), 400
        
        # Convert authors and keywords to JSON strings
        authors_str = json.dumps(data.get('authors', [])) if isinstance(data.get('authors'), list) else data.get('authors', '')
        keywords_str = json.dumps(data.get('keywords', [])) if isinstance(data.get('keywords'), list) else data.get('keywords', '')
        
        # Parse date if provided
        publication_date = None
        if data.get('date'):
            try:
                publication_date = datetime.fromisoformat(data['date'].replace('Z', '+00:00')).date()
            except Exception:
                return jsonify({
                    'success': False,
                    'message': 'Invalid date format'
                }), 400
        
        research = Research(
            title=data['title'],
            description=data.get('description'),
            authors=authors_str,
            category=data.get('category'),
            status=data.get('status', 'Ongoing'),
            keywords=keywords_str,
            citations=data.get('citations', 0),
            views=data.get('views', 0),
            downloads=data.get('downloads', 0),
            journal=data.get('journal'),
            doi=data.get('doi'),
            publication_date=publication_date,
            year=data.get('year'),
            tenant_id=data.get('tenant_id')
        )
        
        db.session.add(research)
        db.session.commit()

        log_audit_event(
            action='CREATE',
            entity_type='RESEARCH',
            entity_id=research.id,
            entity_name=research.title,
            details={'category': research.category, 'status': research.status},
            tenant_id=research.tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Research created successfully',
            'data': research.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@research_bp.route('/<int:research_id>', methods=['GET'])
def get_research_item(research_id):
    """Get a specific research by ID"""
    try:
        research = Research.query.get(research_id)
        if not research:
            return jsonify({
                'success': False,
                'message': 'Research not found'
            }), 404
        
        return jsonify({
            'success': True,
            'data': research.to_dict()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@research_bp.route('/<int:research_id>', methods=['PUT'])
def update_research(research_id):
    """Update a research"""
    try:
        research = Research.query.get(research_id)
        if not research:
            return jsonify({
                'success': False,
                'message': 'Research not found'
            }), 404
        
        data = request.get_json() or {}
        
        if 'title' in data:
            research.title = data['title']
        if 'description' in data:
            research.description = data['description']
        if 'authors' in data:
            research.authors = json.dumps(data['authors']) if isinstance(data['authors'], list) else data['authors']
        if 'category' in data:
            research.category = data['category']
        if 'status' in data:
            research.status = data['status']
        if 'keywords' in data:
            research.keywords = json.dumps(data['keywords']) if isinstance(data['keywords'], list) else data['keywords']
        if 'citations' in data:
            research.citations = data['citations']
        if 'views' in data:
            research.views = data['views']
        if 'downloads' in data:
            research.downloads = data['downloads']
        if 'journal' in data:
            research.journal = data['journal']
        if 'doi' in data:
            research.doi = data['doi']
        if 'year' in data:
            research.year = data['year']
        if 'date' in data and data['date']:
            try:
                research.publication_date = datetime.fromisoformat(data['date'].replace('Z', '+00:00')).date()
            except Exception:
                return jsonify({
                    'success': False,
                    'message': 'Invalid date format'
                }), 400
        if 'date' in data and not data['date']:
            research.publication_date = None
        
        db.session.commit()

        log_audit_event(
            action='UPDATE',
            entity_type='RESEARCH',
            entity_id=research.id,
            entity_name=research.title,
            details={'category': research.category, 'status': research.status},
            tenant_id=research.tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Research updated successfully',
            'data': research.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@research_bp.route('/<int:research_id>', methods=['DELETE'])
@require_roles(['DEAN'])
def delete_research(research_id):
    """Delete a research"""
    try:
        research = Research.query.get(research_id)
        if not research:
            return jsonify({
                'success': False,
                'message': 'Research not found'
            }), 404
        
        tenant_id = research.tenant_id
        title = research.title
        db.session.delete(research)
        db.session.commit()

        log_audit_event(
            action='DELETE',
            entity_type='RESEARCH',
            entity_id=research_id,
            entity_name=title,
            tenant_id=tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Research deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

