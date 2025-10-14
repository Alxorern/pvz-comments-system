// Миграция: Добавление таблицы companies и обновление структуры
module.exports = {
    description: 'Add companies table and update pvz/users structure',
    
    async up(db) {
        return new Promise((resolve, reject) => {
            console.log('🔄 Создаем таблицу companies...');
            
            const createCompaniesSQL = `
                CREATE TABLE IF NOT EXISTS companies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id TEXT UNIQUE NOT NULL,
                    company_name TEXT NOT NULL,
                    phone TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;
            
            db.run(createCompaniesSQL, (err) => {
                if (err) {
                    console.error('❌ Ошибка создания таблицы companies:', err);
                    reject(err);
                    return;
                }
                console.log('✅ Таблица companies создана');
                
                // Создаем компанию для существующих ПВЗ
                console.log('🔄 Создаем компанию для существующих ПВЗ...');
                db.run(`
                    INSERT OR IGNORE INTO companies (company_id, company_name, phone) 
                    VALUES ('000000', 'Неизвестная компания', '')
                `, (err) => {
                    if (err) {
                        console.error('❌ Ошибка создания компании по умолчанию:', err);
                        reject(err);
                        return;
                    }
                    console.log('✅ Компания по умолчанию создана');
                    
                    // Добавляем company_id в таблицу pvz если его нет
                    console.log('🔄 Проверяем структуру таблицы pvz...');
                    db.all("PRAGMA table_info(pvz)", (err, columns) => {
                        if (err) {
                            console.error('❌ Ошибка проверки структуры pvz:', err);
                            reject(err);
                            return;
                        }
                        
                        const hasCompanyId = columns.some(col => col.name === 'company_id');
                        
                        if (!hasCompanyId) {
                            console.log('🔄 Добавляем company_id в таблицу pvz...');
                            db.run('ALTER TABLE pvz ADD COLUMN company_id TEXT', (err) => {
                                if (err) {
                                    console.error('❌ Ошибка добавления company_id в pvz:', err);
                                    reject(err);
                                    return;
                                }
                                console.log('✅ company_id добавлен в pvz');
                                
                                // Обновляем существующие ПВЗ
                                db.run(`
                                    UPDATE pvz 
                                    SET company_id = '000000' 
                                    WHERE company_id IS NULL
                                `, function(err) {
                                    if (err) {
                                        console.error('❌ Ошибка обновления ПВЗ:', err);
                                        reject(err);
                                        return;
                                    }
                                    console.log(`✅ Обновлено ПВЗ: ${this.changes}`);
                                    resolve();
                                });
                            });
                        } else {
                            console.log('✅ company_id уже существует в pvz');
                            resolve();
                        }
                    });
                });
            });
        });
    },
    
    async down(db) {
        // Откат миграции (если нужно)
        console.log('⚠️ Откат миграции не реализован');
        return Promise.resolve();
    }
};
