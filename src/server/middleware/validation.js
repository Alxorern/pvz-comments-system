const Joi = require('joi');
const { validationResult } = require('express-validator');

// Схемы валидации
const schemas = {
  user: Joi.object({
    full_name: Joi.string().min(2).max(100).required(),
    login: Joi.string().alphanum().min(3).max(50).required(),
    password: Joi.string().min(6).required(), // Пароль обязателен при создании
    role: Joi.string().min(1).max(50).required(), // Любая строка, не только admin/superuser/user
    company_id: Joi.string().allow(null).optional() // Разрешаем company_id
  }),
  
  userUpdate: Joi.object({
    full_name: Joi.string().min(2).max(100).required(),
    login: Joi.string().alphanum().min(3).max(50).required(),
    password: Joi.string().min(6).optional(), // Пароль не обязателен при редактировании
    role: Joi.string().min(1).max(50).required(), // Любая строка, не только admin/superuser/user
    company_id: Joi.string().allow(null).optional() // Разрешаем company_id
  }),
  
  company: Joi.object({
    company_id: Joi.string().min(1).max(50).required(),
    company_name: Joi.string().min(2).max(200).required(),
    phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).optional()
  }),
  
  role: Joi.object({
    name: Joi.string().min(2).max(50).required(),
    description: Joi.string().max(500).optional(),
    regions: Joi.array().items(Joi.string()).optional(),
    is_active: Joi.boolean().optional()
  }),
  
  auth: Joi.object({
    login: Joi.string().alphanum().min(3).max(50).required(),
    password: Joi.string().min(1).required()
  }),
  
  comment: Joi.object({
    comment: Joi.string().min(1).max(1000).required(),
    pvz_id: Joi.string().required()
  })
};

// Middleware для валидации
function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      console.error('❌ Ошибка валидации:', {
        body: req.body,
        errors: error.details.map(detail => detail.message)
      });
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
}

// Middleware для проверки результатов валидации
function checkValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation error',
      details: errors.array()
    });
  }
  next();
}

// Middleware для санитизации XSS
function sanitizeInput(req, res, next) {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        req.body[key] = req.body[key].replace(/javascript:/gi, '');
        req.body[key] = req.body[key].replace(/on\w+\s*=/gi, '');
      }
    }
  }
  next();
}

module.exports = {
  schemas,
  validate,
  checkValidationErrors,
  sanitizeInput
};
