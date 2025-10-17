/**
 * Модуль управления ролями
 */
class RolesModule {
  constructor() {
    this.cache = {
      roles: [],
      regions: [],
      statuses: []
    };
    this.editingRoleId = null;
    this.selectedRegions = [];
    this.selectedStatuses = [];
  }

  /**
   * Инициализация модуля
   */
  async init() {
    console.log('🚀 Инициализация модуля ролей...');
    
    try {
      console.log('📊 Загружаем данные...');
      await this.loadData();
      
      console.log('🔧 Настраиваем обработчики событий...');
      this.setupEventListeners();
      
      console.log('🎨 Отображаем роли...');
      this.renderRoles();
      
      // Информация о пользователе теперь управляется через MenuManager
      
      console.log('✅ Модуль ролей инициализирован успешно');
    } catch (error) {
      console.error('❌ Ошибка инициализации модуля ролей:', error);
      if (window.utils) {
        window.utils.showNotification('Ошибка инициализации модуля ролей', 'error');
      }
    }
  }

  /**
   * Инициализация информации о пользователе
   * УДАЛЕНО - теперь управляется через MenuManager
   */
  initUserInfo() {
    // Информация о пользователе теперь управляется через MenuManager
    // Этот метод оставлен для совместимости, но не выполняет никаких действий
  }

