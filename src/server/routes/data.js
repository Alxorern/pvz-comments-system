const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin, requireAnyRole, addUserRegions, addUserStatuses, addMenuPermissions } = require('../middleware/roles');
const googleSheetsService = require('../services/googleSheetsService');
const scheduler = require('../services/scheduler');
const database = require('../database/db');
const XLSX = require('xlsx');

/**
 * Получение выражения для сортировки с учетом NULL значений
 */
function getSortExpression(sortBy, sortOrder) {
  const pvzFields = [
    'pvz_id', 'region', 'address', 'service_name', 'status_date',
    'status_name', 'company_name', 'transaction_date', 'transaction_amount',
    'phone', 'postal_code', 'fitting_room', 'created_at', 'updated_at'
  ];
  
  // Поля дат, которые нужно сортировать как даты
  const dateFields = ['status_date', 'transaction_date', 'created_at', 'updated_at'];
  
  // Маппинг полей комментариев на реальные имена в SQL
  const commentFieldMapping = {
    'last_comment': 'comment',
    'comment_author': 'created_by',
    'comment_date': 'created_at'
  };
  
  if (pvzFields.includes(sortBy)) {
    // Для полей дат используем правильную сортировку с конвертацией в даты
    if (dateFields.includes(sortBy)) {
      // SQLite: конвертируем строки в даты для правильной сортировки
      // Пробуем разные форматы дат
      return `CASE 
        WHEN p.${sortBy} IS NULL OR p.${sortBy} = '' THEN 1 
        ELSE 0 
      END, 
      CASE 
        WHEN p.${sortBy} LIKE '____-__-__%' THEN datetime(p.${sortBy})
        WHEN p.${sortBy} LIKE '__.__.____%' THEN datetime(substr(p.${sortBy}, 7, 4) || '-' || substr(p.${sortBy}, 4, 2) || '-' || substr(p.${sortBy}, 1, 2) || ' ' || substr(p.${sortBy}, 11))
        ELSE p.${sortBy}
      END ${sortOrder}`;
    }
    
    // Для текстовых полей используем COLLATE NOCASE для правильной сортировки
    if (['region', 'address', 'service_name', 'status_name'].includes(sortBy)) {
      return `p.${sortBy} COLLATE NOCASE ${sortOrder}`;
    }
    
    // Для company_name используем поле из таблицы companies
    if (sortBy === 'company_name') {
      return `c.company_name COLLATE NOCASE ${sortOrder}`;
    }
    
    // Для числовых полей
    return `p.${sortBy} ${sortOrder}`;
  } else if (commentFieldMapping[sortBy]) {
    const realFieldName = commentFieldMapping[sortBy];
    // Для полей комментариев обрабатываем NULL значения
    if (sortOrder === 'ASC') {
      return `c.${realFieldName} IS NULL, c.${realFieldName} ASC`;
    } else {
      return `c.${realFieldName} IS NOT NULL, c.${realFieldName} DESC`;
    }
  } else {
    return `p.updated_at DESC`;
  }
}

/**
 * POST /api/data/sync - Синхронизация данных ПВЗ с Google Sheets
 */
router.post('/sync', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔄 Начинаем синхронизацию данных ПВЗ...');
    
    const result = await googleSheetsService.syncPvzData();
    
    console.log('✅ Синхронизация завершена:', result);
    
    res.json({
      success: true,
      message: 'Данные успешно синхронизированы',
      result: result
    });
    
  } catch (error) {
    console.error('❌ Ошибка синхронизации данных:', error);
    res.status(500).json({ 
      error: 'Ошибка синхронизации данных',
      details: error.message 
    });
  }
});

/**
 * GET /api/data/pvz - Получить данные ПВЗ из локальной базы
 */
