const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_PATH || '/app/data/billing.db';

async function migrateExistingData() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Ошибка подключения к БД:', err);
                reject(err);
                return;
            }
            console.log('✅ Подключение к БД для миграции:', dbPath);
        });

        console.log('🔄 Начинаем миграцию существующих данных...');

        // 1. Проверяем, есть ли старые данные ПВЗ без company_id
        db.get('SELECT COUNT(*) as count FROM pvz WHERE company_id IS NULL', (err, row) => {
            if (err) {
                console.error('❌ Ошибка проверки ПВЗ:', err);
                reject(err);
                return;
            }

            const pvzWithoutCompany = row.count;
            console.log(`📊 ПВЗ без company_id: ${pvzWithoutCompany}`);

            if (pvzWithoutCompany > 0) {
                console.log('🔧 Создаем компанию "Неизвестная" для старых ПВЗ...');
                
                // Создаем компанию для старых данных
                db.run(`
                    INSERT OR IGNORE INTO companies (company_id, company_name, phone) 
                    VALUES ('000000', 'Неизвестная компания', '')
                `, (err) => {
                    if (err) {
                        console.error('❌ Ошибка создания компании:', err);
                        reject(err);
                        return;
                    }

                    // Обновляем ПВЗ без company_id
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
                        
                        // 2. Проверяем пользователей без company_id
                        db.get('SELECT COUNT(*) as count FROM users WHERE company_id IS NULL', (err, row) => {
                            if (err) {
                                console.error('❌ Ошибка проверки пользователей:', err);
                                reject(err);
                                return;
                            }

                            const usersWithoutCompany = row.count;
                            console.log(`📊 Пользователей без company_id: ${usersWithoutCompany}`);

                            if (usersWithoutCompany > 0) {
                                console.log('🔧 Обновляем пользователей без company_id...');
                                
                                // Для пользователей без компании оставляем NULL (это нормально)
                                console.log('✅ Пользователи без company_id оставлены как есть (это нормально)');
                            }

                            // 3. Проверяем, есть ли роль superuser
                            db.get('SELECT id FROM roles WHERE name = ?', ['superuser'], (err, row) => {
                                if (err) {
                                    console.error('❌ Ошибка проверки роли superuser:', err);
                                    reject(err);
                                    return;
                                }

                                if (!row) {
                                    console.log('🔧 Создаем роль superuser...');
                                    db.run(`
                                        INSERT INTO roles (id, name, description, is_active) 
                                        VALUES (2, 'superuser', 'superuser', 1)
                                    `, (err) => {
                                        if (err) {
                                            console.error('❌ Ошибка создания роли superuser:', err);
                                            reject(err);
                                            return;
                                        }
                                        console.log('✅ Роль superuser создана');
                                        finishMigration();
                                    });
                                } else {
                                    console.log('✅ Роль superuser уже существует');
                                    finishMigration();
                                }
                            });
                        });
                    });
                });
            } else {
                console.log('✅ Все ПВЗ уже имеют company_id');
                finishMigration();
            }
        });

        function finishMigration() {
            console.log('🎉 Миграция завершена успешно!');
            db.close((err) => {
                if (err) {
                    console.error('❌ Ошибка закрытия БД:', err);
                    reject(err);
                } else {
                    console.log('✅ БД закрыта');
                    resolve();
                }
            });
        }
    });
}

// Запуск миграции
migrateExistingData()
    .then(() => {
        console.log('✅ Миграция завершена');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Ошибка миграции:', error);
        process.exit(1);
    });
