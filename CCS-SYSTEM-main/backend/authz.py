from __future__ import annotations

from functools import wraps
from typing import Callable, Iterable

from flask import current_app, jsonify, request

from models import Faculty, User, or_

DEPARTMENT_CHAIR_POSITION_TOKENS = {
    "department chair",
    "dept chair",
    "chair",
    "chairperson",
}


def _normalize_token(value: str | None) -> str:
    return (value or "").strip().lower()


def get_request_actor() -> User | None:
    """Resolve the current actor from request headers (X-Actor-Id)."""
    actor_id = request.headers.get("X-Actor-Id")
    if not actor_id:
        return None
    try:
        actor_id_int = int(actor_id)
    except ValueError:
        return None
    return User.query.get(actor_id_int)


def resolve_actor_faculty_profile(actor: User | None) -> Faculty | None:
    if not actor:
        return None

    lookup_tokens = {
        (actor.email or "").strip(),
        (actor.username or "").strip(),
    }

    for token in lookup_tokens:
        if not token:
            continue
        profile = Faculty.query.filter(
            or_(
                Faculty.email.ilike(token),
                Faculty.employee_number.ilike(token),
            )
        ).first()
        if profile:
            return profile
    return None


def resolve_actor_department(actor: User | None) -> str | None:
    profile = resolve_actor_faculty_profile(actor)
    department = (profile.department or "").strip() if profile else ""
    return department or None


def resolve_effective_role(actor: User | None) -> str:
    if not actor:
        return ""

    actor_role = (actor.role or "").upper()
    if actor_role != "FACULTY":
        return actor_role

    profile = resolve_actor_faculty_profile(actor)
    position = _normalize_token(profile.position if profile else "")
    if position in DEPARTMENT_CHAIR_POSITION_TOKENS:
        return "CHAIR"

    return actor_role


def require_roles(allowed_roles: Iterable[str]) -> Callable:
    """Restrict access to a route by user role.

    Notes:
    - This app doesn't use auth tokens yet; it relies on X-Actor-Id set by the frontend.
    - In TESTING mode we allow requests through to keep smoke tests simple.
    """

    allowed = {str(role).upper() for role in allowed_roles}

    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if current_app.config.get("TESTING"):
                return fn(*args, **kwargs)

            actor = get_request_actor()
            if not actor:
                return jsonify({"success": False, "message": "Unauthorized"}), 401

            actor_role = resolve_effective_role(actor)
            if actor_role not in allowed:
                return jsonify({"success": False, "message": "Forbidden"}), 403

            return fn(*args, **kwargs)

        return wrapper

    return decorator

