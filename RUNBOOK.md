# Project Runbook

Короткая памятка по первому запуску, обновлению и локальной разработке.

## Требования

- Git
- Node.js и npm
- Python 3
- Windows PowerShell или bash на Linux/Ubuntu
- PostgreSQL нужен только для эндпоинтов, которые ходят в БД

## Первый запуск: Windows

```powershell
git clone <REPOSITORY_URL>
cd project_403
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Скрипт создаст `.venv`, установит Python-зависимости, установит npm-зависимости, проверит актуальность `dist` и запустит backend/frontend.

## Первый запуск: Ubuntu/Linux

```bash
git clone <REPOSITORY_URL>
cd project_403
chmod +x ./start.sh
./start.sh
```

Если в Ubuntu нет пакета для виртуальных окружений:

```bash
sudo apt update
sudo apt install python3-venv
```

## Обновление репозитория перед запуском

Первичное клонирование нельзя выполнить из `start.ps1` или `start.sh`, потому что этих файлов еще нет на машине до `git clone`.

Для уже склонированного проекта можно обновиться перед запуском:

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -UpdateRepo
```

Ubuntu/Linux:

```bash
./start.sh --update-repo
```

Оба варианта выполняют `git pull --ff-only`. Если есть локальные изменения или нужна merge/rebase-логика, обновление надо сделать вручную.

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
