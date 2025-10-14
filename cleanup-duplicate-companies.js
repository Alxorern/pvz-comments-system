const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_PATH || '/app/data/billing.db';

async function cleanupDuplicateCompanies() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Ошибка подключения к БД:', err);
                reject(err);
                return;
            }
            console.log('✅ Подключение к БД для очистки дубликатов:', dbPath);
        });

        console.log('🔄 Начинаем очистку дублирующихся компаний...');

        // 1. Находим дублирующиеся компании
        db.all(`
            SELECT 
                company_name,
                COUNT(*) as count,
                GROUP_CONCAT(company_id) as company_ids
            FROM companies 
            WHERE company_name IS NOT NULL AND company_name != ''
            GROUP BY company_name 
            HAVING COUNT(*) > 1
            ORDER BY company_name
        `, (err, duplicates) => {
            if (err) {
                console.error('❌ Ошибка поиска дубликатов:', err);
                reject(err);
                return;
            }

            if (duplicates.length === 0) {
                console.log('✅ Дублирующихся компаний не найдено');
                db.close();
                resolve();
                return;
            }

            console.log(`📊 Найдено дублирующихся компаний: ${duplicates.length}`);

            let processedCount = 0;
            const totalDuplicates = duplicates.length;

            // Обрабатываем каждую группу дубликатов
            duplicates.forEach((duplicate, index) => {
                const companyIds = duplicate.company_ids.split(',');
                const keepId = companyIds[0]; // Оставляем первый ID
                const removeIds = companyIds.slice(1); // Удаляем остальные

                console.log(`🔧 Обрабатываем: "${duplicate.company_name}"`);
                console.log(`   Оставляем ID: ${keepId}`);
                console.log(`   Удаляем ID: ${removeIds.join(', ')}`);

                // Обновляем ПВЗ, которые ссылаются на удаляемые компании
                const updatePromises = removeIds.map(removeId => {
                    return new Promise((resolveUpdate, rejectUpdate) => {
                        db.run(
                            'UPDATE pvz SET company_id = ? WHERE company_id = ?',
                            [keepId, removeId],
                            function(err) {
                                if (err) {
                                    console.error(`❌ Ошибка обновления ПВЗ для компании ${removeId}:`, err);
                                    rejectUpdate(err);
                                    return;
                                }
                                console.log(`   ✅ Обновлено ПВЗ: ${this.changes} записей`);
                                resolveUpdate();
                            }
                        );
                    });
                });

                // Обновляем пользователей, которые ссылаются на удаляемые компании
                const updateUserPromises = removeIds.map(removeId => {
                    return new Promise((resolveUpdate, rejectUpdate) => {
                        db.run(
                            'UPDATE users SET company_id = ? WHERE company_id = ?',
                            [keepId, removeId],
                            function(err) {
                                if (err) {
                                    console.error(`❌ Ошибка обновления пользователей для компании ${removeId}:`, err);
                                    rejectUpdate(err);
                                    return;
                                }
                                console.log(`   ✅ Обновлено пользователей: ${this.changes} записей`);
                                resolveUpdate();
                            }
                        );
                    });
                });

                // Удаляем дублирующиеся компании
                const deletePromises = removeIds.map(removeId => {
                    return new Promise((resolveDelete, rejectDelete) => {
                        db.run(
                            'DELETE FROM companies WHERE company_id = ?',
                            [removeId],
                            function(err) {
                                if (err) {
                                    console.error(`❌ Ошибка удаления компании ${removeId}:`, err);
                                    rejectDelete(err);
                                    return;
                                }
                                console.log(`   ✅ Удалена компания: ${removeId}`);
                                resolveDelete();
                            }
                        );
                    });
                });

                // Выполняем все операции для этой группы
                Promise.all([...updatePromises, ...updateUserPromises, ...deletePromises])
                    .then(() => {
                        processedCount++;
                        console.log(`✅ Обработано: ${processedCount}/${totalDuplicates}`);
                        
                        if (processedCount === totalDuplicates) {
                            console.log('🎉 Очистка дубликатов завершена!');
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
                    })
                    .catch((error) => {
                        console.error('❌ Ошибка обработки дубликатов:', error);
                        reject(error);
                    });
            });
        });
    });
}

// Запуск очистки
cleanupDuplicateCompanies()
    .then(() => {
        console.log('✅ Очистка завершена успешно');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Ошибка очистки:', error);
        process.exit(1);
    });
