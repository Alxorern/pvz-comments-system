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
ENV DATABASE_PATH=/app/data/billing.db

# Открытие порта
EXPOSE 3000

# Команда запуска
CMD ["node", "server-modular.js"]