const jwt = require('jsonwebtoken');

// JWT секретный ключ (в продакшене должен быть в переменных окружения)
const JWT_SECRET = 'billing-system-secret-key-2025';
const JWT_EXPIRES_IN = '12h';

/**
 * Middleware для проверки JWT токена для API запросов
 */
function authenticateToken(req, res, next) {
  // Проверяем заголовок Authorization: Bearer (стандартный для Yandex Cloud)
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('🔐 Проверка токена для API запроса:', {
    url: req.url,
    method: req.method,
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
 * Позволяет загрузить страницу без токена, клиентский JS проверит токен из localStorage
 */
function authenticatePage(req, res, next) {
  // Проверяем токен в заголовке Authorization
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  // Если токена нет в заголовке, проверяем в query параметрах
  const queryToken = req.query.token;
  
  const finalToken = token || queryToken;

  if (!finalToken) {
    // Если токена нет, позволяем загрузить страницу
    // Клиентский JavaScript проверит токен из localStorage
    console.log('⚠️ Токен не найден в запросе, позволяем загрузить страницу для проверки localStorage');
    req.user = null; // Указываем, что пользователь не аутентифицирован на сервере
    return next();
  }

  jwt.verify(finalToken, JWT_SECRET, (err, user) => {
    if (err) {
      // Если токен невалиден, позволяем загрузить страницу
      // Клиентский JavaScript перенаправит на логин
      console.log('⚠️ Токен невалиден, позволяем загрузить страницу для клиентской проверки');
      req.user = null;
      return next();
    }
    console.log('✅ Токен валиден для пользователя:', user.login);
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
      id: user.id,
      login: user.login, 
      role: user.role, 
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
  JWT_SECRET,
  JWT_EXPIRES_IN
};
