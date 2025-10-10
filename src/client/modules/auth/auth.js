/**
 * Модуль аутентификации для клиентской части
 */
class AuthModule {
  constructor() {
    this.isLoginInProgress = false;
  }

  /**
   * Инициализация модуля аутентификации
   */
  init() {
    this.setupEventListeners();
    this.checkExistingToken();
  }

  /**
   * Настройка обработчиков событий
   */
  setupEventListeners() {
    const btnLogin = document.getElementById('btnLogin');
    if (btnLogin) {
      btnLogin.addEventListener('click', () => this.handleLogin());
    }

    // Поддержка Enter для входа
    const loginForm = document.querySelector('.login-form');
    if (loginForm) {
      loginForm.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !this.isLoginInProgress) {
          this.handleLogin();
        }
      });
    }
  }

  /**
   * Проверка существующего токена при загрузке страницы
   */
  checkExistingToken() {
    const token = localStorage.getItem('authToken');
    const currentPath = window.location.pathname;
    
    if (token) {
        // Проверяем валидность токена через простой API endpoint
        fetch('/api/auth/verify', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      .then(response => {
        if (response.ok) {
          // Токен валиден, перенаправляем на операции только если мы на странице входа
          if (currentPath === '/' || currentPath === '/index.html') {
            window.location.href = '/main?token=' + encodeURIComponent(token);
          }
          // Если мы уже на другой странице, не перенаправляем
        } else {
          // Токен невалиден, очищаем его
          this.clearAuthData();
        }
      })
      .catch((error) => {
        // Ошибка сети, очищаем токен
        this.clearAuthData();
      });
    }
  }

  /**
   * Обработка входа в систему
   */
  async handleLogin() {
    if (this.isLoginInProgress) return;

    const loginInput = document.getElementById('login');
    const passwordInput = document.getElementById('password');
    const btnLogin = document.getElementById('btnLogin');

    if (!loginInput || !passwordInput) {
      this.setStatus('Поля ввода не найдены', true);
      return;
    }

    const login = loginInput.value.trim();
    const password = passwordInput.value.trim();

    if (!login || !password) {
      this.setStatus('Заполните все поля', true);
      return;
    }

    this.isLoginInProgress = true;
    if (btnLogin) btnLogin.disabled = true;
    this.setStatus('Вход в систему...');

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ login, password })
      });

      const data = await response.json();

      if (data.success) {
        // Сохраняем токен в localStorage
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        this.setStatus('Успешный вход!');
        // Перенаправляем на главную страницу или на страницу, с которой пришли
        const returnUrl = new URLSearchParams(window.location.search).get('return') || '/main';
        window.location.href = returnUrl + '?token=' + encodeURIComponent(data.token);
      } else {
        this.setStatus(data.error || 'Ошибка входа', true);
        if (btnLogin) btnLogin.disabled = false;
        this.isLoginInProgress = false;
      }
    } catch (error) {
      this.setStatus('Ошибка соединения', true);
      if (btnLogin) btnLogin.disabled = false;
      this.isLoginInProgress = false;
    }
  }

  /**
   * Выход из системы
   */
  async logout() {
    try {
      // Вызываем API logout
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: apiClient.getAuthHeaders()
      });
    } catch (error) {
      console.log('Ошибка при выходе из системы:', error);
    }
    
    this.clearAuthData();
    
    // Принудительно перезагружаем страницу на логин
    window.location.replace('/');
  }

  /**
   * Очистка данных аутентификации
   */
  clearAuthData() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    sessionStorage.clear();
  }

  /**
   * Установка статуса на странице входа
   */
  setStatus(message, isError = false) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = isError ? 'status error show' : 'status show';
    }
  }

  /**
   * Получение данных текущего пользователя
   */
  getCurrentUser() {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  }

  /**
   * Проверка роли пользователя
   */
  hasRole(role) {
    const user = this.getCurrentUser();
    return user && user.role === role;
  }

  /**
   * Проверка аутентификации
   */
  isAuthenticated() {
    return !!localStorage.getItem('authToken');
  }

  /**
   * Получение информации о пользователе с сервера
   */
  async getUserInfo() {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return null;

      const response = await fetch('/api/auth/user-info', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userInfo = await response.json();
        localStorage.setItem('userInfo', JSON.stringify(userInfo));
        return userInfo;
      } else {
        console.error('Ошибка получения информации о пользователе');
        return null;
      }
    } catch (error) {
      console.error('Ошибка получения информации о пользователе:', error);
      return null;
    }
  }
}

// Создаем глобальный экземпляр модуля аутентификации
window.authModule = new AuthModule();
