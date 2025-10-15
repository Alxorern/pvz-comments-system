/**
 * Модуль для управления навигацией в зависимости от ролей пользователя
 */
class NavigationModule {
  constructor() {
    this.userRole = null;
  }

  /**
   * Инициализация модуля навигации
   */
  async init() {
    try {
      // Получаем информацию о пользователе через secureApiClient
      if (window.secureApiClient) {
        const response = await window.secureApiClient.get('/api/auth/user-info');
        if (response && response.success && response.user) {
          this.userRole = response.user.role;
          this.updateNavigation();
        }
      } else {
        console.log('⚠️ secureApiClient не найден, пропускаем инициализацию навигации');
      }
    } catch (error) {
      console.error('❌ Ошибка инициализации навигации:', error);
    }
  }

  /**
   * Обновляет роль пользователя и перерисовывает навигацию
   */
  updateUserRole(role) {
    this.userRole = role;
    this.updateNavigation();
  }

  /**
   * Обновление навигации в зависимости от роли пользователя
   */
  updateNavigation() {
    console.log('🔄 Обновление навигации для роли:', this.userRole);
    
    // Обрабатываем только элементы навигации в .nav, исключая кнопку выхода
    const navItems = document.querySelectorAll('.nav .nav-item');
    console.log('📋 Найдено элементов навигации:', navItems.length);
    
    navItems.forEach(item => {
      const href = item.getAttribute('href');
      const shouldShow = this.shouldShowNavItem(href);
      console.log(`🔍 ${href}: ${shouldShow ? 'показать' : 'скрыть'}`);
      
      if (shouldShow) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });

    // Обновляем информацию о пользователе в навигации
    this.updateUserInfo();
    
    // Настраиваем кнопку выхода для всех ролей
    this.setupLogoutButton();
  }

  /**
   * Определяет, должен ли показываться пункт навигации
   */
  shouldShowNavItem(href) {
    if (!this.userRole) return false;

    // Администратор видит все пункты
    if (this.userRole === 'admin') {
      return true;
    }

    // Обычные пользователи видят только "Список ПВЗ"
    const allowedPaths = ['/pvz'];
    return allowedPaths.some(path => href && href.includes(path));
  }

  /**
   * Обновляет информацию о пользователе в навигации
   * УДАЛЕНО - теперь управляется через MenuManager
   */
  updateUserInfo() {
    // Информация о пользователе теперь управляется через MenuManager
    // Этот метод оставлен для совместимости, но не выполняет никаких действий
  }

  /**
   * Проверяет, является ли пользователь администратором
   */
  isAdmin() {
    return this.userRole === 'admin';
  }

  /**
   * Получает роль пользователя
   */
  getUserRole() {
    return this.userRole;
  }

  /**
   * Настраивает кнопку выхода для всех ролей
   */
  setupLogoutButton() {
    const btnLogout = document.getElementById('btnLogout');
    console.log('🔧 Настройка кнопки выхода:', btnLogout);
    
    if (btnLogout) {
      // Убеждаемся, что кнопка выхода всегда видна
      btnLogout.style.display = '';
      console.log('✅ Кнопка выхода найдена и сделана видимой');
      
      // Удаляем старые обработчики
      btnLogout.replaceWith(btnLogout.cloneNode(true));
      const newBtnLogout = document.getElementById('btnLogout');
      
      // Снова убеждаемся, что кнопка видна
      newBtnLogout.style.display = '';
      
      newBtnLogout.addEventListener('click', () => {
        console.log('🖱️ Клик по кнопке выхода');
        this.showLogoutConfirmation();
      });
      
      console.log('✅ Обработчик кнопки выхода установлен');
    } else {
      console.error('❌ Кнопка выхода не найдена!');
    }
  }

  /**
   * Показывает подтверждение выхода
   */
  showLogoutConfirmation() {
    // Создаем модальное окно подтверждения
    const modal = document.createElement('div');
    modal.className = 'logout-modal';
    modal.innerHTML = `
      <div class="logout-modal-content">
        <div class="logout-modal-header">
          <h3>Подтверждение выхода</h3>
        </div>
        <div class="logout-modal-body">
          <p>Вы уверены, что хотите выйти из системы?</p>
        </div>
        <div class="logout-modal-footer">
          <button class="btn btn-secondary" id="cancelLogout">Отмена</button>
          <button class="btn btn-primary" id="confirmLogout">Выйти</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Показываем модальное окно
    setTimeout(() => {
      modal.classList.add('show');
    }, 10);
    
    // Обработчики кнопок
    document.getElementById('cancelLogout').addEventListener('click', () => {
      this.hideLogoutConfirmation(modal);
    });
    
    document.getElementById('confirmLogout').addEventListener('click', () => {
      if (window.authModule) {
        window.authModule.logout();
      }
    });
    
    // Закрытие по клику вне модального окна
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideLogoutConfirmation(modal);
      }
    });
  }

  /**
   * Скрывает модальное окно подтверждения выхода
   */
  hideLogoutConfirmation(modal) {
    modal.classList.remove('show');
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, 300);
  }
}

// Создаем глобальный экземпляр модуля навигации
window.navigationModule = new NavigationModule();
