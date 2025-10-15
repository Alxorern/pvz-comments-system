# Переменные окружения

## Обязательные переменные

### Google Sheets API
- `GOOGLE_CREDENTIALS` - JSON строка с учетными данными Google Cloud Service Account

### База данных
- База данных автоматически создается в `/app/data/billing.db` (volume монтирование)

### JWT
- `JWT_SECRET` - секретный ключ для JWT токенов (по умолчанию: `billing-system-secret-key-2025`)

## Пользователи по умолчанию

### Admin пользователь
- `ADMIN_USERNAME` - логин администратора (по умолчанию: `admin`)
- `ADMIN_PASSWORD` - пароль администратора (по умолчанию: `admin`)

### Superuser
- `SUPERUSER_USERNAME` - логин superuser (по умолчанию: `superuser`)
- `SUPERUSER_PASSWORD` - пароль superuser (по умолчанию: `superuser123`)

## Настройка в Railway

1. Перейдите в настройки проекта Railway
2. Добавьте переменные окружения:

```
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"..."}
JWT_SECRET=your-secret-key-here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-admin-password
SUPERUSER_USERNAME=superuser
SUPERUSER_PASSWORD=your-secure-superuser-password
```

**Важно:** Убедитесь, что в Railway настроен volume монтирование в `/app/data/`

## Роли пользователей

### Admin (ID: 1)
- Полный доступ ко всем функциям
- Видит все пункты меню
- Не имеет ограничений по регионам или компаниям

### Superuser (ID: 2)
- Видит только "Список ПВЗ"
- Не имеет ограничений по регионам
- Имеет ограничения по компании (если привязан к компании)

### Обычные пользователи
- Видят только "Список ПВЗ"
- Имеют ограничения по регионам
- Имеют ограничения по компании

## Безопасность

⚠️ **Важно**: Обязательно измените пароли по умолчанию в production окружении!

- Используйте сложные пароли
- Не используйте пароли по умолчанию
- Регулярно обновляйте JWT_SECRET
