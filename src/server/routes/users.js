const express = require('express');
const router = express.Router();
const database = require('../database/db');
const bcrypt = require('bcrypt');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin, addMenuPermissions } = require('../middleware/roles');
const { validate, schemas } = require('../middleware/validation');
const AuditService = require('../services/auditService');

/**
 * GET /api/users - Получить всех пользователей
 */
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  const db = database.getDb();
  const query = `
    SELECT 
      u.*, 
      r.name as role_name,
      c.company_name
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN companies c ON u.company_id = c.company_id
    ORDER BY u.created_at DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      console.error('❌ Ошибка получения пользователей:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    console.log('✅ Получено пользователей:', rows.length);
    res.json({ success: true, data: rows });
  });
});

/**
 * POST /api/users - Создать нового пользователя
 */
router.post('/', authenticateToken, requireAdmin, validate(schemas.user), async (req, res) => {
  console.log('📥 Создание пользователя, полученные данные:', req.body);
  const { full_name, login, password, role, company_id } = req.body;
  const password_hash = bcrypt.hashSync(password, 10);
  
  const db = database.getDb();
  
  // Сначала получаем role_id по названию роли
  db.get('SELECT id FROM roles WHERE name = ?', [role], (err, roleRow) => {
    if (err) {
      console.error('❌ Ошибка получения role_id:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!roleRow) {
      console.error('❌ Роль не найдена:', role);
      res.status(400).json({ error: 'Роль не найдена' });
      return;
    }
    
    const role_id = roleRow.id;
    
    // Получаем следующий user_id
    db.get('SELECT MAX(user_id) as max_id FROM users', (err, row) => {
      if (err) {
        console.error('❌ Ошибка получения максимального user_id:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      const next_user_id = (row.max_id || 0) + 1;
      
      db.run(
        'INSERT INTO users (user_id, full_name, login, password_hash, role, role_id, addwho, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [next_user_id, full_name, login, password_hash, role, role_id, 'admin', company_id || null],
      async function(err) {
        if (err) {
          console.error('❌ Ошибка создания пользователя:', err);
          res.status(500).json({ error: err.message });
          return;
        }
        console.log('✅ Пользователь создан с ID:', this.lastID);
        
        // Логируем создание пользователя
        await AuditService.logAction(req, 'CREATE_USER', 'user', next_user_id);
        
        res.json({ success: true, id: this.lastID, message: 'User created successfully' });
      }
    );
    });
  });
});

/**
 * PUT /api/users/:id - Обновить пользователя
 */
router.put('/:id', authenticateToken, requireAdmin, validate(schemas.userUpdate), async (req, res) => {
  const { id } = req.params;
  const { full_name, login, password, role, company_id } = req.body;
  
  console.log('🔄 Обновление пользователя:', { id, full_name, login, role, company_id, hasPassword: !!password });
  
  const db = database.getDb();
  
  // Сначала получаем role_id по названию роли
  db.get('SELECT id FROM roles WHERE name = ?', [role], (err, roleRow) => {
    if (err) {
      console.error('❌ Ошибка получения role_id:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!roleRow) {
      console.error('❌ Роль не найдена:', role);
      res.status(400).json({ error: 'Роль не найдена' });
      return;
    }
    
    const role_id = roleRow.id;
    
    let query, params;
    
    if (password && password.trim() !== '') {
      // Если пароль указан, обновляем его
      const password_hash = bcrypt.hashSync(password, 10);
      query = 'UPDATE users SET full_name = ?, login = ?, password_hash = ?, role = ?, role_id = ?, company_id = ? WHERE user_id = ?';
      params = [full_name, login, password_hash, role, role_id, company_id || null, id];
    } else {
      // Если пароль не указан, не обновляем его
      query = 'UPDATE users SET full_name = ?, login = ?, role = ?, role_id = ?, company_id = ? WHERE user_id = ?';
      params = [full_name, login, role, role_id, company_id || null, id];
    }
    
    console.log('🔍 Выполняем SQL запрос:', query);
    console.log('🔍 Параметры:', params);
    
    db.run(query, params, async function(err) {
    if (err) {
      console.error('❌ Ошибка обновления пользователя:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    console.log('✅ Пользователь обновлен:', id);
    
    // Логируем обновление пользователя
    await AuditService.logAction(req, 'UPDATE_USER', 'user', id);
    
    res.json({ success: true, message: 'User updated successfully' });
    });
  });
});

module.exports = router;
