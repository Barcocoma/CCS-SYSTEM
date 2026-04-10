import json
from datetime import datetime, timezone
from typing import Any

from flask import Request, request

from models import AuditLog, db


def get_actor_from_request(req: Request | None = None) -> dict[str, Any]:
    active_request = req or request
    user_id = active_request.headers.get('X-Actor-Id')
    username = (
        active_request.headers.get('X-Actor-Name')
        or active_request.headers.get('X-User-Name')
        or 'System'
    )
    tenant_id = active_request.headers.get('X-Tenant-Id')

    return {
        'user_id': int(user_id) if user_id and str(user_id).isdigit() else None,
        'username': username,
        'tenant_id': tenant_id or None,
        'ip_address': active_request.headers.get('X-Forwarded-For', active_request.remote_addr),
    }


def log_audit_event(
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    entity_name: str | None = None,
    details: Any | None = None,
    req: Request | None = None,
    user_id: int | None = None,
    username: str | None = None,
    tenant_id: str | None = None,
) -> None:
    actor = get_actor_from_request(req)
    details_value = details
    if isinstance(details, (dict, list)):
        details_value = json.dumps(details)

    log = AuditLog(
        user_id=user_id if user_id is not None else actor['user_id'],
        username=username or actor['username'],
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        details=details_value,
        ip_address=actor['ip_address'],
        tenant_id=tenant_id if tenant_id is not None else actor['tenant_id'],
        created_at=datetime.now(timezone.utc),
    )

    try:
        db.session.add(log)
        db.session.commit()
    except Exception:
        db.session.rollback()
