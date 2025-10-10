const express = require('express');
const path = require('path');
const cors = require('cors');
const database = require('./database/db');
const { authenticatePage } = require('./middleware/auth');

// Импортируем маршруты
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const rolesRoutes = require('./routes/roles');
const settingsRoutes = require('./routes/settings');
const dataRoutes = require('./routes/data');

const app = express();

// Middleware для CORS (поддержка внешнего доступа)
app.use(cors({
  origin: function (origin, callback) {
    // Разрешаем все origin для туннелей
    callback(null, true);
  },
  credentials: true
}));

// Middleware для обработки JSON и статических файлов
app.use(express.json());

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
app.get('/main', authenticatePage, (req, res) => {
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


app.get('/users', authenticatePage, (req, res) => {
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

app.get('/roles', authenticatePage, (req, res) => {
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

app.get('/pvz', authenticatePage, (req, res) => {
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


app.get('/settings', authenticatePage, (req, res) => {
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

// API маршруты
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/data', dataRoutes);

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
