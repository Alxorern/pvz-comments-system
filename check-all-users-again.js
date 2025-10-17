const sqlite3 = require('sqlite3').verbose();
const dbConfig = require('./database-config');

async function checkAllUsersAgain() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbConfig.getDatabasePath(), (err) => {
            if (err) {
                console.error('❌ Ошибка подключения к БД:', err);
                reject(err);
                return;
            }
            console.log('✅ Подключение к БД установлено');
        });

        // Проверяем всех пользователей
        console.log('🔍 Проверяем всех пользователей...');
        db.all(`
            SELECT 
                u.user_id,
                u.login,
                u.full_name,
                u.role_id,
                r.name as role_name,
                u.company_id
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            ORDER BY u.user_id
        `, (err, users) => {
            if (err) {
                console.error('❌ Ошибка получения пользователей:', err);
                reject(err);
                return;
            }
            
            if (users.length === 0) {
                console.log('📭 Пользователи не найдены');
            } else {
                console.log(`📊 Найдено пользователей: ${users.length}`);
                users.forEach((user, index) => {
                    console.log(`  ${index + 1}. ID: ${user.user_id}, Логин: "${user.login}", Имя: "${user.full_name}", Роль: "${user.role_name}" (ID: ${user.role_id}), Компания: ${user.company_id}`);
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
checkAllUsersAgain()
    .then(() => {
        console.log('🎉 Проверка завершена');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Ошибка:', error);
        process.exit(1);
    });
