# Руководство по реализации мер безопасности

## 🚀 Быстрый старт - Критические исправления

### Шаг 1: Установка зависимостей

```bash
npm install helmet express-rate-limit joi xss winston express-validator
npm install --save-dev webpack webpack-obfuscator terser-webpack-plugin
```

### Шаг 2: Обновление app.js

```javascript
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const database = require('./database/db');
const { authenticatePage } = require('./middleware/auth');
const { addMenuPermissions } = require('./middleware/roles');

const app = express();

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
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
  max: 100, // максимум 100 запросов
  message: 'Слишком много запросов, попробуйте позже',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // максимум 5 попыток входа
  message: 'Слишком много попыток входа, попробуйте позже',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// CORS Security
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// Middleware для обработки JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy for Railway
app.set('trust proxy', 1);

// Остальная конфигурация...
```

### Шаг 3: Создание middleware для валидации

```javascript
// src/server/middleware/validation.js
const Joi = require('joi');
const { validationResult } = require('express-validator');

// Схемы валидации
const schemas = {
  user: Joi.object({
    full_name: Joi.string().min(2).max(100).required(),
    login: Joi.string().alphanum().min(3).max(50).required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
    role: Joi.string().valid('admin', 'superuser', 'user').required(),
    company_id: Joi.string().optional()
  }),
  
  company: Joi.object({
    company_id: Joi.string().min(1).max(50).required(),
    company_name: Joi.string().min(2).max(200).required(),
    phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).optional()
  }),
  
  role: Joi.object({
    name: Joi.string().min(2).max(50).required(),
    description: Joi.string().max(500).optional(),
    regions: Joi.array().items(Joi.string()).optional(),
    is_active: Joi.boolean().optional()
  })
};

// Middleware для валидации
function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
}

// Middleware для проверки результатов валидации
function checkValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation error',
      details: errors.array()
    });
  }
  next();
}

module.exports = {
  schemas,
  validate,
  checkValidationErrors
};
```

### Шаг 4: Создание сервиса аудита

```javascript
// src/server/services/auditService.js
const database = require('../database/db');
const winston = require('winston');

// Настройка логгера
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'audit.log' }),
    new winston.transports.Console()
  ]
});

class AuditService {
  static async logAction(req, action, resourceType = null, resourceId = null) {
    try {
      const db = database.getDb();
      const userId = req.user?.id || null;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent') || 'Unknown';
      
      // Логируем в базу данных
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO audit_log (user_id, action, resource_type, resource_id, ip_address, user_agent, timestamp) 
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [userId, action, resourceType, resourceId, ipAddress, userAgent],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      // Логируем в файл
      auditLogger.info('User Action', {
        userId,
        action,
        resourceType,
        resourceId,
        ipAddress,
        userAgent,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Ошибка логирования аудита:', error);
    }
  }
  
  static async getAuditLogs(filters = {}) {
    try {
      const db = database.getDb();
      let query = `
        SELECT al.*, u.login, u.full_name 
        FROM audit_log al 
        LEFT JOIN users u ON al.user_id = u.user_id 
        WHERE 1=1
      `;
      const params = [];
      
      if (filters.userId) {
        query += ' AND al.user_id = ?';
        params.push(filters.userId);
      }
      
      if (filters.action) {
        query += ' AND al.action = ?';
        params.push(filters.action);
      }
      
      if (filters.dateFrom) {
        query += ' AND al.timestamp >= ?';
        params.push(filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query += ' AND al.timestamp <= ?';
        params.push(filters.dateTo);
      }
      
      query += ' ORDER BY al.timestamp DESC LIMIT 1000';
      
      return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
    } catch (error) {
      console.error('❌ Ошибка получения логов аудита:', error);
      throw error;
    }
  }
}

module.exports = AuditService;
```

### Шаг 5: Создание сервиса шифрования

```javascript
// src/server/services/encryptionService.js
const crypto = require('crypto');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
  }
  
  encrypt(text) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.algorithm, this.key);
      cipher.setAAD(Buffer.from('additional-data'));
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      console.error('❌ Ошибка шифрования:', error);
      throw error;
    }
  }
  
  decrypt(encryptedData) {
    try {
      const { encrypted, iv, authTag } = encryptedData;
      const decipher = crypto.createDecipher(this.algorithm, this.key);
      decipher.setAAD(Buffer.from('additional-data'));
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('❌ Ошибка дешифрования:', error);
      throw error;
    }
  }
  
  hash(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }
}

module.exports = new EncryptionService();
```

### Шаг 6: Обновление переменных окружения

