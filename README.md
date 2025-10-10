# ПВЗ Комментарии

Система управления комментариями для пунктов выдачи заказов (ПВЗ) с интеграцией Google Sheets.

## 🚀 Возможности

- **Аутентификация и авторизация** с ролевой системой
- **Управление пользователями** и ролями
- **Интеграция с Google Sheets** для синхронизации данных ПВЗ
- **Система комментариев** для каждого ПВЗ
- **Экспорт данных** в Excel формат
- **Настройки синхронизации** с планировщиком задач

## 🛠 Технологии

- **Backend**: Node.js, Express.js, SQLite
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Интеграции**: Google Sheets API
- **Деплой**: Railway, Docker

## 📋 Требования

- Node.js 18+
- SQLite
- Google Service Account (для интеграции с Google Sheets)

## 🚀 Быстрый старт

### Локальная разработка

1. **Клонируйте репозиторий**
```bash
git clone https://github.com/your-username/pvz-comments-system.git
cd pvz-comments-system
```

2. **Установите зависимости**
```bash
npm install
```

3. **Настройте переменные окружения**
```bash
cp env.example .env
# Отредактируйте .env файл
```

4. **Инициализируйте базу данных**
```bash
node init-db.js
```

5. **Запустите приложение**
```bash
npm start
```

Приложение будет доступно по адресу: http://localhost:3000

**Логин по умолчанию**: admin / admin

## ☁️ Деплой в Railway

### Подготовка

1. **Создайте GitHub репозиторий** и загрузите код
2. **Создайте Google Service Account** и скачайте JSON файл с учетными данными

### Деплой через интерфейс Railway

1. **Создайте проект в Railway**
   - Откройте [railway.app](https://railway.app)
   - Нажмите "New Project" → "Empty Project"
   - Назовите проект "PVZ"

2. **Создайте сервис приложения**
   - В проекте нажмите "New Service"
   - Выберите "Empty Service"
   - Назовите сервис "pvz-app"

3. **Создайте Volume для базы данных**
   - В проекте нажмите "New Service"
   - Выберите "Volume"
   - Назовите Volume "pvz-app-volume"
   - Установите Mount Path: `/app/data`

4. **Подключите Volume к сервису**
   - Откройте сервис "pvz-app"
   - Перейдите в "Settings" → "Volumes"
   - Нажмите "Attach Volume"
   - Выберите "pvz-app-volume"
   - Установите Mount Path: `/app/data`

5. **Настройте переменные окружения**
   - В сервисе "pvz-app" перейдите в "Variables"
   - Добавьте переменные:
     - `JWT_SECRET`: `your-secret-key-here`
     - `ADMIN_USERNAME`: `admin`
     - `ADMIN_PASSWORD`: `admin`
     - `GOOGLE_CREDENTIALS`: `{"type":"service_account",...}` (JSON строка)

6. **Деплойте код**
   - В сервисе "pvz-app" перейдите в "Deploy"
   - Нажмите "Deploy from GitHub"
   - Выберите ваш репозиторий
   - Нажмите "Deploy"

7. **Инициализируйте базу данных**
   - После деплоя перейдите в "Deploy" → "Logs"
   - Нажмите "Open Terminal"
   - Выполните: `node init-db.js`

8. **Скопируйте локальную базу данных (опционально)**
   - В терминале выполните: `node copy-database-to-railway.js`
   - Это скопирует ваши локальные данные в Railway

### Настройка Google Sheets

1. **Создайте Google Service Account**
   - Откройте [Google Cloud Console](https://console.cloud.google.com)
   - Создайте проект или выберите существующий
   - Включите Google Sheets API
   - Создайте Service Account
   - Скачайте JSON файл с учетными данными

2. **Настройте доступ к Google Sheets**
   - Откройте ваш Google Sheets документ
   - Поделитесь документом с email Service Account
   - Дайте права "Редактор"

3. **Добавьте учетные данные в Railway**
   - Скопируйте содержимое JSON файла
   - Вставьте в переменную `GOOGLE_CREDENTIALS` в Railway

## 📊 Структура проекта

```
├── src/
│   ├── client/           # Frontend
│   │   ├── assets/       # CSS стили
│   │   ├── modules/      # JavaScript модули
│   │   └── pages/        # HTML страницы
│   └── server/           # Backend
│       ├── database/     # База данных
│       ├── middleware/   # Middleware
│       ├── routes/       # API маршруты
│       └── services/     # Сервисы
├── Dockerfile           # Docker конфигурация
├── railway.json         # Railway конфигурация
└── package.json         # Зависимости
```

## 🔧 API Endpoints

- `POST /api/auth` - Аутентификация
- `GET /api/users` - Список пользователей
- `GET /api/roles` - Список ролей
- `GET /api/data/pvz` - Данные ПВЗ
- `POST /api/data/comments` - Добавить комментарий
- `GET /api/settings` - Настройки системы

## 📝 Лицензия

MIT License

## 🤝 Поддержка

Для вопросов и поддержки создайте issue в GitHub репозитории.