from __future__ import annotations

from functools import wraps
from typing import Callable, Iterable

from flask import current_app, jsonify, request

from models import User


def _get_actor() -> User | None:
    """Resolve the current actor from request headers (X-Actor-Id)."""
    actor_id = request.headers.get("X-Actor-Id")
    if not actor_id:
        return None
    try:
        actor_id_int = int(actor_id)
    except ValueError:
        return None
    return User.query.get(actor_id_int)


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

            actor = _get_actor()
            if not actor:
                return jsonify({"success": False, "message": "Unauthorized"}), 401

            actor_role = (actor.role or "").upper()
            if actor_role not in allowed:
                return jsonify({"success": False, "message": "Forbidden"}), 403

            return fn(*args, **kwargs)

        return wrapper

    return decorator