```env
# Security
JWT_SECRET=your-super-secure-jwt-secret-here-min-32-chars
ENCRYPTION_KEY=your-encryption-key-here-min-32-chars
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX_REQUESTS=5

# Logging
LOG_LEVEL=info
AUDIT_LOG_RETENTION_DAYS=90

# Google Sheets
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"..."}
GOOGLE_SHEET_ID=your_google_sheet_id_here

# Users
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-admin-password
SUPERUSER_USERNAME=superuser
SUPERUSER_PASSWORD=your-secure-superuser-password
```

### Шаг 7: Создание миграции для аудита

```javascript
// migrations/versions/002_add_audit_log.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = '/app/data/billing.db';

async function addAuditLog() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Ошибка подключения к БД:', err);
        reject(err);
        return;
      }
      
      console.log('🔧 Создание таблицы audit_log...');
      
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          action TEXT NOT NULL,
          resource_type TEXT,
          resource_id TEXT,
          ip_address TEXT,
          user_agent TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(user_id)
        );
      `;
      
      db.run(createTableSQL, (err) => {
        if (err) {
          console.error('❌ Ошибка создания таблицы audit_log:', err);
          reject(err);
        } else {
          console.log('✅ Таблица audit_log создана успешно');
          
          // Создаем индекс для быстрого поиска
          const createIndexSQL = `
            CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
            CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
            CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
          `;
          
          db.run(createIndexSQL, (err) => {
            if (err) {
              console.error('❌ Ошибка создания индексов:', err);
              reject(err);
            } else {
              console.log('✅ Индексы для audit_log созданы успешно');
              resolve();
            }
          });
        }
      });
    });
  });
}

if (require.main === module) {
  addAuditLog()
    .then(() => {
      console.log('✅ Миграция audit_log завершена успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Ошибка миграции audit_log:', error);
      process.exit(1);
    });
}

module.exports = { addAuditLog };
```

### Шаг 8: Обновление маршрутов с аудитом

```javascript
// Пример обновления src/server/routes/users.js
const AuditService = require('../services/auditService');
const { validate, schemas } = require('../middleware/validation');

// Добавить валидацию и аудит к существующим маршрутам
router.post('/', authenticateToken, requireAdmin, validate(schemas.user), async (req, res) => {
  // ... существующий код ...
  
  // Логируем действие
  await AuditService.logAction(req, 'CREATE_USER', 'user', next_user_id);
  
  // ... остальной код ...
});

router.put('/:id', authenticateToken, requireAdmin, validate(schemas.user), async (req, res) => {
  // ... существующий код ...
  
  // Логируем действие
  await AuditService.logAction(req, 'UPDATE_USER', 'user', id);
  
  // ... остальной код ...
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  // ... существующий код ...
  
  // Логируем действие
  await AuditService.logAction(req, 'DELETE_USER', 'user', id);
  
  // ... остальной код ...
});
```

### Шаг 9: Создание API для аудита

```javascript
// src/server/routes/audit.js
const express = require('express');
const router = express.Router();
const AuditService = require('../services/auditService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/audit - Получить логи аудита
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId,
      action: req.query.action,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };
    
    const logs = await AuditService.getAuditLogs(filters);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('❌ Ошибка получения логов аудита:', error);
    res.status(500).json({ error: 'Ошибка получения логов аудита' });
  }
});

module.exports = router;
```

### Шаг 10: Обновление package.json

```json
{
  "scripts": {
    "start": "node init-db.js && node run-migrations.js && node server-modular.js",
    "dev": "nodemon server-modular.js",
    "build": "webpack --mode production",
    "security-audit": "npm audit",
    "security-fix": "npm audit fix"
  },
  "dependencies": {
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "joi": "^17.11.0",
    "xss": "^1.0.14",
    "winston": "^3.11.0",
    "express-validator": "^7.0.1"
  },
  "devDependencies": {
    "webpack": "^5.89.0",
    "webpack-obfuscator": "^3.5.1",
    "terser-webpack-plugin": "^5.3.9"
  }
}
```

## 🔧 Дополнительные меры безопасности

### 1. Обфускация кода

```javascript
// webpack.config.js
const JavaScriptObfuscator = require('webpack-obfuscator');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/client/modules/shared/api.js',
  output: {
    path: __dirname + '/dist',
    filename: 'api.obfuscated.js'
  },
  plugins: [
    new JavaScriptObfuscator({
      rotateStringArray: true,
      stringArray: true,
      stringArrayThreshold: 0.75,
      transformObjectKeys: true,
      unicodeEscapeSequence: true,
      identifierNamesGenerator: 'hexadecimal',
      renameGlobals: false
    })
  ],
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()]
  }
};
```

### 2. Мониторинг безопасности

```javascript
// src/server/middleware/securityMonitor.js
const winston = require('winston');

