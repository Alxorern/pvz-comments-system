const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || '/app/data/billing.db';

class MigrationManager {
    constructor() {
        this.db = null;
        this.migrationsPath = path.join(__dirname, 'versions');
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('❌ Ошибка подключения к БД:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Подключение к БД для миграций:', dbPath);
                resolve();
            });
        });
    }

    async createMigrationsTable() {
        return new Promise((resolve, reject) => {
            const sql = `
                CREATE TABLE IF NOT EXISTS migrations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    version TEXT UNIQUE NOT NULL,
                    description TEXT,
                    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;
            
            this.db.run(sql, (err) => {
                if (err) {
                    console.error('❌ Ошибка создания таблицы migrations:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Таблица migrations создана');
                resolve();
            });
        });
    }

    async getExecutedMigrations() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT version FROM migrations ORDER BY version', (err, rows) => {
                if (err) {
                    console.error('❌ Ошибка получения выполненных миграций:', err);
                    reject(err);
                    return;
                }
                resolve(rows.map(row => row.version));
            });
        });
    }

    async getAvailableMigrations() {
        if (!fs.existsSync(this.migrationsPath)) {
            return [];
        }
        
        const files = fs.readdirSync(this.migrationsPath)
            .filter(file => file.endsWith('.js'))
            .sort();
        
        return files.map(file => file.replace('.js', ''));
    }

    async executeMigration(version) {
        const migrationPath = path.join(this.migrationsPath, `${version}.js`);
        
        if (!fs.existsSync(migrationPath)) {
            throw new Error(`Миграция ${version} не найдена`);
        }

        console.log(`🔄 Выполняем миграцию: ${version}`);
        
        const migration = require(migrationPath);
        await migration.up(this.db);
        
        // Записываем выполненную миграцию
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO migrations (version, description) VALUES (?, ?)',
                [version, migration.description || ''],
                (err) => {
                    if (err) {
                        console.error('❌ Ошибка записи миграции:', err);
                        reject(err);
                        return;
                    }
                    console.log(`✅ Миграция ${version} выполнена`);
                    resolve();
                }
            );
        });
    }

    async runMigrations() {
        try {
            await this.createMigrationsTable();
            
            const executed = await this.getExecutedMigrations();
            const available = await this.getAvailableMigrations();
            
            const pending = available.filter(version => !executed.includes(version));
            
            if (pending.length === 0) {
                console.log('✅ Все миграции уже выполнены');
                return;
            }

            console.log(`📋 Найдено миграций для выполнения: ${pending.length}`);
            
            for (const version of pending) {
                await this.executeMigration(version);
            }
            
            console.log('🎉 Все миграции выполнены успешно!');
            
        } catch (error) {
            console.error('❌ Ошибка выполнения миграций:', error);
            throw error;
        }
    }

    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        console.error('❌ Ошибка закрытия БД:', err);
                    } else {
                        console.log('✅ БД закрыта');
                    }
                    resolve();
                });
            });
        }
    }
}

module.exports = MigrationManager;
