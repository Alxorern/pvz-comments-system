const database = require('../database/db');

/**
 * Middleware для проверки роли пользователя
 */
function checkRole(allowedRoles = []) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Пользователь не аутентифицирован' });
      }

      const db = database.getDb();
      
      // Получаем роль пользователя
      const userRole = await new Promise((resolve, reject) => {
        db.get(
          'SELECT r.name as role_name, r.is_active FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
          [req.user.id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!userRole) {
        return res.status(403).json({ error: 'Роль пользователя не найдена' });
      }

      // Проверяем, активна ли роль
      if (!userRole.is_active) {
        return res.status(403).json({ error: 'Роль пользователя неактивна' });
      }

      // Проверяем, есть ли роль в списке разрешенных
      if (allowedRoles.length > 0 && !allowedRoles.includes(userRole.role_name)) {
        return res.status(403).json({ error: 'Недостаточно прав доступа' });
      }

      // Добавляем информацию о роли в запрос
      req.userRole = userRole.role_name;
      req.user.role = userRole.role_name;

      next();
    } catch (error) {
      console.error('❌ Ошибка проверки роли:', error);
      res.status(500).json({ error: 'Ошибка проверки роли' });
    }
  };
}

/**
 * Middleware для проверки, является ли пользователь администратором
 */
function requireAdmin(req, res, next) {
  return checkRole(['admin'])(req, res, next);
}

/**
 * Middleware для проверки, что пользователь имеет любую роль (не null)
 */
function requireAnyRole(req, res, next) {
  return checkRole()(req, res, next);
}

/**
 * Получить регионы пользователя по его роли
 */
async function getUserRegions(userId) {
  try {
    const db = database.getDb();
    
    const regions = await new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT reg.name as region_name 
         FROM users u 
         JOIN roles r ON u.role_id = r.id 
         JOIN role_regions rr ON r.id = rr.role_id 
         JOIN regions reg ON rr.region_id = reg.id 
         WHERE u.id = ? AND r.is_active = 1`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    return regions.map(row => row.region_name);
  } catch (error) {
    console.error('❌ Ошибка получения регионов пользователя:', error);
    return [];
  }
}

/**
 * Middleware для добавления регионов пользователя в запрос
 */
async function addUserRegions(req, res, next) {
  try {
    if (req.user && req.userRole && req.userRole !== 'admin') {
      req.userRegions = await getUserRegions(req.user.id);
    } else if (req.userRole === 'admin') {
      // Администратор видит все регионы
      req.userRegions = null; // null означает "все регионы"
    }
    next();
  } catch (error) {
    console.error('❌ Ошибка добавления регионов пользователя:', error);
    next();
  }
}

module.exports = {
  checkRole,
  requireAdmin,
  requireAnyRole,
  getUserRegions,
  addUserRegions
};