  /**
   * Загрузка данных с сервера
   */
  async loadData() {
    try {
      console.log('🔄 Начинаем загрузку данных ролей...');
      console.log('🔍 secureApiClient доступен:', !!window.secureApiClient);
      console.log('🔍 utils доступен:', !!window.utils);
      
      // Загружаем роли
      console.log('📥 Загружаем роли...');
      const rolesResponse = await window.secureApiClient.get('/api/roles');
      console.log('📥 Ответ API ролей:', rolesResponse);
      
      if (rolesResponse && rolesResponse.success) {
        this.cache.roles = rolesResponse.data || [];
        console.log('✅ Загружено ролей:', rolesResponse.data ? rolesResponse.data.length : 0);
      } else {
        console.error('❌ Ошибка загрузки ролей:', rolesResponse);
      }

      // Загружаем регионы
      console.log('📥 Загружаем регионы...');
      const regionsResponse = await window.secureApiClient.get('/api/roles/regions');
      console.log('📥 Ответ API регионов:', regionsResponse);
      
      if (regionsResponse && regionsResponse.success) {
        this.cache.regions = regionsResponse.data || [];
        console.log('✅ Загружено регионов:', regionsResponse.data ? regionsResponse.data.length : 0);
      } else {
        console.error('❌ Ошибка загрузки регионов:', regionsResponse);
      }

      // Загружаем статусы
      console.log('📥 Загружаем статусы...');
      const statusesResponse = await window.secureApiClient.get('/api/roles/statuses');
      console.log('📥 Ответ API статусов:', statusesResponse);
      
      if (statusesResponse && statusesResponse.success) {
        this.cache.statuses = statusesResponse.data || [];
        console.log('✅ Загружено статусов:', statusesResponse.data ? statusesResponse.data.length : 0);
      } else {
        console.error('❌ Ошибка загрузки статусов:', statusesResponse);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки данных ролей:', error);
      if (window.utils) {
        window.utils.showNotification('Ошибка загрузки данных', 'error');
      }
    }
  }

  /**
   * Настройка обработчиков событий
   */
  setupEventListeners() {
    // Кнопка добавления роли
    const btnAddRole = document.getElementById('btnAddRole');
    console.log('🔍 Кнопка добавления роли найдена:', !!btnAddRole);
    if (btnAddRole) {
      btnAddRole.addEventListener('click', () => {
        console.log('🖱️ Клик по кнопке добавления роли');
        this.showAddRoleModal();
      });
    }

    // Модальное окно роли
    const roleModal = document.getElementById('roleModal');
    const closeRoleModal = document.getElementById('closeRoleModal');
    const cancelRoleSave = document.getElementById('cancelRoleSave');
    const saveRoleBtn = document.getElementById('saveRoleBtn');

    console.log('🔍 Элементы модального окна найдены:', {
      roleModal: !!roleModal,
      closeRoleModal: !!closeRoleModal,
      cancelRoleSave: !!cancelRoleSave,
      saveRoleBtn: !!saveRoleBtn
    });

    if (closeRoleModal) {
      closeRoleModal.addEventListener('click', () => {
        console.log('🖱️ Клик по кнопке закрытия модального окна');
        this.hideRoleModal();
      });
    }
    if (cancelRoleSave) {
      cancelRoleSave.addEventListener('click', () => {
        console.log('🖱️ Клик по кнопке отмены');
        this.hideRoleModal();
      });
    }
    if (saveRoleBtn) {
      saveRoleBtn.addEventListener('click', () => {
        console.log('🖱️ Клик по кнопке сохранения роли');
        this.saveRole();
      });
    }

    // Закрытие модального окна по клику вне его
    if (roleModal) {
      roleModal.addEventListener('click', (e) => {
        if (e.target === roleModal) {
          this.hideRoleModal();
        }
      });
    }

    // Поиск регионов
    const regionSearchInput = document.getElementById('regionSearchInput');
    const addRegionBtn = document.getElementById('addRegionBtn');

    if (regionSearchInput) {
      regionSearchInput.addEventListener('input', (e) => this.handleRegionSearch(e.target.value));
      
      // Закрытие списка предложений при потере фокуса
      regionSearchInput.addEventListener('blur', () => {
        // Небольшая задержка, чтобы клик по предложению успел сработать
        setTimeout(() => {
          this.updateRegionSuggestions([]);
        }, 150);
      });
      
      // Поддержка клавиатуры
      regionSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.updateRegionSuggestions([]);
          regionSearchInput.blur();
        }
      });
    }
    if (addRegionBtn) {
      addRegionBtn.addEventListener('click', () => this.addSelectedRegion());
    }

    // Поиск статусов
    const statusSearchInput = document.getElementById('statusSearchInput');
    const addStatusBtn = document.getElementById('addStatusBtn');

    if (statusSearchInput) {
      // При клике на поле показываем все доступные статусы
      statusSearchInput.addEventListener('focus', () => {
        this.handleStatusSearch(''); // Показываем все статусы
      });
      
      statusSearchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        this.handleStatusSearch(query);
        
        // Если пользователь вводит текст, который точно совпадает с одним из статусов,
        // автоматически выделяем его
        if (this.cache.statuses && this.cache.statuses.includes(query)) {
          // Можно добавить визуальное выделение, но пока оставим как есть
        }
      });
      
      // Закрытие списка предложений при потере фокуса
      statusSearchInput.addEventListener('blur', () => {
        // Небольшая задержка, чтобы клик по предложению успел сработать
        setTimeout(() => {
          this.updateStatusSuggestions([]);
        }, 150);
      });
      
      // Поддержка клавиатуры
      statusSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.updateStatusSuggestions([]);
          statusSearchInput.blur();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this.addSelectedStatus();
        }
      });
    }
    if (addStatusBtn) {
      addStatusBtn.addEventListener('click', () => this.addSelectedStatus());
    }

    // Кнопка выхода настраивается в модуле навигации

    // Переключатель темы
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        if (window.themeModule) {
          window.themeModule.toggleTheme();
        }
      });
    }
  }

  /**
   * Отображение модального окна добавления роли
   */
  showAddRoleModal() {
    console.log('📝 Показываем модальное окно добавления роли');
    
    // Если статусы не загружены, загружаем их
    if (!this.cache.statuses || this.cache.statuses.length === 0) {
      console.log('⚠️ Статусы не загружены, загружаем...');
      this.loadData();
    }
    
    this.editingRoleId = null;
    this.selectedRegions = [];
    this.selectedStatuses = [];
    this.clearRoleForm();
    this.updateRegionSuggestions([]);
    this.updateStatusSuggestions([]);
    this.updateSelectedRegionsDisplay();
    this.updateSelectedStatusesDisplay();
    
    const modal = document.getElementById('roleModal');
    const title = document.getElementById('roleModalTitle');
    console.log('🔍 Элементы модального окна:', { modal: !!modal, title: !!title });
    
    if (title) title.textContent = 'Добавить новую роль';
    if (modal) {
      modal.classList.add('show');
      console.log('✅ Класс show добавлен к модальному окну');
    } else {
      console.error('❌ Модальное окно не найдено');
    }
  }

  /**
   * Отображение модального окна редактирования роли
   */
  showEditRoleModal(roleId) {
    console.log('📝 Показываем модальное окно редактирования роли:', roleId);
    const role = this.cache.roles.find(r => r.id === roleId);
    if (!role) {
      console.error('❌ Роль не найдена:', roleId);
      return;
    }

    console.log('✅ Роль найдена:', role);
    this.editingRoleId = roleId;
    this.selectedRegions = role.regions || [];
    this.selectedStatuses = role.statuses || [];
    this.fillRoleForm(role);
    this.updateRegionSuggestions([]);
    this.updateStatusSuggestions([]);
    this.updateSelectedRegionsDisplay();
    this.updateSelectedStatusesDisplay();
    
    const modal = document.getElementById('roleModal');
    const title = document.getElementById('roleModalTitle');
    console.log('🔍 Элементы модального окна:', { modal: !!modal, title: !!title });
    
    if (title) title.textContent = 'Редактировать роль';
    if (modal) {
      modal.classList.add('show');
      console.log('✅ Класс show добавлен к модальному окну');
    } else {
      console.error('❌ Модальное окно не найдено');
    }
  }

  /**
   * Скрытие модального окна роли
   */
  hideRoleModal() {
    const modal = document.getElementById('roleModal');
    if (modal) modal.classList.remove('show');
    this.clearRoleForm();
    this.selectedRegions = [];
    this.editingRoleId = null;
  }

  /**
   * Очистка формы роли
   */
  clearRoleForm() {
    const roleName = document.getElementById('roleName');
    const roleIsActive = document.getElementById('roleIsActive');
    const regionSearchInput = document.getElementById('regionSearchInput');
    const statusSearchInput = document.getElementById('statusSearchInput');
    
    if (roleName) roleName.value = '';
    if (roleIsActive) roleIsActive.checked = true;
    if (regionSearchInput) regionSearchInput.value = '';
    if (statusSearchInput) statusSearchInput.value = '';
  }

  /**
   * Заполнение формы роли
   */
  fillRoleForm(role) {
    const roleName = document.getElementById('roleName');
    const roleIsActive = document.getElementById('roleIsActive');
    
    if (roleName) roleName.value = role.name || '';
    if (roleIsActive) roleIsActive.checked = role.is_active !== 0;
  }

  /**
   * Обработка поиска регионов
   */
  handleRegionSearch(query) {
    if (!query || query.length < 2) {
      this.updateRegionSuggestions([]);
      return;
    }

    // Проверяем, что регионы загружены
    if (!this.cache.regions || this.cache.regions.length === 0) {
      console.warn('⚠️ Регионы не загружены, пытаемся загрузить...');
      this.loadData();
      return;
    }

    const filteredRegions = this.cache.regions.filter(region => 
      region.name.toLowerCase().includes(query.toLowerCase()) &&
      !this.selectedRegions.some(selected => selected.id === region.id)
    );

    console.log(`🔍 Найдено регионов для "${query}":`, filteredRegions.length);
    this.updateRegionSuggestions(filteredRegions);
  }

  /**
   * Обновление списка предложений регионов
   */
  updateRegionSuggestions(regions) {
    const suggestionsContainer = document.getElementById('regionSuggestions');
    if (!suggestionsContainer) return;

    suggestionsContainer.innerHTML = '';

    if (regions.length === 0) {
      suggestionsContainer.classList.remove('show');
      return;
    }

    suggestionsContainer.classList.add('show');

    regions.forEach(region => {
      const suggestion = document.createElement('div');
      suggestion.className = 'suggestion-item';
      suggestion.textContent = region.name;
      suggestion.addEventListener('click', () => {
        // Сразу добавляем регион при клике
        this.addRegionDirectly(region);
        this.updateRegionSuggestions([]);
        const regionSearchInput = document.getElementById('regionSearchInput');
        if (regionSearchInput) regionSearchInput.value = '';
      });
      suggestionsContainer.appendChild(suggestion);
    });
  }

  /**
   * Прямое добавление региона при клике на предложение
   */
  addRegionDirectly(region) {
    console.log('➕ Добавляем регион напрямую:', region.name);
    
    // Проверяем, что регион еще не добавлен
    if (!this.selectedRegions.some(selected => selected.id === region.id)) {
      this.selectedRegions.push(region);
      this.updateSelectedRegionsDisplay();
      console.log('✅ Регион добавлен:', region.name);
      
      // Показываем краткое уведомление
      if (window.utils) {
        window.utils.showNotification(`Регион "${region.name}" добавлен`, 'success');
      }
    } else {
      console.log('⚠️ Регион уже добавлен:', region.name);
      
      // Показываем уведомление о том, что регион уже добавлен
      if (window.utils) {
        window.utils.showNotification(`Регион "${region.name}" уже добавлен`, 'warning');
      }
    }
  }

  /**
   * Выбор региона для добавления (старый метод, оставляем для совместимости)
   */
  selectRegion(region) {
    this.selectedRegion = region;
  }

  /**
   * Добавление выбранного региона
   */
  addSelectedRegion() {
    if (!this.selectedRegion) return;

    if (!this.selectedRegions.some(region => region.id === this.selectedRegion.id)) {
      this.selectedRegions.push(this.selectedRegion);
      this.updateSelectedRegionsDisplay();
    }

    this.selectedRegion = null;
  }

  /**
   * Обновление отображения выбранных регионов
   */
  updateSelectedRegionsDisplay() {
    const container = document.getElementById('selectedRegionsContainer');
    if (!container) return;

    container.innerHTML = '';

    this.selectedRegions.forEach(region => {
      const regionCloud = document.createElement('div');
      regionCloud.className = 'region-cloud';
      regionCloud.innerHTML = `
        <span class="region-name">${region.name}</span>
        <button class="remove-region-btn" data-region-id="${region.id}">&times;</button>
      `;

      const removeBtn = regionCloud.querySelector('.remove-region-btn');
      removeBtn.addEventListener('click', () => this.removeRegion(region.id));

      container.appendChild(regionCloud);
    });
  }

  /**
   * Удаление региона из списка
   */
  removeRegion(regionId) {
    this.selectedRegions = this.selectedRegions.filter(region => region.id !== regionId);
    this.updateSelectedRegionsDisplay();
  }

  /**
   * Обработка поиска статусов
   */
  handleStatusSearch(query) {
    // Проверяем, что статусы загружены
    if (!this.cache.statuses || this.cache.statuses.length === 0) {
      console.warn('⚠️ Статусы не загружены, пытаемся загрузить...');
      this.loadData();
      return;
    }

    let filteredStatuses;
    
    if (!query || query.trim() === '') {
      // Если поле пустое, показываем все доступные статусы
      filteredStatuses = this.cache.statuses.filter(status => 
        !this.selectedStatuses.includes(status)
      );
    } else {
      // Если есть поисковый запрос, фильтруем по нему
      filteredStatuses = this.cache.statuses.filter(status => 
        status.toLowerCase().includes(query.toLowerCase()) &&
        !this.selectedStatuses.includes(status)
      );
    }

    this.updateStatusSuggestions(filteredStatuses);
  }

  /**
   * Обновление списка предложений статусов
   */
  updateStatusSuggestions(statuses) {
    const suggestionsContainer = document.getElementById('statusSuggestions');
    if (!suggestionsContainer) return;

    suggestionsContainer.innerHTML = '';

    if (statuses.length === 0) {
      suggestionsContainer.classList.remove('show');
      return;
    }

    suggestionsContainer.classList.add('show');

    statuses.forEach(status => {
      const suggestion = document.createElement('div');
      suggestion.className = 'suggestion-item';
      suggestion.textContent = status;
      suggestion.addEventListener('click', () => {
        // Сразу добавляем статус при клике
        this.addStatusDirectly(status);
        this.updateStatusSuggestions([]);
        const statusSearchInput = document.getElementById('statusSearchInput');
        if (statusSearchInput) statusSearchInput.value = '';
      });
      suggestionsContainer.appendChild(suggestion);
    });
  }

  /**
   * Добавление статуса напрямую
   */
  addStatusDirectly(status) {
    if (!this.selectedStatuses.includes(status)) {
      this.selectedStatuses.push(status);
      this.updateSelectedStatusesDisplay();
      console.log('✅ Статус добавлен:', status);
      
      // Показываем краткое уведомление
      if (window.utils) {
        window.utils.showNotification(`Статус "${status}" добавлен`, 'success');
      }
    } else {
      console.log('⚠️ Статус уже добавлен:', status);
      
      // Показываем уведомление о том, что статус уже добавлен
      if (window.utils) {
        window.utils.showNotification(`Статус "${status}" уже добавлен`, 'warning');
      }
    }
  }

  /**
   * Добавление выбранного статуса из поля ввода
   */
  addSelectedStatus() {
    const statusSearchInput = document.getElementById('statusSearchInput');
    if (!statusSearchInput || !statusSearchInput.value.trim()) {
      if (window.utils) {
        window.utils.showNotification('Выберите статус из списка', 'error');
      }
      return;
    }

    const statusName = statusSearchInput.value.trim();
    
    // Проверяем, что введенный статус существует в списке доступных
    if (!this.cache.statuses || !this.cache.statuses.includes(statusName)) {
      if (window.utils) {
        window.utils.showNotification('Выберите статус из предложенного списка', 'error');
      }
      return;
    }
    
    this.addStatusDirectly(statusName);
    statusSearchInput.value = '';
    this.updateStatusSuggestions([]);
  }

  /**
   * Обновление отображения выбранных статусов
   */
  updateSelectedStatusesDisplay() {
    const container = document.getElementById('selectedStatusesContainer');
    if (!container) return;

    container.innerHTML = '';

    this.selectedStatuses.forEach(status => {
      const statusCloud = document.createElement('div');
      statusCloud.className = 'region-cloud'; // Используем тот же CSS класс
      statusCloud.innerHTML = `
        <span class="region-name">${status}</span>
        <button class="remove-region-btn" data-status-name="${status}">&times;</button>
      `;

      const removeBtn = statusCloud.querySelector('.remove-region-btn');
      removeBtn.addEventListener('click', () => this.removeStatus(status));

      container.appendChild(statusCloud);
    });
  }

  /**
   * Удаление статуса из выбранных
   */
  removeStatus(statusName) {
    this.selectedStatuses = this.selectedStatuses.filter(status => status !== statusName);
    this.updateSelectedStatusesDisplay();
  }

  /**
   * Сохранение роли
   */
  async saveRole() {
    const roleName = document.getElementById('roleName');
    const roleIsActive = document.getElementById('roleIsActive');

    if (!roleName || !roleName.value.trim()) {
      if (window.utils) {
        window.utils.showNotification('Введите название роли', 'error');
      }
      return;
    }

    const roleData = {
      name: roleName.value.trim(),
      is_active: roleIsActive ? roleIsActive.checked : true,
      regions: this.selectedRegions.map(region => region.id),
      statuses: this.selectedStatuses
    };

    try {
      let result;
      if (this.editingRoleId) {
        result = await window.secureApiClient.put(`/api/roles/${this.editingRoleId}`, roleData);
      } else {
        result = await window.secureApiClient.post('/api/roles', roleData);
      }

      if (result && result.success) {
        this.hideRoleModal();
        await this.loadData();
        this.renderRoles();
        if (window.utils) {
          window.utils.showNotification(
            this.editingRoleId ? 'Роль обновлена успешно' : 'Роль создана успешно', 
            'success'
          );
        }
      } else {
        if (window.utils) {
          window.utils.showNotification('Ошибка сохранения роли', 'error');
        }
      }
    } catch (error) {
      console.error('❌ Ошибка сохранения роли:', error);
      if (window.utils) {
        window.utils.showNotification('Ошибка сохранения роли', 'error');
      }
    }
  }

  /**
   * Удаление роли
   */
  async deleteRole(roleId) {
    if (!confirm('Вы уверены, что хотите удалить эту роль?')) {
      return;
    }

    try {
      const result = await window.secureApiClient.delete(`/api/roles/${roleId}`);
      if (result && result.ok) {
        await this.loadData();
        this.renderRoles();
        if (window.utils) {
          window.utils.showNotification('Роль удалена успешно', 'success');
        }
      } else {
        if (window.utils) {
          window.utils.showNotification('Ошибка удаления роли', 'error');
        }
      }
    } catch (error) {
      console.error('❌ Ошибка удаления роли:', error);
      if (window.utils) {
        window.utils.showNotification('Ошибка удаления роли', 'error');
      }
    }
  }

  /**
   * Сокращение названия региона для отображения в таблице
   */
  truncateRegionName(name, maxLength = 20) {
    if (name.length <= maxLength) {
      return name;
    }
    return name.substring(0, maxLength - 3) + '...';
  }

  /**
   * Отображение ролей в таблице
   */
  renderRoles() {
    const tbody = document.getElementById('rolesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (this.cache.roles.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--muted);">Роли не найдены</td></tr>';
      return;
    }

    this.cache.roles.forEach(role => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${role.id}</td>
        <td>${role.name}</td>
        <td>
          <span class="status-badge ${role.is_active ? 'active' : 'inactive'}">
            ${role.is_active ? 'Активна' : 'Неактивна'}
          </span>
        </td>
        <td class="regions-cell">
          <div class="regions-container">
            ${(role.regions || []).map(region => 
              `<span class="region-cloud region-cloud-table" title="${region.name}">${this.truncateRegionName(region.name)}</span>`
            ).join('')}
          </div>
        </td>
        <td class="statuses-cell">
          <div class="regions-container">
            ${(role.statuses || []).map(status => 
              `<span class="region-cloud region-cloud-table" title="${status}">${this.truncateRegionName(status)}</span>`
            ).join('')}
          </div>
        </td>
        <td>
          <button class="btn btn-sm edit-role-btn" data-role-id="${role.id}">
            Редактировать
          </button>
          <button class="btn btn-sm btn-danger delete-role-btn" data-role-id="${role.id}">
            Удалить
          </button>
        </td>
      `;
      
      // Добавляем обработчики событий для кнопок
      const editBtn = row.querySelector('.edit-role-btn');
      const deleteBtn = row.querySelector('.delete-role-btn');
      
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          console.log('🖱️ Клик по кнопке редактирования роли:', role.id);
          this.showEditRoleModal(role.id);
        });
      }
      
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          console.log('🖱️ Клик по кнопке удаления роли:', role.id);
          this.deleteRole(role.id);
        });
      }
      
      tbody.appendChild(row);
    });
  }
}

// Создаем экземпляр модуля
window.rolesModule = new RolesModule();
