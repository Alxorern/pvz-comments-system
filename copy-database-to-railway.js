const fs = require('fs');
const path = require('path');

console.log('📋 Копирование локальной базы данных на Railway Volume...\n');

const localDbPath = './billing.db';
const railwayDbPath = process.env.DATABASE_URL || '/app/data/billing.db';

console.log('🎯 Проект: PVZ');
console.log('💾 Volume: data (привязан к /app/data)');
console.log('📁 Локальная БД:', localDbPath);
console.log('📁 Railway БД:', railwayDbPath);

// Проверяем существование локальной базы
if (!fs.existsSync(localDbPath)) {
  console.error('❌ Локальная база данных не найдена:', localDbPath);
  process.exit(1);
}

console.log('📁 Локальная БД:', localDbPath);
console.log('📁 Railway БД:', railwayDbPath);

try {
  // Создаем директорию для базы данных если её нет
  const railwayDir = path.dirname(railwayDbPath);
  if (!fs.existsSync(railwayDir)) {
    fs.mkdirSync(railwayDir, { recursive: true });
    console.log('📁 Создана директория:', railwayDir);
  }

  // Копируем файл базы данных
  console.log('📋 Копирование базы данных...');
  fs.copyFileSync(localDbPath, railwayDbPath);
  
  console.log('✅ База данных успешно скопирована на Railway Volume!');
  console.log('\n📊 Статистика:');
  
  const stats = fs.statSync(railwayDbPath);
  console.log(`- Размер файла: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- Дата создания: ${stats.birthtime}`);
  console.log(`- Дата изменения: ${stats.mtime}`);
  
  console.log('\n🎉 Готово! База данных развернута на Railway Volume.');
  
} catch (error) {
  console.error('❌ Ошибка копирования базы данных:', error);
  process.exit(1);
}
