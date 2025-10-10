/**
 * API клиент для работы с сервером
 */
class ApiClient {
  constructor() {
    this.baseUrl = '';
    this.initializeTokenFromUrl();
  }

  /**
   * Инициализирует токен из URL параметров
   */
  initializeTokenFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token && !this.getAuthToken()) {
      console.log('🔑 Сохраняем токен из URL в localStorage');
      localStorage.setItem('authToken', token);
      
      // Очищаем URL от токена
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }

  /**
   * Получает токен аутентификации из localStorage
   */
  getAuthToken() {
    return localStorage.getItem('authToken');
  }

  /**
   * Формирует заголовки с токеном аутентификации
   */
  getAuthHeaders() {
    const token = this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Проверяет аутентификацию и перенаправляет на логин при необходимости
   */
  checkAuthAndRedirect() {
    const token = this.getAuthToken();
    const currentPath = window.location.pathname;
    
    if (!token) {
      // Перенаправляем только если мы не на странице входа
      if (currentPath !== '/' && currentPath !== '/index.html') {
        const returnUrl = encodeURIComponent(currentPath);
        window.location.href = `/?return=${returnUrl}`;
      }
      return false;
    }
    
    return true;
  }

  /**
   * Обрабатывает ошибки аутентификации
   */
  handleAuthError(response) {
    const currentPath = window.location.pathname;
    
    if (response.status === 401 || response.status === 403) {
      // Токен невалиден или истек
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      
      // Перенаправляем только если мы не на странице входа
      if (currentPath !== '/' && currentPath !== '/index.html') {
        const returnUrl = encodeURIComponent(currentPath);
        window.location.href = `/?return=${returnUrl}`;
      }
      return true;
    }
    return false;
  }

  /**
   * Выполняет GET запрос
   */
  async get(endpoint) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });


      if (this.handleAuthError(response)) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 API GET данные:', data);
      return data;
    } catch (error) {
      console.error('API GET error:', error);
      return null;
    }
  }

  /**
   * Выполняет POST запрос
   */
  async post(endpoint, data) {
    try {
      console.log('🔄 API POST запрос:', {
        endpoint: endpoint,
        data: data,
        dataStringified: JSON.stringify(data)
      });

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data)
      });

      console.log('📡 API POST ответ:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });

      if (this.handleAuthError(response)) {
        return null;
      }

      if (!response.ok) {
        // Попробуем получить текст ошибки от сервера
        let errorText = '';
        try {
          errorText = await response.text();
          console.error('❌ Текст ошибки сервера:', errorText);
        } catch (e) {
          console.error('❌ Не удалось получить текст ошибки');
        }
        throw new Error(`HTTP error! status: ${response.status}, text: ${errorText}`);
      }

      return response.json(); // Return parsed JSON data
    } catch (error) {
      console.error('API POST error:', error);
      return null;
    }
  }

  /**
   * Выполняет PUT запрос
   */
  async put(endpoint, data) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data)
      });

      if (this.handleAuthError(response)) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json(); // Return parsed JSON data
    } catch (error) {
      console.error('API PUT error:', error);
      return null;
    }
  }

  /**
   * Выполняет DELETE запрос
   */
  async delete(endpoint) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (this.handleAuthError(response)) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error('API DELETE error:', error);
      return null;
    }
  }
}

// Экспортируем синглтон
window.apiClient = new ApiClient();
