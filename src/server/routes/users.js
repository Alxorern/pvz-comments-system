const express = require('express');
const router = express.Router();
const database = require('../database/db');
const bcrypt = require('bcrypt');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');

/**
 * GET /api/users - Получить всех пользователей
 */
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  const db = database.getDb();
  db.all('SELECT * FROM users ORDER BY created_at DESC', (err, rows) => {
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
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { full_name, login, password, role } = req.body;
  const password_hash = bcrypt.hashSync(password, 10);
  
  const db = database.getDb();
  
  // Получаем следующий user_id
  db.get('SELECT MAX(user_id) as max_id FROM users', (err, row) => {
    if (err) {
      console.error('❌ Ошибка получения максимального user_id:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    const next_user_id = (row.max_id || 0) + 1;
    
    db.run(
      'INSERT INTO users (user_id, full_name, login, password_hash, role, role_id, addwho) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [next_user_id, full_name, login, password_hash, role, 1, 'admin'],
      function(err) {
        if (err) {
          console.error('❌ Ошибка создания пользователя:', err);
          res.status(500).json({ error: err.message });
          return;
        }
        console.log('✅ Пользователь создан с ID:', this.lastID);
        res.json({ success: true, id: this.lastID, message: 'User created successfully' });
      }
    );
  });
});

/**
 * PUT /api/users/:id - Обновить пользователя
 */
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { full_name, login, password, role } = req.body;
  
  console.log('🔄 Обновление пользователя:', { id, full_name, login, role, hasPassword: !!password });
  
  let query, params;
  
  if (password && password.trim() !== '') {
    // Если пароль указан, обновляем его
    const password_hash = bcrypt.hashSync(password, 10);
    query = 'UPDATE users SET full_name = ?, login = ?, password_hash = ?, role = ? WHERE user_id = ?';
    params = [full_name, login, password_hash, role, id];
  } else {
    // Если пароль не указан, не обновляем его
    query = 'UPDATE users SET full_name = ?, login = ?, role = ? WHERE user_id = ?';
    params = [full_name, login, role, id];
  }
  
  console.log('🔍 Выполняем SQL запрос:', query);
  console.log('🔍 Параметры:', params);
  
  const db = database.getDb();
  db.run(query, params, function(err) {
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
    res.json({ success: true, message: 'User updated successfully' });
  });
});

module.exports = router;
