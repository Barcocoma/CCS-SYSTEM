from flask import Blueprint, request, jsonify
from audit import log_audit_event
from authz import require_roles
from models import db, Report
from datetime import datetime

reports_bp = Blueprint('reports', __name__, url_prefix='/api/reports')

@reports_bp.route('', methods=['GET'])
def get_reports():
    """Get all reports with optional filtering"""
    try:
        tenant_id = request.args.get('tenant_id')
        report_type = request.args.get('report_type')
        organization = request.args.get('organization')
        status = request.args.get('status')
        
        query = Report.query
        
        if tenant_id:
            query = query.filter(Report.tenant_id == tenant_id)
        if report_type:
            query = query.filter(Report.report_type == report_type)
        if organization:
            query = query.filter(Report.organization == organization)
        if status:
            query = query.filter(Report.status == status)
        
        reports = query.order_by(Report.date.desc()).all()
        
        return jsonify({
            'success': True,
            'data': [r.to_dict() for r in reports]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@reports_bp.route('', methods=['POST'])
def create_report():
    """Create a new report"""
    try:
        data = request.get_json() or {}
        
        # Validate required fields
        if 'title' not in data or not data['title']:
            return jsonify({
                'success': False,
                'message': 'title is required'
            }), 400
        
        if 'date' not in data or not data['date']:
            return jsonify({
                'success': False,
                'message': 'date is required'
            }), 400
        
        # Parse date
        try:
            report_date = datetime.fromisoformat(data['date'].replace('Z', '+00:00')).date()
        except:
            return jsonify({
                'success': False,
                'message': 'Invalid date format'
            }), 400
        
        report = Report(
            title=data['title'],
            report_type=data.get('report_type', 'event'),
            description=data.get('description'),
            organization=data.get('organization'),
            date=report_date,
            time=data.get('time'),
            venue=data.get('venue'),
            status=data.get('status', 'Upcoming'),
            participants=data.get('participants', 0),
            registered=data.get('registered', 0),
            category=data.get('category'),
            tenant_id=data.get('tenant_id')
        )
        
        db.session.add(report)
        db.session.commit()

        log_audit_event(
            action='CREATE',
            entity_type='EVENT',
            entity_id=report.id,
            entity_name=report.title,
            details={'report_type': report.report_type, 'organization': report.organization},
            tenant_id=report.tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Report created successfully',
            'data': report.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@reports_bp.route('/<int:report_id>', methods=['GET'])
def get_report(report_id):
    """Get a specific report by ID"""
    try:
        report = Report.query.get(report_id)
        if not report:
            return jsonify({
                'success': False,
                'message': 'Report not found'
            }), 404
        
        return jsonify({
            'success': True,
            'data': report.to_dict()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@reports_bp.route('/<int:report_id>', methods=['PUT'])
def update_report(report_id):
    """Update a report"""
    try:
        report = Report.query.get(report_id)
        if not report:
            return jsonify({
                'success': False,
                'message': 'Report not found'
            }), 404
        
        data = request.get_json() or {}
        
        if 'title' in data:
            report.title = data['title']
        if 'report_type' in data:
            report.report_type = data['report_type']
        if 'description' in data:
            report.description = data['description']
        if 'organization' in data:
            report.organization = data['organization']
        if 'time' in data:
            report.time = data['time']
        if 'venue' in data:
            report.venue = data['venue']
        if 'status' in data:
            report.status = data['status']
        if 'participants' in data:
            report.participants = data['participants']
        if 'registered' in data:
            report.registered = data['registered']
        if 'category' in data:
            report.category = data['category']
        if 'date' in data and data['date']:
            try:
                report.date = datetime.fromisoformat(data['date'].replace('Z', '+00:00')).date()
            except Exception:
                return jsonify({
                    'success': False,
                    'message': 'Invalid date format'
                }), 400
        
        db.session.commit()

        log_audit_event(
            action='UPDATE',
            entity_type='EVENT',
            entity_id=report.id,
            entity_name=report.title,
            details={'report_type': report.report_type, 'status': report.status},
            tenant_id=report.tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Report updated successfully',
            'data': report.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@reports_bp.route('/<int:report_id>', methods=['DELETE'])
@require_roles(['DEAN'])
def delete_report(report_id):
    """Delete a report"""
    try:
        report = Report.query.get(report_id)
        if not report:
            return jsonify({
                'success': False,
                'message': 'Report not found'
            }), 404
        
        tenant_id = report.tenant_id
        title = report.title
        db.session.delete(report)
        db.session.commit()

        log_audit_event(
            action='DELETE',
            entity_type='EVENT',
            entity_id=report_id,
            entity_name=title,
            tenant_id=tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Report deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

