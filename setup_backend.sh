#!/bin/bash
echo "🚀 Starting backend setup..."

# Проверка Python
python3 --version || { echo "❌ Python3 not installed"; exit 1; }

# Создание виртуального окружения
echo "📦 Creating virtual environment..." python3 -m venv venv

# Активация
echo "🔌 Activating virtual environment..." source venv/bin/activate

# Обновление
pip echo "⬆️ Upgrading pip..." pip install --upgrade pip

# Установка зависимостей
echo "📥 Installing dependencies..." pip install fastapi uvicorn sqlalchemy asyncpg pydantic python-dotenv passlib[bcrypt] python-jose

# Создание requirements.txt
echo "📝 Freezing dependencies..." pip freeze > requirements.txt
echo "✅ Backend setup complete!"
echo "👉 Activate env: source venv/bin/activate"
echo "👉 Run server: uvicorn app.main:app --reload"