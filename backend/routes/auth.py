from flask import Blueprint, request, jsonify
import sys
import os
import re
from datetime import datetime
# Add parent directory to path for imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
from audit import log_audit_event
from models import db, User

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

@auth_bp.route('/register', methods=['POST'])
def register():
    """User registration endpoint"""
    try:
        data = request.get_json()
        
        # Validate required fields
        username = data.get('username', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        role = data.get('role', 'FACULTY').upper()
        tenant_id = data.get('tenant_id', '').strip() or None
        
        # Validation
        if not username:
            return jsonify({'success': False, 'message': 'Username is required'}), 400
        
        if not email:
            return jsonify({'success': False, 'message': 'Email is required'}), 400
        
        if not validate_email(email):
            return jsonify({'success': False, 'message': 'Invalid email format'}), 400
        
        if not password or len(password) < 6:
            return jsonify({'success': False, 'message': 'Password must be at least 6 characters'}), 400
        
        if role not in ['DEAN', 'CHAIR', 'FACULTY', 'SECRETARY']:
            return jsonify({'success': False, 'message': 'Invalid role'}), 400
        
        # Check if user already exists
        if User.query.filter_by(username=username).first():
            return jsonify({'success': False, 'message': 'Username already exists'}), 400
        
        if User.query.filter_by(email=email).first():
            return jsonify({'success': False, 'message': 'Email already exists'}), 400
        
        # Create new user
        user = User(
            username=username,
            email=email,
            role=role,
            tenant_id=tenant_id
        )
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        log_audit_event(
            'CREATE',
            'USER',
            entity_id=user.id,
            entity_name=user.username,
            details={'email': user.email, 'role': user.role},
            req=request,
            user_id=user.id,
            username=user.username,
            tenant_id=user.tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Registration successful',
            'user': user.to_dict_safe()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Registration failed: {str(e)}'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        tenant_id = (data.get('tenant_id') or data.get('tenantId') or '').strip() or None
        
        if not email or not password:
            return jsonify({'success': False, 'message': 'Email and password are required'}), 400
        
        # Find user by email (optionally tenant_id)
        if tenant_id:
            user = User.query.filter_by(email=email, tenant_id=tenant_id).first()
        else:
            user = User.query.filter_by(email=email).first()
        
        if not user:
            return jsonify({'success': False, 'message': 'Invalid email or password'}), 401
        
        if not user.is_active:
            return jsonify({'success': False, 'message': 'Account is deactivated'}), 401
        
        # Check password
        if not user.check_password(password):
            return jsonify({'success': False, 'message': 'Invalid email or password'}), 401

        log_audit_event(
            'LOGIN',
            'USER',
            entity_id=user.id,
            entity_name=user.username,
            details={'email': user.email},
            req=request,
            user_id=user.id,
            username=user.username,
            tenant_id=user.tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': user.to_dict_safe()
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'Login failed: {str(e)}'}), 500

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """User logout endpoint"""
    payload = request.get_json(silent=True) or {}
    log_audit_event(
        'LOGOUT',
        'USER',
        entity_name=payload.get('username') or 'User Session',
        details={'email': payload.get('email')},
        req=request,
        username=payload.get('username') or request.headers.get('X-Actor-Name') or 'User',
        tenant_id=payload.get('tenant_id'),
    )
    return jsonify({
        'success': True,
        'message': 'Logout successful'
    })


@auth_bp.route('/account/<int:user_id>', methods=['GET'])
def get_account(user_id):
    """Get a single account for settings."""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': 'Account not found'}), 404

    return jsonify({
        'success': True,
        'data': user.to_dict_safe(),
    })


@auth_bp.route('/account/<int:user_id>', methods=['PUT'])
def update_account(user_id):
    """Update account settings."""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': 'Account not found'}), 404

        data = request.get_json(silent=True) or {}
        username = (data.get('username') or user.username).strip()
        email = (data.get('email') or user.email).strip().lower()
        password = data.get('password', '')

        if not username:
            return jsonify({'success': False, 'message': 'Username is required'}), 400

        if not email:
            return jsonify({'success': False, 'message': 'Email is required'}), 400

        if not validate_email(email):
            return jsonify({'success': False, 'message': 'Invalid email format'}), 400

        existing_username = User.query.filter_by(username=username).first()
        if existing_username and existing_username.id != user.id:
            return jsonify({'success': False, 'message': 'Username already exists'}), 400

        existing_email = User.query.filter_by(email=email).first()
        if existing_email and existing_email.id != user.id:
            return jsonify({'success': False, 'message': 'Email already exists'}), 400

        user.username = username
        user.email = email

        if password:
            if len(password) < 6:
                return jsonify({'success': False, 'message': 'Password must be at least 6 characters'}), 400
            user.set_password(password)

        db.session.commit()
        log_audit_event(
            'UPDATE',
            'USER',
            entity_id=user.id,
            entity_name=user.username,
            details={'email': user.email, 'password_updated': bool(password)},
            req=request,
            user_id=user.id,
            username=user.username,
            tenant_id=user.tenant_id,
        )

        return jsonify({
            'success': True,
            'message': 'Account updated successfully',
            'data': user.to_dict_safe(),
        })
    except Exception as exc:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Account update failed: {exc}'}), 500

