#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REPO_URL="https://github.com/aske312/project_403.git"

REPO_URL="$DEFAULT_REPO_URL"
PROJECT_DIR=""
UPDATE_REPO=0
SKIP_SYSTEM_DEPS=0
SKIP_INSTALL=0
SKIP_BUILD=0
START_DB=0
START_REDIS=0
DB_ONLY=0
REDIS_ONLY=0
INSTALL_ONLY=0
BUILD_ONLY=0
FORCE_INSTALL=0
FORCE_BUILD=0
BACKEND_HOST="127.0.0.1"
BACKEND_PORT="8000"
FRONTEND_HOST="127.0.0.1"
FRONTEND_PORT="5173"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --repo-url)
            REPO_URL="$2"
            shift 2
            ;;
        --project-dir)
            PROJECT_DIR="$2"
            shift 2
            ;;
        --update-repo)
            UPDATE_REPO=1
            shift
            ;;
        --skip-system-deps)
            SKIP_SYSTEM_DEPS=1
            shift
            ;;
        --skip-install)
            SKIP_INSTALL=1
            shift
            ;;
        --skip-build)
            SKIP_BUILD=1
            shift
            ;;
        --start-db)
            START_DB=1
            shift
            ;;
        --start-redis)
            START_REDIS=1
            shift
            ;;
        --db-only)
            DB_ONLY=1
            shift
            ;;
        --redis-only)
            REDIS_ONLY=1
            shift
            ;;
        --install-only)
            INSTALL_ONLY=1
            shift
            ;;
        --build-only)
            BUILD_ONLY=1
            shift
            ;;
        --force-install)
            FORCE_INSTALL=1
            shift
            ;;
        --force-build)
            FORCE_BUILD=1
            shift
            ;;
        -h|--help)
            cat <<'HELP'
Usage: ./start.sh [options]

Bootstrap options:
  --repo-url URL          Repository URL to clone when script is outside the project.
  --project-dir DIR       Target directory for clone. Default: project_403.
  --update-repo           Run git pull --ff-only before installing/running.
  --skip-system-deps      Do not install missing system packages.

Project options:
  --skip-install          Skip Python/npm dependency installation.
  --skip-build            Skip frontend dist freshness check.
  --start-db              Start PostgreSQL using docker compose before app startup.
  --start-redis           Start Redis using docker compose before app startup.
  --db-only               Start PostgreSQL using docker compose and exit.
  --redis-only            Start Redis using docker compose and exit.
  --install-only          Prepare environment and exit.
  --build-only            Prepare/check frontend build and exit.
  --force-install         Reinstall npm dependencies.
  --force-build           Run npm run build unconditionally.
  Host and port settings are read only from .env.
HELP
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

STARTUP_LOG_DIR="logs/startup"
mkdir -p "$STARTUP_LOG_DIR"
STARTUP_STAMP="$(date -u +%Y%m%d-%H%M%S)"
STARTUP_LOG_FILE="$STARTUP_LOG_DIR/launcher-$STARTUP_STAMP.log"
RUNTIME_LOG_DIR="logs/runtime/run-$STARTUP_STAMP"
mkdir -p "$RUNTIME_LOG_DIR"
BACKEND_STDOUT_LOG="$RUNTIME_LOG_DIR/backend.stdout.log"
BACKEND_STDERR_LOG="$RUNTIME_LOG_DIR/backend.stderr.log"
FRONTEND_STDOUT_LOG="$RUNTIME_LOG_DIR/frontend.stdout.log"
FRONTEND_STDERR_LOG="$RUNTIME_LOG_DIR/frontend.stderr.log"

log_detail() {
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >>"$STARTUP_LOG_FILE"
}

run_logged() {
    log_detail "RUN: $*"
    "$@" >>"$STARTUP_LOG_FILE" 2>&1
}

