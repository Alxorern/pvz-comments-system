const sqlite3 = require('sqlite3').verbose();
const dbConfig = require('./database-config');

async function checkCompany000002() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbConfig.getDatabasePath(), (err) => {
            if (err) {
                console.error('❌ Ошибка подключения к БД:', err);
                reject(err);
                return;
            }
            console.log('✅ Подключение к БД установлено');
        });

        // Проверяем все ПВЗ компании 000002
        console.log('🔍 Проверяем все ПВЗ компании 000002...');
        db.all(`
            SELECT 
                pvz_id,
                region,
                status_name,
                address
            FROM pvz
            WHERE company_id = '000002'
            ORDER BY region, status_name
        `, (err, pvz) => {
            if (err) {
                console.error('❌ Ошибка получения ПВЗ:', err);
                reject(err);
                return;
            }
            
            if (pvz.length === 0) {
                console.log('📭 ПВЗ компании 000002 не найдены');
            } else {
                console.log(`📊 Найдено ПВЗ компании 000002: ${pvz.length}`);
                
                // Группируем по регионам и статусам
                const grouped = {};
                pvz.forEach(p => {
                    const key = `${p.region} - ${p.status_name}`;
                    if (!grouped[key]) {
                        grouped[key] = [];
                    }
                    grouped[key].push(p);
                });
                
                console.log('\n📊 Группировка по регионам и статусам:');
                Object.entries(grouped).forEach(([key, items]) => {
                    console.log(`  ${key}: ${items.length} ПВЗ`);
                });
            }
            
            db.close((err) => {
                if (err) {
                    console.error('❌ Ошибка закрытия БД:', err);
                    reject(err);
                } else {
                    console.log('\n✅ Соединение с БД закрыто');
                    resolve();
                }
            });
        });
    });
}

// Запускаем проверку
checkCompany000002()
    .then(() => {
        console.log('🎉 Проверка завершена');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Ошибка:', error);
        process.exit(1);
    });
