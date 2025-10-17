const sqlite3 = require('sqlite3').verbose();

/**
 * Миграция 003: Добавление столбца problems в таблицу pvz
 * Дата: 2024-01-XX
 * Описание: Добавляет столбец problems для хранения информации о проблемах ПВЗ
 */

async function up(db) {
    return new Promise((resolve, reject) => {
        console.log('🔄 Выполнение миграции 003: Добавление столбца problems в таблицу pvz...');
        
        // Проверяем, существует ли таблица pvz
        db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='pvz'", (err, tables) => {
            if (err) {
                console.error('❌ Ошибка проверки таблицы pvz:', err);
                reject(err);
                return;
            }
            
            if (tables.length === 0) {
                console.log('⚠️ Таблица pvz не существует, пропускаем добавление столбца problems');
                resolve();
                return;
            }
            
            // Проверяем, есть ли уже столбец problems
            db.all("PRAGMA table_info(pvz)", (err, columns) => {
                if (err) {
                    console.error('❌ Ошибка проверки структуры таблицы pvz:', err);
                    reject(err);
                    return;
                }
            
            const hasProblemsColumn = columns.some(col => col.name === 'problems');
            
            if (hasProblemsColumn) {
                console.log('✅ Столбец problems уже существует в таблице pvz');
                resolve();
                return;
            }
            
            // Добавляем столбец problems
            db.run(`
                ALTER TABLE pvz 
                ADD COLUMN problems TEXT DEFAULT NULL
            `, (err) => {
                if (err) {
                    console.error('❌ Ошибка добавления столбца problems:', err);
                    reject(err);
                } else {
                    console.log('✅ Столбец problems успешно добавлен в таблицу pvz');
                    resolve();
                }
            });
            });
        });
    });
}

async function down(db) {
    return new Promise((resolve, reject) => {
        console.log('🔄 Откат миграции 003: Удаление столбца problems из таблицы pvz...');
        
        // SQLite не поддерживает DROP COLUMN в старых версиях
        // Поэтому мы просто логируем, что откат не поддерживается
        console.log('⚠️ Откат миграции 003 не поддерживается (SQLite ограничения)');
        console.log('💡 Для отката необходимо пересоздать таблицу pvz без столбца problems');
        resolve();
    });
}

module.exports = {
    version: '003',
    description: 'Добавление столбца problems в таблицу pvz',
    up,
    down
};
