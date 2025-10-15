/**
 * Модуль управления пользователями
 */
class UsersModule {
  constructor() {
    this.editingUserId = null;
    this.cache = {
      users: [],
      roles: [],
      companies: [],
      lastCreatedUserId: null
    };
  }

  /**
   * Инициализация модуля
   */
  async init() {
    this.setupEventListeners();
    await this.loadData();
    this.renderUsers();
    
    // Убеждаемся, что модальные окна скрыты по умолчанию
    this.hideAllModals();
  }
  
  hideAllModals() {
    const modals = ['overlayAddUser', 'overlayEditUser'];
    modals.forEach(id => {
      const modal = document.getElementById(id);
      if (modal) {
        modal.classList.remove('show');
      }
    });
  }

  /**
   * Настройка обработчиков событий
   */
  setupEventListeners() {
    // Кнопки модальных окон
    const btnAddUser = document.getElementById('btnAddUser');
    if (btnAddUser) {
      btnAddUser.addEventListener('click', () => this.showAddUserModal());
    }

    const btnCancelAddUser = document.getElementById('btnCancelAddUser');
    if (btnCancelAddUser) {
      btnCancelAddUser.addEventListener('click', () => this.hideAddUserModal());
    }

    const closeAddUserModal = document.getElementById('closeAddUserModal');
    if (closeAddUserModal) {
      closeAddUserModal.addEventListener('click', () => this.hideAddUserModal());
    }

    const btnSubmitAddUser = document.getElementById('btnSubmitAddUser');
    if (btnSubmitAddUser) {
      btnSubmitAddUser.addEventListener('click', () => this.submitAddUser());
    }

    const btnCancelEditUser = document.getElementById('btnCancelEditUser');
    if (btnCancelEditUser) {
      btnCancelEditUser.addEventListener('click', () => this.hideEditUserModal());
    }

    const btnSubmitEditUser = document.getElementById('btnSubmitEditUser');
    if (btnSubmitEditUser) {
      btnSubmitEditUser.addEventListener('click', () => this.submitEditUser());
    }

    // Закрытие модальных окон по клику на overlay
    const overlayAddUser = document.getElementById('overlayAddUser');
    if (overlayAddUser) {
      overlayAddUser.addEventListener('click', (e) => {
        if (e.target === overlayAddUser) {
          this.hideAddUserModal();
        }
      });
    }

    const overlayEditUser = document.getElementById('overlayEditUser');
    if (overlayEditUser) {
      overlayEditUser.addEventListener('click', (e) => {
        if (e.target === overlayEditUser) {
          this.hideEditUserModal();
        }
      });
    }
  }

