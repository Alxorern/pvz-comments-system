/**
 * Конфигурация базы данных
 * Этот файл указывает на правильное расположение базы данных
 */

const path = require('path');

// Основная база данных (правильная)
const MAIN_DATABASE_PATH = path.join(__dirname, 'billing.db');

// Альтернативные пути (для справки)
const ALTERNATIVE_PATHS = {
    // Пустая база данных (не использовать)
    empty: path.join(__dirname, 'src', 'server', 'database', 'billing.db'),
    // Основная база данных (использовать эту)
    main: MAIN_DATABASE_PATH
};

module.exports = {
    // Основной путь к базе данных
    databasePath: MAIN_DATABASE_PATH,
    
    // Альтернативные пути
    alternativePaths: ALTERNATIVE_PATHS,
    
    // Функция для получения правильного пути
    getDatabasePath: () => MAIN_DATABASE_PATH,
    
    // Функция для проверки существования базы данных
    checkDatabaseExists: () => {
        const fs = require('fs');
        return fs.existsSync(MAIN_DATABASE_PATH);
    },
    
    // Функция для получения информации о базе данных
    getDatabaseInfo: () => {
        const fs = require('fs');
        if (fs.existsSync(MAIN_DATABASE_PATH)) {
            const stats = fs.statSync(MAIN_DATABASE_PATH);
            return {
                path: MAIN_DATABASE_PATH,
                size: stats.size,
                sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
                lastModified: stats.mtime,
                exists: true
            };
        }
        return {
            path: MAIN_DATABASE_PATH,
            exists: false
        };
    }
};
