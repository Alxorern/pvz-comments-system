const database = require('../database/db');
const winston = require('winston');

// Настройка логгера
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'audit.log' }),
    new winston.transports.Console()
  ]
});

class AuditService {
  static async logAction(req, action, resourceType = null, resourceId = null) {
    try {
      const db = database.getDb();
      const userId = req.user?.id || null;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent') || 'Unknown';
      
      // Логируем в базу данных
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO audit_log (user_id, action, resource_type, resource_id, ip_address, user_agent, timestamp) 
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [userId, action, resourceType, resourceId, ipAddress, userAgent],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      // Логируем в файл
      auditLogger.info('User Action', {
        userId,
        action,
        resourceType,
        resourceId,
        ipAddress,
        userAgent,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Ошибка логирования аудита:', error);
    }
  }
  
  static async getAuditLogs(filters = {}) {
    try {
      const db = database.getDb();
      let query = `
        SELECT al.*, u.login, u.full_name 
        FROM audit_log al 
        LEFT JOIN users u ON al.user_id = u.user_id 
        WHERE 1=1
      `;
      const params = [];
      
      if (filters.userId) {
        query += ' AND al.user_id = ?';
        params.push(filters.userId);
      }
      
      if (filters.action) {
        query += ' AND al.action = ?';
        params.push(filters.action);
      }
      
      if (filters.dateFrom) {
        query += ' AND al.timestamp >= ?';
        params.push(filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query += ' AND al.timestamp <= ?';
        params.push(filters.dateTo);
      }
      
      query += ' ORDER BY al.timestamp DESC LIMIT 1000';
      
      return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
    } catch (error) {
      console.error('❌ Ошибка получения логов аудита:', error);
      throw error;
    }
  }
  
  static async getSecurityStats() {
    try {
      const db = database.getDb();
      
      const stats = await new Promise((resolve, reject) => {
        db.get(`
          SELECT 
            COUNT(*) as total_requests,
            COUNT(CASE WHEN action = 'LOGIN_FAILED' THEN 1 END) as failed_logins,
            COUNT(CASE WHEN action = 'UNAUTHORIZED_ACCESS' THEN 1 END) as unauthorized_access,
            COUNT(DISTINCT ip_address) as unique_ips
          FROM audit_log 
          WHERE timestamp >= datetime('now', '-1 day')
        `, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      return stats;
    } catch (error) {
      console.error('❌ Ошибка получения статистики безопасности:', error);
      throw error;
    }
  }
}

module.exports = AuditService;
