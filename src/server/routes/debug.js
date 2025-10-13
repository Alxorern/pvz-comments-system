const express = require('express');
const router = express.Router();
const database = require('../database/db');
const fs = require('fs');

/**
 * GET /api/debug/db-info - Информация о базе данных
 */
router.get('/db-info', (req, res) => {
  try {
    const db = database.getDb();
    const filename = db.filename;
    
    let fileSize = 0;
    let tables = [];
    
    try {
      const stats = fs.statSync(filename);
      fileSize = stats.size;
    } catch (err) {
      console.error('Ошибка получения размера файла:', err.message);
    }
    
    // Получаем список таблиц
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
      if (err) {
        console.error('Ошибка получения таблиц:', err);
        tables = [];
      } else {
        tables = rows.map(row => row.name);
      }
      
      res.json({
        filename,
        fileSize,
        tables,
        connected: !!db
      });
    });
    
  } catch (error) {
    console.error('Ошибка debug/db-info:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/debug/users - Список пользователей
 */
router.get('/users', (req, res) => {
  try {
    const db = database.getDb();
    
    db.all('SELECT user_id, login, role_id FROM users', (err, rows) => {
      if (err) {
        console.error('Ошибка получения пользователей:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({ users: rows });
    });
    
  } catch (error) {
    console.error('Ошибка debug/users:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/debug/roles - Список ролей
 */
router.get('/roles', (req, res) => {
  try {
    const db = database.getDb();
    
    db.all('SELECT id, name, is_active FROM roles', (err, rows) => {
      if (err) {
        console.error('Ошибка получения ролей:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({ roles: rows });
    });
    
  } catch (error) {
    console.error('Ошибка debug/roles:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/debug/join-test - Тест JOIN запроса
 */
router.get('/join-test', (req, res) => {
  try {
    const db = database.getDb();
    
    const sql = 'SELECT u.user_id, u.login, u.role_id, r.name as role_name, r.is_active FROM users u LEFT JOIN roles r ON u.role_id = r.id';
    
    db.all(sql, (err, rows) => {
      if (err) {
        console.error('Ошибка JOIN запроса:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({ results: rows });
    });
    
  } catch (error) {
    console.error('Ошибка debug/join-test:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
