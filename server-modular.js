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
  database.connect().then(() => {
    console.log('✅ Основное подключение к БД установлено');
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
