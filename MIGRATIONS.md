# Система миграций базы данных

## Обзор

Система миграций позволяет безопасно обновлять структуру базы данных без потери данных.

## Структура

```
migrations/
├── migration-manager.js    # Менеджер миграций
├── versions/              # Папка с миграциями
│   └── 001_add_companies_table.js
└── run-migrations.js      # Скрипт запуска миграций
```

## Как работает

1. **При запуске приложения** автоматически выполняются все невыполненные миграции
2. **Каждая миграция** записывается в таблицу `migrations` после выполнения
3. **Миграции выполняются** в порядке версий (001, 002, 003...)

## Создание новой миграции

### 1. Создать файл миграции
```bash
# Создать файл: migrations/versions/002_add_new_feature.js
```

### 2. Структура файла миграции
```javascript
module.exports = {
    description: 'Описание миграции',
    
    async up(db) {
        // Код для применения миграции
        return new Promise((resolve, reject) => {
            // SQL команды
            db.run('CREATE TABLE new_table (...)', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    
    async down(db) {
        // Код для отката миграции (опционально)
        return Promise.resolve();
    }
};
```

### 3. Запуск миграций
```bash
# Автоматически при запуске приложения
# Или вручную:
node run-migrations.js
```

## Примеры миграций

### Добавление таблицы
```javascript
async up(db) {
    return new Promise((resolve, reject) => {
        db.run(`
            CREATE TABLE new_table (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL
            )
        `, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}
```

### Добавление столбца
```javascript
async up(db) {
    return new Promise((resolve, reject) => {
        db.run('ALTER TABLE users ADD COLUMN new_field TEXT', (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}
```

### Обновление данных
```javascript
async up(db) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE users SET role = "user" WHERE role IS NULL', function(err) {
            if (err) reject(err);
            else {
                console.log(`Обновлено записей: ${this.changes}`);
                resolve();
            }
        });
    });
}
```

## Безопасность

- ✅ **Миграции выполняются** только один раз
- ✅ **Порядок выполнения** гарантирован
- ✅ **Откат возможен** (если реализован)
- ✅ **Логирование** всех операций

## Логи

При выполнении миграций вы увидите:
```
🚀 Запуск миграций базы данных...
✅ Таблица migrations создана
📋 Найдено миграций для выполнения: 1
🔄 Выполняем миграцию: 001_add_companies_table
✅ Миграция 001_add_companies_table выполнена
🎉 Все миграции выполнены успешно!
```

## Troubleshooting

### Миграция не выполняется
- Проверьте синтаксис файла миграции
- Убедитесь, что файл находится в `migrations/versions/`
- Проверьте логи на ошибки

### Ошибка при выполнении
- Миграция остановится на первой ошибке
- Исправьте ошибку и перезапустите
- При необходимости создайте миграцию для исправления
