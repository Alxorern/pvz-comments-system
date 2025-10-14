const MigrationManager = require('./migrations/migration-manager');

async function main() {
    const migrationManager = new MigrationManager();
    
    try {
        console.log('🚀 Запуск миграций базы данных...');
        
        await migrationManager.init();
        await migrationManager.runMigrations();
        
        console.log('✅ Все миграции выполнены успешно!');
        
    } catch (error) {
        console.error('❌ Ошибка выполнения миграций:', error);
        process.exit(1);
    } finally {
        await migrationManager.close();
        process.exit(0);
    }
}

main();
