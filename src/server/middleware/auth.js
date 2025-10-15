const jwt = require('jsonwebtoken');

// JWT секретный ключ (в продакшене должен быть в переменных окружения)
const JWT_SECRET = process.env.JWT_SECRET || 'billing-system-secret-key-2025';
const JWT_EXPIRES_IN = '12h';

/**
 * Middleware для проверки JWT токена для API запросов
 */
function authenticateToken(req, res, next) {
  // Сначала проверяем httpOnly cookie
  const cookieToken = req.cookies && req.cookies.auth_token;
  
  // Если нет cookie, проверяем заголовок Authorization: Bearer
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];
  
  const token = cookieToken || headerToken;

  console.log('🔐 Проверка токена для API запроса:', {
    url: req.url,
    method: req.method,
    hasCookie: !!cookieToken,
    hasAuthHeader: !!authHeader,
    tokenPreview: token ? token.substring(0, 20) + '...' : 'отсутствует'
  });

  if (!token) {
    console.log('❌ Токен отсутствует');
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('❌ Ошибка верификации токена:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    console.log('✅ Токен действителен для пользователя:', user.login);
    req.user = user;
    next();
  });
}

/**
 * Middleware для проверки токена для страниц (с перенаправлением)
 * Перенаправляет на страницу входа при отсутствии валидного токена
 */
function authenticatePage(req, res, next) {
  // Сначала проверяем httpOnly cookie
  const cookieToken = req.cookies && req.cookies.auth_token;
  
  // Если нет cookie, проверяем токен в заголовке Authorization
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];
  
  // Если токена нет в заголовке, проверяем в query параметрах
  const queryToken = req.query.token;
  
  const finalToken = cookieToken || headerToken || queryToken;

  if (!finalToken) {
    // Если токена нет, перенаправляем на страницу входа
    return res.redirect('/login');
  }

  jwt.verify(finalToken, JWT_SECRET, (err, user) => {
    if (err) {
      // Если токен невалиден, перенаправляем на страницу входа
      return res.redirect('/login');
    }
    req.user = user;
    next();
  });
}

/**
 * Генерирует JWT токен для пользователя
 */
function generateToken(user) {
  return jwt.sign(
    { 
      id: user.user_id,  // Используем user_id вместо id
      login: user.login, 
      full_name: user.full_name 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

module.exports = {
  authenticateToken,
  authenticatePage,
  generateToken,
  JWT_SECRET: process.env.JWT_SECRET || 'billing-system-secret-key-2025',
  JWT_EXPIRES_IN
};
