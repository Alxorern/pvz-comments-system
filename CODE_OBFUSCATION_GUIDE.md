# Руководство по обфускации и защите кода

## 🔒 Обфускация JavaScript кода

### 1. Установка инструментов

```bash
npm install --save-dev webpack webpack-obfuscator terser-webpack-plugin
npm install --save-dev uglify-js clean-css-cli
```

### 2. Конфигурация Webpack для обфускации

```javascript
// webpack.config.js
const JavaScriptObfuscator = require('webpack-obfuscator');
const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    'api': './src/client/modules/shared/api.js',
    'auth': './src/client/modules/auth/auth.js',
    'menu': './src/client/modules/shared/menu.js',
    'utils': './src/client/modules/shared/utils.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist/obfuscated'),
    filename: '[name].obfuscated.js',
    clean: true
  },
  plugins: [
    new JavaScriptObfuscator({
      // Основные настройки
      rotateStringArray: true,
      stringArray: true,
      stringArrayThreshold: 0.75,
      transformObjectKeys: true,
      unicodeEscapeSequence: true,
      
      // Генерация имен
      identifierNamesGenerator: 'hexadecimal',
      renameGlobals: false,
      renameProperties: false,
      
      // Защита от отладки
      debugProtection: true,
      debugProtectionInterval: 2000,
      disableConsoleOutput: true,
      
      // Дополнительная защита
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.75,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.4,
      
      // Исключения
      exclude: [
        'node_modules/**/*',
        '**/*.test.js',
        '**/*.spec.js'
      ]
    })
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug']
          },
          mangle: {
            toplevel: true,
            properties: {
              regex: /^_/
            }
          }
        }
      })
    ]
  }
};
```

### 3. Обфускация CSS

```javascript
// scripts/obfuscate-css.js
const CleanCSS = require('clean-css-cli');
const fs = require('fs');
const path = require('path');

function obfuscateCSS() {
  const inputFile = './src/client/assets/styles/main.css';
  const outputFile = './dist/obfuscated/styles.obfuscated.css';
  
  const input = fs.readFileSync(inputFile, 'utf8');
  
  const options = {
    level: 2,
    format: {
      breaks: {
        afterAtRule: false,
        afterBlockBegins: false,
        afterBlockEnds: false,
        afterComment: false,
        afterProperty: false,
        afterRuleBegins: false,
        afterRuleEnds: false,
        beforeBlockEnds: false,
        betweenSelectors: false
      },
      indentBy: 0,
      indentWith: 'space',
      spaces: {
        aroundSelectorRelation: false,
        beforeBlockBegins: false,
        beforeValue: false
      },
      wrapAt: false
    }
  };
  
  const result = new CleanCSS(options).minify(input);
  
  // Создаем директорию если не существует
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputFile, result.styles);
  console.log('✅ CSS обфусцирован:', outputFile);
}

obfuscateCSS();
```

### 4. Обфускация HTML

```javascript
// scripts/obfuscate-html.js
const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');

async function obfuscateHTML() {
  const htmlFiles = [
    './src/client/pages/login.html',
    './src/client/pages/main.html',
    './src/client/pages/users.html',
    './src/client/pages/roles.html',
    './src/client/pages/companies.html',
    './src/client/pages/pvz.html',
    './src/client/pages/settings.html'
  ];
  
  for (const file of htmlFiles) {
    try {
      const input = fs.readFileSync(file, 'utf8');
      
      const result = await minify(input, {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true
      });
      
      const outputFile = file.replace('src/client/pages', 'dist/obfuscated/pages');
      const outputDir = path.dirname(outputFile);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(outputFile, result);
      console.log('✅ HTML обфусцирован:', outputFile);
    } catch (error) {
      console.error('❌ Ошибка обфускации HTML:', file, error);
    }
  }
}

obfuscateHTML();
```

### 5. Обфускация серверного кода

```javascript
// scripts/obfuscate-server.js
const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

function obfuscateServerFiles() {
  const serverFiles = [
    './src/server/routes/auth.js',
    './src/server/routes/users.js',
    './src/server/routes/roles.js',
    './src/server/routes/companies.js',
    './src/server/routes/data.js',
    './src/server/middleware/auth.js',
    './src/server/middleware/roles.js'
  ];
  
  serverFiles.forEach(file => {
    try {
      const input = fs.readFileSync(file, 'utf8');
      
      const obfuscationResult = JavaScriptObfuscator.obfuscate(input, {
        rotateStringArray: true,
        stringArray: true,
        stringArrayThreshold: 0.75,
        transformObjectKeys: true,
        unicodeEscapeSequence: true,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        debugProtection: false, // Отключаем для серверного кода
        disableConsoleOutput: false // Оставляем логи для сервера
      });
      
      const outputFile = file.replace('src/server', 'dist/obfuscated/server');
      const outputDir = path.dirname(outputFile);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(outputFile, obfuscationResult.getObfuscatedCode());
      console.log('✅ Серверный файл обфусцирован:', outputFile);
    } catch (error) {
      console.error('❌ Ошибка обфускации серверного файла:', file, error);
    }
  });
}

obfuscateServerFiles();
```

