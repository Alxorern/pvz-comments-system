const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
  constructor() {
    this.db = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      // Принудительно устанавливаем путь для Railway
      if (process.env.RAILWAY_ENVIRONMENT === 'production') {
        process.env.DATABASE_PATH = '/app/data/billing.db';
      }
      
      // Используем переменную окружения или путь по умолчанию
      const dbPath = process.env.DATABASE_PATH || 
        (process.env.NODE_ENV === 'production' 
          ? '/app/data/billing.db'  // Используем Volume
          : path.join(__dirname, '../../../billing.db'));
      
      console.log(`🗄️ Подключение к БД по пути: ${dbPath}`);
      
      // Создаем директорию если она не существует
      const dbDir = path.dirname(dbPath);
      console.log(`📁 Проверяем директорию: ${dbDir}`);
      console.log(`📁 Директория существует: ${fs.existsSync(dbDir)}`);
      
      if (!fs.existsSync(dbDir)) {
        console.log(`❌ Директория не существует: ${dbDir}`);
        console.log(`❌ НЕ создаем директорию - это может быть проблема с Volume!`);
        reject(new Error(`Директория базы данных не существует: ${dbDir}`));
        return;
      }
      
      // Проверяем права доступа
      try {
        fs.accessSync(dbDir, fs.constants.W_OK);
        console.log(`✅ Права записи в директорию: ${dbDir}`);
      } catch (accessErr) {
        console.error(`❌ Нет прав записи в директорию: ${accessErr.message}`);
        reject(accessErr);
        return;
      }
      
      this.db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
          console.error('❌ Ошибка подключения к базе данных:', err.message);
          reject(err);
        } else {
          console.log('✅ Подключено к базе данных SQLite');
          
          
          resolve(this.db);
        }
      });
    });
  }

  getDb() {
    if (!this.db) {
      throw new Error('База данных не подключена. Вызовите connect() сначала.');
    }
    return this.db;
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('❌ Ошибка закрытия базы данных:', err.message);
            reject(err);
          } else {
            console.log('✅ Соединение с базой данных закрыто');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

// Экспортируем синглтон
const database = new Database();
module.exports = database;
