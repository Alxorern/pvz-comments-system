const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const database = require('./database/db');
const { authenticatePage } = require('./middleware/auth');
const { addMenuPermissions } = require('./middleware/roles');
const { sanitizeInput } = require('./middleware/validation');

// Импортируем маршруты
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const rolesRoutes = require('./routes/roles');
const settingsRoutes = require('./routes/settings');
const dataRoutes = require('./routes/data');
const companiesRoutes = require('./routes/companies');
const auditRoutes = require('./routes/audit');

const app = express();

// Trust proxy for Railway
app.set('trust proxy', 1);

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  xssFilter: true,
  noSniff: true,
  frameguard: { action: 'deny' }
}));

// Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100000, // максимум 100,000 запросов (увеличено в 100 раз)
  message: 'Слишком много запросов, попробуйте позже',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 1000, // максимум 1000 попыток входа (увеличено в 100 раз)
  message: 'Слишком много попыток входа, попробуйте позже',
  standardHeaders: true,
  legacyHeaders: false,
});

// Более мягкий лимит для API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 50000, // максимум 50,000 запросов для API (увеличено в 100 раз)
  message: 'Слишком много API запросов, попробуйте позже',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// CORS Security
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

// Автоматически добавляем Railway домены
if (process.env.RAILWAY_STATIC_URL) {
  allowedOrigins.push(process.env.RAILWAY_STATIC_URL);
}
if (process.env.RAILWAY_PUBLIC_DOMAIN) {
  allowedOrigins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
}

console.log('🌐 Разрешенные CORS origins:', allowedOrigins);

app.use(cors({
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, Postman, мобильные приложения)
    if (!origin) {
      return callback(null, true);
    }
    
    // Проверяем, есть ли origin в списке разрешенных
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    
    // Для Railway автоматически разрешаем поддомены railway.app
    if (origin.includes('.railway.app')) {
      return callback(null, true);
    }
    
    console.log('❌ CORS заблокирован для origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// Middleware для обработки JSON с ограничениями
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser для httpOnly cookies
app.use(cookieParser());

// XSS Protection
app.use(sanitizeInput);

// Обслуживание модулей клиентской части
app.use('/modules', express.static(path.join(__dirname, '../client/modules')));
app.use('/pages', express.static(path.join(__dirname, '../client/pages')));
app.use('/assets', express.static(path.join(__dirname, '../client/assets')));

console.log('🚀 Инициализация модульного сервера...');

// Подключение к базе данных будет выполнено в server-modular.js

// Маршруты для страниц
app.get('/', (req, res) => {
  console.log('📄 Запрос на главную страницу (/) - модульная версия');
  const filePath = path.join(__dirname, '../client/pages', 'login.html');
  console.log('📁 Путь к файлу:', filePath);
  
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('❌ Ошибка отправки файла:', err);
      res.status(500).send('Ошибка загрузки страницы');
    } else {
      console.log('✅ Модульная страница входа отправлена успешно');
    }
  });
});

app.get('/index.html', (req, res) => {
  console.log('📄 Запрос на index.html - перенаправление на модульную версию');
  res.redirect('/');
});


// Защищенные маршруты - требуют токен
app.get('/main', authenticatePage, addMenuPermissions, (req, res) => {
  console.log('📄 Запрос на главную страницу приложения (/main) для пользователя:', req.user ? req.user.login : 'неаутентифицированный пользователь');
  const filePath = path.join(__dirname, '../client/pages', 'main.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('❌ Ошибка отправки модульной главной страницы:', err);
      res.status(500).send('Ошибка загрузки страницы');
    } else {
      console.log('✅ Модульная главная страница отправлена успешно');
    }
  });
});


app.get('/users', authenticatePage, addMenuPermissions, (req, res) => {
  const userInfo = req.user ? req.user.login : 'неаутентифицированный пользователь';
  console.log('📄 Запрос на страницу пользователей (/users) для пользователя:', userInfo);
  const filePath = path.join(__dirname, '../client/pages', 'users.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('❌ Ошибка отправки страницы пользователей:', err);
      res.status(500).send('Ошибка загрузки страницы');
    } else {
      console.log('✅ Страница пользователей отправлена успешно');
    }
  });
});

app.get('/roles', authenticatePage, addMenuPermissions, (req, res) => {
  const userInfo = req.user ? req.user.login : 'неаутентифицированный пользователь';
  console.log('📄 Запрос на страницу ролей (/roles) для пользователя:', userInfo);
  const filePath = path.join(__dirname, '../client/pages', 'roles.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('❌ Ошибка отправки страницы ролей:', err);
      res.status(500).send('Ошибка загрузки страницы');
    } else {
      console.log('✅ Страница ролей отправлена успешно');
    }
  });
});

app.get('/companies', authenticatePage, addMenuPermissions, (req, res) => {
  const userInfo = req.user ? req.user.login : 'неаутентифицированный пользователь';
  console.log('📄 Запрос на страницу компаний (/companies) для пользователя:', userInfo);
  const filePath = path.join(__dirname, '../client/pages', 'companies.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('❌ Ошибка отправки страницы компаний:', err);
      res.status(500).send('Ошибка загрузки страницы');
    } else {
      console.log('✅ Страница компаний отправлена успешно');
    }
  });
});

app.get('/pvz', authenticatePage, addMenuPermissions, (req, res) => {
  const userInfo = req.user ? req.user.login : 'неаутентифицированный пользователь';
  console.log('📄 Запрос на страницу ПВЗ (/pvz) для пользователя:', userInfo);
  const filePath = path.join(__dirname, '../client/pages', 'pvz.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('❌ Ошибка отправки страницы ПВЗ:', err);
      res.status(500).send('Ошибка загрузки страницы');
    } else {
      console.log('✅ Страница ПВЗ отправлена успешно');
    }
  });
});


app.get('/settings', authenticatePage, addMenuPermissions, (req, res) => {
  const userInfo = req.user ? req.user.login : 'неаутентифицированный пользователь';
  console.log('📄 Запрос на страницу настроек (/settings) для пользователя:', userInfo);
  const filePath = path.join(__dirname, '../client/pages', 'settings.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('❌ Ошибка отправки страницы настроек:', err);
      res.status(500).send('Ошибка загрузки страницы');
    } else {
      console.log('✅ Страница настроек отправлена успешно');
    }
  });
});








// Совместимость со старыми версиями
app.get('/test', authenticatePage, (req, res) => {
  const userInfo = req.user ? req.user.login : 'неаутентифицированный пользователь';
  console.log('📄 Запрос на тестовую страницу (/test) для пользователя:', userInfo);
  res.sendFile(path.join(__dirname, '../../public', 'test.html'));
});

app.get('/login-simple', (req, res) => {
  console.log('📄 Запрос на упрощенную страницу входа (/login-simple) - старая версия');
  res.sendFile(path.join(__dirname, '../../public', 'login-simple.html'));
});

app.get('/main-simple', authenticatePage, (req, res) => {
  console.log('📄 Запрос на упрощенную главную страницу (/main-simple) - старая версия');
  res.sendFile(path.join(__dirname, '../../public', 'main-simple.html'));
});

// Health check endpoint для мониторинга
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API маршруты с rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', apiLimiter, usersRoutes);
app.use('/api/roles', apiLimiter, rolesRoutes);
app.use('/api/settings', apiLimiter, settingsRoutes);
app.use('/api/data', apiLimiter, dataRoutes);
app.use('/api/companies', apiLimiter, companiesRoutes);
app.use('/api/audit', apiLimiter, auditRoutes);

// Обработка 404 ошибок
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('❌ Серверная ошибка:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
