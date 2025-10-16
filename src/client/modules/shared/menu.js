// Модуль для управления меню в зависимости от роли пользователя
class MenuManager {
    constructor() {
        this.api = window.secureApiClient;
        this.menuItems = {
            'pvz': { url: '/pvz', text: 'Список ПВЗ', icon: '📦' },
            'analytics': { url: '/analytics', text: 'Аналитика', icon: '📊' },
            'companies': { url: '/companies', text: 'Компании', icon: '🏢' },
            'users': { url: '/users', text: 'Пользователи', icon: '👥' },
            'roles': { url: '/roles', text: 'Роли', icon: '🔐' },
            'settings': { url: '/settings', text: 'Настройки', icon: '⚙️' }
        };
    }

    async init() {
        try {
            console.log('🔧 Инициализация меню...');
            
            // Получаем информацию о пользователе с доступными пунктами меню
            const response = await this.api.get('/api/auth/user-info');
            
            if (response && response.success && response.user) {
                // API возвращает { success: true, user: {...} }
                const user = response.user;
                console.log('👤 Пользователь:', user.login, 'Роль:', user.role);
                
                // Обновляем информацию о пользователе
                this.updateUserInfo(user);
                
                // Обновляем меню на основе доступных пунктов
                if (response.menuItems && Array.isArray(response.menuItems)) {
                    console.log('📋 Доступные пункты меню:', response.menuItems);
                    this.updateMenu(response.menuItems);
                } else {
                    console.log('📋 Используем fallback - показываем все пункты меню');
                    this.showAllMenuItems();
                }
            } else {
                console.warn('⚠️ Пользователь не аутентифицирован');
                this.showAllMenuItems(); // Fallback - показываем все пункты
            }
            
        } catch (error) {
            console.error('❌ Ошибка инициализации меню:', error);
            this.showAllMenuItems(); // Fallback - показываем все пункты
        }
    }

    updateMenu(availableItems) {
        console.log('🔄 Обновление меню с пунктами:', availableItems);
        
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
                    console.log('✅ Показываем пункт меню:', href);
                } else {
                    menuItem.style.display = 'none';
                    console.log('❌ Скрываем пункт меню:', href);
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
        
        // Уведомляем NavigationModule об изменении роли
        if (window.navigationModule && window.navigationModule.updateUserRole) {
            window.navigationModule.updateUserRole(user.role);
        }
    }

    /**
     * Обновляет информацию о пользователе из localStorage
     */
    updateUserInfoFromStorage() {
        // Больше не используем localStorage для аутентификации
        // Данные пользователя получаем через API с httpOnly cookies
        console.log('🔒 Аутентификация через httpOnly cookies, localStorage не используется');
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
