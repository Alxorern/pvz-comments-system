const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_PATH || '/app/data/billing.db';

async function initDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Ошибка подключения к БД:', err);
                reject(err);
                return;
            }
            console.log('✅ База данных создана:', dbPath);
            resolve(db);
        });
    });
}

async function createTables(db) {
    return new Promise((resolve, reject) => {
        const sql = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                full_name TEXT,
                login TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                role_id INTEGER,
                addwho TEXT DEFAULT 'admin',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (role_id) REFERENCES roles (id)
            );
            
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS pvz (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pvz_id TEXT UNIQUE NOT NULL,
                region TEXT,
                address TEXT,
                service_name TEXT,
                status_date TEXT,
                status_name TEXT,
                company_name TEXT,
                transaction_date TEXT,
                transaction_amount TEXT,
                phone TEXT,
                postal_code TEXT,
                fitting_room TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pvz_id TEXT NOT NULL,
                comment TEXT NOT NULL,
                created_by TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS regions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS role_regions (
                role_id INTEGER,
                region_id INTEGER,
                PRIMARY KEY (role_id, region_id),
                FOREIGN KEY (role_id) REFERENCES roles (id),
                FOREIGN KEY (region_id) REFERENCES regions (id)
            );
            
            CREATE TABLE IF NOT EXISTS user_table_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                table_name TEXT NOT NULL,
                column_visibility TEXT NOT NULL,
                column_widths TEXT NOT NULL,
                column_order TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, table_name)
            );
            
            CREATE TABLE IF NOT EXISTS google_sync_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                status TEXT NOT NULL,
                message TEXT,
                records_processed INTEGER DEFAULT 0,
                records_created INTEGER DEFAULT 0,
                records_updated INTEGER DEFAULT 0,
                records_skipped INTEGER DEFAULT 0,
                execution_time_ms INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        db.exec(sql, (err) => {
            if (err) {
                console.error('❌ Ошибка создания таблиц:', err);
                reject(err);
                return;
            }
            console.log('✅ Таблицы созданы');
            resolve();
        });
    });
}

async function createAdminUser(db) {
    return new Promise((resolve, reject) => {
        const bcrypt = require('bcrypt');
        
        // Получаем учетные данные из переменных окружения
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
        const hashedPassword = bcrypt.hashSync(adminPassword, 10);
        
        const sql = `
            INSERT OR REPLACE INTO users (user_id, full_name, login, password_hash, role, addwho) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        db.run(sql, [1, 'Administrator', adminUsername, hashedPassword, 'admin', 'system'], (err) => {
            if (err) {
                console.error('❌ Ошибка создания admin:', err);
                reject(err);
                return;
            }
            console.log(`✅ Admin пользователь создан: ${adminUsername}`);
            resolve();
        });
    });
}

async function main() {
    try {
        console.log('🚀 Инициализация базы данных...');
        
        const db = await initDatabase();
        await createTables(db);
        await createAdminUser(db);
        
        db.close((err) => {
            if (err) {
                console.error('❌ Ошибка закрытия БД:', err);
                process.exit(1);
            }
            console.log('✅ База данных инициализирована успешно');
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Критическая ошибка:', error);
        process.exit(1);
    }
}

main();