from flask import Blueprint, request, jsonify
from audit import log_audit_event
from authz import require_roles
from models import db, Organization

organizations_bp = Blueprint('organizations', __name__, url_prefix='/api/organizations')

@organizations_bp.route('', methods=['GET'])
def get_organizations():
    """Get all organizations with optional filtering"""
    try:
        tenant_id = request.args.get('tenant_id')
        status = request.args.get('status')
        
        query = Organization.query
        
        if tenant_id:
            query = query.filter(Organization.tenant_id == tenant_id)
        if status:
            query = query.filter(Organization.status == status)
        
        organizations = query.order_by(Organization.name).all()
        
        return jsonify({
            'success': True,
            'data': [org.to_dict() for org in organizations]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@organizations_bp.route('', methods=['POST'])
def create_organization():
    """Create a new organization"""
    try:
        data = request.get_json() or {}
        
        # Validate required fields
        if 'name' not in data or not data['name']:
            return jsonify({
                'success': False,
                'message': 'name is required'
            }), 400
        
        if 'full_name' not in data or not data['full_name']:
            return jsonify({
                'success': False,
                'message': 'full_name is required'
            }), 400
        
        # Check if organization with same name already exists
        existing = Organization.query.filter_by(
            name=data['name'],
            tenant_id=data.get('tenant_id')
        ).first()
        
        if existing:
            return jsonify({
                'success': False,
                'message': 'Organization with this name already exists'
            }), 400
        
        organization = Organization(
            name=data['name'],
            full_name=data['full_name'],
            members=data.get('members', 0),
            events_count=data.get('events_count', 0),
            status=data.get('status', 'Active'),
            color=data.get('color'),
            description=data.get('description'),
            tenant_id=data.get('tenant_id')
        )
        
        db.session.add(organization)
        db.session.commit()

        log_audit_event(
            action='CREATE',
            entity_type='ORGANIZATION',
            entity_id=organization.id,
            entity_name=organization.name,
            details={'full_name': organization.full_name, 'status': organization.status},
            tenant_id=organization.tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Organization created successfully',
            'data': organization.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@organizations_bp.route('/<int:org_id>', methods=['GET'])
def get_organization(org_id):
    """Get a specific organization by ID"""
    try:
        organization = Organization.query.get(org_id)
        if not organization:
            return jsonify({
                'success': False,
                'message': 'Organization not found'
            }), 404
        
        return jsonify({
            'success': True,
            'data': organization.to_dict()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@organizations_bp.route('/<int:org_id>', methods=['PUT'])
def update_organization(org_id):
    """Update an organization"""
    try:
        organization = Organization.query.get(org_id)
        if not organization:
            return jsonify({
                'success': False,
                'message': 'Organization not found'
            }), 404
        
        data = request.get_json() or {}

        next_name = data.get('name', organization.name)
        duplicate = Organization.query.filter(
            Organization.id != organization.id,
            Organization.name == next_name,
            Organization.tenant_id == organization.tenant_id,
        ).first()
        if duplicate:
            return jsonify({
                'success': False,
                'message': 'Organization with this name already exists'
            }), 400
        
        if 'name' in data:
            organization.name = data['name']
        if 'full_name' in data:
            organization.full_name = data['full_name']
        if 'members' in data:
            organization.members = data['members']
        if 'events_count' in data:
            organization.events_count = data['events_count']
        if 'status' in data:
            organization.status = data['status']
        if 'color' in data:
            organization.color = data['color']
        if 'description' in data:
            organization.description = data['description']
        
        db.session.commit()

        log_audit_event(
            action='UPDATE',
            entity_type='ORGANIZATION',
            entity_id=organization.id,
            entity_name=organization.name,
            details={'status': organization.status, 'members': organization.members},
            tenant_id=organization.tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Organization updated successfully',
            'data': organization.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@organizations_bp.route('/<int:org_id>', methods=['DELETE'])
@require_roles(['DEAN'])
def delete_organization(org_id):
    """Delete an organization"""
    try:
        organization = Organization.query.get(org_id)
        if not organization:
            return jsonify({
                'success': False,
                'message': 'Organization not found'
            }), 404
        
        tenant_id = organization.tenant_id
        name = organization.name
        db.session.delete(organization)
        db.session.commit()

        log_audit_event(
            action='DELETE',
            entity_type='ORGANIZATION',
            entity_id=org_id,
            entity_name=name,
            tenant_id=tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Organization deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

