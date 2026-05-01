# Project_403

MVP приватного мессенджера с React/Vite frontend, FastAPI backend, PostgreSQL-моделью данных, JWT-аутентификацией и dev/admin-инструментами для локальной разработки.

## Навигация

- [Текущее состояние](#текущее-состояние)
- [Документация](#документация)
- [Быстрый старт](#быстрый-старт)
- [Адреса](#адреса)
- [PostgreSQL](#postgresql)
- [Команды](#команды)
- [API](#api)
- [Переменные окружения](#переменные-окружения)
- [Диаграммы](#диаграммы)
- [Проверки](#проверки)

## Текущее состояние

Реализовано:

- базовый frontend на React/Vite с RU/EN интерфейсом;
- backend на FastAPI с async SQLAlchemy;
- локальный PostgreSQL через Docker Compose;
- SQLite fallback для локальной разработки без PostgreSQL;
- регистрация и логин пользователей;
- вход по email или handle;
- JWT access token и endpoint текущего профиля;
- роли `owner/user` и признак `is_super_admin`;
- dev seed-пользователи для локальной разработки;
- rate limit для login/register;
- обработка истекшей frontend-сессии;
- admin panel для DEV-режима;
- состояние backend/frontend/Database в админке;
- runtime-state с накоплением общего времени запуска проекта;
- список логов с пагинацией максимум по 10 записей и сортировкой от новых к старым;
- dev-команды рестарта backend/frontend/project из админки;
- стартовые скрипты для Windows и Ubuntu/Linux.

Запланировано ближайшими эпиками:

- список пользователей;
- создание личных и групповых чатов;
- хранение и отображение истории сообщений;
- WebSocket realtime;
- индикаторы доставки, прочтения, typing и online/offline;
- тесты auth/admin/chat сценариев;
- production-профиль запуска ближе к боевому развертыванию.

## Документация

- [docks/plans.md](docks/plans.md) — рабочий план по эпикам и статусам.
- [docks/project-summary.md](docks/project-summary.md) — краткое описание текущего и планируемого функционала без технических команд. Этот документ можно использовать как источник summary для главной страницы.

## Быстрый старт

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Ubuntu/Linux:

```bash
chmod +x ./start.sh
./start.sh
```

Запуск вместе с PostgreSQL через Docker Compose:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -StartDb
```

```bash
./start.sh --start-db
```

Стартовые скрипты создают `.env`, `.venv`, обновляют `pip`, устанавливают Python/npm-зависимости, проверяют frontend-сборку и запускают backend + frontend.

Docker нужен только для локального PostgreSQL. Если Docker недоступен или PostgreSQL не поднят, backend может использовать временный SQLite fallback: `sqlite+aiosqlite:///./local.db`.

## Адреса

| Назначение | URL |
| --- | --- |
| Frontend | http://127.0.0.1:5173 |
| Admin UI | http://127.0.0.1:5173/admin |
| Backend | http://127.0.0.1:8000 |
| FastAPI docs | http://127.0.0.1:8000/docs |

## PostgreSQL

Для локальной БД добавлен [docker-compose.yml](docker-compose.yml).

Поднять только PostgreSQL:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -DbOnly
```

```bash
./start.sh --db-only
```

Или напрямую:

```bash
docker compose up -d db
```

Параметры dev-БД:

```text
host: localhost
port: 5432
database: messenger_db
user: postgres
password: password
```

Backend при старте пытается создать таблицы автоматически, если `AUTO_CREATE_TABLES=True`. Если PostgreSQL недоступен и `DB_FALLBACK_ENABLED=True`, таблицы будут созданы в локальном SQLite-файле `local.db`.

Создать таблицы вручную через API:

```bash
curl -X POST http://127.0.0.1:8000/api/db/init
```

Базовые таблицы:

- `users`
- `chats`
- `chat_members`
- `messages`

## Команды

### Стартовые скрипты

| Действие | Windows | Ubuntu/Linux |
| --- | --- | --- |
| Запуск | `powershell -ExecutionPolicy Bypass -File .\start.ps1` | `./start.sh` |
| Запуск с БД | `powershell -ExecutionPolicy Bypass -File .\start.ps1 -StartDb` | `./start.sh --start-db` |
| Только БД | `powershell -ExecutionPolicy Bypass -File .\start.ps1 -DbOnly` | `./start.sh --db-only` |
| Только подготовка | `powershell -ExecutionPolicy Bypass -File .\start.ps1 -InstallOnly` | `./start.sh --install-only` |
| Проверить сборку | `powershell -ExecutionPolicy Bypass -File .\start.ps1 -BuildOnly` | `./start.sh --build-only` |
| Обновить repo | `powershell -ExecutionPolicy Bypass -File .\start.ps1 -UpdateRepo` | `./start.sh --update-repo` |
| Принудительно npm install | `powershell -ExecutionPolicy Bypass -File .\start.ps1 -ForceInstall` | `./start.sh --force-install` |
| Принудительно build | `powershell -ExecutionPolicy Bypass -File .\start.ps1 -ForceBuild` | `./start.sh --force-build` |

Запуск на других портах:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -BackendPort 18000 -FrontendPort 18001
```

```bash
./start.sh --backend-port 18000 --frontend-port 18001
```

### Frontend

```bash
npm ci
npm run dev
npm run lint
npm run build
```

### Backend

Windows:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.start:app --host 127.0.0.1 --port 8000
```

Ubuntu/Linux:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app.start:app --host 127.0.0.1 --port 8000
```

## API

| Method | Path | Назначение |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Регистрация пользователя |
| `POST` | `/api/auth/login` | Логин по email или handle |
| `GET` | `/api/users/me` | Текущий профиль по bearer-токену |
| `GET` | `/api/admin/health` | Runtime status: version, env, branch, backend stack |
| `GET` | `/api/admin/logs` | Список логов с пагинацией |
| `GET` | `/api/admin/logs/{date}/{file}` | Скачать файл лога |
| `GET` | `/api/admin/commands` | Список доступных admin-команд |
| `POST` | `/api/admin/commands/{command_id}` | Поставить admin-команду в очередь |
| `GET` | `/api/admin/check` | Проверка GET |
| `POST` | `/api/admin/check` | Проверка POST |
| `PUT` | `/api/admin/check` | Проверка PUT |
| `PATCH` | `/api/admin/check` | Проверка PATCH |
| `DELETE` | `/api/admin/check` | Проверка DELETE |
| `GET` | `/api/db/check_connect` | Проверка подключения к БД |
| `POST` | `/api/db/init` | Создание таблиц |

Admin command API доступен только в DEV-режиме пользователю с ролью `owner` и `is_super_admin=True`.

## Переменные окружения

`.env` не хранится в git. Если файла нет, стартовый скрипт создаст dev-вариант.

```env
APP_NAME=MessengerAPI
VERSION=0.0.1
ENV=development
DEBUG=True
AUTO_CREATE_TABLES=True
HOST=0.0.0.0
PORT=8000
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/messenger_db
DB_FALLBACK_ENABLED=True
DB_FALLBACK_URL=sqlite+aiosqlite:///./local.db
JWT_SECRET=change_me_before_public_deploy
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
AUTH_RATE_LIMIT_WINDOW_SECONDS=60
AUTH_LOGIN_RATE_LIMIT_ATTEMPTS=5
AUTH_REGISTER_RATE_LIMIT_ATTEMPTS=3
PROJECT_BRANCH=master
LOG_FILE=logs/app.log
LOG_MAX_BYTES=1048576
LOG_BACKUP_COUNT=3
ADMIN_COMMAND_FILE=logs/admin-command.json
RUNTIME_STATE_FILE=logs/runtime-state.json
VITE_API_URL=http://127.0.0.1:8000
```

Перед публичным deploy надо заменить `JWT_SECRET`, `DATABASE_URL` и другие значения окружения на реальные. Production-профиль запуска будет оформляться отдельным этапом перед развертыванием на боевой сервер.

## Диаграммы

### Архитектура

```mermaid
flowchart LR
    Browser[Browser] --> Frontend[React/Vite]
    Frontend -->|HTTP| Backend[FastAPI]
    Backend -->|SQLAlchemy async| DB[(PostgreSQL)]
    Backend -.fallback.-> SQLite[(SQLite dev fallback)]
    Frontend --> Admin[/Admin UI/]
    Admin -->|health, logs, commands| Backend
    Scripts[start.ps1 / start.sh] -->|runs| Backend
    Scripts -->|runs| Frontend
    Backend -->|admin-command.json| Scripts
```

### ERD

```mermaid
erDiagram
    USERS {
        int id PK
        string email UK
        string handle UK
        string name
        string password_hash
        string role
        boolean is_super_admin
        datetime created_at
    }

    CHATS {
        int id PK
        string title
        datetime created_at
    }

    CHAT_MEMBERS {
        int id PK
        int chat_id FK
        int user_id FK
        datetime joined_at
    }

    MESSAGES {
        int id PK
        int chat_id FK
        int sender_id FK
        text body
        datetime created_at
    }

    USERS ||--o{ CHAT_MEMBERS : joins
    CHATS ||--o{ CHAT_MEMBERS : contains
    CHATS ||--o{ MESSAGES : has
    USERS ||--o{ MESSAGES : sends
```

### Основной пользовательский сценарий

```mermaid
flowchart TD
    Start([Start]) --> OpenApp[Open app]
    OpenApp --> HasToken{Has saved token?}
    HasToken -->|Yes| LoadProfile[Load current profile]
    HasToken -->|No| HasAccount{Has account?}
    HasAccount -->|Yes| Login[Sign in]
    HasAccount -->|No| Register[Create account]
    Register --> Login
    Login --> LoadProfile
    LoadProfile --> OpenMessenger[Open messenger workspace]
    OpenMessenger --> SelectUser[Select user]
    SelectUser --> OpenChat[Open chat]
    OpenChat --> SendMessage[Send message]
```

## Проверки

Frontend:

```bash
npm run lint
npm run build
```

Backend:

```powershell
.\.venv\Scripts\python.exe -m compileall app
```

Ubuntu/Linux:

```bash
.venv/bin/python -m compileall app
```
