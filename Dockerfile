FROM node:18-alpine

# Установка рабочей директории
WORKDIR /app

# Копирование package.json и package-lock.json
COPY package*.json ./

# Установка зависимостей
RUN npm ci --only=production

# Копирование исходного кода
COPY . .

# Создание директории для базы данных с правильными правами
RUN mkdir -p /app/data && chmod 755 /app/data

# Установка переменных окружения
ENV NODE_ENV=production

# Открытие порта
EXPOSE 3000

# Создаем скрипт запуска с инициализацией БД и миграциями
RUN echo '#!/bin/sh\n\
echo "🚀 Запуск приложения..."\n\
echo "🔧 Инициализация базы данных..."\n\
node init-db.js\n\
echo "✅ База данных инициализирована"\n\
echo "🔄 Выполнение миграций..."\n\
node run-migrations.js\n\
echo "✅ Миграции выполнены"\n\
echo "🌐 Запуск сервера..."\n\
node server-modular.js' > /app/start.sh && chmod +x /app/start.sh

# Команда запуска
CMD ["/app/start.sh"]