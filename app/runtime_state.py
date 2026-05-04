import json
import logging
import threading
import time
from pathlib import Path

from app.setting.config import parameters as param

logger = logging.getLogger(__name__)

state_lock = threading.Lock()
session_started_at = None
session_started_wall_time = None
launch_count = 0
online_users = {}
ONLINE_USER_TTL_SECONDS = 120


def get_state_path():
    return Path(param.RUNTIME_STATE_FILE)


def read_state():
    state_path = get_state_path()
    if not state_path.exists():
        return {}

    try:
        return json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Runtime state could not be read: %s", exc)
        return {}


def write_state(payload):
    state_path = get_state_path()
    state_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = state_path.with_suffix(f"{state_path.suffix}.tmp")
    temp_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    temp_path.replace(state_path)


def get_current_runtime_ms():
    if session_started_at is None:
        return 0.0

    return max((time.perf_counter() - session_started_at) * 1000, 0.0)


def persist_runtime_state(closed=False):
    now = time.time()
    current_runtime_ms = get_current_runtime_ms()

    payload = {
        "total_runtime_ms": 0 if closed else round(current_runtime_ms, 1),
        "current_runtime_ms": 0 if closed else round(current_runtime_ms, 1),
        "launch_count": launch_count,
        "current_launch_started_at": None if closed else session_started_wall_time,
        "last_seen_at": now,
    }

    write_state(payload)


def start_runtime_session():
    global launch_count, session_started_at, session_started_wall_time

    with state_lock:
        if session_started_at is not None:
            return

        state = read_state()
        launch_count = max(int(state.get("launch_count") or 0), 0) + 1
        session_started_at = time.perf_counter()
        session_started_wall_time = time.time()
        persist_runtime_state()


def mark_runtime_seen():
    with state_lock:
        if session_started_at is None:
            return

        persist_runtime_state()


def stop_runtime_session():
    global session_started_at, session_started_wall_time

    with state_lock:
        if session_started_at is None:
            return

        session_started_at = None
        session_started_wall_time = None
        persist_runtime_state(closed=True)


def mark_user_online(user_id):
    with state_lock:
        online_users[str(user_id)] = time.time()


def get_online_user_count():
    now = time.time()

    with state_lock:
        expired_user_ids = [
            user_id
            for user_id, seen_at in online_users.items()
            if now - seen_at > ONLINE_USER_TTL_SECONDS
        ]
        for user_id in expired_user_ids:
            online_users.pop(user_id, None)

        return len(online_users)


def get_runtime_metrics():
    with state_lock:
        current_runtime_ms = get_current_runtime_ms()
        return {
            "total_runtime_ms": round(current_runtime_ms, 1),
            "current_runtime_ms": round(current_runtime_ms, 1),
            "launch_count": launch_count,
        }
