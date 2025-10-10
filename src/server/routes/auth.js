const express = require('express');
const router = express.Router();
const database = require('../database/db');
const bcrypt = require('bcrypt');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { requireAnyRole } = require('../middleware/roles');

/**
 * POST /api/auth - Аутентификация пользователя
 */
router.post('/', async (req, res) => {
  const { login, password } = req.body;
  
  try {
    // Используем основное подключение к базе данных
    const database = require('../database/db');
    const db = database.getDb();
    
    if (!db) {
      console.error('❌ База данных не подключена');
      res.status(500).json({ error: 'База данных не подключена' });
      return;
    }
  
    // Аутентификация пользователя
    db.get('SELECT * FROM users WHERE login = ?', [login], (err, row) => {
      if (err) {
        console.error('❌ Ошибка аутентификации:', err);
        res.status(500).json({ error: err.message });
        return;
      }
    if (row) {
      // Проверяем пароль
      if (bcrypt.compareSync(password, row.password_hash)) {
        console.log('✅ Успешная аутентификация для пользователя:', login);
        
        // Генерируем JWT токен
        const token = generateToken(row);
        
        res.json({ 
          success: true, 
          token: token,
          user: { 
            login: row.login, 
            role: row.role, 
            full_name: row.full_name 
          } 
        });
      } else {
        console.log('❌ Неверный пароль для пользователя:', login);
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      console.log('❌ Пользователь не найден:', login);
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
  
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error);
    res.status(500).json({ error: 'Ошибка подключения к базе данных' });
  }
});

/**
 * POST /api/logout - Выход из системы
 */
router.post('/logout', (req, res) => {
  console.log('🚪 Пользователь вышел из системы');
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * POST /api/auth/verify - Проверка валидности токена
 */
router.post('/verify', authenticateToken, (req, res) => {
  console.log('✅ Токен валиден для пользователя:', req.user.login);
  res.json({ 
    success: true, 
    user: { 
      login: req.user.login, 
      role: req.user.role, 
      full_name: req.user.full_name 
    } 
  });
});

/**
 * GET /api/auth/user-info - Получить информацию о текущем пользователе
 */
router.get('/user-info', authenticateToken, requireAnyRole, (req, res) => {
  try {
    const db = database.getDb();
    
    // Получаем информацию о пользователе с его ролью
    db.get(
      `SELECT u.id, u.login, u.full_name, r.name as role_name, r.is_active as role_active
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`,
      [req.user.id],
      (err, row) => {
        if (err) {
          console.error('❌ Ошибка получения информации о пользователе:', err);
          res.status(500).json({ error: err.message });
          return;
        }
        
        if (!row) {
          res.status(404).json({ error: 'Пользователь не найден' });
          return;
        }
        
        res.json({
          id: row.id,
          login: row.login,
          full_name: row.full_name,
          role: row.role_name || 'user',
          role_active: row.role_active
        });
      }
    );
  } catch (error) {
    console.error('❌ Ошибка получения информации о пользователе:', error);
    res.status(500).json({ error: 'Ошибка получения информации о пользователе' });
  }
});

module.exports = router;
