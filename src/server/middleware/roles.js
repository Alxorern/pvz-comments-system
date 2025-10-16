const database = require('../database/db');

/**
 * Middleware для проверки роли пользователя
 */
function checkRole(allowedRoles = []) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        console.log('❌ Пользователь не аутентифицирован');
        return res.status(401).json({ error: 'Пользователь не аутентифицирован' });
      }

      const db = database.getDb();
      
      // Получаем роль пользователя
      const userRole = await new Promise((resolve, reject) => {
        const sql = 'SELECT r.name as role_name, r.is_active FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.user_id = ?';
        const params = [req.user.id];
        
        db.get(sql, params, (err, row) => {
          if (err) {
            console.error('❌ Ошибка SQL запроса:', err);
            reject(err);
          } else {
            resolve(row);
          }
        });
      });

      if (!userRole) {
        return res.status(403).json({ error: 'Роль пользователя не найдена' });
      }

      // Проверяем, активна ли роль
      const isRoleActive = userRole.is_active === 1 || userRole.is_active === '1' || userRole.is_active === true;
      if (!isRoleActive) {
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
 * Middleware для проверки, что пользователь имеет роль superuser
 */
function requireSuperuser(req, res, next) {
  return checkRole(['superuser'])(req, res, next);
}

/**
 * Middleware для проверки, что пользователь имеет роль admin или superuser
 */
function requireAdminOrSuperuser(req, res, next) {
  return checkRole(['admin', 'superuser'])(req, res, next);
}

/**
 * Middleware для проверки, что пользователь имеет любую роль (не null)
 */
function requireAnyRole(req, res, next) {
  return checkRole()(req, res, next);
}

/**
 * Middleware для добавления информации о доступных пунктах меню в зависимости от роли
 */
function addMenuPermissions(req, res, next) {
  if (!req.user) {
    return next();
  }

  // Получаем роль пользователя и его компанию
  const db = database.getDb();
  const sql = `
    SELECT 
      r.name as role_name,
      u.company_id
    FROM users u 
    LEFT JOIN roles r ON u.role_id = r.id 
    WHERE u.user_id = ?
  `;
  
  db.get(sql, [req.user.id], (err, row) => {
    if (err) {
      console.error('❌ Ошибка получения роли для меню:', err);
      return next();
    }

    const roleName = row?.role_name;
    const userCompanyId = row?.company_id;
    
    // Определяем доступные пункты меню в зависимости от роли
    let menuItems = [];
    
    if (roleName === 'admin') {
      // Админ видит все пункты меню
      menuItems = ['pvz', 'analytics', 'companies', 'users', 'roles', 'settings'];
    } else if (roleName === 'superuser') {
      // Superuser видит только список ПВЗ
      menuItems = ['pvz'];
    } else {
      // Обычные пользователи видят только список ПВЗ
      menuItems = ['pvz'];
    }
    
    req.user.menuItems = menuItems;
    req.user.roleName = roleName;
    req.user.companyId = userCompanyId;
    
    next();
  });
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
  requireSuperuser,
  requireAdminOrSuperuser,
  requireAnyRole,
  addMenuPermissions,
  getUserRegions,
  addUserRegions
};