### 6. Создание скрипта сборки

```javascript
// scripts/build-obfuscated.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function buildObfuscated() {
  console.log('🚀 Начинаем сборку обфусцированной версии...');
  
  try {
    // Создаем директорию для обфусцированных файлов
    if (!fs.existsSync('./dist/obfuscated')) {
      fs.mkdirSync('./dist/obfuscated', { recursive: true });
    }
    
    // Обфусцируем JavaScript файлы
    console.log('📦 Обфускация JavaScript файлов...');
    execSync('npx webpack --config webpack.config.js', { stdio: 'inherit' });
    
    // Обфусцируем CSS
    console.log('🎨 Обфускация CSS файлов...');
    require('./obfuscate-css.js');
    
    // Обфусцируем HTML
    console.log('📄 Обфускация HTML файлов...');
    await require('./obfuscate-html.js');
    
    // Обфусцируем серверные файлы
    console.log('🖥️ Обфускация серверных файлов...');
    require('./obfuscate-server.js');
    
    // Копируем необходимые файлы
    console.log('📋 Копирование дополнительных файлов...');
    execSync('cp -r src/server/database dist/obfuscated/server/', { stdio: 'inherit' });
    execSync('cp -r src/server/services dist/obfuscated/server/', { stdio: 'inherit' });
    execSync('cp -r src/server/templates dist/obfuscated/server/', { stdio: 'inherit' });
    execSync('cp package.json dist/obfuscated/', { stdio: 'inherit' });
    execSync('cp init-db.js dist/obfuscated/', { stdio: 'inherit' });
    execSync('cp run-migrations.js dist/obfuscated/', { stdio: 'inherit' });
    execSync('cp server-modular.js dist/obfuscated/', { stdio: 'inherit' });
    
    console.log('✅ Сборка обфусцированной версии завершена!');
    console.log('📁 Файлы находятся в директории: ./dist/obfuscated/');
    
  } catch (error) {
    console.error('❌ Ошибка сборки:', error);
    process.exit(1);
  }
}

buildObfuscated();
```

### 7. Обновление package.json

```json
{
  "scripts": {
    "start": "node init-db.js && node run-migrations.js && node server-modular.js",
    "dev": "nodemon server-modular.js",
    "build": "node scripts/build-obfuscated.js",
    "build:client": "npx webpack --config webpack.config.js",
    "build:css": "node scripts/obfuscate-css.js",
    "build:html": "node scripts/obfuscate-html.js",
    "build:server": "node scripts/obfuscate-server.js",
    "security-audit": "npm audit",
    "security-fix": "npm audit fix"
  },
  "devDependencies": {
    "webpack": "^5.89.0",
    "webpack-obfuscator": "^3.5.1",
    "terser-webpack-plugin": "^5.3.9",
    "clean-css-cli": "^5.6.2",
    "html-minifier-terser": "^7.2.0",
    "javascript-obfuscator": "^4.0.2"
  }
}
```

## 🔐 Дополнительные меры защиты

### 1. Защита от reverse engineering

```javascript
// src/server/middleware/antiDebug.js
function antiDebug() {
  // Проверка на отладчик
  setInterval(() => {
    const start = performance.now();
    debugger;
    const end = performance.now();
    
    if (end - start > 100) {
      console.log('⚠️ Обнаружен отладчик!');
      // Можно отправить алерт или заблокировать доступ
    }
  }, 1000);
  
  // Проверка на консоль разработчика
  let devtools = false;
  setInterval(() => {
    if (window.outerHeight - window.innerHeight > 200 || 
        window.outerWidth - window.innerWidth > 200) {
      if (!devtools) {
        devtools = true;
        console.log('⚠️ Обнаружена консоль разработчика!');
        // Можно заблокировать функциональность
      }
    } else {
      devtools = false;
    }
  }, 500);
}

module.exports = antiDebug;
```

### 2. Защита от копирования

