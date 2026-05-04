import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from app.setting.config import parameters as param

ADMIN_COMMANDS = {
    "restart_backend": ("Restart backend", ("backend",)),
    "restart_frontend": ("Restart frontend", ("frontend",)),
    "restart_project": ("Restart project", ("backend", "frontend")),
}


def get_command_path():
    return Path(param.ADMIN_COMMAND_FILE)


def write_json_atomic(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(f"{path.suffix}.tmp")
    temp_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    temp_path.replace(path)


def list_admin_commands():
    if not param.ADMIN_COMMANDS_ENABLED:
        return []

    return [
        {
            "id": command_id,
            "label": label,
            "services": list(services),
        }
        for command_id, (label, services) in ADMIN_COMMANDS.items()
    ]


def read_admin_command_state():
    command_path = get_command_path()
    if not command_path.exists():
        return None

    try:
        return json.loads(command_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {
            "status": "invalid",
            "file": str(command_path),
        }


def queue_admin_command(command_id, requested_by):
    if not param.ADMIN_COMMANDS_ENABLED:
        return None

    if command_id not in ADMIN_COMMANDS:
        return None

    now = datetime.now(timezone.utc)
    label, services = ADMIN_COMMANDS[command_id]
    payload = {
        "id": uuid4().hex,
        "command": command_id,
        "label": label,
        "services": list(services),
        "status": "pending",
        "requested_by": requested_by,
        "requested_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=param.ADMIN_COMMAND_TTL_SECONDS)).isoformat(),
    }
    write_json_atomic(get_command_path(), payload)
    return payload
