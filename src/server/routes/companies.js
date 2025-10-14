const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');
const database = require('../database/db');

/**
 * GET /api/companies - Получение списка компаний
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const db = database.getDb();
    
    let query = 'SELECT * FROM companies';
    let countQuery = 'SELECT COUNT(*) as total FROM companies';
    let params = [];
    
    if (search) {
      const searchCondition = 'WHERE company_name LIKE ? OR phone LIKE ?';
      query += ` ${searchCondition}`;
      countQuery += ` ${searchCondition}`;
      const searchParam = `%${search}%`;
      params = [searchParam, searchParam];
    }
    
    query += ' ORDER BY company_name ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    // Получаем данные
    const rows = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Получаем общее количество
    const countResult = await new Promise((resolve, reject) => {
      db.get(countQuery, search ? [searchParam, searchParam] : [], (err, row) => {
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
    console.error('❌ Ошибка получения списка компаний:', error);
    res.status(500).json({ 
      error: 'Ошибка получения списка компаний',
      details: error.message 
    });
  }
});

/**
 * GET /api/companies/all - Получение всех компаний для выпадающих списков
 */
router.get('/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = database.getDb();
    
    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT company_id, company_name FROM companies ORDER BY company_name ASC', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({
      success: true,
      data: rows
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения всех компаний:', error);
    res.status(500).json({ 
      error: 'Ошибка получения всех компаний',
      details: error.message 
    });
  }
});

/**
 * POST /api/companies - Создание новой компании
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { company_name, phone } = req.body;
    
    if (!company_name || company_name.trim() === '') {
      return res.status(400).json({ 
        error: 'Название компании обязательно' 
      });
    }
    
    const db = database.getDb();
    
    // Генерируем новый company_id
    const maxIdResult = await new Promise((resolve, reject) => {
      db.get(
        'SELECT MAX(CAST(company_id AS INTEGER)) as max_id FROM companies WHERE company_id GLOB "[0-9]*"',
        [],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    const nextId = (maxIdResult?.max_id || 0) + 1;
    const companyId = String(nextId).padStart(6, '0');
    
    // Создаем компанию
    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO companies (company_id, company_name, phone) VALUES (?, ?, ?)',
        [companyId, company_name.trim(), phone?.trim() || null],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, company_id: companyId });
        }
      );
    });
    
    console.log(`✅ Создана компания: ${company_name} (ID: ${companyId})`);
    
    res.json({
      success: true,
      message: 'Компания успешно создана',
      data: {
        id: result.id,
        company_id: result.company_id,
        company_name: company_name.trim(),
        phone: phone?.trim() || null
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка создания компании:', error);
    res.status(500).json({ 
      error: 'Ошибка создания компании',
      details: error.message 
    });
  }
});

/**
 * PUT /api/companies/:id - Обновление компании
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, phone } = req.body;
    
    if (!company_name || company_name.trim() === '') {
      return res.status(400).json({ 
        error: 'Название компании обязательно' 
      });
    }
    
    const db = database.getDb();
    
    // Обновляем компанию
    const result = await new Promise((resolve, reject) => {
      db.run(
        'UPDATE companies SET company_name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [company_name.trim(), phone?.trim() || null, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
    
    if (result === 0) {
      return res.status(404).json({ 
        error: 'Компания не найдена' 
      });
    }
    
    console.log(`✅ Обновлена компания ID ${id}: ${company_name}`);
    
    res.json({
      success: true,
      message: 'Компания успешно обновлена'
    });
    
  } catch (error) {
    console.error('❌ Ошибка обновления компании:', error);
    res.status(500).json({ 
      error: 'Ошибка обновления компании',
      details: error.message 
    });
  }
});

/**
 * DELETE /api/companies/:id - Удаление компании
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const db = database.getDb();
    
    // Проверяем, есть ли связанные ПВЗ
    const pvzCount = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM pvz WHERE company_id = (SELECT company_id FROM companies WHERE id = ?)',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });
    
    if (pvzCount > 0) {
      return res.status(400).json({ 
        error: `Невозможно удалить компанию. С ней связано ${pvzCount} ПВЗ. Сначала удалите или переназначьте ПВЗ.` 
      });
    }
    
    // Удаляем компанию
    const result = await new Promise((resolve, reject) => {
      db.run('DELETE FROM companies WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
    
    if (result === 0) {
      return res.status(404).json({ 
        error: 'Компания не найдена' 
      });
    }
    
    console.log(`✅ Удалена компания ID ${id}`);
    
    res.json({
      success: true,
      message: 'Компания успешно удалена'
    });
    
  } catch (error) {
    console.error('❌ Ошибка удаления компании:', error);
    res.status(500).json({ 
      error: 'Ошибка удаления компании',
      details: error.message 
    });
  }
});

module.exports = router;
