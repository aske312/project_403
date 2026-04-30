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
DB_ONLY=0
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
        --db-only)
            DB_ONLY=1
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
  --db-only               Start PostgreSQL using docker compose and exit.
  --install-only          Prepare environment and exit.
  --build-only            Prepare/check frontend build and exit.
  --force-install         Reinstall npm dependencies.
  --force-build           Run npm run build unconditionally.
  --backend-host HOST     Backend host. Default: 127.0.0.1.
  --backend-port PORT     Backend port. Default: 8000.
  --frontend-host HOST    Frontend host. Default: 127.0.0.1.
  --frontend-port PORT    Frontend port. Default: 5173.
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

step() {
    printf '\n==> %s\n' "$1"
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

    step "Creating default .env"
    local project_branch
    project_branch="$(git branch --show-current 2>/dev/null || true)"
    if [[ -z "$project_branch" ]]; then
        project_branch="unknown"
    fi
    cat > .env <<EOF
# APPLICATION
APP_NAME=Project_403
VERSION=0.0.1
ENV=development
DEBUG=True
AUTO_CREATE_TABLES=True

# SERVER
HOST=0.0.0.0
PORT=$BACKEND_PORT

# DATABASE
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/messenger_db
DB_FALLBACK_ENABLED=True
DB_FALLBACK_URL=sqlite+aiosqlite:///./local.db

# AUTH
JWT_SECRET=change_me_before_public_deploy
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# BUILD
PROJECT_BRANCH=$project_branch

# LOGGING
LOG_DIR=logs
LOG_FILE=logs/app.log
LOG_MAX_BYTES=1048576
LOG_BACKUP_COUNT=3

# UI_API
VITE_API_URL=http://$BACKEND_HOST:$BACKEND_PORT
EOF
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

    step "Starting PostgreSQL"
    docker compose up -d db
}

install_system_deps
enter_or_clone_project

if [[ "$UPDATE_REPO" -eq 1 ]]; then
    if [[ ! -d ".git" ]]; then
        echo "This directory is not a git repository." >&2
        exit 1
    fi

    step "Updating repository"
    git pull --ff-only
fi

ensure_env_file

if [[ "$START_DB" -eq 1 || "$DB_ONLY" -eq 1 ]]; then
    start_database
fi

if [[ "$DB_ONLY" -eq 1 ]]; then
    step "Database is ready"
    exit 0
fi

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
    if [[ ! -x ".venv/bin/python" ]]; then
        step "Creating Python virtual environment"
        python3 -m venv .venv
    fi

    step "Updating pip"
    .venv/bin/python -m pip install --upgrade pip

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
