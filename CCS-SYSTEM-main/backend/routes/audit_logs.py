from flask import Blueprint, request, jsonify
from models import db, AuditLog
from datetime import datetime, timedelta
from authz import require_roles

audit_logs_bp = Blueprint('audit_logs', __name__, url_prefix='/api/audit-logs')

@audit_logs_bp.route('', methods=['GET'])
@require_roles(['DEAN'])
def get_audit_logs():
    """Get audit logs with optional filtering"""
    try:
        tenant_id = request.args.get('tenant_id')
        user_id = request.args.get('user_id')
        action = request.args.get('action')
        entity_type = request.args.get('entity_type')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = request.args.get('limit', type=int, default=100)
        offset = request.args.get('offset', type=int, default=0)
        
        query = AuditLog.query
        
        if tenant_id:
            query = query.filter(AuditLog.tenant_id == tenant_id)
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        if action:
            query = query.filter(AuditLog.action == action)
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(AuditLog.created_at >= start_dt)
            except:
                pass
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(AuditLog.created_at <= end_dt)
            except:
                pass
        
        # Get total count before pagination
        total = query.count()
        
        # Apply pagination
        logs = query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset).all()
        
        return jsonify({
            'success': True,
            'data': [log.to_dict() for log in logs],
            'total': total,
            'limit': limit,
            'offset': offset
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@audit_logs_bp.route('/stats', methods=['GET'])
@require_roles(['DEAN'])
def get_audit_stats():
    """Get audit log statistics"""
    try:
        tenant_id = request.args.get('tenant_id')
        days = request.args.get('days', type=int, default=30)
        
        query = AuditLog.query
        if tenant_id:
            query = query.filter(AuditLog.tenant_id == tenant_id)
        
        # Get logs from last N days
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        query = query.filter(AuditLog.created_at >= cutoff_date)
        
        logs = query.all()
        
        # Calculate statistics
        actions = {}
        entity_types = {}
        users = {}
        
        for log in logs:
            # Count by action
            actions[log.action] = actions.get(log.action, 0) + 1
            # Count by entity type
            entity_types[log.entity_type] = entity_types.get(log.entity_type, 0) + 1
            # Count by user
            users[log.username] = users.get(log.username, 0) + 1
        
        return jsonify({
            'success': True,
            'data': {
                'total_logs': len(logs),
                'by_action': actions,
                'by_entity_type': entity_types,
                'by_user': users,
                'period_days': days
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# Helper function to create audit log entries (can be imported by other modules)
def create_audit_log(user_id, username, action, entity_type, entity_id=None, entity_name=None, details=None, ip_address=None, tenant_id=None):
    """Helper function to create audit log entries"""
    try:
        log = AuditLog(
            user_id=user_id,
            username=username,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            details=details,
            ip_address=ip_address,
            tenant_id=tenant_id
        )
        db.session.add(log)
        db.session.commit()
        return log
    except Exception as e:
        db.session.rollback()
        print(f"Error creating audit log: {e}")
        return None

