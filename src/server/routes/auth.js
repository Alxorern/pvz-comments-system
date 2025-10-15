const express = require('express');
const router = express.Router();
const database = require('../database/db');
const bcrypt = require('bcrypt');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { setAuthCookie, clearAuthCookie, authenticateToken: secureAuthToken, authenticatePage: secureAuthPage } = require('../middleware/secureAuth');
const { requireAnyRole, addMenuPermissions } = require('../middleware/roles');
const { validate, schemas } = require('../middleware/validation');
const AuditService = require('../services/auditService');

/**
 * POST /api/auth - Аутентификация пользователя
 */
router.post('/', validate(schemas.auth), async (req, res) => {
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
    db.get('SELECT * FROM users WHERE login = ?', [login], async (err, row) => {
      if (err) {
        console.error('❌ Ошибка аутентификации:', err);
        res.status(500).json({ error: err.message });
        return;
      }
    if (row) {
      // Проверяем пароль
      if (bcrypt.compareSync(password, row.password_hash)) {
        console.log('✅ Успешная аутентификация для пользователя:', login);
        
        // Логируем успешный вход
        req.user = { id: row.user_id, login: row.login };
        await AuditService.logAction(req, 'LOGIN_SUCCESS', 'user', row.user_id);
        
        // Генерируем JWT токен
        const token = generateToken(row);
        
        // Устанавливаем httpOnly cookie
        setAuthCookie(res, token);
        
        res.json({ 
          success: true, 
          user: { 
            id: row.user_id,
            login: row.login, 
            full_name: row.full_name 
          } 
        });
      } else {
        console.log('❌ Неверный пароль для пользователя:', login);
        
        // Логируем неудачную попытку входа
        req.user = { id: null, login: login };
        await AuditService.logAction(req, 'LOGIN_FAILED', 'user', login);
        
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      console.log('❌ Пользователь не найден:', login);
      
      // Логируем попытку входа с несуществующим пользователем
      req.user = { id: null, login: login };
      await AuditService.logAction(req, 'LOGIN_FAILED', 'user', login);
      
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
router.post('/logout', secureAuthToken, async (req, res) => {
  console.log('🚪 Пользователь вышел из системы:', req.user.login);
  
  // Логируем выход из системы
  await AuditService.logAction(req, 'LOGOUT', 'user', req.user.id);
  
  // Удаляем httpOnly cookie
  clearAuthCookie(res);
  
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * POST /api/auth/verify - Проверка валидности токена
 */
router.post('/verify', secureAuthToken, (req, res) => {
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
 * GET /api/auth/user-info - Получение информации о пользователе с доступными пунктами меню
 */
router.get('/user-info', secureAuthToken, addMenuPermissions, (req, res) => {
  try {
    const userInfo = {
      id: req.user.id,
      login: req.user.login,
      full_name: req.user.full_name,
      role: req.user.roleName || req.user.role, // Используем roleName если role не установлен
      roleName: req.user.roleName,
      menuItems: req.user.menuItems || []
    };

    console.log('📋 Информация о пользователе с меню:', userInfo);
    
    res.json({
      success: true,
      user: userInfo
    });
  } catch (error) {
    console.error('❌ Ошибка получения информации о пользователе с меню:', error);
    res.status(500).json({ error: 'Ошибка получения информации о пользователе' });
  }
});

module.exports = router;
