# Project_403

MVP-заготовка приватного мессенджера: React/Vite frontend, FastAPI backend, debug UI и подготовка к PostgreSQL.

## Навигация

- [Быстрый старт](#быстрый-старт)
- [Bootstrap на новом сервере](#bootstrap-на-новом-сервере)
- [Адреса](#адреса)
- [Команды](#команды)
- [API](#api)
- [Переменные окружения](#переменные-окружения)
- [База данных](#база-данных)
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

Стартовые скрипты создают `.env`, `.venv`, устанавливают Python/npm-зависимости и запускают backend + frontend.

## Bootstrap на новом сервере

`start.ps1` и `start.sh` можно запускать внутри уже склонированного проекта или как отдельный файл на новой машине.

Репозиторий по умолчанию:

```text
https://github.com/aske312/project_403.git
```

Ubuntu/Linux bootstrap:

```bash
chmod +x ./start.sh
./start.sh
```

Скрипт может установить через `apt-get`: `git`, `python3`, `python3-venv`, `python3-pip`, `curl`, `ca-certificates`. Если Node.js отсутствует или версия ниже 20, скрипт поставит Node.js 20 LTS через NodeSource. Для этого нужны интернет и права `sudo`.

Windows bootstrap:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Скрипт может установить через `winget`: Git, Python и Node.js/npm. После установки через `winget` иногда нужно открыть новую PowerShell-сессию, чтобы обновился `PATH`.

Другой репозиторий или каталог:

```bash
./start.sh --repo-url https://github.com/user/repo.git --project-dir my-app
```

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -RepoUrl https://github.com/user/repo.git -ProjectDir my-app
```

Не трогать системные зависимости:

```bash
./start.sh --skip-system-deps
```

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -SkipSystemDeps
```

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

`--update-repo` / `-UpdateRepo` выполняет `git pull --ff-only`. Если есть локальные изменения или нужен merge/rebase, обновление надо сделать вручную.

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

Если PostgreSQL не запущен, `/api/db/check_connect` вернет ошибку подключения. Это ожидаемо и не мешает запуску приложения.

## Переменные окружения

`.env` не хранится в git. Если файла нет, стартовый скрипт создаст dev-вариант.

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

Перед публичным deploy надо заменить `JWT_SECRET`, `DATABASE_URL` и другие значения окружения на реальные.

## База данных

PostgreSQL пока не запускается автоматически. В `start.ps1` и `start.sh` есть закомментированная заготовка для Docker и Docker Compose.

Ожидаемая dev-строка подключения:

```text
postgresql+asyncpg://postgres:password@localhost:5432/messenger_db
```

Пока БД не запущена, `/api/debug/check` должен работать, а `/api/db/check_connect` ожидаемо вернет ошибку подключения.

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

Планируемая модель данных:

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

Сейчас реализованы frontend-заготовка, FastAPI-приложение, debug API, проверка подключения к БД и скрипты запуска.

Регистрация, логин, реальные сообщения и WebSocket-чат пока не реализованы.
