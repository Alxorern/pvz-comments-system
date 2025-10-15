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
  async checkExistingToken() {
    const currentPath = window.location.pathname;
    
    try {
      // Не показываем сообщение о проверке аутентификации на странице логина
      if (currentPath !== '/' && currentPath !== '/index.html') {
        console.log('🔑 Проверяем аутентификацию через httpOnly cookie...');
      }
      
      const authResult = await window.secureApiClient.checkAuth();
      if (authResult.success) {
        console.log('✅ Пользователь аутентифицирован');
        // Перенаправляем на главную страницу только если мы на странице входа
        if (currentPath === '/' || currentPath === '/index.html') {
          window.location.href = '/main';
        }
      } else {
        // Не показываем сообщение о неаутентификации на странице логина
        if (currentPath !== '/' && currentPath !== '/index.html') {
          console.log('❌ Пользователь не аутентифицирован');
        }
      }
    } catch (error) {
      console.error('❌ Ошибка проверки аутентификации:', error);
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
      const result = await window.secureApiClient.login(login, password);

      if (result.success) {
        this.setStatus('Успешный вход!');
        // Перенаправляем на главную страницу или на страницу, с которой пришли
        const returnUrl = new URLSearchParams(window.location.search).get('return') || '/main';
        window.location.href = returnUrl;
      } else {
        this.setStatus(result.error || 'Ошибка входа', true);
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
        credentials: 'include'
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
    // Больше не используем localStorage для токенов
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
  async getCurrentUser() {
    const authResult = await window.secureApiClient.checkAuth();
    return authResult.success ? authResult.user : null;
  }

  /**
   * Проверка роли пользователя
   */
  async hasRole(role) {
    const user = await this.getCurrentUser();
    return user && user.role === role;
  }

  /**
   * Проверка аутентификации
   */
  async isAuthenticated() {
    const authResult = await window.secureApiClient.checkAuth();
    return authResult.success;
  }

  /**
   * Получение информации о пользователе с сервера
   */
  async getUserInfo() {
    try {
      const authResult = await window.secureApiClient.checkAuth();
      if (authResult.success) {
        return authResult.user;
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
