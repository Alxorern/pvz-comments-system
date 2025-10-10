const express = require('express');
const router = express.Router();
const database = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');

/**
 * GET /api/settings - Получить настройки системы
 */
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  const db = database.getDb();
  
  db.all('SELECT key, value FROM settings', (err, rows) => {
    if (err) {
      console.error('❌ Ошибка получения настроек:', err);
      res.status(500).json({ error: err.message });
      return;
    }

    // Преобразуем массив строк в объект
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });

    console.log('✅ Настройки получены:', Object.keys(settings));
    res.json(settings);
  });
});

/**
 * POST /api/settings - Сохранить настройки системы
 */
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { pvzTableId, pvzSheetName, updateFrequency } = req.body;
  
  if (!pvzTableId || !pvzSheetName) {
    res.status(400).json({ error: 'Необходимо указать ID таблицы и название листа' });
    return;
  }

  const db = database.getDb();
  
  // Начинаем транзакцию
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Сохраняем настройки
    const settings = [
      { key: 'pvzTableId', value: pvzTableId },
      { key: 'pvzSheetName', value: pvzSheetName },
      { key: 'updateFrequency', value: updateFrequency || '60' }
    ];

    let completed = 0;
    let hasError = false;

    settings.forEach(setting => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [setting.key, setting.value],
        function(err) {
          if (err) {
            console.error(`❌ Ошибка сохранения настройки ${setting.key}:`, err);
            hasError = true;
          } else {
            console.log(`✅ Настройка ${setting.key} сохранена`);
          }
          
          completed++;
          if (completed === settings.length) {
            if (hasError) {
              db.run('ROLLBACK');
              res.status(500).json({ error: 'Ошибка сохранения настроек' });
            } else {
              db.run('COMMIT');
              
              // Обновляем шедулер после сохранения настроек
              const scheduler = require('../services/scheduler');
              scheduler.updateFrequency(parseInt(updateFrequency));
              
              // Очищаем кэш настроек в Google Sheets сервисе
              const googleSheetsService = require('../services/googleSheetsService');
              googleSheetsService.clearSettingsCache();
              
              res.json({ success: true, message: 'Настройки сохранены успешно' });
            }
          }
        }
      );
    });
  });
});

/**
 * POST /api/settings/test-connection - Тестировать подключение к Google Sheets
 */
router.post('/test-connection', authenticateToken, requireAdmin, async (req, res) => {
  const { pvzTableId, pvzSheetName } = req.body;
  
  if (!pvzTableId || !pvzSheetName) {
    res.status(400).json({ error: 'Необходимо указать ID таблицы и название листа' });
    return;
  }

  try {
    // Импортируем сервис Google Sheets
    const googleSheetsService = require('../services/googleSheetsService');
    
    // Тестируем подключение к таблице
    const result = await googleSheetsService.testConnection(pvzTableId);

    if (result) {
      console.log('✅ Подключение к Google Sheets успешно');
      res.json({ 
        success: true, 
        message: 'Подключение к Google Sheets работает корректно',
        details: {
          table: result
        }
      });
    } else {
      console.error('❌ Ошибка подключения к Google Sheets');
      res.status(400).json({ 
        success: false, 
        error: 'Ошибка подключения к Google Sheets'
      });
    }
  } catch (error) {
    console.error('❌ Ошибка тестирования подключения:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Внутренняя ошибка сервера при тестировании подключения' 
    });
  }
});

/**
 * GET /api/settings/sync-logs - Получить логи синхронизации
 */
router.get('/sync-logs', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, syncType } = req.query;
    const offset = (page - 1) * limit;
    
    const database = require('../database/db');
    const db = database.getDb();
    
    // Строим запрос с фильтрами
    let whereClause = '';
    let params = [];
    
    if (status || syncType) {
      const conditions = [];
      if (status) {
        conditions.push('status = ?');
        params.push(status);
      }
      if (syncType) {
        conditions.push('sync_type = ?');
        params.push(syncType);
      }
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }
    
    // Получаем общее количество записей
    const countQuery = `SELECT COUNT(*) as total FROM google_sync_log ${whereClause}`;
    const totalResult = await new Promise((resolve, reject) => {
      db.get(countQuery, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    // Получаем записи с пагинацией
    const dataQuery = `
      SELECT * FROM google_sync_log 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const logs = await new Promise((resolve, reject) => {
      db.all(dataQuery, [...params, limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({
      success: true,
      data: {
        logs: logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalResult.total,
          pages: Math.ceil(totalResult.total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения логов синхронизации:', error);
    res.status(500).json({ 
      error: 'Ошибка получения логов синхронизации',
      details: error.message 
    });
  }
});

/**
 * GET /api/settings/sync-logs/stats - Получить статистику синхронизации
 */
router.get('/sync-logs/stats', authenticateToken, async (req, res) => {
  try {
    const database = require('../database/db');
    const db = database.getDb();
    
    // Получаем статистику за последние 30 дней
    const statsQuery = `
      SELECT 
        status,
        COUNT(*) as count,
        AVG(execution_time_ms) as avg_execution_time,
        SUM(records_processed) as total_processed,
        SUM(records_created) as total_created,
        SUM(records_updated) as total_updated,
        SUM(records_skipped) as total_skipped
      FROM google_sync_log 
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY status
    `;
    
    const stats = await new Promise((resolve, reject) => {
      db.all(statsQuery, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Получаем последние 5 записей
    const recentQuery = `
      SELECT * FROM google_sync_log 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    
    const recent = await new Promise((resolve, reject) => {
      db.all(recentQuery, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({
      success: true,
      data: {
        stats: stats,
        recent: recent
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения статистики синхронизации:', error);
    res.status(500).json({ 
      error: 'Ошибка получения статистики синхронизации',
      details: error.message 
    });
  }
});

module.exports = router;