  /**
   * Загрузка данных с сервера
   */
  async loadData() {
    try {
      console.log('🔄 Начинаем загрузку данных пользователей...');
      console.log('🔍 apiClient доступен:', !!window.apiClient);
      console.log('🔍 utils доступен:', !!window.utils);
      
      // Загружаем пользователей
      console.log('📥 Загружаем пользователей...');
      const usersResponse = await window.apiClient.get('/api/users');
      console.log('📥 Ответ API пользователей:', usersResponse);
      
      if (usersResponse && usersResponse.success) {
        this.cache.users = usersResponse.data;
        console.log('✅ Загружено пользователей:', usersResponse.data.length);
      } else {
        console.error('❌ Ошибка загрузки пользователей:', usersResponse);
      }

      // Загружаем роли
      console.log('📥 Загружаем роли...');
      const rolesResponse = await window.apiClient.get('/api/roles');
      console.log('📥 Ответ API ролей:', rolesResponse);
      
      if (rolesResponse && rolesResponse.success) {
        this.cache.roles = rolesResponse.data;
        console.log('✅ Загружено ролей:', rolesResponse.data.length);
        this.populateRoles();
      } else {
        console.error('❌ Ошибка загрузки ролей:', rolesResponse);
      }

      // Загружаем компании
      console.log('📥 Загружаем компании...');
      const companiesResponse = await window.apiClient.get('/api/companies/all');
      console.log('📥 Ответ API компаний:', companiesResponse);
      
      if (companiesResponse && companiesResponse.success) {
        this.cache.companies = companiesResponse.data;
        console.log('✅ Загружено компаний:', companiesResponse.data.length);
        this.populateCompanies();
      } else {
        console.error('❌ Ошибка загрузки компаний:', companiesResponse);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки данных пользователей:', error);
      if (window.utils) {
        window.utils.showNotification('Ошибка загрузки данных', 'error');
      }
    }
  }

  /**
   * Заполнение выпадающих списков ролей
   */
  populateRoles() {
    const addSelect = document.getElementById('addUserRole');
    if (addSelect) {
      addSelect.innerHTML = '<option value="">Выберите роль</option>';
      this.cache.roles.forEach(role => {
        const option = document.createElement('option');
        option.value = role.name;
        option.textContent = role.name;
        addSelect.appendChild(option);
      });
    }
    
    const editSelect = document.getElementById('editUserRole');
    if (editSelect) {
      editSelect.innerHTML = '<option value="">Выберите роль</option>';
      this.cache.roles.forEach(role => {
        const option = document.createElement('option');
        option.value = role.name;
        option.textContent = role.name;
        editSelect.appendChild(option);
      });
    }
  }

  /**
   * Заполнение выпадающих списков компаний
   */
  populateCompanies() {
    const addSelect = document.getElementById('addUserCompany');
    if (addSelect) {
      addSelect.innerHTML = '<option value="">Выберите компанию</option>';
      this.cache.companies.forEach(company => {
        const option = document.createElement('option');
        option.value = company.company_id;
        option.textContent = company.company_name;
        addSelect.appendChild(option);
      });
    }
    
    const editSelect = document.getElementById('editUserCompany');
    if (editSelect) {
      editSelect.innerHTML = '<option value="">Выберите компанию</option>';
      this.cache.companies.forEach(company => {
        const option = document.createElement('option');
        option.value = company.company_id;
        option.textContent = company.company_name;
        editSelect.appendChild(option);
      });
    }
  }

  /**
   * Отображение списка пользователей
   */
  renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    this.cache.users.forEach(user => {
      const row = document.createElement('tr');
      row.dataset.id = user.id;
      row.dataset.created = user.created;
      
      row.innerHTML = `
        <td>${user.user_id}</td>
        <td>${user.login}</td>
        <td>${user.full_name}</td>
        <td>${user.role_name || user.role}</td>
        <td>${user.company_name || '-'}</td>
        <td>${user.created ? (window.utils ? window.utils.formatDate(user.created) : user.created) : ''}</td>
        <td>${user.addwho || ''}</td>
        <td>
          <button class="btn small" onclick="usersModule.showEditUserModal(${user.user_id})" data-user-id="${user.user_id}">Редактировать</button>
        </td>
      `;

      // Подсветка новой записи
      if (this.cache.lastCreatedUserId && user.user_id === this.cache.lastCreatedUserId) {
        row.classList.add('highlight');
      }

      tbody.appendChild(row);
    });

    // Убираем подсветку через 5 секунд
    if (this.cache.lastCreatedUserId) {
      setTimeout(() => {
        this.cache.lastCreatedUserId = null;
        const highlightedRows = tbody.querySelectorAll('.highlight');
        highlightedRows.forEach(row => row.classList.remove('highlight'));
      }, 5000);
    }
  }

  /**
   * Показать модальное окно создания пользователя
   */
  showAddUserModal() {
    const modal = document.getElementById('overlayAddUser');
    if (modal) {
      modal.classList.add('show');
      this.clearAddUserForm();
    }
  }

  /**
   * Скрыть модальное окно создания пользователя
   */
  hideAddUserModal() {
    const modal = document.getElementById('overlayAddUser');
    if (modal) {
      modal.classList.remove('show');
    }
  }

  /**
   * Показать модальное окно редактирования пользователя
   */
  showEditUserModal(userId) {
    const overlay = document.getElementById('overlayEditUser');
    if (overlay) {
      overlay.classList.add('show');
      
      console.log('🔍 Поиск пользователя для редактирования:', userId);
      
      const user = this.cache.users.find(u => u.user_id == userId);
      if (user) {
        console.log('✅ Найден пользователь для редактирования:', user);
        document.getElementById('editUserFullName').value = user.full_name || '';
        document.getElementById('editUserLogin').value = user.login || '';
        document.getElementById('editUserPassword').value = '';
        document.getElementById('editUserRole').value = user.role || '';
        document.getElementById('editUserCompany').value = user.company_id || '';
        
        this.editingUserId = userId;
      } else {
        console.error('❌ Пользователь не найден в кэше:', userId);
        if (window.utils) {
          window.utils.showNotification('Пользователь не найден', 'error');
        }
      }
    }
  }

