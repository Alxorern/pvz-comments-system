const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Путь к базе данных (Railway Volume)
const dbPath = process.env.DATABASE_URL || '/app/data/billing.db';

console.log('🚀 Инициализация базы данных для Railway...');
console.log('📁 Путь к БД:', dbPath);

// Создаем подключение к базе данных
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Ошибка подключения к БД:', err.message);
    process.exit(1);
  }
  console.log('✅ Подключение к БД установлено');
});

// Функция для выполнения SQL запросов
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

// Функция для получения данных
function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function initializeDatabase() {
  try {
    console.log('📋 Создание таблиц...');

    // Создание таблицы пользователей
    await runQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Создание таблицы настроек
    await runQuery(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Создание таблицы ПВЗ
    await runQuery(`
      CREATE TABLE IF NOT EXISTS pvz (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pvz_id TEXT UNIQUE NOT NULL,
        region TEXT,
        address TEXT,
        service_name TEXT,
        status_date TEXT,
        status_name TEXT,
        company_name TEXT,
        transaction_date TEXT,
        transaction_amount TEXT,
        phone TEXT,
        postal_code TEXT,
        fitting_room TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Создание таблицы комментариев
    await runQuery(`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pvz_id TEXT NOT NULL,
        comment TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pvz_id) REFERENCES pvz (pvz_id)
      )
    `);

    // Создание таблицы ролей
    await runQuery(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Создание таблицы регионов
    await runQuery(`
      CREATE TABLE IF NOT EXISTS regions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Создание таблицы связи ролей и регионов
    await runQuery(`
      CREATE TABLE IF NOT EXISTS role_regions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_id INTEGER NOT NULL,
        region_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles (id),
        FOREIGN KEY (region_id) REFERENCES regions (id),
        UNIQUE(role_id, region_id)
      )
    `);

    // Создание таблицы настроек таблиц пользователей
    await runQuery(`
      CREATE TABLE IF NOT EXISTS user_table_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        table_name TEXT NOT NULL,
        settings TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(user_id, table_name)
      )
    `);

    // Создание таблицы логов синхронизации
    await runQuery(`
      CREATE TABLE IF NOT EXISTS google_sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT NOT NULL,
        message TEXT,
        records_processed INTEGER DEFAULT 0,
        records_created INTEGER DEFAULT 0,
        records_updated INTEGER DEFAULT 0,
        records_skipped INTEGER DEFAULT 0,
        execution_time INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Таблицы созданы');

    // Создание индексов
    console.log('📊 Создание индексов...');
    
    await runQuery(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pvz_pvz_id_unique ON pvz (pvz_id)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_pvz_region ON pvz (region)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_pvz_status_name ON pvz (status_name)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_pvz_company_name ON pvz (company_name)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_pvz_updated_at ON pvz (updated_at)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_pvz_transaction_date ON pvz (transaction_date)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_pvz_region_status ON pvz (region, status_name)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_comments_pvz_id ON comments (pvz_id)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments (created_at)`);

    console.log('✅ Индексы созданы');

    // Проверяем, есть ли пользователи
    const users = await getQuery('SELECT COUNT(*) as count FROM users');
    if (users[0].count === 0) {
      console.log('👤 Создание администратора...');
      
      // Создаем роль admin
      await runQuery(`
        INSERT OR IGNORE INTO roles (name, is_active) 
        VALUES ('admin', 1)
      `);

      // Создаем пользователя admin (пароль: admin123)
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await runQuery(`
        INSERT OR IGNORE INTO users (username, password_hash, role) 
        VALUES ('admin', ?, 'admin')
      `, [hashedPassword]);

      console.log('✅ Администратор создан (admin/admin123)');
    } else {
      console.log('👤 Пользователи уже существуют');
    }

    // Проверяем настройки
    const settings = await getQuery('SELECT COUNT(*) as count FROM settings');
    if (settings[0].count === 0) {
      console.log('⚙️ Создание базовых настроек...');
      
      await runQuery(`
        INSERT OR IGNORE INTO settings (key, value) VALUES 
        ('google_sheet_id', ''),
        ('google_sheet_name', 'PVZ'),
        ('sync_frequency', '0 */6 * * *'),
        ('sync_enabled', 'true'),
        ('scheduler_running', 'false')
      `);

      console.log('✅ Базовые настройки созданы');
    } else {
      console.log('⚙️ Настройки уже существуют');
    }

    console.log('🎉 Инициализация базы данных завершена успешно!');

  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error);
    process.exit(1);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('❌ Ошибка закрытия БД:', err.message);
      } else {
        console.log('🔒 Соединение с БД закрыто');
      }
    });
  }
}

// Запуск инициализации
initializeDatabase();
