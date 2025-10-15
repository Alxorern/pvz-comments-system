# Переменные окружения для Railway (ОКОНЧАТЕЛЬНЫЙ СПИСОК)

## Обязательные переменные (только те, что действительно нужны)

### JWT и безопасность
```
JWT_SECRET=your_very_secure_jwt_secret_here_minimum_32_characters
```

### Google Sheets API (один из вариантов)
```
# Вариант 1: Путь к файлу с учетными данными
GOOGLE_CREDENTIALS_PATH=/app/google-credentials.json

# ИЛИ Вариант 2: JSON в переменной окружения
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"..."}
```

### CORS (опционально)
```
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
```

## Переменные, которые НЕ нужны (Railway устанавливает автоматически)

✅ `PORT` - Railway автоматически устанавливает
✅ `NODE_ENV` - Railway автоматически устанавливает  
✅ `DATABASE_PATH` - код сам определяет путь по умолчанию

## Переменные, которые НЕ используются в коде (удалены из списка)

❌ `GOOGLE_SHEET_ID` - не используется в коде
❌ `GOOGLE_SHEET_NAME` - не используется в коде  
❌ `SYNC_FREQUENCY` - не используется в коде
❌ `SYNC_ENABLED` - не используется в коде
❌ `CORS_ORIGIN` - не используется в коде
❌ `RATE_LIMIT_WINDOW_MS` - не используется в коде
❌ `RATE_LIMIT_MAX_REQUESTS` - не используется в коде

## Минимальный набор для Railway

Для работы системы достаточно только этих переменных:

```
JWT_SECRET=your_very_secure_jwt_secret_here_minimum_32_characters
GOOGLE_CREDENTIALS_PATH=/app/google-credentials.json
```

## Как установить переменные в Railway

1. Откройте ваш проект в Railway
2. Перейдите в раздел "Variables"
3. Добавьте каждую переменную:
   - Нажмите "New Variable"
   - Введите имя переменной
   - Введите значение
   - Нажмите "Add"

## Важные замечания

### JWT_SECRET
- Должен быть длиной минимум 32 символа
- Используйте случайную строку
- Пример: `JWT_SECRET=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567890`

### GOOGLE_CREDENTIALS_PATH
- Путь к файлу с учетными данными Google API
- В Railway должен быть: `/app/google-credentials.json`

### DATABASE_PATH
- Путь к файлу базы данных в контейнере
- Должен быть: `/app/data/billing.db`

## Проверка после установки

После установки всех переменных:
1. Перезапустите приложение в Railway
2. Проверьте логи на наличие ошибок
3. Убедитесь, что приложение запускается без ошибок
