const express = require('express');
const router = express.Router();
const database = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');

/**
 * GET /api/roles - Получить все роли с их регионами
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = database.getDb();
    
    const roles = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          r.id,
          r.name,
          r.is_active,
          r.created_at,
          GROUP_CONCAT(
            CASE 
              WHEN reg.name IS NOT NULL 
              THEN json_object('id', reg.id, 'name', reg.name)
              ELSE NULL 
            END
          ) as regions_json
        FROM roles r
        LEFT JOIN role_regions rr ON r.id = rr.role_id
        LEFT JOIN regions reg ON rr.region_id = reg.id
        GROUP BY r.id, r.name, r.is_active, r.created_at
        ORDER BY r.name
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Парсим JSON регионов для каждой роли
    const rolesWithRegions = roles.map(role => {
      let regions = [];
      if (role.regions_json) {
        try {
          // Разделяем JSON объекты по },{ и добавляем недостающие скобки
          const jsonString = '[' + role.regions_json.replace(/},{/g, '},{') + ']';
          regions = JSON.parse(jsonString);
        } catch (error) {
          console.error('❌ Ошибка парсинга регионов для роли', role.id, ':', error);
          regions = [];
        }
      }
      return {
        ...role,
        regions: regions
      };
    });

    res.json({ success: true, data: rolesWithRegions });
  } catch (error) {
    console.error('❌ Ошибка получения ролей:', error);
    res.status(500).json({ 
      error: 'Ошибка получения ролей',
      details: error.message 
    });
  }
});

/**
 * GET /api/roles/regions - Получить все регионы
 */
router.get('/regions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = database.getDb();
    
    const regions = await new Promise((resolve, reject) => {
      db.all(`
        SELECT id, name, created_at
        FROM regions
        ORDER BY name
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ success: true, data: regions });
  } catch (error) {
    console.error('❌ Ошибка получения регионов:', error);
    res.status(500).json({ 
      error: 'Ошибка получения регионов',
      details: error.message 
    });
  }
});

/**
 * POST /api/roles - Создать новую роль
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, is_active = 1, regions = [] } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Название роли обязательно' });
    }

    const db = database.getDb();
    
    // Начинаем транзакцию
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // Создаем роль
      db.run(`
        INSERT INTO roles (name, is_active) 
        VALUES (?, ?)
      `, [name.trim(), is_active], function(err) {
        if (err) {
          console.error('❌ Ошибка создания роли:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Ошибка создания роли' });
        }

        const roleId = this.lastID;
        console.log(`✅ Роль "${name}" создана с ID: ${roleId}`);

        // Если есть регионы, добавляем их
        if (regions.length > 0) {
          let regionsProcessed = 0;
          
          regions.forEach(regionId => {
            db.run(`
              INSERT INTO role_regions (role_id, region_id) 
              VALUES (?, ?)
            `, [roleId, regionId], function(err) {
              if (err) {
                console.error(`❌ Ошибка добавления региона ${regionId} к роли ${roleId}:`, err);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Ошибка добавления региона к роли' });
              } else {
                console.log(`✅ Регион ${regionId} добавлен к роли ${roleId}`);
              }
              
              regionsProcessed++;
              if (regionsProcessed === regions.length) {
                db.run('COMMIT');
                res.json({ 
                  success: true, 
                  message: 'Роль создана успешно',
                  id: roleId
                });
              }
            });
          });
        } else {
          db.run('COMMIT');
          res.json({ 
            success: true, 
            message: 'Роль создана успешно',
            id: roleId
          });
        }
      });
    });
  } catch (error) {
    console.error('❌ Ошибка создания роли:', error);
    res.status(500).json({ 
      error: 'Ошибка создания роли',
      details: error.message 
    });
  }
});

/**
 * PUT /api/roles/:id - Обновить роль
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const roleId = req.params.id;
    const { name, is_active, regions = [] } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Название роли обязательно' });
    }

    const db = database.getDb();
    
    // Начинаем транзакцию
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // Обновляем роль
      db.run(`
        UPDATE roles 
        SET name = ?, is_active = ?
        WHERE id = ?
      `, [name.trim(), is_active, roleId], function(err) {
        if (err) {
          console.error('❌ Ошибка обновления роли:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Ошибка обновления роли' });
        }

        if (this.changes === 0) {
          db.run('ROLLBACK');
          return res.status(404).json({ error: 'Роль не найдена' });
        }

        console.log(`✅ Роль ID ${roleId} обновлена`);

        // Удаляем старые связи с регионами
        db.run(`
          DELETE FROM role_regions 
          WHERE role_id = ?
        `, [roleId], function(err) {
          if (err) {
            console.error('❌ Ошибка удаления старых связей с регионами:', err);
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Ошибка обновления связей с регионами' });
          }

          // Добавляем новые связи с регионами
          if (regions.length > 0) {
            let regionsProcessed = 0;
            
            regions.forEach(regionId => {
              db.run(`
                INSERT INTO role_regions (role_id, region_id) 
                VALUES (?, ?)
              `, [roleId, regionId], function(err) {
                if (err) {
                  console.error(`❌ Ошибка добавления региона ${regionId} к роли ${roleId}:`, err);
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: 'Ошибка добавления региона к роли' });
                } else {
                  console.log(`✅ Регион ${regionId} добавлен к роли ${roleId}`);
                }
                
                regionsProcessed++;
                if (regionsProcessed === regions.length) {
                  db.run('COMMIT');
                  res.json({ 
                    success: true, 
                    message: 'Роль обновлена успешно'
                  });
                }
              });
            });
          } else {
            db.run('COMMIT');
            res.json({ 
              success: true, 
              message: 'Роль обновлена успешно'
            });
          }
        });
      });
    });
  } catch (error) {
    console.error('❌ Ошибка обновления роли:', error);
    res.status(500).json({ 
      error: 'Ошибка обновления роли',
      details: error.message 
    });
  }
});

/**
 * DELETE /api/roles/:id - Удалить роль
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const roleId = req.params.id;
    const db = database.getDb();
    
    // Проверяем, используется ли роль пользователями
    const userCount = await new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE role_id = ?
      `, [roleId], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    if (userCount > 0) {
      return res.status(400).json({ 
        error: `Невозможно удалить роль. Она используется ${userCount} пользователем(ами)`
      });
    }

    // Удаляем роль (связи с регионами удалятся автоматически из-за CASCADE)
    db.run(`
      DELETE FROM roles 
      WHERE id = ?
    `, [roleId], function(err) {
      if (err) {
        console.error('❌ Ошибка удаления роли:', err);
        return res.status(500).json({ error: 'Ошибка удаления роли' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Роль не найдена' });
      }

      console.log(`✅ Роль ID ${roleId} удалена`);
      res.json({ 
        success: true, 
        message: 'Роль удалена успешно'
      });
    });
  } catch (error) {
    console.error('❌ Ошибка удаления роли:', error);
    res.status(500).json({ 
      error: 'Ошибка удаления роли',
      details: error.message 
    });
  }
});

module.exports = router;