const securityLogger = winston.createLogger({
  level: 'warn',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'security.log' }),
    new winston.transports.Console()
  ]
});

function securityMonitor(req, res, next) {
  // Логируем подозрительную активность
  if (req.body && JSON.stringify(req.body).includes('<script>')) {
    securityLogger.warn('XSS Attempt Detected', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: req.body,
      timestamp: new Date().toISOString()
    });
  }
  
  // Логируем множественные неудачные попытки входа
  if (req.url.includes('/api/auth') && req.method === 'POST') {
    // Здесь можно добавить логику для отслеживания неудачных попыток
  }
  
  next();
}

module.exports = securityMonitor;
```

### 3. Защита от CSRF

```javascript
// src/server/middleware/csrf.js
const crypto = require('crypto');

function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

function csrfProtection(req, res, next) {
  if (req.method === 'GET') {
    req.csrfToken = generateCSRFToken();
    res.locals.csrfToken = req.csrfToken;
  } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    const token = req.headers['x-csrf-token'] || req.body._csrf;
    if (!token || token !== req.session.csrfToken) {
      return res.status(403).json({ error: 'CSRF token mismatch' });
    }
  }
  next();
}

module.exports = csrfProtection;
```

## 📊 Мониторинг и алерты

### 1. Настройка алертов

```javascript
// src/server/services/alertService.js
const nodemailer = require('nodemailer');

class AlertService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.ALERT_EMAIL,
        pass: process.env.ALERT_EMAIL_PASSWORD
      }
    });
  }
  
  async sendSecurityAlert(alert) {
    try {
      await this.transporter.sendMail({
        from: process.env.ALERT_EMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: `Security Alert: ${alert.type}`,
        html: `
          <h2>Security Alert</h2>
          <p><strong>Type:</strong> ${alert.type}</p>
          <p><strong>Description:</strong> ${alert.description}</p>
          <p><strong>IP:</strong> ${alert.ip}</p>
          <p><strong>Time:</strong> ${alert.timestamp}</p>
          <p><strong>User Agent:</strong> ${alert.userAgent}</p>
        `
      });
    } catch (error) {
      console.error('❌ Ошибка отправки алерта:', error);
    }
  }
}

module.exports = new AlertService();
```

### 2. Дашборд мониторинга

```javascript
// src/server/routes/monitoring.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/monitoring/security - Получить статистику безопасности
router.get('/security', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = database.getDb();
    
    // Статистика за последние 24 часа
    const stats = await new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN action = 'LOGIN_FAILED' THEN 1 END) as failed_logins,
          COUNT(CASE WHEN action = 'UNAUTHORIZED_ACCESS' THEN 1 END) as unauthorized_access,
          COUNT(DISTINCT ip_address) as unique_ips
        FROM audit_log 
        WHERE timestamp >= datetime('now', '-1 day')
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('❌ Ошибка получения статистики безопасности:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

module.exports = router;
```

## 🚀 Деплой с мерами безопасности

### 1. Обновление Dockerfile

```dockerfile
FROM node:18-alpine

# Установка security updates
RUN apk update && apk upgrade

# Создание пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Установка зависимостей
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Копирование кода
COPY . .

# Создание директорий с правильными правами
RUN mkdir -p /app/data /app/logs
RUN chown -R nodejs:nodejs /app

# Переключение на пользователя nodejs
USER nodejs

# Открытие порта
EXPOSE 3000

# Запуск приложения
CMD ["npm", "start"]
```

### 2. Обновление railway.json

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 3. Создание health check endpoint

```javascript
// src/server/routes/health.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

module.exports = router;
```

## 📋 Финальный чек-лист

### Перед деплоем
- [ ] Все security headers настроены
- [ ] Rate limiting активен
- [ ] CORS ограничен разрешенными доменами
- [ ] JWT секрет сгенерирован и сохранен
- [ ] Валидация данных на всех endpoints
- [ ] Аудит логирования настроен
- [ ] Шифрование чувствительных данных
- [ ] Мониторинг безопасности активен
- [ ] Обфускация кода настроена
- [ ] Health check endpoint создан

### После деплоя
- [ ] Тестирование всех security мер
- [ ] Проверка логов на ошибки
- [ ] Мониторинг производительности
- [ ] Тестирование rate limiting
- [ ] Проверка CORS настроек
- [ ] Валидация JWT токенов
- [ ] Тестирование аудита
- [ ] Проверка алертов
- [ ] Тестирование health check
- [ ] Проверка обфускации

### Регулярные проверки
- [ ] Еженедельный анализ логов безопасности
- [ ] Ежемесячное обновление зависимостей
- [ ] Ежеквартальный аудит безопасности
- [ ] Ежегодное тестирование на проникновение
