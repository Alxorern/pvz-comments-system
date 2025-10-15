async function up(db) {
  return new Promise((resolve, reject) => {
    console.log('🔧 Создание таблицы audit_log...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      );
    `;
    
    db.run(createTableSQL, (err) => {
      if (err) {
        console.error('❌ Ошибка создания таблицы audit_log:', err);
        reject(err);
      } else {
        console.log('✅ Таблица audit_log создана успешно');
        
        // Создаем индексы для быстрого поиска
        const createIndexSQL = `
          CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
          CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
          CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
        `;
        
        db.run(createIndexSQL, (err) => {
          if (err) {
            console.error('❌ Ошибка создания индексов:', err);
            reject(err);
          } else {
            console.log('✅ Индексы для audit_log созданы успешно');
            resolve();
          }
        });
      }
    });
  });
}

module.exports = {
  up,
  description: 'Add audit_log table for security monitoring'
};
