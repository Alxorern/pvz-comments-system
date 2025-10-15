// Модуль для управления меню в зависимости от роли пользователя
class MenuManager {
    constructor() {
        this.api = new ApiClient();
        this.menuItems = {
            'pvz': { url: '/pvz', text: 'Список ПВЗ', icon: '📦' },
            'companies': { url: '/companies', text: 'Компании', icon: '🏢' },
            'users': { url: '/users', text: 'Пользователи', icon: '👥' },
            'roles': { url: '/roles', text: 'Роли', icon: '🔐' },
            'settings': { url: '/settings', text: 'Настройки', icon: '⚙️' }
        };
    }

    async init() {
        try {
            console.log('🔧 Инициализация меню...');
            
            // Сначала обновляем информацию о пользователе из localStorage
            this.updateUserInfoFromStorage();
            
            // Получаем информацию о пользователе с доступными пунктами меню
            const response = await this.api.get('/api/auth/user-info');
            
            if (response && response.login) {
                // API возвращает данные напрямую
                const user = response;
                console.log('👤 Пользователь:', user.login, 'Роль:', user.role);
                
                // Обновляем информацию о пользователе
                this.updateUserInfo(user);
                
                // Показываем все пункты меню (пока нет системы ролей)
                this.showAllMenuItems();
            } else {
                console.warn('⚠️ Не удалось получить информацию о пользователе через API, используем localStorage');
                // Fallback - получаем данные из localStorage
                const userData = localStorage.getItem('user');
                if (userData) {
                    const user = JSON.parse(userData);
                    console.log('👤 Пользователь из localStorage:', user.login);
                    this.updateUserInfo(user);
                }
                this.showAllMenuItems(); // Fallback - показываем все пункты
            }
            
        } catch (error) {
            console.error('❌ Ошибка инициализации меню:', error);
            // Fallback - получаем данные из localStorage
            const userData = localStorage.getItem('user');
            if (userData) {
                const user = JSON.parse(userData);
                console.log('👤 Пользователь из localStorage (fallback):', user.login);
                this.updateUserInfo(user);
            }
            this.showAllMenuItems(); // Fallback - показываем все пункты
        }
    }

    updateMenu(availableItems) {
        // Находим контейнеры навигации
        const navContainers = document.querySelectorAll('.sidebar-nav, .nav');
        
        navContainers.forEach(container => {
            // Получаем все пункты меню (кнопка выхода теперь в sidebar-bottom)
            const allMenuItems = container.querySelectorAll('.nav-item');
            
            // Скрываем/показываем пункты в зависимости от доступности
            allMenuItems.forEach(menuItem => {
                const href = menuItem.getAttribute('href');
                const isAvailable = availableItems.some(itemKey => {
                    const item = this.menuItems[itemKey];
                    return item && item.url === href;
                });
                
                if (isAvailable) {
                    menuItem.style.display = '';
                } else {
                    menuItem.style.display = 'none';
                }
            });
        });
    }

    updateUserInfo(user) {
        // Обновляем информацию о пользователе в интерфейсе
        const userInfoElements = document.querySelectorAll('#userInfo, .user-info');
        userInfoElements.forEach(element => {
            const userNameEl = element.querySelector('.user-name');
            const userRoleEl = element.querySelector('.user-role');
            
            if (userNameEl) {
                // Показываем login в первой строке
                userNameEl.textContent = user.login || 'Неизвестный пользователь';
            }
            if (userRoleEl) {
                // Показываем full_name во второй строке
                userRoleEl.textContent = user.full_name || 'Имя не указано';
            }
        });
        
        // НЕ сохраняем в localStorage - это делает auth.js
    }

    /**
     * Обновляет информацию о пользователе из localStorage
     */
    updateUserInfoFromStorage() {
        const userData = localStorage.getItem('user');
        if (userData) {
            const user = JSON.parse(userData);
            console.log('👤 Обновляем информацию о пользователе из localStorage:', user.login);
            this.updateUserInfo(user);
        } else {
            console.warn('⚠️ Данные пользователя не найдены в localStorage');
        }
    }

    showAllMenuItems() {
        // Fallback - показываем все пункты меню
        console.log('🔄 Показываем все пункты меню (fallback)');
        const navContainers = document.querySelectorAll('.sidebar-nav, .nav');
        
        navContainers.forEach(container => {
            const allMenuItems = container.querySelectorAll('.nav-item:not(#btnLogout)');
            allMenuItems.forEach(menuItem => {
                menuItem.style.display = '';
            });
        });
    }

    // Метод для обновления меню на конкретной странице
    static async initForPage() {
        const menuManager = new MenuManager();
        await menuManager.init();
        return menuManager;
    }
}

// Экспортируем для использования в других модулях
window.MenuManager = MenuManager;