run_logged_checked() {
    if run_logged "$@"; then
        log_detail "EXIT: 0"
        return 0
    fi

    local rc=$?
    log_detail "EXIT: $rc"
    echo "Command failed: $*" >&2
    exit 1
}

status() {
    local percent="$1"
    local stage="$2"
    local message="$3"
    local bar_width=24
    local filled=$((percent * bar_width / 100))
    local empty=$((bar_width - filled))
    local bar
    bar="$(printf '%*s' "$filled" '' | tr ' ' '#')$(printf '%*s' "$empty" '' | tr ' ' '-')"

    log_detail "[$percent%] $stage: $message"
    printf '\r[%s] %3s%% %-10s' "$bar" "$percent" "$stage"
}

step() {
    log_detail "==> $1"
}

status 0 "launcher" "boot"

wait_for_http_endpoint() {
    local url="$1"
    local label="$2"
    local percent_start="$3"
    local percent_ready="$4"
    local pid="${5:-}"
    local timeout_seconds="${6:-120}"

    status "$percent_start" "$label" "waiting"
    local deadline=$((SECONDS + timeout_seconds))

    while [[ "$SECONDS" -lt "$deadline" ]]; do
        if [[ -n "$pid" ]] && ! kill -0 "$pid" 2>/dev/null; then
            wait "$pid"
            exit $?
        fi

        if curl -fsS --max-time 5 "$url" >/dev/null; then
            status "$percent_ready" "$label" "ready"
            return 0
        fi

        sleep 1
    done

    log_detail "TIMEOUT: $label $url"
    echo "$label did not become ready at $url within $timeout_seconds seconds." >&2
    exit 1
}

wait_for_docker_healthy() {
    local container_name="$1"
    local label="$2"
    local percent_start="$3"
    local percent_ready="$4"
    local timeout_seconds="${5:-120}"

    status "$percent_start" "$label" "waiting"
    local deadline=$((SECONDS + timeout_seconds))

    while [[ "$SECONDS" -lt "$deadline" ]]; do
        local health
        health="$(docker inspect --format '{{.State.Health.Status}}' "$container_name" 2>/dev/null | head -n 1 || true)"
        if [[ "$health" == "healthy" ]]; then
            status "$percent_ready" "$label" "ready"
            return 0
        fi

        sleep 1
    done

    log_detail "TIMEOUT: $label $container_name"
    echo "$label did not become healthy within $timeout_seconds seconds." >&2
    exit 1
}

has_command() {
    command -v "$1" >/dev/null 2>&1
}

need_command() {
    if ! has_command "$1"; then
        echo "$1 is not installed or is not available in PATH." >&2
        exit 1
    fi
}

dotenv_value() {
    local key="$1"

    [[ -f ".env" ]] || return 1

    awk -F= -v key="$key" '
        /^[[:space:]]*#/ { next }
        /^[[:space:]]*$/ { next }
        {
            current=$1
            gsub(/^[[:space:]]+|[[:space:]]+$/, "", current)
            if (current == key) {
                value=substr($0, index($0, "=") + 1)
                gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
                gsub(/^"|"$/, "", value)
                gsub(/^'\''|'\''$/, "", value)
                print value
                exit
            }
        }
    ' .env
}

sudo_cmd() {
    if [[ "$(id -u)" -eq 0 ]]; then
        "$@"
    else
        sudo "$@"
    fi
}

install_system_deps() {
    if [[ "$SKIP_SYSTEM_DEPS" -eq 1 ]]; then
        return
    fi

    local missing=()
    has_command git || missing+=("git")
    has_command python3 || missing+=("python3")
    has_command curl || missing+=("curl")

    if [[ "${#missing[@]}" -eq 0 ]]; then
        true
    else
        if ! has_command apt-get; then
            echo "Missing commands: ${missing[*]}." >&2
            echo "Automatic system package installation is supported only on apt-based Linux distributions." >&2
            exit 1
        fi

        step "Installing system dependencies"
        sudo_cmd apt-get update
        sudo_cmd apt-get install -y git python3 python3-venv python3-pip curl ca-certificates
    fi

    local node_major=0
    if has_command node; then
        node_major="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
    fi

    if ! has_command npm || [[ "$node_major" -lt 20 ]]; then
        if ! has_command apt-get; then
            echo "Node.js 20+ and npm are required." >&2
            exit 1
        fi

        step "Installing Node.js 20 LTS"
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo_cmd bash -
        sudo_cmd apt-get install -y nodejs
    fi
}

