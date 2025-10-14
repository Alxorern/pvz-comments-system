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
            
            // Получаем информацию о пользователе с доступными пунктами меню
            const response = await this.api.get('/api/auth/user-info');
            
            if (response.success && response.user) {
                const user = response.user;
                console.log('👤 Пользователь:', user.login, 'Роль:', user.roleName);
                console.log('📋 Доступные пункты меню:', user.menuItems);
                
                this.updateMenu(user.menuItems);
                this.updateUserInfo(user);
            } else {
                console.warn('⚠️ Не удалось получить информацию о пользователе');
                this.showAllMenuItems(); // Fallback - показываем все пункты
            }
            
        } catch (error) {
            console.error('❌ Ошибка инициализации меню:', error);
            this.showAllMenuItems(); // Fallback - показываем все пункты
        }
    }

    updateMenu(availableItems) {
        // Находим контейнеры навигации
        const navContainers = document.querySelectorAll('.sidebar-nav, .nav');
        
        navContainers.forEach(container => {
            // Очищаем контейнер
            container.innerHTML = '';
            
            // Добавляем доступные пункты меню
            availableItems.forEach(itemKey => {
                const item = this.menuItems[itemKey];
                if (item) {
                    const navItem = document.createElement('a');
                    navItem.href = item.url;
                    navItem.className = 'nav-item';
                    
                    // Проверяем, является ли текущая страница активной
                    if (window.location.pathname === item.url) {
                        navItem.classList.add('active');
                    }
                    
                    navItem.innerHTML = `
                        <span class="nav-icon">${item.icon}</span>
                        <span class="nav-text">${item.text}</span>
                    `;
                    
                    container.appendChild(navItem);
                }
            });
        });
    }

    updateUserInfo(user) {
        // Обновляем информацию о пользователе в интерфейсе
        const userInfoElements = document.querySelectorAll('#userInfo, .user-info');
        userInfoElements.forEach(element => {
            element.textContent = `${user.full_name} (${user.roleName})`;
        });
    }

    showAllMenuItems() {
        // Fallback - показываем все пункты меню
        console.log('🔄 Показываем все пункты меню (fallback)');
        const allItems = Object.keys(this.menuItems);
        this.updateMenu(allItems);
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