```javascript
// src/client/modules/shared/antiCopy.js
function antiCopy() {
  // Запрет на копирование
  document.addEventListener('copy', (e) => {
    e.preventDefault();
    console.log('⚠️ Копирование запрещено!');
  });
  
  // Запрет на выделение текста
  document.addEventListener('selectstart', (e) => {
    e.preventDefault();
  });
  
  // Запрет на контекстное меню
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
  
  // Запрет на горячие клавиши
  document.addEventListener('keydown', (e) => {
    // F12, Ctrl+Shift+I, Ctrl+U, Ctrl+S
    if (e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.key === 's')) {
      e.preventDefault();
      console.log('⚠️ Горячие клавиши заблокированы!');
    }
  });
}

module.exports = antiCopy;
```

### 3. Защита от скриншотов

```javascript
// src/client/modules/shared/antiScreenshot.js
function antiScreenshot() {
  // Блокировка Print Screen
  document.addEventListener('keydown', (e) => {
    if (e.key === 'PrintScreen') {
      e.preventDefault();
      console.log('⚠️ Скриншоты запрещены!');
    }
  });
  
  // Блокировка Alt+Print Screen
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'PrintScreen') {
      e.preventDefault();
      console.log('⚠️ Скриншоты запрещены!');
    }
  });
  
  // Блокировка Ctrl+Print Screen
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'PrintScreen') {
      e.preventDefault();
      console.log('⚠️ Скриншоты запрещены!');
    }
  });
}

module.exports = antiScreenshot;
```

### 4. Защита от инспекции элементов

```javascript
// src/client/modules/shared/antiInspect.js
function antiInspect() {
  // Проверка на открытие инспектора
  let devtools = false;
  
  setInterval(() => {
    if (window.outerHeight - window.innerHeight > 200 || 
        window.outerWidth - window.innerWidth > 200) {
      if (!devtools) {
        devtools = true;
        console.log('⚠️ Обнаружен инспектор элементов!');
        // Можно заблокировать функциональность или перенаправить
        // window.location.href = '/blocked';
      }
    } else {
      devtools = false;
    }
  }, 500);
  
  // Проверка на изменение размера окна
  window.addEventListener('resize', () => {
    if (window.outerHeight - window.innerHeight > 200 || 
        window.outerWidth - window.innerWidth > 200) {
      console.log('⚠️ Подозрительное изменение размера окна!');
    }
  });
}

module.exports = antiInspect;
```

### 5. Интеграция защиты в HTML

```html
<!-- В начало каждого HTML файла -->
<script>
// Защита от отладки
(function() {
  'use strict';
  
  // Анти-отладка
  setInterval(() => {
    const start = performance.now();
    debugger;
    const end = performance.now();
    
    if (end - start > 100) {
      console.clear();
      document.body.innerHTML = '<h1>Доступ запрещен</h1>';
    }
  }, 1000);
  
  // Анти-копирование
  document.addEventListener('copy', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  
  // Анти-горячие клавиши
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.key === 's') ||
        e.key === 'PrintScreen') {
      e.preventDefault();
    }
  });
})();
</script>
```

## 🚀 Деплой обфусцированной версии

### 1. Обновление Dockerfile для обфускации

```dockerfile
FROM node:18-alpine AS builder

# Установка зависимостей для сборки
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Копирование исходного кода
COPY . .

# Сборка обфусцированной версии
RUN npm run build

# Production stage
FROM node:18-alpine

# Установка security updates
RUN apk update && apk upgrade

# Создание пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Копирование обфусцированных файлов
WORKDIR /app
COPY --from=builder /app/dist/obfuscated ./
COPY --from=builder /app/package*.json ./

# Установка только production зависимостей
RUN npm ci --only=production

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

### 2. Создание .dockerignore

```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.nyc_output
.coverage
dist/obfuscated
*.log
```

### 3. Обновление railway.json

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

## 📋 Чек-лист обфускации

### Перед сборкой
- [ ] Все зависимости установлены
- [ ] Конфигурация webpack настроена
- [ ] Скрипты обфускации созданы
- [ ] Защитные меры интегрированы

### После сборки
- [ ] JavaScript файлы обфусцированы
- [ ] CSS файлы минифицированы
- [ ] HTML файлы сжаты
- [ ] Серверные файлы защищены
- [ ] Защитные меры активны

### Тестирование
- [ ] Приложение запускается
- [ ] Все функции работают
- [ ] Защита от отладки активна
- [ ] Защита от копирования работает
- [ ] Защита от скриншотов активна
- [ ] Защита от инспекции работает

### Деплой
- [ ] Dockerfile обновлен
- [ ] .dockerignore настроен
- [ ] railway.json обновлен
- [ ] Тестирование в production
- [ ] Мониторинг работы защиты
