const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Определяем путь к базе данных в зависимости от окружения
let dbPath;
if (process.env.RAILWAY_ENVIRONMENT === 'production') {
    // В Railway используем Volume
    dbPath = '/app/data/billing.db';
    console.log('🚀 Railway production environment detected');
} else if (process.env.DATABASE_PATH) {
    // Используем переменную окружения
    dbPath = process.env.DATABASE_PATH;
    console.log('🔧 Using DATABASE_PATH environment variable');
} else {
    // Локальная разработка
    try {
        const dbConfig = require('./database-config');
        dbPath = dbConfig.getDatabasePath();
        console.log('💻 Local development environment');
    } catch (error) {
        dbPath = path.join(__dirname, 'billing.db');
        console.log('💻 Fallback to default path');
    }
}

console.log(`🗄️ Database path: ${dbPath}`);

async function initDatabase() {
    return new Promise((resolve, reject) => {
        // Создаем директорию если она не существует
        const dbDir = path.dirname(dbPath);
        console.log(`📁 Database directory: ${dbDir}`);
        console.log(`📁 Directory exists: ${fs.existsSync(dbDir)}`);
        
        if (!fs.existsSync(dbDir)) {
            console.log(`❌ Directory does not exist: ${dbDir}`);
            console.log(`❌ NOT creating directory - this might be a Volume issue!`);
            reject(new Error(`Database directory does not exist: ${dbDir}`));
            return;
        }
        
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
                login TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created TEXT,
                addwho TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                role_id INTEGER DEFAULT NULL,
                company_id TEXT DEFAULT NULL,
                FOREIGN KEY (company_id) REFERENCES companies(company_id)
            );
            
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id TEXT UNIQUE NOT NULL,
                company_name TEXT NOT NULL,
                phone TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Уникальный индекс на название компании, чтобы не допускать дублей
            CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_company_name ON companies(company_name);
            
            CREATE TABLE IF NOT EXISTS pvz (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pvz_id TEXT UNIQUE NOT NULL,
                region TEXT,
                address TEXT,
                service_name TEXT,
                status_date TEXT,
                status_name TEXT,
                company_id TEXT,
                transaction_date TEXT,
                transaction_amount TEXT,
                postal_code TEXT,
                fitting_room TEXT,
                phone TEXT,
                problems TEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(company_id)
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
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1
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
            
            CREATE TABLE IF NOT EXISTS role_statuses (
                role_id INTEGER,
                status_name TEXT,
                PRIMARY KEY (role_id, status_name),
                FOREIGN KEY (role_id) REFERENCES roles (id)
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
                details TEXT,
                records_processed INTEGER DEFAULT 0,
                records_created INTEGER DEFAULT 0,
                records_updated INTEGER DEFAULT 0,
                records_skipped INTEGER DEFAULT 0,
                execution_time_ms INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                sync_type TEXT DEFAULT 'pvz'
            );
            
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                resource_type TEXT,
                resource_id TEXT,
                ip_address TEXT,
                user_agent TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
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

async function migrateDatabase(db) {
    return new Promise((resolve, reject) => {
        console.log('🔧 Проверяем необходимость миграции...');
        
        // Проверяем структуру таблицы users
        db.all("PRAGMA table_info(users)", (err, columns) => {
            if (err) {
                console.error('❌ Ошибка проверки структуры таблицы:', err);
                reject(err);
                return;
            }
            
            // Если это новая БД, миграция не нужна
            if (!columns || columns.length === 0) {
                console.log('✅ Новая БД - миграция не требуется');
                resolve();
                return;
            }
            
            // Проверяем, есть ли столбец role
            const hasRoleColumn = columns.some(col => col.name === 'role');
            
            if (hasRoleColumn) {
                console.log('✅ Столбец role уже существует - миграция не требуется');
                resolve();
            } else {
                console.log('🔧 Добавляем столбец role...');
                db.run('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "user"', (err) => {
                    if (err) {
                        console.error('❌ Ошибка добавления столбца role:', err);
                        reject(err);
                        return;
                    }
                    console.log('✅ Столбец role добавлен');
                    resolve();
                });
            }
        });
    });
}

async function createAdminRole(db) {
    return new Promise((resolve, reject) => {
        console.log('🔧 Создание роли admin...');
        
        // Сначала проверим, есть ли уже роль admin
        db.get('SELECT id, name FROM roles WHERE name = ?', ['admin'], (err, row) => {
            if (err) {
                console.error('❌ Ошибка проверки роли admin:', err);
                reject(err);
                return;
            }
            
            if (row) {
                console.log(`✅ Роль admin уже существует (ID: ${row.id})`);
                resolve();
                return;
            }
            
            const sql = `
                INSERT OR REPLACE INTO roles (id, name, description, is_active) 
                VALUES (?, ?, ?, ?)
            `;
            
            console.log('🔧 Вставляем роль admin с ID=1...');
            db.run(sql, [1, 'admin', 'admin', 1], (err) => {
                if (err) {
                    console.error('❌ Ошибка создания роли admin:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Роль admin создана с ID=1');
                
                // Создаем роль superuser
                const superuserSql = `
                    INSERT OR REPLACE INTO roles (id, name, description, is_active) 
                    VALUES (?, ?, ?, ?)
                `;
                
                console.log('🔧 Вставляем роль superuser с ID=2...');
                db.run(superuserSql, [2, 'superuser', 'superuser', 1], (err) => {
                    if (err) {
                        console.error('❌ Ошибка создания роли superuser:', err);
                        reject(err);
                        return;
                    }
                    console.log('✅ Роль superuser создана с ID=2');
                    resolve();
                });
            });
        });
    });
}

async function createAdminUser(db) {
    return new Promise((resolve, reject) => {
        console.log('🔧 Создание пользователя admin...');
        const bcrypt = require('bcrypt');
        
        // Получаем учетные данные из переменных окружения
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
        
        // Проверяем, существует ли уже пользователь admin
        db.get('SELECT user_id, login FROM users WHERE user_id = 1', (err, row) => {
            if (err) {
                console.error('❌ Ошибка проверки существования admin:', err);
                reject(err);
                return;
            }
            
            if (row) {
                console.log(`✅ Пользователь admin уже существует (ID: ${row.user_id}, Login: ${row.login})`);
                resolve();
                return;
            }
            
            const hashedPassword = bcrypt.hashSync(adminPassword, 10);
            console.log(`🔧 Создаем пользователя: ${adminUsername} с role_id=1`);
            
            const sql = `
                INSERT INTO users (user_id, login, full_name, password_hash, role, created, addwho, role_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const createdDate = new Date().toISOString();
            db.run(sql, [1, adminUsername, 'Administrator', hashedPassword, 'admin', createdDate, 'system', 1], (err) => {
                if (err) {
                    console.error('❌ Ошибка создания admin:', err);
                    reject(err);
                    return;
                }
                console.log(`✅ Admin пользователь создан: ${adminUsername} с role_id=1`);
                resolve();
            });
        });
    });
}

async function createSuperUser(db) {
    return new Promise((resolve, reject) => {
        console.log('🔧 Создание пользователя superuser...');
        const bcrypt = require('bcrypt');
        
        // Получаем учетные данные из переменных окружения
        const superUsername = process.env.SUPERUSER_USERNAME || 'superuser';
        const superPassword = process.env.SUPERUSER_PASSWORD || 'superuser123';
        
        // Проверяем, существует ли уже пользователь superuser
        db.get('SELECT user_id, login FROM users WHERE user_id = 2', (err, row) => {
            if (err) {
                console.error('❌ Ошибка проверки существования superuser:', err);
                reject(err);
                return;
            }
            
            if (row) {
                console.log(`✅ Пользователь superuser уже существует (ID: ${row.user_id}, Login: ${row.login})`);
                resolve();
                return;
            }
            
            const hashedPassword = bcrypt.hashSync(superPassword, 10);
            console.log(`🔧 Создаем пользователя: ${superUsername} с role_id=2`);
            
            const sql = `
                INSERT INTO users (user_id, login, full_name, password_hash, role, created, addwho, role_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const createdDate = new Date().toISOString();
            db.run(sql, [2, superUsername, 'Super User', hashedPassword, 'superuser', createdDate, 'system', 2], (err) => {
                if (err) {
                    console.error('❌ Ошибка создания superuser:', err);
                    reject(err);
                    return;
                }
                console.log(`✅ Superuser создан: ${superUsername} с role_id=2`);
                resolve();
            });
        });
    });
}

async function main() {
    try {
        console.log('🚀 Инициализация базы данных...');
        
        const db = await initDatabase();
        await createTables(db);
        await migrateDatabase(db);
        await createAdminRole(db);
        await createAdminUser(db);
        await createSuperUser(db);
        
        // Проверяем, что все создалось правильно
        console.log('🔍 Проверка созданных данных...');
        
        // Проверяем роли
        db.get('SELECT COUNT(*) as count FROM roles', (err, row) => {
            if (err) {
                console.error('❌ Ошибка проверки ролей:', err);
            } else {
                console.log(`📊 Ролей в БД: ${row.count}`);
            }
        });
        
        // Проверяем пользователей
        db.get('SELECT user_id, login, role_id FROM users WHERE user_id = 1', (err, row) => {
            if (err) {
                console.error('❌ Ошибка проверки пользователя admin:', err);
            } else if (row) {
                console.log(`👤 Admin: ID=${row.user_id}, Login=${row.login}, Role ID=${row.role_id}`);
            } else {
                console.log('❌ Пользователь admin не найден!');
            }
        });
        
        // Проверяем superuser
        db.get('SELECT user_id, login, role_id FROM users WHERE user_id = 2', (err, row) => {
            if (err) {
                console.error('❌ Ошибка проверки пользователя superuser:', err);
            } else if (row) {
                console.log(`👤 Superuser: ID=${row.user_id}, Login=${row.login}, Role ID=${row.role_id}`);
            } else {
                console.log('❌ Пользователь superuser не найден!');
            }
        });
        
        // Проверяем JOIN для admin
        db.get('SELECT u.user_id, u.login, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.user_id = 1', (err, row) => {
            if (err) {
                console.error('❌ Ошибка проверки JOIN admin:', err);
            } else if (row) {
                console.log(`🔗 Admin JOIN: User=${row.login}, Role=${row.role_name}`);
            } else {
                console.log('❌ Admin JOIN не вернул результат!');
            }
        });
        
        // Проверяем JOIN для superuser
        db.get('SELECT u.user_id, u.login, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.user_id = 2', (err, row) => {
            if (err) {
                console.error('❌ Ошибка проверки JOIN superuser:', err);
            } else if (row) {
                console.log(`🔗 Superuser JOIN: User=${row.login}, Role=${row.role_name}`);
            } else {
                console.log('❌ Superuser JOIN не вернул результат!');
            }
            
            // Закрываем БД после всех проверок
            db.close((err) => {
                if (err) {
                    console.error('❌ Ошибка закрытия БД:', err);
                    process.exit(1);
                }
                console.log('✅ База данных инициализирована успешно');
                process.exit(0);
            });
        });
        
    } catch (error) {
        console.error('❌ Критическая ошибка:', error);
        process.exit(1);
    }
}

main();