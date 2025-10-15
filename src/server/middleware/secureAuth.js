const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// JWT секретный ключ
const JWT_SECRET = process.env.JWT_SECRET || 'billing-system-secret-key-2025';
const JWT_EXPIRES_IN = '12h';
const COOKIE_NAME = 'auth_token';
const COOKIE_OPTIONS = {
  httpOnly: true,        // Недоступен для JavaScript
  secure: process.env.NODE_ENV === 'production', // HTTPS в продакшене
  sameSite: 'strict',    // Защита от CSRF
  maxAge: 12 * 60 * 60 * 1000, // 12 часов в миллисекундах
  path: '/'              // Доступен на всех путях
};

/**
 * Генерирует JWT токен для пользователя
 */
function generateToken(user) {
  return jwt.sign(
    { 
      id: user.user_id,
      login: user.login, 
      full_name: user.full_name,
      iat: Math.floor(Date.now() / 1000) // issued at
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Устанавливает httpOnly cookie с токеном
 */
function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
}

/**
 * Удаляет auth cookie
 */
function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
}

/**
 * Middleware для проверки JWT токена из cookie или заголовка
 */
function authenticateToken(req, res, next) {
  // Сначала проверяем cookie
  const token = req.cookies[COOKIE_NAME];
  
  // Если нет cookie, проверяем заголовок Authorization (для совместимости)
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];
  
  const finalToken = token || headerToken;


  if (!finalToken) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(finalToken, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('❌ Ошибка верификации токена:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

/**
 * Middleware для проверки токена для страниц
 */
function authenticatePage(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  
  if (!token) {
    return res.redirect('/login');
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.redirect('/login');
    }
    req.user = user;
    next();
  });
}

/**
 * Генерирует CSRF токен
 */
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware для CSRF защиты
 */
function csrfProtection(req, res, next) {
  if (req.method === 'GET') {
    // Для GET запросов генерируем новый CSRF токен
    const csrfToken = generateCSRFToken();
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false, // Должен быть доступен для JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 12 * 60 * 60 * 1000,
      path: '/'
    });
    res.locals.csrfToken = csrfToken;
  } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    // Для изменяющих запросов проверяем CSRF токен
    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const cookieToken = req.cookies.csrf_token;
    
    if (!token || !cookieToken || token !== cookieToken) {
      return res.status(403).json({ error: 'CSRF token mismatch' });
    }
  }
  next();
}

module.exports = {
  generateToken,
  setAuthCookie,
  clearAuthCookie,
  authenticateToken,
  authenticatePage,
  generateCSRFToken,
  csrfProtection,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
