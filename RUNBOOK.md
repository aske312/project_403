# Project Runbook

Памятка по bootstrap-запуску проекта на новом сервере и по обычному локальному запуску.

## Что теперь умеют стартовые скрипты

`start.sh` и `start.ps1` можно запускать двумя способами:

- внутри уже склонированного проекта;
- как отдельный файл на новой машине: скрипт сам поставит доступные системные зависимости, склонирует репозиторий и подготовит проект.

Репозиторий по умолчанию:

```text
https://github.com/aske312/project_403.git
```

## Новый Ubuntu/Linux сервер

Минимальный сценарий:

```bash
chmod +x ./start.sh
./start.sh
```

Скрипт выполнит:

- установку системных пакетов через `apt-get`: `git`, `python3`, `python3-venv`, `python3-pip`, `curl`, `ca-certificates`;
- установку Node.js 20 LTS через NodeSource, если Node/npm отсутствуют или Node ниже 20;
- `git clone https://github.com/aske312/project_403.git project_403`, если проект еще не рядом со скриптом;
- создание dev `.env`, если файла нет;
- создание `.venv`;
- установку Python-зависимостей из `requirements.txt`;
- установку frontend-зависимостей через `npm ci`;
- проверку актуальности `dist` и `npm run build` при необходимости;
- запуск backend и frontend.

Если нужен другой репозиторий или каталог:

```bash
./start.sh --repo-url https://github.com/user/repo.git --project-dir my-app
```

Если системные пакеты уже поставлены и их не надо трогать:

```bash
./start.sh --skip-system-deps
```

Для автоматической установки системных пакетов на Ubuntu/Linux нужны интернет и права `sudo`.

## Новый Windows сервер

Минимальный сценарий из PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Скрипт проверит и при необходимости попробует установить через `winget`:

- Git;
- Python;
- Node.js/npm.

Затем он склонирует репозиторий, подготовит `.venv`, поставит Python/npm-зависимости, проверит frontend-сборку и запустит backend/frontend.
Если `.env` отсутствует, скрипт создаст dev-вариант с локальным `DATABASE_URL`.

Если нужен другой репозиторий или каталог:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -RepoUrl https://github.com/user/repo.git -ProjectDir my-app
```

Если системные зависимости уже установлены:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -SkipSystemDeps
```

Примечание: после установки Git/Python/Node через `winget` Windows иногда требует открыть новую сессию PowerShell, чтобы обновился `PATH`.

## Уже склонированный проект

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Ubuntu/Linux:

```bash
./start.sh
```

## Обновление репозитория перед запуском

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -UpdateRepo
```

Ubuntu/Linux:

```bash
./start.sh --update-repo
```

Оба варианта выполняют `git pull --ff-only`. Если есть локальные изменения или нужен merge/rebase, обновление надо сделать вручную.

## Частые режимы

Только подготовить среду:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -InstallOnly
```

```bash
./start.sh --install-only
```

Проверить/обновить frontend-сборку без запуска серверов:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -BuildOnly
```

```bash
./start.sh --build-only
```

Принудительно переустановить frontend-зависимости:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -ForceInstall
```

```bash
./start.sh --force-install
```

Принудительно пересобрать frontend:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -ForceBuild
```

```bash
./start.sh --force-build
```

Запуск на других портах:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -BackendPort 18000 -FrontendPort 18001
```

```bash
./start.sh --backend-port 18000 --frontend-port 18001
```

## Адреса по умолчанию

- Frontend: http://127.0.0.1:5173
- Backend: http://127.0.0.1:8000
- FastAPI docs: http://127.0.0.1:8000/docs

## База данных

Запуск PostgreSQL пока не включен. В `start.ps1` и `start.sh` есть закомментированная заготовка для Docker и Docker Compose.

Пока БД не запущена, `/api/debug/check` должен работать, а `/api/db/check_connect` ожидаемо вернет ошибку подключения.

Создаваемый скриптом `.env` подходит для локального/dev-запуска. Перед публичным deploy надо заменить `JWT_SECRET`, `DATABASE_URL` и другие значения окружения на реальные.
