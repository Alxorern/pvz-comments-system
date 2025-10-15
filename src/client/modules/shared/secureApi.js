/**
 * Безопасный API клиент без localStorage
 * Использует httpOnly cookies для аутентификации
 */
class SecureApiClient {
  constructor() {
    this.baseURL = '';
    this.isAuthenticatedFlag = null;
  }

  /**
   * Проверяет аутентификацию через API
   */
  async checkAuth() {
    try {
      const response = await fetch('/api/auth/user-info', {
        method: 'GET',
        credentials: 'include', // Важно для cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.isAuthenticatedFlag = true;
        return { success: true, user: data };
      } else if (response.status === 401) {
        // 401 - это нормальное поведение для неаутентифицированных пользователей
        this.isAuthenticatedFlag = false;
        return { success: false, error: 'Not authenticated' };
      } else {
        // Другие ошибки - это реальные проблемы
        console.error('❌ Ошибка проверки аутентификации:', response.status, response.statusText);
        this.isAuthenticatedFlag = false;
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      console.error('❌ Ошибка проверки аутентификации:', error);
      this.isAuthenticatedFlag = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Проверяет, аутентифицирован ли пользователь
   */
  isAuthenticated() {
    return this.isAuthenticatedFlag === true;
  }

  /**
   * Перенаправляет на страницу входа если не аутентифицирован
   */
  async checkAuthAndRedirect() {
    const authResult = await this.checkAuth();
    if (!authResult.success) {
      window.location.href = '/';
      return false;
    }
    return true;
  }

  /**
   * Выполняет аутентификацию
   */
  async login(login, password) {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        credentials: 'include', // Важно для cookies
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ login, password })
      });

      const data = await response.json();
      
      if (response.ok) {
        this.isAuthenticatedFlag = true;
        return { success: true, user: data.user };
      } else {
        this.isAuthenticatedFlag = false;
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('❌ Ошибка входа:', error);
      this.isAuthenticatedFlag = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Выход из системы
   */
  async logout() {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include', // Важно для cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });

      this.isAuthenticatedFlag = false;
      
      if (response.ok) {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('❌ Ошибка выхода:', error);
      // Все равно перенаправляем на страницу входа
      window.location.href = '/';
    }
  }

  /**
   * Выполняет GET запрос
   */
  async get(url) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include', // Важно для cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data; // Возвращаем данные как есть (может быть { success: true, user: {...} } или просто данные)
    } catch (error) {
      console.error('❌ API GET error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Выполняет POST запрос
   */
  async post(url, data) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include', // Важно для cookies
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        // Пытаемся получить детали ошибки от сервера
        let errorDetails = null;
        try {
          errorDetails = await response.json();
        } catch (e) {
          // Если не удалось распарсить JSON, используем текст
          errorDetails = { error: `HTTP ${response.status}` };
        }
        console.error('❌ Server error response:', errorDetails);
        if (errorDetails.details) {
          console.error('❌ Validation details:', errorDetails.details);
        }
        throw new Error(`HTTP error! status: ${response.status}`, { cause: errorDetails });
      }

      const result = await response.json();
      return result; // Возвращаем данные напрямую, как в старом API
    } catch (error) {
      console.error('❌ API POST error:', error);
      if (error.cause) {
        return { success: false, error: error.message, details: error.cause };
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Выполняет PUT запрос
   */
  async put(url, data) {
    try {
      const response = await fetch(url, {
        method: 'PUT',
        credentials: 'include', // Важно для cookies
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result; // Возвращаем данные напрямую, как в старом API
    } catch (error) {
      console.error('❌ API PUT error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Выполняет DELETE запрос
   */
  async delete(url) {
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include', // Важно для cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result; // Возвращаем данные напрямую, как в старом API
    } catch (error) {
      console.error('❌ API DELETE error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Создаем глобальный экземпляр
window.secureApiClient = new SecureApiClient();
