const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('billing.db', (err) => {
  if (err) {
    console.error('❌ Ошибка подключения к БД:', err);
    return;
  }
  console.log('✅ Подключение к БД успешно');
});

// Проверяем существование таблицы audit_log
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_log'", (err, rows) => {
  if (err) {
    console.error('❌ Ошибка проверки таблицы:', err);
  } else {
    console.log('📊 Таблица audit_log существует:', rows.length > 0);
    if (rows.length > 0) {
      console.log('✅ Таблица audit_log уже создана');
    } else {
      console.log('⚠️ Таблица audit_log не найдена, нужно запустить миграцию');
    }
  }
  
  // Проверяем все таблицы
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('❌ Ошибка получения списка таблиц:', err);
    } else {
      console.log('📋 Существующие таблицы:');
      tables.forEach(table => console.log('  -', table.name));
    }
    
    db.close();
  });
});
