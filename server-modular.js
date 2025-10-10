const app = require('./src/server/app');
const scheduler = require('./src/server/services/scheduler');

const PORT = process.env.PORT || 3000;

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Модульный сервер запущен на http://localhost:${PORT}`);
  console.log(`📊 База данных: billing.db`);
  console.log(`🌐 Откройте http://localhost:${PORT} в браузере`);
  console.log('📋 API endpoints доступны');
  
  // Инициализируем основное подключение к БД
  console.log('🗄️ Инициализация основного подключения к БД...');
  const database = require('./src/server/database/db');
  database.connect().then(async () => {
    console.log('✅ Основное подключение к БД установлено');
    
    // Проверяем, нужно ли инициализировать БД
    const db = database.getDb();
    if (db) {
      try {
        // Проверяем существование таблицы users
        const result = await new Promise((resolve, reject) => {
          db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        if (!result) {
          console.log('🔧 Таблица users не найдена, инициализируем БД...');
          // Запускаем скрипт инициализации
          const { exec } = require('child_process');
          exec('node init-db.js', (error, stdout, stderr) => {
            if (error) {
              console.error('❌ Ошибка инициализации БД:', error);
            } else {
              console.log('✅ БД инициализирована:', stdout);
            }
          });
        } else {
          console.log('✅ БД уже инициализирована');
        }
      } catch (err) {
        console.error('❌ Ошибка проверки БД:', err);
      }
    }
  }).catch(err => {
    console.error('❌ Ошибка основного подключения к БД:', err);
  });
});

// Обработка завершения процесса
process.on('SIGINT', async () => {
  console.log('\n🛑 Получен сигнал SIGINT, завершаем сервер...');
  const database = require('./src/server/database/db');
  try {
    await scheduler.stop();
    await database.close();
    console.log('✅ Сервер завершен');
    process.exit(0);
  } catch (err) {
    console.error('❌ Ошибка при закрытии базы данных:', err);
    process.exit(1);
  }
});
