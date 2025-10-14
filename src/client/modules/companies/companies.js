// Модуль управления компаниями
class CompaniesManager {
    constructor() {
        this.currentPage = 1;
        this.currentSearch = '';
        this.editingCompanyId = null;
        this.api = new ApiClient();
        
        this.init();
    }

    async init() {
        console.log('🏢 Инициализация модуля управления компаниями...');
        
        // Проверяем аутентификацию
        if (!this.api.isAuthenticated()) {
            console.log('❌ Пользователь не аутентифицирован, перенаправляем на страницу входа');
            window.location.href = '/';
            return;
        }

        // Инициализируем обработчики событий
        this.initEventListeners();
        
        // Загружаем данные
        await this.loadCompanies();
        
        console.log('✅ Модуль управления компаниями инициализирован');
    }

    initEventListeners() {
        // Кнопка добавления компании
        document.getElementById('addCompanyBtn').addEventListener('click', () => {
            this.showAddModal();
        });

        // Поиск
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.searchCompanies();
        });

        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchCompanies();
            }
        });

        // Модальное окно
        document.getElementById('closeModal').addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideModal();
        });

        // Форма компании
        document.getElementById('companyForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCompany();
        });

        // Выход
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Закрытие модального окна по клику вне его
        document.getElementById('companyModal').addEventListener('click', (e) => {
            if (e.target.id === 'companyModal') {
                this.hideModal();
            }
        });
    }

    async loadCompanies(page = 1, search = '') {
        try {
            console.log(`📋 Загружаем компании (страница ${page}, поиск: "${search}")`);
            
            const params = new URLSearchParams({
                page: page,
                limit: 50
            });
            
            if (search) {
                params.append('search', search);
            }

            const response = await this.api.get(`/api/companies?${params}`);
            
            if (response.success) {
                this.renderCompanies(response.data);
                this.renderPagination(response.pagination);
                this.currentPage = page;
                this.currentSearch = search;
            } else {
                throw new Error(response.error || 'Ошибка загрузки компаний');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки компаний:', error);
            this.showError('Ошибка загрузки компаний: ' + error.message);
        }
    }

    renderCompanies(companies) {
        const tbody = document.getElementById('companiesTableBody');
        
        if (companies.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="no-data">
                        <div class="no-data-content">
                            <span class="no-data-icon">📋</span>
                            <p>Компании не найдены</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = companies.map(company => `
            <tr>
                <td>${company.company_id}</td>
                <td>${company.company_name}</td>
                <td>${company.phone || '-'}</td>
                <td>${this.formatDate(company.created_at)}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-secondary" onclick="companiesManager.editCompany(${company.id})">
                        <span class="btn-icon">✏️</span>
                        Редактировать
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="companiesManager.deleteCompany(${company.id}, '${company.company_name}')">
                        <span class="btn-icon">🗑️</span>
                        Удалить
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderPagination(pagination) {
        const paginationEl = document.getElementById('pagination');
        
        if (pagination.pages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }

        let paginationHTML = '<div class="pagination-controls">';
        
        // Предыдущая страница
        if (pagination.page > 1) {
            paginationHTML += `
                <button class="btn btn-sm btn-secondary" onclick="companiesManager.loadCompanies(${pagination.page - 1}, '${this.currentSearch}')">
                    ← Предыдущая
                </button>
            `;
        }
        
        // Номера страниц
        const startPage = Math.max(1, pagination.page - 2);
        const endPage = Math.min(pagination.pages, pagination.page + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === pagination.page ? 'active' : '';
            paginationHTML += `
                <button class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}" 
                        onclick="companiesManager.loadCompanies(${i}, '${this.currentSearch}')">
                    ${i}
                </button>
            `;
        }
        
        // Следующая страница
        if (pagination.page < pagination.pages) {
            paginationHTML += `
                <button class="btn btn-sm btn-secondary" onclick="companiesManager.loadCompanies(${pagination.page + 1}, '${this.currentSearch}')">
                    Следующая →
                </button>
            `;
        }
        
        paginationHTML += '</div>';
        paginationHTML += `<div class="pagination-info">Страница ${pagination.page} из ${pagination.pages} (всего: ${pagination.total})</div>`;
        
        paginationEl.innerHTML = paginationHTML;
    }

    showAddModal() {
        this.editingCompanyId = null;
        document.getElementById('modalTitle').textContent = 'Добавить компанию';
        document.getElementById('companyForm').reset();
        document.getElementById('companyModal').style.display = 'flex';
    }

    editCompany(companyId) {
        console.log(`✏️ Редактирование компании ID: ${companyId}`);
        
        // Находим компанию в таблице
        const row = document.querySelector(`button[onclick*="editCompany(${companyId})"]`).closest('tr');
        const cells = row.querySelectorAll('td');
        
        // Заполняем форму данными
        document.getElementById('modalTitle').textContent = 'Редактировать компанию';
        document.getElementById('companyName').value = cells[1].textContent;
        document.getElementById('companyPhone').value = cells[2].textContent === '-' ? '' : cells[2].textContent;
        
        this.editingCompanyId = companyId;
        document.getElementById('companyModal').style.display = 'flex';
    }

    async saveCompany() {
        try {
            const formData = {
                company_name: document.getElementById('companyName').value.trim(),
                phone: document.getElementById('companyPhone').value.trim()
            };

            if (!formData.company_name) {
                this.showError('Название компании обязательно');
                return;
            }

            let response;
            if (this.editingCompanyId) {
                // Обновление существующей компании
                console.log(`💾 Обновление компании ID: ${this.editingCompanyId}`);
                response = await this.api.put(`/api/companies/${this.editingCompanyId}`, formData);
            } else {
                // Создание новой компании
                console.log('💾 Создание новой компании');
                response = await this.api.post('/api/companies', formData);
            }

            if (response.success) {
                this.hideModal();
                await this.loadCompanies(this.currentPage, this.currentSearch);
                this.showSuccess(response.message || 'Компания сохранена успешно');
            } else {
                throw new Error(response.error || 'Ошибка сохранения компании');
            }

        } catch (error) {
            console.error('❌ Ошибка сохранения компании:', error);
            this.showError('Ошибка сохранения компании: ' + error.message);
        }
    }

    async deleteCompany(companyId, companyName) {
        if (!confirm(`Вы уверены, что хотите удалить компанию "${companyName}"?\n\nЭто действие нельзя отменить.`)) {
            return;
        }

        try {
            console.log(`🗑️ Удаление компании ID: ${companyId}`);
            
            const response = await this.api.delete(`/api/companies/${companyId}`);
            
            if (response.success) {
                await this.loadCompanies(this.currentPage, this.currentSearch);
                this.showSuccess(response.message || 'Компания удалена успешно');
            } else {
                throw new Error(response.error || 'Ошибка удаления компании');
            }

        } catch (error) {
            console.error('❌ Ошибка удаления компании:', error);
            this.showError('Ошибка удаления компании: ' + error.message);
        }
    }

    searchCompanies() {
        const search = document.getElementById('searchInput').value.trim();
        this.loadCompanies(1, search);
    }

    hideModal() {
        document.getElementById('companyModal').style.display = 'none';
        this.editingCompanyId = null;
    }

    logout() {
        if (confirm('Вы уверены, что хотите выйти?')) {
            this.api.logout();
            window.location.href = '/';
        }
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showSuccess(message) {
        // Простое уведомление об успехе
        const notification = document.createElement('div');
        notification.className = 'notification success';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showError(message) {
        // Простое уведомление об ошибке
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Инициализация при загрузке страницы
let companiesManager;
document.addEventListener('DOMContentLoaded', () => {
    companiesManager = new CompaniesManager();
});
