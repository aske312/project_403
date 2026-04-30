# Project_403

MVP-заготовка приватного мессенджера.

В проекте есть:

- React/Vite frontend;
- FastAPI backend;
- debug-страница для проверки API;
- заготовка подключения к PostgreSQL;
- стартовые скрипты для Windows и Ubuntu/Linux.

Подробная памятка по запуску: [RUNBOOK.md](RUNBOOK.md).

## Быстрый старт

### Windows

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

### Ubuntu/Linux

```bash
chmod +x ./start.sh
./start.sh
```

Скрипты сами подготовят окружение: создадут `.env`, `.venv`, установят Python/npm-зависимости и запустят backend + frontend.

## Адреса

- Frontend: http://127.0.0.1:5173
- Debug UI: http://127.0.0.1:5173/debug
- Backend: http://127.0.0.1:8000
- FastAPI docs: http://127.0.0.1:8000/docs

## Основные команды

Установить зависимости и запустить проект:

```bash
./start.sh
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Только подготовить окружение:

```bash
./start.sh --install-only
```

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -InstallOnly
```

Проверить/обновить frontend-сборку:

```bash
./start.sh --build-only
```

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -BuildOnly
```

Обновить репозиторий перед запуском:

```bash
./start.sh --update-repo
```

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -UpdateRepo
```

Ручные frontend-команды:

```bash
npm ci
npm run dev
npm run lint
npm run build
```

Ручной backend-запуск на Linux:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app.start:app --host 127.0.0.1 --port 8000
```

Ручной backend-запуск на Windows:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.start:app --host 127.0.0.1 --port 8000
```

## API

Рабочие debug endpoints:

- `GET /api/debug/check`
- `POST /api/debug/check`
- `PUT /api/debug/check`
- `PATCH /api/debug/check`
- `DELETE /api/debug/check`

Проверка БД:

- `GET /api/db/check_connect`

Если PostgreSQL не запущен, `/api/db/check_connect` вернет ошибку подключения. Это ожидаемо и не мешает запуску приложения.

## .env

`.env` не хранится в git. Если файла нет, стартовый скрипт создаст dev-вариант.

Минимальный пример:

```env
APP_NAME=MessengerAPI
ENV=development
DEBUG=True
HOST=0.0.0.0
PORT=8000
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/messenger_db
JWT_SECRET=change_me_before_public_deploy
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
BUILD_ID=dev
VITE_API_URL=http://127.0.0.1:8000
```

## Архитектура

```mermaid
flowchart LR
    Browser[Browser] --> Frontend[React/Vite]
    Frontend -->|HTTP| Backend[FastAPI]
    Backend -->|asyncpg / SQLAlchemy| DB[(PostgreSQL)]
    Frontend --> Debug[/Debug UI/]
    Debug -->|OpenAPI + probes| Backend
```

## ERD

Планируемая модель данных для мессенджера:

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
        datetime created_at
    }

    CHAT_MEMBERS {
        int chat_id FK
        int user_id FK
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

## UML

Высокоуровневые компоненты:

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
        +APP_NAME
        +DATABASE_URL
        +JWT_SECRET
    }

    class DatabaseSession {
        +engine
    }

    ReactApp --> FastAPIApp : HTTP
    FastAPIApp --> Config
    FastAPIApp --> DatabaseSession
    DatabaseSession --> PostgreSQL
```

## BPMN / процесс

Упрощенный пользовательский процесс:

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

## Текущее ограничение

Регистрация, логин, реальные сообщения и WebSocket-чат пока не реализованы. Сейчас проект подготовлен как чистая стартовая база: frontend, backend, debug API, окружение и скрипты запуска.
