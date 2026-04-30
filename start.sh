#!/usr/bin/env bash
set -euo pipefail

UPDATE_REPO=0
SKIP_INSTALL=0
SKIP_BUILD=0
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
        --update-repo)
            UPDATE_REPO=1
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
        --backend-host)
            BACKEND_HOST="$2"
            shift 2
            ;;
        --backend-port)
            BACKEND_PORT="$2"
            shift 2
            ;;
        --frontend-host)
            FRONTEND_HOST="$2"
            shift 2
            ;;
        --frontend-port)
            FRONTEND_PORT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: ./start.sh [--update-repo] [--skip-install] [--skip-build] [--install-only] [--build-only] [--force-install] [--force-build] [--backend-host HOST] [--backend-port PORT] [--frontend-host HOST] [--frontend-port PORT]"
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

step() {
    printf '\n==> %s\n' "$1"
}

need_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "$1 is not installed or is not available in PATH." >&2
        exit 1
    fi
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

if [[ ! -f ".env" ]]; then
    echo "Warning: .env was not found. Backend will use defaults where available; database and auth settings may be missing." >&2
fi

if [[ "$UPDATE_REPO" -eq 1 ]]; then
    need_command git

    if [[ ! -d ".git" ]]; then
        echo "This directory is not a git repository. Clone the repository first." >&2
        exit 1
    fi

    step "Updating repository"
    git pull --ff-only
fi

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
    if [[ ! -x ".venv/bin/python" ]]; then
        step "Creating Python virtual environment"
        if command -v python3 >/dev/null 2>&1; then
            python3 -m venv .venv
        elif command -v python >/dev/null 2>&1; then
            python -m venv .venv
        else
            echo "Python 3 is not installed or is not available in PATH." >&2
            exit 1
        fi
    fi

    step "Installing Python dependencies"
    .venv/bin/python -m pip install -r requirements.txt

    need_command npm

    if [[ "$FORCE_INSTALL" -eq 1 || ! -d "node_modules" ]]; then
        step "Installing frontend dependencies"
        if [[ -f "package-lock.json" ]]; then
            npm ci
        else
            npm install
        fi
    else
        step "Frontend dependencies already installed"
    fi
fi

if [[ "$INSTALL_ONLY" -eq 1 ]]; then
    step "Environment is ready"
    exit 0
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
    if build_outdated; then
        step "Building frontend"
        npm run build
    else
        step "Frontend build is up to date"
    fi
fi

if [[ "$BUILD_ONLY" -eq 1 ]]; then
    step "Build is ready"
    exit 0
fi

# Database startup placeholder. Keep disabled until local DB orchestration is chosen.
#
# Docker example:
# step "Starting PostgreSQL"
# docker run --name messenger-postgres \
#     -e POSTGRES_DB=messenger_db \
#     -e POSTGRES_USER=postgres \
#     -e POSTGRES_PASSWORD=password \
#     -p 5432:5432 \
#     -d postgres:16
#
# Docker Compose example:
# docker compose up -d db

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

step "Starting backend"
.venv/bin/python -m uvicorn app.start:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" &
BACKEND_PID=$!

step "Starting frontend"
npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" &
FRONTEND_PID=$!

printf '\nFrontend: http://%s:%s\n' "$FRONTEND_HOST" "$FRONTEND_PORT"
printf 'Backend:  http://%s:%s\n' "$BACKEND_HOST" "$BACKEND_PORT"
printf 'Press Ctrl+C to stop both processes.\n'

while true; do
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