install_docker() {
    if has_command docker; then
        return
    fi

    if [[ "$SKIP_SYSTEM_DEPS" -eq 1 ]]; then
        echo "Docker is not installed or is not available in PATH." >&2
        exit 1
    fi

    if ! has_command apt-get; then
        echo "Docker auto-install is supported only on apt-based Linux distributions." >&2
        exit 1
    fi

    step "Installing Docker Engine"
    sudo_cmd apt-get update
    sudo_cmd apt-get install -y ca-certificates curl
    sudo_cmd install -m 0755 -d /etc/apt/keyrings
    sudo_cmd curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo_cmd chmod a+r /etc/apt/keyrings/docker.asc

    . /etc/os-release
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" |
        sudo_cmd tee /etc/apt/sources.list.d/docker.list >/dev/null

    sudo_cmd apt-get update
    sudo_cmd apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

repo_dir_name() {
    local name
    name="$(basename "$REPO_URL")"
    name="${name%.git}"
    printf '%s\n' "${name:-project_403}"
}

enter_or_clone_project() {
    if [[ -f "package.json" && -d "app" && -d "src" ]]; then
        return
    fi

    need_command git

    local target="${PROJECT_DIR:-$(repo_dir_name)}"
    if [[ ! -d "$target/.git" ]]; then
        step "Cloning repository"
        git clone "$REPO_URL" "$target"
    fi

    cd "$target"
}

ensure_env_file() {
    if [[ -f ".env" ]]; then
        return
    fi

    echo "Settings file is missing. Create the project settings file before starting the app." >&2
    exit 1
}

build_outdated() {
    if [[ "$FORCE_BUILD" -eq 1 ]]; then
        return 0
    fi

    if [[ ! -f "dist/index.html" ]]; then
        return 0
    fi

    local input
    for input in index.html package.json package-lock.json vite.config.js .env src public; do
        if [[ -e "$input" ]] && find "$input" -type f -newer "dist/index.html" -print -quit | grep -q .; then
            return 0
        fi
    done

    return 1
}

start_database() {
    if [[ ! -f "docker-compose.yml" ]]; then
        echo "docker-compose.yml was not found." >&2
        exit 1
    fi

    install_docker

    log_detail "RUN: docker compose up -d db"
    step "Starting PostgreSQL"
    docker compose up -d db
}

start_redis() {
    if [[ ! -f "docker-compose.yml" ]]; then
        echo "docker-compose.yml was not found." >&2
        exit 1
    fi

    install_docker

    log_detail "RUN: docker compose up -d redis"
    step "Starting Redis"
    if docker compose up -d redis >>"$STARTUP_LOG_FILE" 2>&1; then
        log_detail "EXIT: 0"
    else
        local rc=$?
        log_detail "EXIT: $rc"
        return 1
    fi
}

install_system_deps
enter_or_clone_project

status 10 "launcher" "environment loaded"

if [[ "$UPDATE_REPO" -eq 1 ]]; then
    if [[ ! -d ".git" ]]; then
        echo "This directory is not a git repository." >&2
        exit 1
    fi

    step "Updating repository"
    git pull --ff-only
fi

ensure_env_file

BACKEND_HOST="$(dotenv_value HOST || printf '%s' "$BACKEND_HOST")"
BACKEND_PORT="$(dotenv_value PORT || printf '%s' "$BACKEND_PORT")"
FRONTEND_HOST="$(dotenv_value FRONTEND_HOST || printf '%s' "$FRONTEND_HOST")"
FRONTEND_PORT="$(dotenv_value FRONTEND_PORT || printf '%s' "$FRONTEND_PORT")"

if [[ "$START_DB" -eq 1 || "$DB_ONLY" -eq 1 ]]; then
    status 20 "postgres" "starting"
    start_database
    wait_for_docker_healthy "project_403_postgres" "postgres" 24 30
fi

if [[ "$DB_ONLY" -eq 1 ]]; then
    status 30 "postgres" "ready"
    printf '\n'
    exit 0
fi

if [[ "$START_REDIS" -eq 1 || "$REDIS_ONLY" -eq 1 ]]; then
    status 32 "redis" "starting"
    if start_redis; then
        wait_for_docker_healthy "project_403_redis" "redis" 36 40
    else
        log_detail "Redis start failed, continuing without Redis"
        status 40 "redis" "unavailable"
        if [[ "$REDIS_ONLY" -eq 1 ]]; then
            exit 1
        fi
    fi
fi

if [[ "$REDIS_ONLY" -eq 1 ]]; then
    status 40 "redis" "ready"
    printf '\n'
    exit 0
fi

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
    status 45 "deps" "preparing"
    if [[ ! -x ".venv/bin/python" ]]; then
        status 47 "deps" "creating venv"
        run_logged_checked python3 -m venv .venv
    fi

    status 50 "deps" "updating pip"
    run_logged_checked .venv/bin/python -m pip install --upgrade pip

    status 53 "deps" "installing python"
    run_logged_checked .venv/bin/python -m pip install -r requirements.txt

    need_command npm

    if [[ "$FORCE_INSTALL" -eq 1 || ! -d "node_modules" ]]; then
        status 57 "deps" "installing frontend"
        if [[ -f "package-lock.json" ]]; then
            run_logged_checked npm ci
        else
            run_logged_checked npm install
        fi
    fi
    status 60 "deps" "ready"
fi

if [[ "$INSTALL_ONLY" -eq 1 ]]; then
    status 60 "launcher" "environment ready"
    printf '\n'
    exit 0
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
    status 65 "frontend" "building"
    if build_outdated; then
        status 67 "frontend" "bundling"
        run_logged_checked npm run build
    fi
    status 70 "frontend" "build ready"
fi

if [[ "$BUILD_ONLY" -eq 1 ]]; then
    status 70 "launcher" "build ready"
    printf '\n'
    exit 0
fi

cleanup() {
    step "Stopping processes"
    if [[ -n "${BACKEND_PID:-}" ]]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [[ -n "${FRONTEND_PID:-}" ]]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

ADMIN_COMMAND_FILE="$(dotenv_value ADMIN_COMMAND_FILE || printf '%s' "${ADMIN_COMMAND_FILE:-logs/admin-command.json}")"
ADMIN_COMMAND_ARCHIVE_DIR="logs/admin-commands"

start_backend() {
    log_detail "RUN: .venv/bin/python -m uvicorn app.start:app --host $BACKEND_HOST --port $BACKEND_PORT"
    log_detail "BACKEND_LOGS: stdout=$BACKEND_STDOUT_LOG stderr=$BACKEND_STDERR_LOG"
    .venv/bin/python -m uvicorn app.start:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" >>"$BACKEND_STDOUT_LOG" 2>>"$BACKEND_STDERR_LOG" &
    BACKEND_PID=$!
}

start_frontend() {
    log_detail "RUN: npm run dev -- --host $FRONTEND_HOST --port $FRONTEND_PORT"
    log_detail "FRONTEND_LOGS: stdout=$FRONTEND_STDOUT_LOG stderr=$FRONTEND_STDERR_LOG"
    npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" >>"$FRONTEND_STDOUT_LOG" 2>>"$FRONTEND_STDERR_LOG" &
    FRONTEND_PID=$!
}

stop_service() {
    local pid="$1"
    local name="$2"

    if [[ -z "$pid" ]]; then
        return
    fi

    if kill -0 "$pid" 2>/dev/null; then
        step "Stopping $name"
        kill "$pid" 2>/dev/null || true
        wait "$pid" 2>/dev/null || true
    fi
}

read_admin_command_field() {
    local field="$1"

    [[ -f "$ADMIN_COMMAND_FILE" ]] || return 1
    .venv/bin/python - "$ADMIN_COMMAND_FILE" "$field" <<'PY'
import json
import sys

path, field = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as command_file:
    payload = json.load(command_file)
print(payload.get(field, ""))
PY
}

admin_command_expired() {
    [[ -f "$ADMIN_COMMAND_FILE" ]] || return 1
    .venv/bin/python - "$ADMIN_COMMAND_FILE" <<'PY'
import json
import sys
from datetime import datetime, timezone

with open(sys.argv[1], encoding="utf-8") as command_file:
    payload = json.load(command_file)

expires_at = payload.get("expires_at")
if not expires_at:
    raise SystemExit(1)

expires_at = datetime.fromisoformat(expires_at)
if expires_at.tzinfo is None:
    expires_at = expires_at.replace(tzinfo=timezone.utc)

raise SystemExit(0 if expires_at < datetime.now(timezone.utc) else 1)
PY
}

archive_admin_command() {
    [[ -f "$ADMIN_COMMAND_FILE" ]] || return
    mkdir -p "$ADMIN_COMMAND_ARCHIVE_DIR"

    local command_id
    command_id="$(read_admin_command_field id 2>/dev/null || true)"
    if [[ -z "$command_id" ]]; then
        command_id="invalid-$(date -u +%s)"
    fi

    mv -f "$ADMIN_COMMAND_FILE" "$ADMIN_COMMAND_ARCHIVE_DIR/$command_id.json"
}

handle_admin_command() {
    [[ -f "$ADMIN_COMMAND_FILE" ]] || return

    if admin_command_expired 2>/dev/null; then
        echo "Admin command expired: $(read_admin_command_field command 2>/dev/null || true)" >&2
        archive_admin_command
        return
    fi

    local command
    command="$(read_admin_command_field command 2>/dev/null || true)"

    case "$command" in
        restart_backend)
            stop_service "$BACKEND_PID" "backend"
            start_backend
            archive_admin_command
            ;;
        restart_frontend)
            stop_service "$FRONTEND_PID" "frontend"
            start_frontend
            archive_admin_command
            ;;
        restart_project)
            stop_service "$FRONTEND_PID" "frontend"
            stop_service "$BACKEND_PID" "backend"
            start_backend
            start_frontend
            archive_admin_command
            ;;
        *)
            echo "Unknown admin command: $command" >&2
            archive_admin_command
            ;;
    esac
}

status 75 "backend" "starting"
start_backend
wait_for_http_endpoint "http://$BACKEND_HOST:$BACKEND_PORT/api/admin/health" "backend" 78 85 "$BACKEND_PID"

status 88 "frontend" "starting"
start_frontend
wait_for_http_endpoint "http://$FRONTEND_HOST:$FRONTEND_PORT/__project403/frontend-metrics" "frontend" 90 96 "$FRONTEND_PID"

status 100 "launcher" "project ready"
printf '\n'
printf '\nFrontend: http://%s:%s\n' "$FRONTEND_HOST" "$FRONTEND_PORT"
printf 'Backend:  http://%s:%s\n' "$BACKEND_HOST" "$BACKEND_PORT"
printf 'Startup log: %s\n' "$STARTUP_LOG_FILE"
printf 'Runtime logs: %s\n' "$RUNTIME_LOG_DIR"
printf 'Press Ctrl+C to stop both processes.\n'

while true; do
    handle_admin_command

    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        wait "$BACKEND_PID"
        exit $?
    fi

    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
        wait "$FRONTEND_PID"
        exit $?
    fi

    sleep 1
done