  /**
   * Скрыть модальное окно редактирования пользователя
   */
  hideEditUserModal() {
    const overlay = document.getElementById('overlayEditUser');
    if (overlay) {
      overlay.classList.remove('show');
    }
    this.editingUserId = null;
  }

  /**
   * Очистить форму создания пользователя
   */
  clearAddUserForm() {
    const fields = ['addUserFullName', 'addUserLogin', 'addUserPassword', 'addUserRole'];
    fields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.value = '';
      }
    });
  }

  /**
   * Создание нового пользователя
   */
  async submitAddUser() {
    const fullNameEl = document.getElementById('addUserFullName');
    const loginEl = document.getElementById('addUserLogin');
    const passwordEl = document.getElementById('addUserPassword');
    const roleEl = document.getElementById('addUserRole');
    const companyEl = document.getElementById('addUserCompany');
    
    if (!fullNameEl || !loginEl || !passwordEl || !roleEl || !companyEl) {
      if (window.utils) {
        window.utils.showNotification('Не все поля формы пользователя найдены', 'error');
      }
      return;
    }
    
    const fullName = fullNameEl.value.trim();
    const login = loginEl.value.trim();
    const password = passwordEl.value.trim();
    const role = roleEl.value;
    const company_id = companyEl.value;

    if (!fullName || !login || !password || !role) {
      if (window.utils) {
        window.utils.showNotification('Заполните все обязательные поля', 'error');
      }
      return;
    }

    const userData = {
      full_name: fullName,
      login: login,
      password: password,
      role: role,
      company_id: company_id || null
    };

    try {
      console.log('🔄 Создание нового пользователя:', { 
        userData: { ...userData, password: '[HIDDEN]' } 
      });
      
      const result = await window.apiClient.post('/api/users', userData);
      
      if (result && result.success) {
        this.hideAddUserModal();
        
        // Обновляем данные с сервера
        await this.refreshUsers();
        
        if (window.utils) {
          window.utils.showNotification('Пользователь создан успешно', 'success');
        }
      } else {
        if (window.utils) {
          window.utils.showNotification('Ошибка создания пользователя', 'error');
        }
      }
    } catch (error) {
      console.error('❌ Ошибка создания пользователя:', error);
      if (window.utils) {
        window.utils.showNotification('Ошибка соединения: ' + error.message, 'error');
      }
    }
  }

  /**
   * Редактирование пользователя
   */
  async submitEditUser() {
    const fullNameEl = document.getElementById('editUserFullName');
    const loginEl = document.getElementById('editUserLogin');
    const passwordEl = document.getElementById('editUserPassword');
    const roleEl = document.getElementById('editUserRole');
    const companyEl = document.getElementById('editUserCompany');
    
    if (!fullNameEl || !loginEl || !passwordEl || !roleEl || !companyEl) {
      if (window.utils) {
        window.utils.showNotification('Не все поля формы пользователя найдены', 'error');
      }
      return;
    }
    
    const fullName = fullNameEl.value.trim();
    const login = loginEl.value.trim();
    const password = passwordEl.value.trim();
    const role = roleEl.value;
    const company_id = companyEl.value;

    if (!fullName || !login || !role) {
      if (window.utils) {
        window.utils.showNotification('Заполните ФИО, логин и роль', 'error');
      }
      return;
    }

    const userData = {
      full_name: fullName,
      login: login,
      password: password,
      role: role,
      company_id: company_id || null
    };

    try {
      console.log('🔄 Редактирование пользователя:', { 
        editingUserId: this.editingUserId, 
        userData: { ...userData, password: userData.password ? '[HIDDEN]' : '[EMPTY]' } 
      });
      
      const result = await window.apiClient.put(`/api/users/${this.editingUserId}`, userData);
      
      if (result && result.success) {
        this.hideEditUserModal();
        
        // Обновляем данные с сервера
        await this.refreshUsers();
        
        if (window.utils) {
          window.utils.showNotification('Пользователь обновлен успешно', 'success');
        }
      } else {
        if (window.utils) {
          window.utils.showNotification('Ошибка обновления пользователя', 'error');
        }
      }
    } catch (error) {
      console.error('❌ Ошибка редактирования пользователя:', error);
      if (window.utils) {
        window.utils.showNotification('Ошибка соединения: ' + error.message, 'error');
      }
    }
  }

  /**
   * Обновление данных пользователей
   */
  async refreshUsers() {
    await this.loadData();
    this.renderUsers();
  }
}

// Создаем глобальный экземпляр модуля пользователей
window.usersModule = new UsersModule();
