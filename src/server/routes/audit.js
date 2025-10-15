const express = require('express');
const router = express.Router();
const AuditService = require('../services/auditService');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');

// GET /api/audit - Получить логи аудита
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId,
      action: req.query.action,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo
    };
    
    const logs = await AuditService.getAuditLogs(filters);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('❌ Ошибка получения логов аудита:', error);
    res.status(500).json({ error: 'Ошибка получения логов аудита' });
  }
});

// GET /api/audit/stats - Получить статистику безопасности
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await AuditService.getSecurityStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('❌ Ошибка получения статистики безопасности:', error);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

module.exports = router;
