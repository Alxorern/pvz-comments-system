#!/bin/bash

echo "🚀 Запуск деплоя в Railway..."

# Проверяем, установлен ли Railway CLI
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI не установлен!"
    echo "Установите его: npm install -g @railway/cli"
    exit 1
fi

# Проверяем, авторизованы ли мы в Railway
if ! railway whoami &> /dev/null; then
    echo "❌ Не авторизованы в Railway!"
    echo "Выполните: railway login"
    exit 1
fi

echo "✅ Railway CLI готов"

# Проверяем готовность к деплою
echo "🔍 Проверка готовности к деплою..."
node check-deployment-readiness.js

if [ $? -ne 0 ]; then
    echo "❌ Система не готова к деплою!"
    exit 1
fi

echo "✅ Система готова к деплою"

# Очищаем временные файлы
echo "🧹 Очистка временных файлов..."
rm -f check-db-schema.js
rm -f check-deployment-readiness.js

# Запускаем деплой
echo "🚂 Запуск деплоя в Railway..."
railway up

if [ $? -eq 0 ]; then
    echo "🎉 Деплой завершен успешно!"
    echo ""
    echo "📋 Следующие шаги:"
    echo "1. Проверьте логи: railway logs"
    echo "2. Убедитесь, что все переменные окружения установлены"
    echo "3. Проверьте работу приложения"
    echo ""
    echo "🔗 Получить URL приложения: railway domain"
else
    echo "❌ Ошибка деплоя!"
    echo "Проверьте логи: railway logs"
    exit 1
fi
