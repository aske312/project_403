# Project_403

MVP-заготовка приватного мессенджера: React/Vite frontend, FastAPI backend, debug UI и PostgreSQL-схема на будущее.

## Навигация

- [Быстрый старт](#быстрый-старт)
- [PostgreSQL](#postgresql)
- [Адреса](#адреса)
- [Команды](#команды)
- [API](#api)
- [Переменные окружения](#переменные-окружения)
- [Диаграммы](#диаграммы)
- [Текущее состояние](#текущее-состояние)

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

Стартовые скрипты создают `.env`, `.venv`, устанавливают Python/npm-зависимости, проверяют frontend-сборку и запускают backend + frontend.

Docker нужен только для локального PostgreSQL. При запуске с БД скрипты проверяют Docker и пробуют установить его автоматически:

- Windows: Docker Desktop через `winget`;
- Ubuntu/Linux: Docker Engine из официального apt-репозитория Docker.

После установки Docker Desktop на Windows может понадобиться открыть Docker Desktop, принять условия использования и запустить новую PowerShell-сессию.

Если установка Docker Desktop на Windows завершается ошибкой, проверь:

- PowerShell запущен с правами администратора;
- включена виртуализация;
- установлен WSL2 или доступен Hyper-V backend;
- после установки Docker Desktop открыт хотя бы один раз.

## PostgreSQL

Для локальной БД добавлен [docker-compose.yml](docker-compose.yml).

Если Docker не установлен, команды `-StartDb`, `-DbOnly`, `--start-db` и `--db-only` попробуют установить его автоматически. Автоустановка отключается через `-SkipSystemDeps` / `--skip-system-deps`.

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

Backend при старте пытается создать таблицы автоматически, если `AUTO_CREATE_TABLES=True`. Если БД недоступна, backend продолжит стартовать, а `/api/db/check_connect` покажет ошибку подключения.

Создать таблицы вручную через API:

```bash
curl -X POST http://127.0.0.1:8000/api/db/init
```

Создаваемые таблицы:

- `users`
- `chats`
- `chat_members`
- `messages`

## Адреса

| Назначение | URL |
| --- | --- |
| Frontend | http://127.0.0.1:5173 |
| Debug UI | http://127.0.0.1:5173/debug |
| Backend | http://127.0.0.1:8000 |
| FastAPI docs | http://127.0.0.1:8000/docs |

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

```bash
./start.sh --backend-port 18000 --frontend-port 18001
```

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -BackendPort 18000 -FrontendPort 18001
```

### Frontend

```bash
npm ci
npm run dev
npm run lint
npm run build
```

### Backend

Linux:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app.start:app --host 127.0.0.1 --port 8000
```

Windows:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.start:app --host 127.0.0.1 --port 8000
```

## API

| Method | Path | Назначение |
| --- | --- | --- |
| `GET` | `/api/debug/check` | Проверка GET |
| `POST` | `/api/debug/check` | Проверка POST |
| `PUT` | `/api/debug/check` | Проверка PUT |
| `PATCH` | `/api/debug/check` | Проверка PATCH |
| `DELETE` | `/api/debug/check` | Проверка DELETE |
| `GET` | `/api/db/check_connect` | Проверка подключения к БД |
| `POST` | `/api/db/init` | Создание таблиц |

## Переменные окружения

`.env` не хранится в git. Если файла нет, стартовый скрипт создаст dev-вариант.

```env
APP_NAME=MessengerAPI
ENV=development
DEBUG=True
AUTO_CREATE_TABLES=True
HOST=0.0.0.0
PORT=8000
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/messenger_db
JWT_SECRET=change_me_before_public_deploy
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
BUILD_ID=dev
VITE_API_URL=http://127.0.0.1:8000
```

Перед публичным deploy надо заменить `JWT_SECRET`, `DATABASE_URL` и другие значения окружения на реальные.

## Диаграммы

### Архитектура

```mermaid
flowchart LR
    Browser[Browser] --> Frontend[React/Vite]
    Frontend -->|HTTP| Backend[FastAPI]
    Backend -->|asyncpg / SQLAlchemy| DB[(PostgreSQL)]
    Frontend --> Debug[/Debug UI/]
    Debug -->|OpenAPI + probes| Backend
```

### ERD

```mermaid
erDiagram
    USERS {
        int id PK
        string email UK
        string name
        string password_hash
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

### UML

```mermaid
classDiagram
    class ReactApp {
        +Home
        +Debug
    }

    class FastAPIApp {
        +debugRouter
        +dbRouter
    }

    class Config {
        +DATABASE_URL
        +AUTO_CREATE_TABLES
    }

    class DatabaseSession {
        +engine
        +init_db()
    }

    class Models {
        +User
        +Chat
        +ChatMember
        +Message
    }

    ReactApp --> FastAPIApp : HTTP
    FastAPIApp --> Config
    FastAPIApp --> DatabaseSession
    DatabaseSession --> Models
    DatabaseSession --> PostgreSQL
```

### BPMN-like процесс

```mermaid
flowchart TD
    Start([Start]) --> OpenApp[Open app]
    OpenApp --> HasAccount{Has account?}
    HasAccount -->|Yes| Login[Sign in]
    HasAccount -->|No| Register[Create account]
    Register --> Login
    Login --> OpenChat[Open chat]
    OpenChat --> SendMessage[Send message]
    SendMessage --> SaveMessage[Save message to DB]
    SaveMessage --> DeliverMessage[Deliver to recipient]
    DeliverMessage --> End([End])
```

## Текущее состояние

Сейчас реализованы frontend-заготовка, FastAPI-приложение, debug API, PostgreSQL Docker Compose, SQLAlchemy-модели и автоматическое создание базовых таблиц.

Регистрация, логин, реальные сообщения и WebSocket-чат пока не реализованы.
