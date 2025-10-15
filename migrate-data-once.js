const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = '/app/data/billing.db';

async function migrateDataOnce() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Ошибка подключения к БД:', err);
                reject(err);
                return;
            }
            console.log('✅ Подключение к БД установлено:', dbPath);
        });

        // Проверяем, есть ли данные в таблице companies
        db.get('SELECT COUNT(*) as count FROM companies', (err, row) => {
            if (err) {
                console.error('❌ Ошибка проверки данных в таблице companies:', err);
                db.close();
                reject(err);
                return;
            }

            if (row.count > 0) {
                console.log('✅ Таблица companies уже содержит данные, миграция не нужна');
                db.close();
                resolve();
                return;
            }

            console.log('🔧 Заполняем таблицу companies данными из pvz...');
            
            // Получаем уникальные компании из pvz
            db.all(`
                SELECT DISTINCT company_id, company_name 
                FROM pvz 
                WHERE company_id IS NOT NULL AND company_name IS NOT NULL
            `, (err, companies) => {
                if (err) {
                    console.error('❌ Ошибка получения компаний из pvz:', err);
                    db.close();
                    reject(err);
                    return;
                }

                console.log(`📊 Найдено ${companies.length} уникальных компаний в pvz`);

                if (companies.length === 0) {
                    console.log('⚠️ Нет компаний для заполнения');
                    db.close();
                    resolve();
                    return;
                }

                // Вставляем компании
                const insertStmt = db.prepare(`
                    INSERT OR IGNORE INTO companies (company_id, company_name, phone) 
                    VALUES (?, ?, NULL)
                `);

                let inserted = 0;
                companies.forEach((company, index) => {
                    insertStmt.run([company.company_id, company.company_name], function(err) {
                        if (err) {
                            console.error(`❌ Ошибка вставки компании ${company.company_name}:`, err);
                        } else if (this.changes > 0) {
                            inserted++;
                        }
                        
                        if (index === companies.length - 1) {
                            insertStmt.finalize();
                            console.log(`✅ Вставлено ${inserted} компаний в таблицу companies`);
                            db.close();
                            resolve();
                        }
                    });
                });
            });
        });
    });
}

// Запуск миграции
if (require.main === module) {
    migrateDataOnce()
        .then(() => {
            console.log('🎉 Миграция данных завершена успешно!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Ошибка миграции данных:', error);
            process.exit(1);
        });
}

module.exports = { migrateDataOnce };