router.get('/pvz', authenticateToken, addMenuPermissions, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const db = database.getDb();
    
    let query = `
      SELECT p.*, c.company_name
      FROM pvz p 
      LEFT JOIN companies c ON p.company_id = c.company_id
    `;
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM pvz p 
      LEFT JOIN companies c ON p.company_id = c.company_id
    `;
    let params = [];
    let whereConditions = [];
    
    // Логика фильтрации по ролям
    if (req.user.roleName === 'admin') {
      // Admin видит все записи - никаких дополнительных фильтров
    } else if (req.user.roleName === 'superuser') {
      // Superuser видит записи только если у него выбрана компания
      if (req.user.companyId) {
        whereConditions.push('p.company_id = ?');
        params.push(req.user.companyId);
      } else {
        // Если у superuser нет компании, не показываем ничего
        whereConditions.push('1 = 0');
      }
    } else {
      // Обычные пользователи видят записи своей компании
      if (req.user.companyId) {
        whereConditions.push('p.company_id = ?');
        params.push(req.user.companyId);
      } else {
        // Если у пользователя нет компании, не показываем ничего
        whereConditions.push('1 = 0');
      }
    }
    
    if (search) {
      whereConditions.push('(p.pvz_id LIKE ? OR p.region LIKE ? OR p.address LIKE ? OR c.company_name LIKE ?)');
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    if (whereConditions.length > 0) {
      const whereClause = 'WHERE ' + whereConditions.join(' AND ');
      query += ` ${whereClause}`;
      countQuery += ` ${whereClause}`;
    }
    
    query += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));
    
    // Получаем данные
    const rows = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Получаем общее количество (убираем LIMIT и OFFSET из params)
    const countParams = params.slice(0, -2); // Убираем последние 2 параметра (limit, offset)
    const countResult = await new Promise((resolve, reject) => {
      db.get(countQuery, countParams, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        pages: Math.ceil(countResult.total / limit)
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения данных ПВЗ:', error);
    console.error('❌ Стек ошибки:', error.stack);
    res.status(500).json({ 
      error: 'Ошибка получения данных ПВЗ',
      details: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /api/data/pvz-with-comments - Получить данные ПВЗ с последними комментариями
 */
router.get('/pvz-with-comments', authenticateToken, requireAnyRole, addMenuPermissions, addUserRegions, addUserStatuses, async (req, res) => {
  try {
    console.log('📊 Запрос pvz-with-comments:', req.query);
    console.log('👤 Пользователь:', req.user);
    console.log('🔍 Роль пользователя:', req.user.roleName);
    console.log('🔍 ID компании пользователя:', req.user.companyId);
    
    const db = database.getDb();
    console.log('🗄️ Соединение с БД получено');
    
    if (!db) {
      throw new Error('База данных не подключена');
    }
    
    // Убираем пагинацию - возвращаем все данные
    console.log('📄 Возвращаем все данные без пагинации');
    
    // Параметры сортировки с валидацией
    const allowedSortColumns = [
      'pvz_id', 'region', 'address', 'service_name', 'status_date',
      'status_name', 'company_name', 'transaction_date', 'transaction_amount',
      'phone', 'postal_code', 'fitting_room', 'created_at', 'updated_at',
      'last_comment', 'comment_author', 'comment_date'
    ];
    const sortBy = allowedSortColumns.includes(req.query.sortBy) ? req.query.sortBy : 'updated_at';
    const sortOrder = ['ASC', 'DESC'].includes(req.query.sortOrder?.toUpperCase()) ? req.query.sortOrder.toUpperCase() : 'DESC';
    
    console.log('🔍 Параметры сортировки:', { sortBy, sortOrder });
    console.log('🔍 SQL выражение сортировки:', getSortExpression(sortBy, sortOrder));
    
    // Параметры фильтрации
    const pvzId = req.query.pvzId || '';
    const regions = req.query.regions ? req.query.regions.split(',') : [];
    const address = req.query.address || '';
    const company = req.query.company || '';
    
    // Строим WHERE условия
    let whereConditions = [];
    let params = [];
    
    // Фильтр по PVZ ID
    if (pvzId) {
      whereConditions.push('p.pvz_id LIKE ?');
      params.push(`%${pvzId}%`);
    }
    
    // Логика фильтрации по ролям и регионам
    if (req.user.roleName === 'admin') {
      // Admin видит все записи, но может фильтровать по выбранным регионам
      if (regions.length > 0) {
        const placeholders = regions.map(() => '?').join(',');
        whereConditions.push(`p.region IN (${placeholders})`);
        params.push(...regions);
      }
      // Если admin не выбрал регионы, показываем все (без дополнительных условий)
    } else if (req.user.roleName === 'superuser') {
      // Superuser видит записи только своей компании, независимо от региона
      if (req.user.companyId) {
        whereConditions.push('p.company_id = ?');
        params.push(req.user.companyId);
        
        // Superuser может дополнительно фильтровать по регионам
        if (regions.length > 0) {
          const placeholders = regions.map(() => '?').join(',');
          whereConditions.push(`p.region IN (${placeholders})`);
          params.push(...regions);
        }
      } else {
        // Если у superuser нет компании, не показываем ничего
        whereConditions.push('1 = 0');
      }
    } else {
      // Обычные пользователи видят записи своей компании + фильтр по регионам роли
      if (req.user.companyId) {
        whereConditions.push('p.company_id = ?');
        params.push(req.user.companyId);
        
        // Дополнительно фильтруем по регионам роли
        if (req.userRegions && req.userRegions.length > 0) {
          const placeholders = req.userRegions.map(() => '?').join(',');
          whereConditions.push(`p.region IN (${placeholders})`);
          params.push(...req.userRegions);
          
          // Если пользователь выбрал конкретные регионы, фильтруем по ним
          if (regions.length > 0) {
            const filteredRegions = regions.filter(region => req.userRegions.includes(region));
            if (filteredRegions.length > 0) {
              whereConditions.pop(); // Удаляем предыдущее условие
              params.splice(-req.userRegions.length); // Удаляем предыдущие параметры
              const placeholders = filteredRegions.map(() => '?').join(',');
              whereConditions.push(`p.region IN (${placeholders})`);
              params.push(...filteredRegions);
            }
          }
        } else {
          // Если у пользователя нет регионов, не показываем ничего
          whereConditions.push('1 = 0');
        }
      } else {
        // Если у пользователя нет компании, не показываем ничего
        whereConditions.push('1 = 0');
      }
    }
    
    if (address) {
      whereConditions.push('p.address LIKE ?');
      params.push(`%${address}%`);
    }
    
    if (company) {
      whereConditions.push('c.company_name LIKE ?');
      params.push(`%${company}%`);
    }
    
    // Фильтрация по статусам (если у пользователя есть ограничения по статусам)
    if (req.userStatuses && req.userStatuses.length > 0) {
      const placeholders = req.userStatuses.map(() => '?').join(',');
      whereConditions.push(`p.status_name IN (${placeholders})`);
      params.push(...req.userStatuses);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // Запрос с LEFT JOIN для получения последнего комментария для каждого ПВЗ и данных компании
    const baseQuery = `
      SELECT 
        p.*,
        c.comment as last_comment,
        c.created_by as comment_author,
        c.created_at as comment_date,
        comp.company_name
      FROM pvz p
      LEFT JOIN (
        SELECT 
          c1.pvz_id,
          c1.comment,
          c1.created_by,
          c1.created_at
        FROM comments c1
        INNER JOIN (
          SELECT 
            pvz_id, 
            MAX(created_at) as max_date
          FROM comments
          GROUP BY pvz_id
        ) c2 ON c1.pvz_id = c2.pvz_id AND c1.created_at = c2.max_date
        WHERE c1.rowid = (
          SELECT MIN(c3.rowid)
          FROM comments c3
          WHERE c3.pvz_id = c1.pvz_id AND c3.created_at = c2.max_date
        )
      ) c ON p.pvz_id = c.pvz_id
      LEFT JOIN companies comp ON p.company_id = comp.company_id
      ${whereClause}
      ORDER BY ${getSortExpression(sortBy, sortOrder)}
    `;
    
    console.log('🔍 SQL запрос:', baseQuery);
    
    // Получаем все данные без пагинации
    const rows = await new Promise((resolve, reject) => {
      db.all(baseQuery, params, (err, rows) => {
        if (err) {
          console.error('❌ Ошибка SQL запроса данных:', err);
          console.error('❌ SQL запрос:', baseQuery);
          console.error('❌ Параметры:', params);
          reject(err);
        } else {
          console.log(`✅ SQL запрос данных выполнен успешно, получено ${rows.length} записей`);
          
          // Проверяем уникальность PVZID
          const pvzIds = rows.map(row => row.pvz_id);
          const uniquePvzIds = [...new Set(pvzIds)];
          console.log(`🔍 Проверка уникальности PVZID: ${pvzIds.length} записей, ${uniquePvzIds.length} уникальных PVZID`);
          
          if (pvzIds.length !== uniquePvzIds.length) {
            console.warn('⚠️ Обнаружены дублирующиеся PVZID!');
            const duplicates = pvzIds.filter((id, index) => pvzIds.indexOf(id) !== index);
            console.warn('⚠️ Дублирующиеся PVZID:', [...new Set(duplicates)]);
          }
          
          resolve(rows);
        }
      });
    });
    
    res.json({
      success: true,
      data: {
        items: rows,
        total: rows.length
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения данных ПВЗ с комментариями:', error);
    res.status(500).json({ 
      error: 'Ошибка получения данных ПВЗ с комментариями',
      details: error.message 
    });
  }
});

/**
 * GET /api/data/comments - Получить комментарии
 */
router.get('/comments', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { pvz_id } = req.query;
    const db = database.getDb();
    
    let query = `
      SELECT c.*, p.region, p.address, comp.company_name 
      FROM comments c 
      LEFT JOIN pvz p ON c.pvz_id = p.pvz_id
      LEFT JOIN companies comp ON p.company_id = comp.company_id
    `;
    let params = [];
    
    if (pvz_id) {
      query += ' WHERE c.pvz_id = ?';
      params.push(pvz_id);
    }
    
    query += ' ORDER BY c.created_at DESC';
    
    const rows = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({
      success: true,
      data: rows
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения комментариев:', error);
    res.status(500).json({ 
      error: 'Ошибка получения комментариев',
      details: error.message 
    });
  }
});

/**
 * POST /api/data/comments - Добавить комментарий
 */
router.post('/comments', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { pvz_id, comment, problems } = req.body;
    const created_by = req.user.login;
    
    console.log('💬 Сохранение комментария:', { pvz_id, comment, problems, created_by });
    
    if (!pvz_id) {
      return res.status(400).json({ 
        error: 'PVZ ID обязателен',
        details: 'Не указан ID ПВЗ для комментария' 
      });
    }
    
    // Проверяем, что есть либо комментарий, либо проблема (включая пустую строку для "Нет проблем")
    if (!comment && problems === undefined) {
      return res.status(400).json({ 
        error: 'Необходимо указать комментарий или проблему' 
      });
    }
    
    const db = database.getDb();
    
    // Начинаем транзакцию
    db.serialize(() => {
      // Добавляем комментарий, если он есть
      if (comment && comment.trim()) {
        db.run(`
          INSERT INTO comments (pvz_id, comment, created_by) 
          VALUES (?, ?, ?)
        `, [pvz_id, comment.trim(), created_by], function(err) {
          if (err) {
            console.error('❌ Ошибка добавления комментария:', err);
            return res.status(500).json({ 
              error: 'Ошибка добавления комментария',
              details: err.message 
            });
          }
          
          console.log('✅ Комментарий добавлен, ID:', this.lastID);
        });
      }
      
      // Обновляем поле problems в таблице pvz (включая пустую строку для "Нет проблем")
      if (problems !== undefined) {
        db.run(`
          UPDATE pvz 
          SET problems = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE pvz_id = ?
        `, [problems, pvz_id], function(err) {
          if (err) {
            console.error('❌ Ошибка обновления problems:', err);
            // Не прерываем выполнение, так как комментарий мог быть сохранен
          } else {
            console.log('✅ Поле problems обновлено для PVZ:', pvz_id, 'значение:', problems || '(пустое)');
          }
          
          res.json({
            success: true,
            message: 'Данные сохранены',
            commentId: comment && comment.trim() ? 'saved' : null,
            problemsUpdated: true
          });
        });
      } else {
        // Если problems не указано, просто возвращаем успех
        res.json({
          success: true,
          message: 'Комментарий добавлен',
          commentId: comment && comment.trim() ? 'saved' : null,
          problemsUpdated: false
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка добавления комментария:', error);
    res.status(500).json({ 
      error: 'Ошибка добавления комментария',
      details: error.message 
    });
  }
});

/**
 * GET /api/data/scheduler/status - Получить статус планировщика
 */
router.get('/scheduler/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const status = scheduler.getStatus();
    
    // Получаем настройки из базы данных
    const db = database.getDb();
    const settings = await new Promise((resolve, reject) => {
      db.all('SELECT key, value FROM settings', [], (err, rows) => {
        if (err) reject(err);
        else {
          const settingsObj = {};
          rows.forEach(row => {
            settingsObj[row.key] = row.value;
          });
          resolve(settingsObj);
        }
      });
    });
    
    res.json({
      success: true,
      status: status,
      settings: settings
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения статуса планировщика:', error);
    res.status(500).json({ 
      error: 'Ошибка получения статуса планировщика',
      details: error.message 
    });
  }
});

/**
 * POST /api/data/scheduler/start - Запустить планировщик
 */
router.post('/scheduler/start', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await scheduler.start();
    res.json({
      success: true,
      message: 'Планировщик запущен'
    });
  } catch (error) {
    console.error('❌ Ошибка запуска планировщика:', error);
    res.status(500).json({ 
      error: 'Ошибка запуска планировщика',
      details: error.message 
    });
  }
});

/**
 * POST /api/data/scheduler/stop - Остановить планировщик
 */
router.post('/scheduler/stop', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await scheduler.stop();
    res.json({
      success: true,
      message: 'Планировщик остановлен'
    });
  } catch (error) {
    console.error('❌ Ошибка остановки планировщика:', error);
    res.status(500).json({ 
      error: 'Ошибка остановки планировщика',
      details: error.message 
    });
  }
});

/**
 * GET /api/data/table-settings/:tableName - Получить настройки таблицы для пользователя
 */
router.get('/table-settings/:tableName', authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.params;
    const userId = req.user.id;
    
    const db = database.getDb();
    
    const row = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM user_table_settings WHERE user_id = ? AND table_name = ?',
        [userId, tableName],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (row) {
      res.json({
        success: true,
        settings: {
          columnVisibility: JSON.parse(row.column_visibility),
          columnWidths: JSON.parse(row.column_widths),
          columnOrder: JSON.parse(row.column_order)
        }
      });
    } else {
      // Возвращаем настройки по умолчанию
      res.json({
        success: true,
        settings: {
          columnVisibility: {},
          columnWidths: {},
          columnOrder: []
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка получения настроек таблицы:', error);
    res.status(500).json({ 
      error: 'Ошибка получения настроек таблицы',
      details: error.message 
    });
  }
});

/**
 * POST /api/data/table-settings/:tableName - Сохранить настройки таблицы для пользователя
 */
router.post('/table-settings/:tableName', authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.params;
    const userId = req.user.id;
    const { columnVisibility, columnWidths, columnOrder } = req.body;
    
    console.log('💾 Сохранение настроек таблицы:', { userId, tableName, columnVisibility, columnWidths, columnOrder });
    console.log('👤 Информация о пользователе:', { id: req.user.id, login: req.user.login, role: req.user.role });
    
    const db = database.getDb();
    
    // Используем INSERT OR REPLACE для избежания race conditions
    console.log('💾 Сохраняем настройки с помощью INSERT OR REPLACE...');
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO user_table_settings 
         (user_id, table_name, column_visibility, column_widths, column_order, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          userId,
          tableName,
          JSON.stringify(columnVisibility),
          JSON.stringify(columnWidths),
          JSON.stringify(columnOrder)
        ],
        function(err) {
          if (err) {
            console.error('❌ Ошибка сохранения настроек:', err);
            reject(err);
          } else {
            console.log(`✅ Настройки сохранены, затронуто строк: ${this.changes}, lastID: ${this.lastID}`);
            resolve(this);
          }
        }
      );
    });
    
    res.json({
      success: true,
      message: 'Настройки таблицы сохранены'
    });
    
  } catch (error) {
    console.error('❌ Ошибка сохранения настроек таблицы:', error);
    res.status(500).json({ 
      error: 'Ошибка сохранения настроек таблицы',
      details: error.message 
    });
  }
});

/**
 * DELETE /api/data/table-settings/:tableName - Удалить настройки таблицы для пользователя
 */
router.delete('/table-settings/:tableName', authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.params;
    const userId = req.user.id;
    
    console.log('🗑️ Удаление настроек таблицы:', { userId, tableName });
    
    const db = database.getDb();
    
    // Удаляем настройки для данного пользователя и таблицы
    const result = await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM user_table_settings WHERE user_id = ? AND table_name = ?',
        [userId, tableName],
        function(err) {
          if (err) {
            console.error('❌ Ошибка удаления настроек:', err);
            reject(err);
          } else {
            console.log(`✅ Настройки удалены, затронуто строк: ${this.changes}`);
            resolve(this);
          }
        }
      );
    });
    
    res.json({
      success: true,
      message: 'Настройки таблицы удалены'
    });
    
  } catch (error) {
    console.error('❌ Ошибка удаления настроек таблицы:', error);
    res.status(500).json({ 
      error: 'Ошибка удаления настроек таблицы',
      details: error.message 
    });
  }
});

/**
 * GET /api/data/regions - Получить список всех регионов
 */
router.get('/regions', authenticateToken, requireAnyRole, addUserRegions, async (req, res) => {
  try {
    const database = require('../database/db');
    const db = database.getDb();
    
    let regions;
    
    if (req.userRole === 'admin') {
      // Администратор видит все регионы
      regions = await new Promise((resolve, reject) => {
        db.all('SELECT DISTINCT region FROM pvz WHERE region IS NOT NULL AND region != "" ORDER BY region', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => row.region));
        });
      });
      console.log(`🔍 Admin получил ${regions.length} регионов:`, regions.slice(0, 5));
    } else if (req.userRole === 'superuser') {
      // Superuser видит все регионы (может фильтровать по любому региону)
      regions = await new Promise((resolve, reject) => {
        db.all('SELECT DISTINCT region FROM pvz WHERE region IS NOT NULL AND region != "" ORDER BY region', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => row.region));
        });
      });
      console.log(`🔍 Superuser получил ${regions.length} регионов:`, regions.slice(0, 5));
    } else {
      // Обычные пользователи видят только свои регионы
      regions = req.userRegions || [];
    }
    
    res.json({
      success: true,
      data: regions
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения регионов:', error);
    res.status(500).json({ 
      error: 'Ошибка получения регионов',
      details: error.message 
    });
  }
});

/**
 * POST /api/data/export - Экспорт данных в XLS файл
 */
router.post('/export', authenticateToken, addMenuPermissions, addUserRegions, addUserStatuses, async (req, res) => {
  try {
    const { filters } = req.body;
    
    const db = database.getDb();
    if (!db) {
      throw new Error('База данных не подключена');
    }
    
    // Параметры фильтрации (аналогично /pvz-with-comments)
    const pvzId = filters?.pvzId || '';
    const regions = filters?.regions || [];
    const address = filters?.address || '';
    const company = filters?.company || '';
    
    // Строим WHERE условия (копируем логику из /pvz-with-comments)
    let whereConditions = [];
    let params = [];
    
    // Фильтр по PVZ ID
    if (pvzId) {
      whereConditions.push('p.pvz_id LIKE ?');
      params.push(`%${pvzId}%`);
    }
    
    // Логика фильтрации по ролям и регионам (аналогично /pvz-with-comments)
    if (req.user.roleName === 'admin') {
      // Admin видит все записи, но может фильтровать по выбранным регионам
      if (regions.length > 0) {
        const placeholders = regions.map(() => '?').join(',');
        whereConditions.push(`p.region IN (${placeholders})`);
        params.push(...regions);
      }
      // Если admin не выбрал регионы, показываем все (без дополнительных условий)
    } else if (req.user.roleName === 'superuser') {
      // Superuser видит записи только своей компании, независимо от региона
      if (req.user.companyId) {
        whereConditions.push('p.company_id = ?');
        params.push(req.user.companyId);
        
        // Superuser может дополнительно фильтровать по регионам
        if (regions.length > 0) {
          const placeholders = regions.map(() => '?').join(',');
          whereConditions.push(`p.region IN (${placeholders})`);
          params.push(...regions);
        }
      } else {
        // Если у superuser нет компании, не показываем ничего
        whereConditions.push('1 = 0');
      }
    } else {
      // Обычные пользователи видят записи своей компании + фильтр по регионам роли
      if (req.user.companyId) {
        whereConditions.push('p.company_id = ?');
        params.push(req.user.companyId);
        
        // Дополнительно фильтруем по регионам роли
        if (req.userRegions && req.userRegions.length > 0) {
          const placeholders = req.userRegions.map(() => '?').join(',');
          whereConditions.push(`p.region IN (${placeholders})`);
          params.push(...req.userRegions);
          
          // Если пользователь выбрал конкретные регионы, фильтруем по ним
          if (regions.length > 0) {
            const filteredRegions = regions.filter(region => req.userRegions.includes(region));
            if (filteredRegions.length > 0) {
              whereConditions.pop(); // Удаляем предыдущее условие
              params.splice(-req.userRegions.length); // Удаляем предыдущие параметры
              const placeholders = filteredRegions.map(() => '?').join(',');
              whereConditions.push(`p.region IN (${placeholders})`);
              params.push(...filteredRegions);
            }
          }
        } else {
          // Если у пользователя нет регионов, не показываем ничего
          whereConditions.push('1 = 0');
        }
      } else {
        // Если у пользователя нет компании, не показываем ничего
        whereConditions.push('1 = 0');
      }
    }
    
    if (address) {
      whereConditions.push('p.address LIKE ?');
      params.push(`%${address}%`);
    }
    
    if (company) {
      whereConditions.push('c.company_name LIKE ?');
      params.push(`%${company}%`);
    }
    
    // Фильтрация по статусам (если у пользователя есть ограничения по статусам)
    if (req.userStatuses && req.userStatuses.length > 0) {
      const placeholders = req.userStatuses.map(() => '?').join(',');
      whereConditions.push(`p.status_name IN (${placeholders})`);
      params.push(...req.userStatuses);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    console.log('🔍 WHERE условия для экспорта:', whereConditions);
    console.log('🔍 Параметры для экспорта:', params);
    console.log('🔍 WHERE clause:', whereClause);
    
    // Получаем все данные для экспорта
    const baseQuery = `
      SELECT 
        p.pvz_id,
        p.region,
        p.address,
        p.service_name,
        p.status_date,
        p.status_name,
        comp.company_name,
        p.transaction_date,
        p.transaction_amount,
        p.phone,
        p.postal_code,
        p.fitting_room,
        c.comment as last_comment,
        c.created_by as comment_author,
        c.created_at as comment_date
      FROM pvz p
      LEFT JOIN (
        SELECT 
          c1.pvz_id,
          c1.comment,
          c1.created_by,
          c1.created_at
        FROM comments c1
        INNER JOIN (
          SELECT 
            pvz_id, 
            MAX(created_at) as max_date
          FROM comments
          GROUP BY pvz_id
        ) c2 ON c1.pvz_id = c2.pvz_id AND c1.created_at = c2.max_date
        WHERE c1.rowid = (
          SELECT MIN(c3.rowid)
          FROM comments c3
          WHERE c3.pvz_id = c1.pvz_id AND c3.created_at = c2.max_date
        )
      ) c ON p.pvz_id = c.pvz_id
      LEFT JOIN companies comp ON p.company_id = comp.company_id
      ${whereClause}
      ORDER BY p.region, p.pvz_id
    `;
    
    console.log('🔍 SQL запрос для экспорта:', baseQuery);
    
    const rows = await new Promise((resolve, reject) => {
      db.all(baseQuery, params, (err, rows) => {
        if (err) {
          console.error('❌ Ошибка SQL запроса экспорта:', err);
          reject(err);
        } else {
          console.log(`✅ Получено ${rows.length} записей для экспорта`);
          resolve(rows);
        }
      });
    });
    
    if (rows.length === 0) {
      return res.status(400).json({
        error: 'Нет данных для экспорта',
        message: 'По заданным фильтрам не найдено ни одной записи'
      });
    }
    
    // Группируем данные по регионам
    const dataByRegion = {};
    rows.forEach(row => {
      const region = row.region || 'Без региона';
      if (!dataByRegion[region]) {
        dataByRegion[region] = [];
      }
      dataByRegion[region].push(row);
    });
    
    console.log(`📊 Данные сгруппированы по ${Object.keys(dataByRegion).length} регионам`);
    
    // Создаем новую рабочую книгу
    const workbook = XLSX.utils.book_new();
    
    // Заголовки колонок
    const headers = [
      'ID ПВЗ',
      'Регион', 
      'Адрес',
      'Наименование сервиса',
      'Дата статуса',
      'Наименование статуса',
      'Наименование компании',
      'Дата транзакции',
      'Сумма транзакции, руб',
      'Телефон',
      'Индекс',
      'Примерочная',
      'Последний комментарий',
      'Кто комментировал',
      'Когда комментировал'
    ];
    
    // Создаем общий лист со всеми данными (первый лист)
    const allDataSheet = [
      headers, // Заголовки
      ...rows.map(row => [
        row.pvz_id || '',
        row.region || '',
        row.address || '',
        row.service_name || '',
        row.status_date || '',
        row.status_name || '',
        row.company_name || '',
        row.transaction_date || '',
        row.transaction_amount || '',
        row.phone || '',
        row.postal_code || '',
        row.fitting_room || '',
        row.last_comment || '',
        row.comment_author || '',
        row.comment_date || ''
      ])
    ];
    
    // Создаем общий лист
    const allDataWorksheet = XLSX.utils.aoa_to_sheet(allDataSheet);
    
    // Настраиваем ширину колонок для общего листа
    const colWidths = [
      { wch: 12 }, // ID ПВЗ
      { wch: 20 }, // Регион
      { wch: 40 }, // Адрес
      { wch: 25 }, // Наименование сервиса
      { wch: 15 }, // Дата статуса
      { wch: 20 }, // Наименование статуса
      { wch: 30 }, // Наименование компании
      { wch: 15 }, // Дата транзакции
      { wch: 20 }, // Сумма транзакции
      { wch: 15 }, // Телефон
      { wch: 10 }, // Индекс
      { wch: 12 }, // Примерочная
      { wch: 30 }, // Последний комментарий
      { wch: 20 }, // Кто комментировал
      { wch: 20 }  // Когда комментировал
    ];
    allDataWorksheet['!cols'] = colWidths;
    
    // Добавляем общий лист в книгу (первым)
    XLSX.utils.book_append_sheet(workbook, allDataWorksheet, 'Все данные');
    
    // Создаем лист для каждого региона
    Object.keys(dataByRegion).forEach(region => {
      const regionData = dataByRegion[region];
      
      // Подготавливаем данные для листа
      const sheetData = [
        headers, // Заголовки
        ...regionData.map(row => [
          row.pvz_id || '',
          row.region || '',
          row.address || '',
          row.service_name || '',
          row.status_date || '',
          row.status_name || '',
          row.company_name || '',
          row.transaction_date || '',
          row.transaction_amount || '',
          row.phone || '',
          row.postal_code || '',
          row.fitting_room || '',
          row.last_comment || '',
          row.comment_author || '',
          row.comment_date || ''
        ])
      ];
      
      // Создаем лист
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      
      // Настраиваем ширину колонок
      const colWidths = [
        { wch: 12 }, // ID ПВЗ
        { wch: 20 }, // Регион
        { wch: 40 }, // Адрес
        { wch: 25 }, // Наименование сервиса
        { wch: 15 }, // Дата статуса
        { wch: 20 }, // Наименование статуса
        { wch: 30 }, // Наименование компании
        { wch: 15 }, // Дата транзакции
        { wch: 20 }, // Сумма транзакции
        { wch: 15 }, // Телефон
        { wch: 10 }, // Индекс
        { wch: 12 }, // Примерочная
        { wch: 30 }, // Последний комментарий
        { wch: 20 }, // Кто комментировал
        { wch: 20 }  // Когда комментировал
      ];
      worksheet['!cols'] = colWidths;
      
      // Добавляем лист в книгу (ограничиваем длину названия листа)
      const sheetName = region.length > 31 ? region.substring(0, 31) : region;
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });
    
    // Генерируем буфер Excel файла
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      compression: true
    });
    
    // Генерируем имя файла с датой
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `PVZ_export_${dateStr}_${timeStr}.xlsx`;
    
    console.log(`✅ Создан Excel файл: ${filename}, размер: ${excelBuffer.length} байт`);
    
    // Отправляем файл
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);
    
    res.send(excelBuffer);
    
  } catch (error) {
    console.error('❌ Ошибка экспорта данных:', error);
    res.status(500).json({ 
      error: 'Ошибка экспорта данных',
      details: error.message 
    });
  }
});

module.exports = router;
