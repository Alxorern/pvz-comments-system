/**
 * Скрипт для проверки конфигурации базы данных
 */

const dbConfig = require('./database-config');

console.log('🔧 Проверка конфигурации базы данных...\n');

// Получаем информацию о базе данных
const dbInfo = dbConfig.getDatabaseInfo();

console.log('📊 Информация о базе данных:');
console.log(`  Путь: ${dbInfo.path}`);
console.log(`  Существует: ${dbInfo.exists ? '✅ ДА' : '❌ НЕТ'}`);

if (dbInfo.exists) {
    console.log(`  Размер: ${dbInfo.sizeFormatted}`);
    console.log(`  Последнее изменение: ${dbInfo.lastModified}`);
}

console.log('\n🔍 Альтернативные пути:');
Object.entries(dbConfig.alternativePaths).forEach(([name, path]) => {
    const fs = require('fs');
    const exists = fs.existsSync(path);
    const size = exists ? `${(fs.statSync(path).size / 1024).toFixed(2)} KB` : 'N/A';
    console.log(`  ${name}: ${path} ${exists ? `✅ (${size})` : '❌'}`);
});

console.log('\n✅ Конфигурация загружена успешно!');
console.log(`🎯 Используется база данных: ${dbConfig.getDatabasePath()}`);
