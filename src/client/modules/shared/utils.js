/**
 * Общие утилиты для клиентской части
 */

/**
 * Форматирует дату для отображения
 */
function formatDate(dateString, options = {}) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const defaultOptions = {
    showTime: true,
    locale: 'ru-RU'
  };
  
  const config = { ...defaultOptions, ...options };
  
  if (config.showTime) {
    return date.toLocaleString(config.locale);
  } else {
    return date.toLocaleDateString(config.locale);
  }
}

/**
 * Форматирует число с заданным количеством знаков после запятой
 */
function formatNumber(number, decimals = 2) {
  if (number === null || number === undefined || isNaN(number)) return '';
  return parseFloat(number).toFixed(decimals);
}

/**
 * Дебаунс функции (задержка выполнения)
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Показывает уведомление пользователю
 */
function showNotification(message, type = 'info', duration = 3000) {
  // Создаем элемент уведомления
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // Добавляем на страницу
  document.body.appendChild(notification);
  
  // Анимация появления
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Удаляем через заданное время
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, duration);
}

/**
 * Валидация email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Генерирует уникальный ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Экранирует HTML символы
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Инициализация информации о пользователе в боковой панели
 */
function initializeUserInfo() {
  const user = authModule.getCurrentUser();
  if (user) {
    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl) {
      const userNameEl = userInfoEl.querySelector('.user-name');
      const userRoleEl = userInfoEl.querySelector('.user-role');
      
      if (userNameEl) userNameEl.textContent = user.full_name || user.login;
      if (userRoleEl) userRoleEl.textContent = user.role || '';
    }
  }
}

/**
 * Инициализация кнопки выхода (устарело - теперь используется в navigation.js)
 */
function initializeLogoutButton() {
  // Кнопка выхода теперь настраивается в модуле навигации
  console.log('ℹ️ Кнопка выхода настраивается в модуле навигации');
}

/**
 * Проверяет аутентификацию и перенаправляет на логин при необходимости
 */
function checkAuthentication() {
  const token = localStorage.getItem('authToken');
  if (!token) {
    // Сохраняем текущую страницу для возврата после логина
    const currentPath = window.location.pathname;
    const returnUrl = encodeURIComponent(currentPath);
    window.location.href = `/login?return=${returnUrl}`;
    return false;
  }
  return true;
}

/**
 * Полная инициализация боковой панели
 */
function initializeSidebar() {
  initializeUserInfo();
  initializeLogoutButton();
}

// Экспортируем утилиты в глобальную область
window.utils = {
  formatDate,
  formatNumber,
  debounce,
  showNotification,
  isValidEmail,
  generateId,
  escapeHtml,
  initializeUserInfo,
  initializeLogoutButton,
  initializeSidebar,
  checkAuthentication
};
