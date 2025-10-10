const cron = require('node-cron');
const googleSheetsService = require('./googleSheetsService');
const database = require('../database/db');

let task = null;
let isRunning = false;
let currentFrequency = 60; // Default to 60 minutes

/**
 * Сохранить состояние шедулера в базу данных
 */
async function saveSchedulerState() {
  try {
    const db = database.getDb();
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['scheduler_running', isRunning ? 'true' : 'false'],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    // Состояние сохранено
  } catch (error) {
    console.error('❌ Ошибка сохранения состояния шедулера:', error);
  }
}

/**
 * Загрузить состояние шедулера из базы данных
 */
async function loadSchedulerState() {
  try {
    const db = database.getDb();
    const result = await new Promise((resolve, reject) => {
      db.get(
        'SELECT value FROM settings WHERE key = ?',
        ['scheduler_running'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.value === 'true' : false);
        }
      );
    });
    // Состояние загружено
    return result;
  } catch (error) {
    console.error('❌ Ошибка загрузки состояния шедулера:', error);
    return false;
  }
}

async function startScheduler() {
  if (isRunning) {
    // Шедулер уже запущен
    return;
  }

  const settings = await googleSheetsService.getSettings();
  currentFrequency = parseInt(settings.updateFrequency || '60'); // minutes

  // Останавливаем предыдущую задачу, если она была
  if (task) {
    task.stop();
  }

  // Запускаем новую задачу
  // cron syntax: minute hour day-of-month month day-of-week
  // For example, every 15 minutes: '*/15 * * * *'
  const cronExpression = `*/${currentFrequency} * * * *`;
  
  task = cron.schedule(cronExpression, async () => {
    console.log(`⏰ Автосинхронизация (${currentFrequency} мин)...`);
    try {
      await googleSheetsService.syncPvzData();
      console.log('✅ Автосинхронизация завершена');
    } catch (error) {
      console.error('❌ Ошибка автосинхронизации:', error.message);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Moscow" // Или ваш часовой пояс
  });

  isRunning = true;
  await saveSchedulerState();
  console.log(`✅ Шедулер запущен с частотой: ${currentFrequency} минут.`);
}

async function stopScheduler() {
  if (task) {
    task.stop();
    task = null;
  }
  isRunning = false;
  await saveSchedulerState();
  console.log('🛑 Шедулер остановлен.');
}

async function updateFrequency(newFrequency) {
  currentFrequency = newFrequency;
  if (isRunning) {
    // Обновляем частоту
    stopScheduler();
    await startScheduler();
  } else {
    // Частота обновлена, но шедулер не запущен
  }
}

function getStatus() {
  return {
    isRunning: isRunning,
    frequency: currentFrequency,
    nextRun: task && task.nextDate ? task.nextDate().toDate() : null
  };
}

/**
 * Инициализация шедулера при запуске сервера
 */
async function initializeScheduler() {
  // Инициализация шедулера
  
  // Загружаем сохраненное состояние
  const wasRunning = await loadSchedulerState();
  
  if (wasRunning) {
    // Восстанавливаем шедулер
    await startScheduler();
  } else {
    // Шедулер был остановлен
  }
}

module.exports = {
  start: startScheduler,
  stop: stopScheduler,
  updateFrequency: updateFrequency,
  getStatus: getStatus,
  initialize: initializeScheduler
};
