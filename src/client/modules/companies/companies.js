// Модуль управления компаниями
class CompaniesManager {
    constructor() {
        this.currentPage = 1;
        this.currentFilters = {};
        this.editingCompanyId = null;
        this.api = new ApiClient();
        this.allCompanies = [];
        this.filteredCompanies = [];
        this.filterTimeout = null;
    }

    async init() {
        console.log('🏢 Инициализация модуля управления компаниями...');
        
        // Проверяем аутентификацию
        if (!this.api.checkAuthAndRedirect()) {
            console.log('❌ Пользователь не аутентифицирован, перенаправляем на страницу входа');
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
        const addBtn = document.getElementById('addCompanyBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.showAddModal();
            });
        }

        // Фильтры
        const nameFilter = document.getElementById('companyNameFilter');
        if (nameFilter) {
            nameFilter.addEventListener('input', () => {
                this.applyFilters();
            });
        }

        const phoneFilter = document.getElementById('phoneFilter');
        if (phoneFilter) {
            phoneFilter.addEventListener('input', () => {
                this.applyFilters();
            });
        }

        // Модальное окно
        const closeModal = document.getElementById('closeModal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.hideModal();
            });
        }

        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hideModal();
            });
        }

        // Форма компании
        const companyForm = document.getElementById('companyForm');
        if (companyForm) {
            companyForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveCompany();
            });
        }

        // Выход (если есть отдельная кнопка)
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        // Закрытие модального окна по клику вне его
        const companyModal = document.getElementById('companyModal');
        if (companyModal) {
            companyModal.addEventListener('click', (e) => {
                if (e.target.id === 'companyModal') {
                    this.hideModal();
                }
            });
        }

        // Обработчики для кнопок редактирования и удаления (делегирование событий)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-company-btn')) {
                const companyId = e.target.getAttribute('data-company-id');
                console.log('🔍 Клик по кнопке редактирования, companyId:', companyId);
                console.log('🔍 Кнопка:', e.target);
                console.log('🔍 data-company-id атрибут:', e.target.getAttribute('data-company-id'));
                this.editCompany(companyId);
            } else if (e.target.classList.contains('delete-company-btn')) {
                const companyId = e.target.getAttribute('data-company-id');
                const companyName = e.target.closest('tr').querySelector('td:nth-child(2)').textContent;
                this.deleteCompany(companyId, companyName);
            }
        });
    }

    async loadCompanies(page = 1, filters = {}) {
        try {
            console.log(`📋 Загружаем компании (страница ${page}, фильтры:`, filters);
            
            // Если это первая загрузка или нет фильтров, загружаем все данные
            if (this.allCompanies.length === 0 || Object.keys(filters).length === 0) {
                const response = await this.api.get('/api/companies/all');
                
                if (response.success) {
                    this.allCompanies = response.data;
                    console.log(`📊 Загружено ${this.allCompanies.length} компаний`);
                } else {
                    throw new Error(response.error || 'Ошибка загрузки компаний');
                }
            }
            
            // Применяем фильтры
            this.applyClientFilters(filters);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки компаний:', error);
            this.showError('Ошибка загрузки компаний: ' + error.message);
        }
    }
    
    applyClientFilters(filters) {
        console.log('🔍 Применяем фильтры:', filters);
        
        let filtered = [...this.allCompanies];
        
        // Фильтр по названию
        if (filters.name && filters.name.trim()) {
            const nameFilter = filters.name.toLowerCase().trim();
            filtered = filtered.filter(company => 
                company.company_name && company.company_name.toLowerCase().includes(nameFilter)
            );
        }
        
        // Фильтр по телефону
        if (filters.phone && filters.phone.trim()) {
            const phoneFilter = filters.phone.toLowerCase().trim();
            filtered = filtered.filter(company => 
                company.phone && company.phone.toLowerCase().includes(phoneFilter)
            );
        }
        
        this.filteredCompanies = filtered;
        this.currentFilters = filters;
        this.currentPage = 1;
        
        console.log(`📊 Отфильтровано: ${filtered.length} из ${this.allCompanies.length} компаний`);
        
        this.renderCompanies(filtered);
        this.renderPagination({
            page: 1,
            pages: 1,
            total: filtered.length
        });
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

        tbody.innerHTML = companies.map(company => {
            console.log('🔍 Рендерим компанию:', company);
            return `
            <tr>
                <td>${company.company_id}</td>
                <td>${company.company_name}</td>
                <td>${company.phone || '-'}</td>
                <td>${this.formatDate(company.created_at)}</td>
                <td class="actions">
                    <button class="btn btn-sm edit-company-btn" data-company-id="${company.id}">
                        Редактировать
                    </button>
                    <button class="btn btn-sm btn-danger delete-company-btn" data-company-id="${company.id}">
                        Удалить
                    </button>
                </td>
            </tr>
        `;
        }).join('');
    }

    renderPagination(pagination) {
        const paginationEl = document.getElementById('pagination');
        
        if (!paginationEl) {
            console.warn('⚠️ Элемент пагинации не найден');
            return;
        }
        
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
        
        // Добавляем обработчики событий для кнопок пагинации
        this.setupPaginationEventListeners();
    }
    
    setupPaginationEventListeners() {
        // Обработчик для кнопок пагинации
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('pagination-btn') || e.target.classList.contains('pagination-page')) {
                const page = parseInt(e.target.getAttribute('data-page'));
                if (page && page !== this.currentPage) {
                    this.loadCompanies(page, this.currentFilters);
                }
            }
        });
    }

    showAddModal() {
        this.editingCompanyId = null;
        document.getElementById('modalTitle').textContent = 'Добавить компанию';
        document.getElementById('companyForm').reset();
        document.getElementById('companyModal').classList.add('show');
    }

    editCompany(companyId) {
        console.log(`✏️ Редактирование компании ID: ${companyId}`);
        
        // Находим компанию в таблице
        const row = document.querySelector(`button[data-company-id="${companyId}"]`).closest('tr');
        const cells = row.querySelectorAll('td');
        
        // Заполняем форму данными
        document.getElementById('modalTitle').textContent = 'Редактировать компанию';
        document.getElementById('companyName').value = cells[1].textContent;
        document.getElementById('companyPhone').value = cells[2].textContent === '-' ? '' : cells[2].textContent;
        
        this.editingCompanyId = companyId;
        document.getElementById('companyModal').classList.add('show');
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
            console.log('📊 Ответ API удаления:', response);
            
            if (response && response.success) {
                await this.loadCompanies(this.currentPage, this.currentFilters);
                this.showSuccess(response.message || 'Компания удалена успешно');
            } else {
                const errorMsg = response?.error || response?.message || 'Ошибка удаления компании';
                console.error('❌ Ошибка API:', errorMsg);
                throw new Error(errorMsg);
            }

        } catch (error) {
            console.error('❌ Ошибка удаления компании:', error);
            this.showError('Ошибка удаления компании: ' + error.message);
        }
    }

    applyFilters() {
        // Очищаем предыдущий таймер
        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }
        
        // Устанавливаем новый таймер для дебаунса
        this.filterTimeout = setTimeout(() => {
            const nameFilter = document.getElementById('companyNameFilter').value.trim();
            const phoneFilter = document.getElementById('phoneFilter').value.trim();
            
            // Создаем объект фильтров
            const filters = {};
            if (nameFilter) filters.name = nameFilter;
            if (phoneFilter) filters.phone = phoneFilter;
            
            this.applyClientFilters(filters);
        }, 300); // 300ms задержка
    }

    hideModal() {
        document.getElementById('companyModal').classList.remove('show');
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

// Создаем экземпляр CompaniesManager в глобальной области видимости
window.companiesManager = new CompaniesManager();
