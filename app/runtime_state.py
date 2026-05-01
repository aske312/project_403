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
accumulated_runtime_ms = 0.0
launch_count = 0


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
    total_runtime_ms = accumulated_runtime_ms + current_runtime_ms

    payload = {
        "total_runtime_ms": round(total_runtime_ms, 1),
        "current_runtime_ms": 0 if closed else round(current_runtime_ms, 1),
        "launch_count": launch_count,
        "current_launch_started_at": None if closed else session_started_wall_time,
        "last_seen_at": now,
    }

    write_state(payload)


def start_runtime_session():
    global accumulated_runtime_ms, launch_count, session_started_at, session_started_wall_time

    with state_lock:
        if session_started_at is not None:
            return

        state = read_state()
        accumulated_runtime_ms = max(float(state.get("total_runtime_ms") or 0), 0.0)
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
    global accumulated_runtime_ms, session_started_at, session_started_wall_time

    with state_lock:
        if session_started_at is None:
            return

        accumulated_runtime_ms += get_current_runtime_ms()
        session_started_at = None
        session_started_wall_time = None
        persist_runtime_state(closed=True)


def get_runtime_metrics():
    with state_lock:
        current_runtime_ms = get_current_runtime_ms()
        return {
            "total_runtime_ms": round(accumulated_runtime_ms + current_runtime_ms, 1),
            "current_runtime_ms": round(current_runtime_ms, 1),
            "launch_count": launch_count,
        }
