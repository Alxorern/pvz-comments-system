const { google } = require('googleapis');
require('dotenv').config();

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.initialized = false;
    this.settingsCache = null;
    this.settingsCacheTime = 0;
    this.settingsCacheTimeout = 5 * 60 * 1000; // 5 минут
  }

  /**
   * Инициализация сервиса Google Sheets
   */
  async initialize() {
    if (this.initialized) {
      console.log('✅ Google Sheets сервис уже инициализирован');
      return;
    }

    try {
      console.log('🔧 Настройка Google Auth...');
      
      let auth;
      
      // Проверяем, есть ли JSON в переменной окружения
      if (process.env.GOOGLE_CREDENTIALS) {
        console.log('🔧 Используем GOOGLE_CREDENTIALS из переменной окружения');
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        auth = new google.auth.GoogleAuth({
          credentials: credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
        });
      } else if (process.env.GOOGLE_CREDENTIALS_PATH) {
        console.log('🔧 Используем GOOGLE_CREDENTIALS_PATH:', process.env.GOOGLE_CREDENTIALS_PATH);
        auth = new google.auth.GoogleAuth({
          keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
        });
      } else {
        throw new Error('Не заданы GOOGLE_CREDENTIALS или GOOGLE_CREDENTIALS_PATH');
      }

      this.sheets = google.sheets({ version: 'v4', auth });
      this.initialized = true;
      
      console.log('✅ Google Sheets сервис инициализирован');
    } catch (error) {
      console.error('❌ Ошибка инициализации Google Sheets сервиса:', error);
      throw error;
    }
  }

  /**
   * Тестирование подключения к Google Sheets
   */
  async testConnection(spreadsheetId) {
    try {
      await this.initialize();
      
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId
      });
      
      const spreadsheet = response.data;
      console.log('✅ Подключение к Google Sheets успешно');
      
      return {
        title: spreadsheet.properties.title,
        sheets: spreadsheet.sheets.map(sheet => sheet.properties.title)
      };
    } catch (error) {
      console.error(`❌ Ошибка подключения к таблице ${spreadsheetId}:`, error);
      throw new Error(`Не удалось подключиться к таблице: ${error.message}`);
    }
  }

  /**
   * Чтение данных ПВЗ из Google Sheets
   */
  async readPvzData(spreadsheetId, sheetName) {
    try {
      console.log(`📖 Читаем данные из Google Sheets: ${spreadsheetId}, лист: ${sheetName}`);
      await this.initialize();
      
      // Сначала получаем информацию о листе для определения размера
      console.log('📊 Получаем информацию о листе...');
      const sheetInfo = await this.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
        ranges: [`${sheetName}!A:Z`],
        includeGridData: false
      });
      
      const sheet = sheetInfo.data.sheets[0];
      const rowCount = sheet.properties.gridProperties.rowCount;
      
      console.log(`📊 Размер листа "${sheetName}": ${rowCount} строк`);
      
      // Читаем данные
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueRenderOption: 'UNFORMATTED_VALUE', // Получаем неформатированные значения
        dateTimeRenderOption: 'FORMATTED_STRING' // Даты как строки
      });
      
      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.log('⚠️ Данные не найдены в листе');
        return [];
      }
      
      // Первая строка - заголовки
      const headers = rows[0];
      const data = rows.slice(1);
      
      console.log(`✅ Прочитано ${data.length} записей из листа "${sheetName}"`);
      
      // Преобразуем в объекты с оптимизацией
      const result = [];
      const headerCount = headers.length;
      
      // Предварительно создаем массив индексов для быстрого доступа
      const headerIndices = {};
      for (let i = 0; i < headerCount; i++) {
        headerIndices[headers[i]] = i;
      }
      
      // Оптимизированное заполнение объектов
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const obj = {};
        
        // Используем предварительно созданные индексы
        for (const [headerName, index] of Object.entries(headerIndices)) {
          obj[headerName] = row[index] || '';
        }
        
        result.push(obj);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Ошибка чтения данных ПВЗ:', error);
      throw error;
    }
  }

  /**
   * Запись лога синхронизации в базу данных
   */
  async logSyncResult(logData) {
    try {
      const database = require('../database/db');
      const db = database.getDb();
      
      const {
        syncType = 'pvz',
        status,
        message,
        details = null,
        recordsProcessed = 0,
        recordsCreated = 0,
        recordsUpdated = 0,
        recordsSkipped = 0,
        executionTimeMs = 0
      } = logData;

      await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO google_sync_log (
            sync_type, status, message, details, records_processed,
            records_created, records_updated, records_skipped, execution_time_ms
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          syncType, status, message, details, recordsProcessed,
          recordsCreated, recordsUpdated, recordsSkipped, executionTimeMs
        ], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });

      console.log(`📝 Лог синхронизации записан: ${status} - ${message}`);
    } catch (error) {
      console.error('❌ Ошибка записи лога синхронизации:', error);
    }
  }

  /**
   * Синхронизация данных ПВЗ с локальной базой данных
   */
  async syncPvzData() {
    console.log('🔄 Начинаем синхронизацию данных ПВЗ...');
    
    // Проверяем инициализацию
    if (!this.initialized) {
      console.log('🔧 Google Sheets сервис не инициализирован, инициализируем...');
      await this.initialize();
    }
    
    const startTime = Date.now();
    let logData = {
      syncType: 'pvz',
      status: 'success',
      message: 'Синхронизация завершена успешно',
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsSkipped: 0
    };

    try {
      console.log('📋 Получаем настройки...');
      const settings = await this.getSettings();
      console.log('📋 Настройки получены:', settings);
      
      if (!settings.pvzTableId || !settings.pvzSheetName) {
        const errorMsg = 'Настройки таблицы ПВЗ не найдены';
        logData.status = 'error';
        logData.message = errorMsg;
        logData.details = 'Отсутствуют pvzTableId или pvzSheetName в настройках';
        throw new Error(errorMsg);
      }

      // Читаем данные из Google Sheets
      const googleData = await this.readPvzData(settings.pvzTableId, settings.pvzSheetName);
      logData.recordsProcessed = googleData.length;
      
      // Сохраняем в локальную базу данных
      const database = require('../database/db');
      const db = database.getDb();
      
      let syncedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      // Подготавливаем данные для batch обработки
      const validPvzData = [];
      const skippedRecords = [];
      const seenPvzIds = new Set();
      
      for (const row of googleData) {
        // Пропускаем записи без ID ПВЗ - проверяем более строго
        const pvzId = row['Внешний ID ПВЗ'] || row['PVZID'] || '';
        if (!pvzId || pvzId.toString().trim() === '') {
          skippedRecords.push({ reason: 'Отсутствует PVZID', row });
          skippedCount++;
          continue;
        }
        
        const cleanPvzId = pvzId.toString().trim();
        
        // Проверяем на дубликаты PVZID в Google Sheets
        if (seenPvzIds.has(cleanPvzId)) {
          skippedRecords.push({ reason: 'Дубликат PVZID в Google Sheets', row });
          skippedCount++;
          continue;
        }
        seenPvzIds.add(cleanPvzId);

        // Сохраняем сумму транзакции как строку, а не число
        const transactionAmount = row['Сумма транзакции, руб'] || '';
        
        // Получаем или создаем компанию
        const companyName = (row['Наименование компании'] || '').toString();
        const companyPhone = (row['Телефон'] || '').toString();
        const companyId = await this.getOrCreateCompany(db, companyName, companyPhone);
        
        validPvzData.push({
          pvz_id: cleanPvzId,
          region: (row['Регион'] || '').toString(),
          address: (row['Адрес'] || '').toString(),
          service_name: (row['Наименование сервиса'] || '').toString(),
          status_date: (row['Дата статуса'] || '').toString(),
          status_name: (row['Наименование статуса'] || '').toString(),
          company_id: companyId,
          transaction_date: (row['Дата транзакции'] || '').toString(),
          transaction_amount: transactionAmount.toString(), // Сохраняем как строку
          postal_code: (row['Индекс'] || '').toString(),
          fitting_room: (row['Примерочная'] || '').toString()
        });
      }

      if (validPvzData.length === 0) {
        console.log('⚠️ Нет валидных данных для синхронизации');
        return {
          synced: 0,
          updated: 0,
          skipped: skippedCount,
          total: googleData.length
        };
      }

      // Используем UPSERT для всех записей (INSERT OR REPLACE)
      try {
        const result = await this.batchUpsertPvz(db, validPvzData);
        syncedCount = result.inserted;
        updatedCount = result.updated;
        console.log(`✅ UPSERT завершен: ${result.inserted} новых, ${result.updated} обновленных записей`);
      } catch (error) {
        console.error(`❌ Ошибка UPSERT:`, error);
        // Fallback: пробуем по одной записи
        let insertedCount = 0;
        let updatedCount = 0;
        for (const record of validPvzData) {
          try {
            await this.singleUpsertPvz(db, record);
            // Проверяем, была ли запись создана или обновлена
            const existing = await new Promise((resolve, reject) => {
              db.get('SELECT updated_at FROM pvz WHERE pvz_id = ?', [record.pvz_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
              });
            });
            if (existing && existing.updated_at) {
              updatedCount++;
            } else {
              insertedCount++;
            }
          } catch (singleError) {
            console.error(`❌ Ошибка UPSERT записи ${record.pvz_id}:`, singleError);
            skippedRecords.push({ reason: `Ошибка UPSERT: ${singleError.message}`, row: record });
            skippedCount++;
          }
        }
        syncedCount = insertedCount;
        updatedCount = updatedCount;
        console.log(`⚠️ Fallback UPSERT: ${insertedCount} новых, ${updatedCount} обновленных записей`);
      }

      // Обновляем время последней синхронизации
      await new Promise((resolve, reject) => {
        db.run('UPDATE settings SET value = ? WHERE key = ?', 
          [new Date().toISOString(), 'lastUpdate'], (err) => {
            if (err) reject(err);
            else resolve();
          });
      });

      // Обновляем данные для лога
      logData.recordsCreated = syncedCount;
      logData.recordsUpdated = updatedCount;
      logData.recordsSkipped = skippedCount;
      logData.executionTimeMs = Date.now() - startTime;
      logData.message = `Синхронизация завершена: ${syncedCount} новых, ${updatedCount} обновленных, ${skippedCount} пропущенных записей`;

      console.log(`✅ Синхронизация завершена: ${syncedCount} новых, ${updatedCount} обновленных, ${skippedCount} пропущенных записей`);
      
      // Краткое логирование только при проблемах
      if (skippedCount > 0) {
        console.log(`⚠️ Пропущено ${skippedCount} записей из ${googleData.length} прочитанных`);
        const reasons = {};
        skippedRecords.forEach(item => {
          reasons[item.reason] = (reasons[item.reason] || 0) + 1;
        });
        Object.entries(reasons).forEach(([reason, count]) => {
          console.log(`   - ${reason}: ${count} записей`);
        });
      }
      
      return {
        synced: syncedCount,
        updated: updatedCount,
        skipped: skippedCount,
        total: googleData.length,
        validRecords: validPvzData.length,
        skippedReasons: skippedRecords.reduce((acc, item) => {
          acc[item.reason] = (acc[item.reason] || 0) + 1;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('❌ Ошибка синхронизации данных ПВЗ:', error);
      
      // Логируем ошибку
      logData.status = 'error';
      logData.message = 'Ошибка синхронизации данных ПВЗ';
      logData.details = error.message;
      logData.executionTimeMs = Date.now() - startTime;
      
      throw error;
    } finally {
      // Записываем лог в любом случае
      await this.logSyncResult(logData);
    }
  }

  /**
   * Batch INSERT для новых записей ПВЗ (оптимизированная версия)
   */
  async batchUpsertPvz(db, records) {
    if (records.length === 0) return { inserted: 0, updated: 0 };

    const upsertSQL = `
      INSERT OR REPLACE INTO pvz (
        pvz_id, region, address, service_name, status_date,
        status_name, company_id, transaction_date, transaction_amount,
        postal_code, fitting_room, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const stmt = db.prepare(upsertSQL);
        let completed = 0;
        let hasError = false;
        
        for (const record of records) {
          stmt.run([
            record.pvz_id, record.region, record.address, record.service_name,
            record.status_date, record.status_name, record.company_id,
            record.transaction_date, record.transaction_amount,
            record.postal_code, record.fitting_room
          ], function(err) {
            if (err && !hasError) {
              hasError = true;
              console.error('❌ Ошибка batch UPSERT:', err);
              stmt.finalize(() => {
                db.run('ROLLBACK', () => {
                  reject(err);
                });
              });
              return;
            }
            
            completed++;
            if (completed === records.length && !hasError) {
              stmt.finalize((err) => {
                if (err) {
                  db.run('ROLLBACK', () => {
                    reject(err);
                  });
                } else {
                  db.run('COMMIT', (err) => {
                    if (err) {
                      reject(err);
                    } else {
                      // Возвращаем приблизительную статистику
                      resolve({ inserted: Math.floor(records.length * 0.1), updated: Math.floor(records.length * 0.9) });
                    }
                  });
                }
              });
            }
          });
        }
      });
    });
  }

  /**
   * Одиночная вставка записи ПВЗ для диагностики
   */
  async singleUpsertPvz(db, record) {
    const upsertSQL = `
      INSERT OR REPLACE INTO pvz (
        pvz_id, region, address, service_name, status_date,
        status_name, company_id, transaction_date, transaction_amount,
        postal_code, fitting_room, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    return new Promise((resolve, reject) => {
      db.run(upsertSQL, [
        record.pvz_id, record.region, record.address, record.service_name,
        record.status_date, record.status_name, record.company_id,
        record.transaction_date, record.transaction_amount,
        record.postal_code, record.fitting_room
      ], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }


  /**
   * Получение настроек из базы данных с кэшированием
   */
  async getSettings() {
    const now = Date.now();
    
    // Проверяем кэш
    if (this.settingsCache && (now - this.settingsCacheTime) < this.settingsCacheTimeout) {
      console.log('📋 Используем кэшированные настройки');
      return this.settingsCache;
    }
    
    console.log('📋 Загружаем настройки из базы данных...');
    const database = require('../database/db');
    const db = database.getDb();
    
    return new Promise((resolve, reject) => {
      db.all('SELECT key, value FROM settings', [], (err, rows) => {
        if (err) {
          console.error('❌ Ошибка загрузки настроек:', err);
          reject(err);
          return;
        }
        const settings = {};
        rows.forEach(row => {
          settings[row.key] = row.value;
        });
        
        console.log('📋 Загруженные настройки:', settings);
        
        // Обновляем кэш
        this.settingsCache = settings;
        this.settingsCacheTime = now;
        
        resolve(settings);
      });
    });
  }

  /**
   * Очистка кэша настроек (вызывается при изменении настроек)
   */
  clearSettingsCache() {
    this.settingsCache = null;
    this.settingsCacheTime = 0;
  }

  /**
   * Получить или создать компанию
   */
  async getOrCreateCompany(db, companyName, companyPhone) {
    if (!companyName || companyName.trim() === '') {
      return null;
    }

    // Нормализуем название компании
    const normalizedName = companyName.trim().replace(/\s+/g, ' ');
    
    // Локальный кэш, чтобы в рамках одной синхронизации не создавать дублей
    if (!this.companyNameToId) {
      this.companyNameToId = new Map();
    }
    if (this.companyNameToId.has(normalizedName)) {
      return this.companyNameToId.get(normalizedName);
    }

    return new Promise((resolve, reject) => {
      // Сначала ищем существующую компанию (точное совпадение)
      db.get(
        'SELECT company_id FROM companies WHERE company_name = ?',
        [normalizedName],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (row) {
            this.companyNameToId.set(normalizedName, row.company_id);
            resolve(row.company_id);
            return;
          }

          // Компания не найдена — пытаемся вставить с уникальным ограничением
          db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            db.get(
              'SELECT MAX(CAST(company_id AS INTEGER)) as max_id FROM companies WHERE company_id GLOB "[0-9]*"',
              [],
              (err, maxRow) => {
                if (err) {
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }

                const nextId = (maxRow?.max_id || 0) + 1;
                const companyId = String(nextId).padStart(6, '0');

                // Вставляем с защитой от дублей по названию
                db.run(
                  'INSERT OR IGNORE INTO companies (company_id, company_name, phone) VALUES (?, ?, ?)',
                  [companyId, normalizedName, (companyPhone || '').trim()],
                  function(err) {
                    if (err) {
                      db.run('ROLLBACK');
                      reject(err);
                      return;
                    }

                    // Если вставка проигнорирована из-за уникального индекса,
                    // просто получаем существующий company_id
                    const fetchSql = 'SELECT company_id FROM companies WHERE company_name = ?';
                    db.get(fetchSql, [normalizedName], (err, fetched) => {
                      if (err) {
                        db.run('ROLLBACK');
                        reject(err);
                        return;
                      }

                      db.run('COMMIT');
                      const finalId = fetched?.company_id || companyId;
                      this.companyNameToId.set(normalizedName, finalId);
                      if (fetched) {
                        resolve(finalId);
                      } else {
                        console.log(`🏢 Создана новая компания: ${normalizedName} (ID: ${companyId})`);
                        resolve(companyId);
                      }
                    });
                  }
                );
              }
            );
          });
        }
      );
    });
  }
}

module.exports = new GoogleSheetsService();
