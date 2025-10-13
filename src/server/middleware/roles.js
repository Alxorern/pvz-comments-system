const database = require('../database/db');

/**
 * Middleware для проверки роли пользователя
 */
function checkRole(allowedRoles = []) {
  return async (req, res, next) => {
    console.log('🔍 checkRole вызван для:', req.user?.id, 'разрешенные роли:', allowedRoles);
    try {
      if (!req.user) {
        console.log('❌ Пользователь не аутентифицирован');
        return res.status(401).json({ error: 'Пользователь не аутентифицирован' });
      }

      const db = database.getDb();
      console.log('🔍 База данных подключена:', !!db);
      console.log('🔍 Файл базы данных:', db?.filename);
      
      // Получаем роль пользователя
      console.log('🔍 Проверка роли для пользователя:', req.user.id);
      const userRole = await new Promise((resolve, reject) => {
        const sql = 'SELECT r.name as role_name, r.is_active FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.user_id = ?';
        const params = [req.user.id];
        console.log('🔍 SQL запрос:', sql);
        console.log('🔍 Параметры:', params);
        
        db.get(sql, params, (err, row) => {
          if (err) {
            console.error('❌ Ошибка SQL запроса:', err);
            reject(err);
          } else {
            console.log('🔍 Результат SQL запроса:', row);
            resolve(row);
          }
        });
      });

      if (!userRole) {
        return res.status(403).json({ error: 'Роль пользователя не найдена' });
      }

      // Проверяем, активна ли роль
      console.log('🔍 Проверка активности роли:', userRole.is_active, typeof userRole.is_active);
      const isRoleActive = userRole.is_active === 1 || userRole.is_active === '1' || userRole.is_active === true;
      if (!isRoleActive) {
        console.log('❌ Роль неактивна:', userRole);
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
  console.log('🔍 requireAdmin вызван для пользователя:', req.user?.id);
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
         WHERE u.user_id = ? AND r.is_active = 1`,
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
