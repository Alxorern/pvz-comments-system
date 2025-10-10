/**
 * Модуль управления темами
 * Обеспечивает переключение между светлой и темной темами
 */

class ThemeManager {
    constructor() {
        this.currentTheme = this.getStoredTheme() || 'dark';
        this.init();
    }

    /**
     * Инициализация менеджера тем
     */
    init() {
        this.applyTheme(this.currentTheme);
        this.setupEventListeners();
    }

    /**
     * Получить сохраненную тему из localStorage
     */
    getStoredTheme() {
        try {
            return localStorage.getItem('billing-theme');
        } catch (error) {
            console.warn('Не удалось получить тему из localStorage:', error);
            return 'dark';
        }
    }

    /**
     * Сохранить тему в localStorage
     */
    setStoredTheme(theme) {
        try {
            localStorage.setItem('billing-theme', theme);
        } catch (error) {
            console.warn('Не удалось сохранить тему в localStorage:', error);
        }
    }

    /**
     * Применить тему к документу
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        this.setStoredTheme(theme);
        this.updateThemeToggle();
    }

    /**
     * Переключить тему
     */
    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
        
        // Показать уведомление
        this.showThemeNotification(newTheme);
    }

    /**
     * Обновить переключатель темы
     */
    updateThemeToggle() {
        const toggle = document.getElementById('themeToggle');
        if (!toggle) return;

        const icon = toggle.querySelector('.theme-toggle-icon');
        const text = toggle.querySelector('.theme-toggle-text');

        if (this.currentTheme === 'dark') {
            icon.textContent = '🌙';
            text.textContent = 'Темная тема';
            toggle.setAttribute('data-theme', 'dark');
        } else {
            icon.textContent = '☀️';
            text.textContent = 'Светлая тема';
            toggle.setAttribute('data-theme', 'light');
        }
    }

    /**
     * Показать уведомление о смене темы
     */
    showThemeNotification(theme) {
        const themeName = theme === 'dark' ? 'темная' : 'светлая';
        const message = `Переключено на ${themeName} тему`;
        
        // Используем существующую систему уведомлений, если она есть
        if (typeof showNotification === 'function') {
            showNotification(message, 'success');
        } else {
            // Создаем простое уведомление
            this.createSimpleNotification(message);
        }
    }

    /**
     * Создать простое уведомление
     */
    createSimpleNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification notification-success';
        notification.textContent = message;

        document.body.appendChild(notification);

        // Анимация появления
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Удаление через 3 секунды
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Настроить обработчики событий
     */
    setupEventListeners() {
        // Обработчик для переключателя темы
        document.addEventListener('click', (event) => {
            if (event.target.closest('#themeToggle')) {
                event.preventDefault();
                this.toggleTheme();
            }
        });

        // Обработчик для системной темы (если поддерживается)
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addListener((e) => {
                // Автоматически переключаемся на системную тему только при первом запуске
                if (!this.getStoredTheme()) {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    /**
     * Получить текущую тему
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * Установить конкретную тему
     */
    setTheme(theme) {
        if (theme === 'dark' || theme === 'light') {
            this.applyTheme(theme);
        }
    }
}

// Создаем глобальный экземпляр
window.themeManager = new ThemeManager();

// Экспортируем для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}
