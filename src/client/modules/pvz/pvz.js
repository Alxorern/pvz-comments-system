/**
 * Модуль для работы со списком ПВЗ
 */
class PvzModule {
  constructor() {
    this.currentPage = 1;
    this.pageSize = 20;
    this.totalPages = 1;
    this.totalItems = 0;
    this.currentSort = { column: 'updated_at', direction: 'desc' }; // Сортировка по умолчанию
    this.currentFilters = {
      pvzId: '',
      regions: [],
      address: '',
      company: ''
    };
    this.tableSettings = {
      columnVisibility: {},
      columnWidths: {},
      columnOrder: []
    };
    this.regions = [];
    this.data = [];
    this.allData = []; // Все данные для клиентской фильтрации
    this.filteredData = null; // Отфильтрованные данные
    this.selectedSuggestionIndex = -1;
    this.currentSuggestions = [];
    this.filterTimeout = null;
    this.currentPvzId = null;
    this.isSortingInProgress = false; // Флаг для предотвращения множественных вызовов сортировки
    
    // Кэширование данных
    this.cache = {
      data: new Map(), // Кэш данных по ключу запроса
      lastUpdate: null, // Время последнего обновления
      cacheTimeout: 5 * 60 * 1000, // 5 минут
      maxCacheSize: 100 // Максимальное количество кэшированных запросов
    };
    
    this.init();
  }

  /**
   * Инициализация модуля
   */
  async init() {
    try {
      console.log('🚀 Инициализация модуля ПВЗ...');
      
      // Проверяем доступность apiClient
      if (!window.apiClient) {
        console.error('❌ window.apiClient не найден. Ожидаем загрузки...');
        // Ждем немного и пробуем снова
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!window.apiClient) {
          console.error('❌ window.apiClient все еще не найден');
          return;
        }
      }
      console.log('✅ window.apiClient найден');
      
      // Инициализируем навигацию
      if (window.navigationModule) {
        await window.navigationModule.init();
      }
      
      // Проверяем авторизацию
      if (!window.authModule || !window.authModule.isAuthenticated()) {
        window.location.href = '/login';
        return;
      }

      // Инициализируем элементы интерфейса
      this.initElements();
      
      // Загружаем настройки таблицы
      await this.loadTableSettings();
      
      // Загружаем регионы для фильтра
      await this.loadRegions();
      
      // Загружаем данные
      await this.loadData();
      
      // Настраиваем обработчики событий
      this.setupEventListeners();
      
      // Обновляем индикаторы сортировки
      this.updateSortIndicators();
      
      // Информация о пользователе теперь управляется через MenuManager
      
      // Настраиваем сортировку
      this.setupSorting();
      
      // Настраиваем обработчик изменения размера окна
      this.setupResizeHandler();
      
      console.log('✅ Модуль ПВЗ инициализирован успешно');
    } catch (error) {
      console.error('❌ Ошибка инициализации модуля ПВЗ:', error);
      if (window.utils) {
        window.utils.showNotification('Ошибка инициализации модуля ПВЗ', 'error');
      }
    }
  }

  /**
   * Инициализация элементов интерфейса
   */
  initElements() {
    // Основные элементы
    this.elements = {
      table: document.getElementById('pvzTable'),
      tableHead: document.getElementById('tableHead'),
      tableBody: document.getElementById('tableBody'),
      pvzIdFilter: document.getElementById('pvzIdFilter'),
      regionSearchInput: document.getElementById('regionSearchInput'),
      regionSuggestions: document.getElementById('regionSuggestions'),
      selectedRegions: document.getElementById('selectedRegions'),
      addressFilter: document.getElementById('addressFilter'),
      companyFilter: document.getElementById('companyFilter'),
      btnClearFilters: document.getElementById('btnClearFilters'),
      btnExport: document.getElementById('btnExport'),
      btnRefresh: document.getElementById('btnRefresh'),
      btnTableSettings: document.getElementById('btnTableSettings'),
      btnFirstPage: document.getElementById('btnFirstPage'),
      btnPrevPage: document.getElementById('btnPrevPage'),
      btnNextPage: document.getElementById('btnNextPage'),
      btnLastPage: document.getElementById('btnLastPage'),
      paginationInfo: document.getElementById('paginationInfo'),
      paginationPages: document.getElementById('paginationPages'),
      tableSettingsModal: document.getElementById('tableSettingsModal'),
      closeTableSettings: document.getElementById('closeTableSettings'),
      columnSettings: document.getElementById('columnSettings'),
      btnResetSettings: document.getElementById('btnResetSettings'),
      btnSaveSettings: document.getElementById('btnSaveSettings'),
      commentsModal: document.getElementById('commentsModal'),
      closeCommentsModal: document.getElementById('closeCommentsModal'),
      commentsForm: document.getElementById('commentsForm'),
      newComment: document.getElementById('newComment'),
      cancelComment: document.getElementById('cancelComment'),
      saveComment: document.getElementById('saveComment'),
      commentsList: document.getElementById('commentsList')
    };
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
   * Настройка сортировки
   */
  setupSorting() {
    if (!this.elements.tableHead) return;

    // Очищаем все старые обработчики
    const sortableHeaders = this.elements.tableHead.querySelectorAll('.sortable');
    sortableHeaders.forEach(header => {
      // Клонируем элемент, чтобы удалить все обработчики
      const newHeader = header.cloneNode(true);
      header.parentNode.replaceChild(newHeader, header);
    });

    // Получаем обновленные элементы
    const updatedHeaders = this.elements.tableHead.querySelectorAll('.sortable');
    updatedHeaders.forEach(header => {
      header.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        const column = header.dataset.column;
        console.log('🖱️ Клик по заголовку сортировки:', column);
        console.log('🖱️ Текущее состояние перед кликом:', this.currentSort);
        
        this.handleSort(column);
      });
    });
    
    console.log('✅ Обработчики сортировки настроены для', updatedHeaders.length, 'заголовков');
  }

  /**
   * Обработка сортировки
   */
  handleSort(column) {
    // Защита от множественных вызовов
    if (this.isSortingInProgress) {
      console.log('⚠️ Сортировка уже выполняется, пропускаем');
      return;
    }
    
    this.isSortingInProgress = true;
    
    console.log('🔄 Сортировка по колонке:', column);
    console.log('🔄 Текущая сортировка:', this.currentSort);
    
    if (this.currentSort.column === column) {
      // Переключаем направление сортировки
      const oldDirection = this.currentSort.direction;
      this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
      console.log(`🔄 Переключение направления: ${oldDirection} -> ${this.currentSort.direction}`);
    } else {
      // Новая колонка, начинаем с возрастающей сортировки
      this.currentSort.column = column;
      this.currentSort.direction = 'asc';
      console.log('🔄 Новая колонка, устанавливаем ASC');
    }

    console.log('📊 Новые параметры сортировки:', this.currentSort);

    // Обновляем визуальные индикаторы сразу
    this.updateSortIndicators();
    
    // Применяем сортировку на клиенте
    this.applyClientSideSorting();
    
    this.isSortingInProgress = false;
  }

  /**
   * Обновление индикаторов сортировки
   */
  updateSortIndicators() {
    if (!this.elements.tableHead) return;

    const sortableHeaders = this.elements.tableHead.querySelectorAll('.sortable');
    console.log('🔄 Обновляем индикаторы сортировки для', sortableHeaders.length, 'заголовков');
    console.log('🔄 Активная сортировка:', this.currentSort);
    
    sortableHeaders.forEach(header => {
      const column = header.dataset.column;
      if (column === this.currentSort.column) {
        header.dataset.sort = this.currentSort.direction;
        console.log(`✅ Устанавливаем индикатор для ${column}: ${this.currentSort.direction}`);
      } else {
        header.dataset.sort = 'none';
        console.log(`➖ Сбрасываем индикатор для ${column}: none`);
      }
    });
  }

  /**
   * Настройка обработчика изменения размера окна
   */
  setupResizeHandler() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.updateColumnWidths();
      }, 250);
    });
  }

  /**
   * Настройка обработчиков событий
   */
  setupEventListeners() {
    // Фильтры регионов
    if (this.elements.regionSearchInput) {
      this.elements.regionSearchInput.addEventListener('input', (e) => {
        this.handleRegionSearch(e.target.value);
      });
      
      // Закрытие списка предложений при потере фокуса
      this.elements.regionSearchInput.addEventListener('blur', () => {
        setTimeout(() => {
          this.updateRegionSuggestions([]);
        }, 150);
      });
      
      // Поддержка клавиатуры
      this.elements.regionSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.updateRegionSuggestions([]);
          this.elements.regionSearchInput.blur();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.navigateSuggestions(1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.navigateSuggestions(-1);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this.selectHighlightedSuggestion();
        }
      });
    }


    if (this.elements.pvzIdFilter) {
      this.elements.pvzIdFilter.addEventListener('input', (e) => {
        this.handleTextFilterChange('pvzId', e.target.value);
      });
    }

    if (this.elements.addressFilter) {
      this.elements.addressFilter.addEventListener('input', (e) => {
        this.handleTextFilterChange('address', e.target.value);
      });
    }

    if (this.elements.companyFilter) {
      this.elements.companyFilter.addEventListener('input', (e) => {
        this.handleTextFilterChange('company', e.target.value);
      });
    }

    // Кнопки фильтров
    if (this.elements.btnClearFilters) {
      this.elements.btnClearFilters.addEventListener('click', () => {
        this.clearFilters();
      });
    }

    if (this.elements.btnExport && !this.elements.btnExport.hasAttribute('data-listener-added')) {
      this.elements.btnExport.addEventListener('click', () => {
        this.exportData();
      });
      this.elements.btnExport.setAttribute('data-listener-added', 'true');
    }


    // Кнопка обновления
    if (this.elements.btnRefresh) {
      this.elements.btnRefresh.addEventListener('click', () => {
        this.refreshData({ clearCache: true, forceRefresh: true });
      });
    }

    // Пагинация
    if (this.elements.btnFirstPage) {
      this.elements.btnFirstPage.addEventListener('click', () => {
        this.currentPage = 1;
        this.handlePaginationChange();
      });
    }

    if (this.elements.btnPrevPage) {
      this.elements.btnPrevPage.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.handlePaginationChange();
        }
      });
    }

    if (this.elements.btnNextPage) {
      this.elements.btnNextPage.addEventListener('click', () => {
        if (this.currentPage < this.totalPages) {
          this.currentPage++;
          this.handlePaginationChange();
        }
      });
    }

    if (this.elements.btnLastPage) {
      this.elements.btnLastPage.addEventListener('click', () => {
        this.currentPage = this.totalPages;
        this.handlePaginationChange();
      });
    }

    // Настройки таблицы
    if (this.elements.btnTableSettings) {
      this.elements.btnTableSettings.addEventListener('click', () => {
        this.showTableSettings();
      });
    }

    if (this.elements.closeTableSettings) {
      this.elements.closeTableSettings.addEventListener('click', () => {
        this.hideTableSettings();
      });
    }

    if (this.elements.btnResetSettings) {
      this.elements.btnResetSettings.addEventListener('click', () => {
        this.resetTableSettings();
      });
    }

    if (this.elements.btnSaveSettings) {
      this.elements.btnSaveSettings.addEventListener('click', () => {
        this.saveTableSettings();
      });
    }

    // Клик по overlay для закрытия модального окна
    if (this.elements.tableSettingsModal) {
      this.elements.tableSettingsModal.addEventListener('click', (e) => {
        if (e.target === this.elements.tableSettingsModal) {
          this.hideTableSettings();
        }
      });
    }

    // Выход из системы
    // Кнопка выхода настраивается в модуле навигации

    // Модальное окно комментариев
    if (this.elements.closeCommentsModal) {
      this.elements.closeCommentsModal.addEventListener('click', () => {
        this.hideCommentsModal();
      });
    }

    if (this.elements.cancelComment) {
      this.elements.cancelComment.addEventListener('click', () => {
        this.hideCommentsModal();
      });
    }

    if (this.elements.commentsForm && !this.elements.commentsForm.hasAttribute('data-listener-added')) {
      this.elements.commentsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveComment();
      });
      this.elements.commentsForm.setAttribute('data-listener-added', 'true');
    }

    // Клик по overlay для закрытия модального окна комментариев
    if (this.elements.commentsModal) {
      this.elements.commentsModal.addEventListener('click', (e) => {
        if (e.target === this.elements.commentsModal) {
          this.hideCommentsModal();
        }
      });
    }
  }

  /**
   * Генерация ключа кэша для запроса
   */
  generateCacheKey() {
    const key = JSON.stringify({
      page: this.currentPage,
      limit: this.pageSize,
      sort: this.currentSort,
      filters: this.currentFilters
    });
    
    console.log('🔑 Генерируем ключ кэша для:', {
      page: this.currentPage,
      limit: this.pageSize,
      sort: this.currentSort,
      filters: this.currentFilters
    });
    
    // Безопасное кодирование в base64 с поддержкой Unicode
    try {
      const cacheKey = btoa(unescape(encodeURIComponent(key)));
      console.log('🔑 Ключ кэша:', cacheKey.substring(0, 20) + '...');
      return cacheKey;
    } catch (error) {
      // Если не удается кодировать, используем простой хэш
      const hashKey = this.simpleHash(key);
      console.log('🔑 Ключ кэша (хэш):', hashKey);
      return hashKey;
    }
  }

  /**
   * Простая хэш-функция для генерации ключа кэша
   */
  simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Проверка актуальности кэша
   */
  isCacheValid() {
    if (!this.cache.lastUpdate) return false;
    return (Date.now() - this.cache.lastUpdate) < this.cache.cacheTimeout;
  }

  /**
   * Получение данных из кэша
   */
  getCachedData() {
    const cacheKey = this.generateCacheKey();
    const cachedData = this.cache.data.get(cacheKey);
    
    if (cachedData) {
      console.log('📦 Найдены кэшированные данные для ключа:', cacheKey.substring(0, 20) + '...');
    }
    
    return cachedData;
  }

  /**
   * Сохранение данных в кэш
   */
  setCachedData(data) {
    const cacheKey = this.generateCacheKey();
    
    // Ограничиваем размер кэша
    if (this.cache.data.size >= this.cache.maxCacheSize) {
      const firstKey = this.cache.data.keys().next().value;
      this.cache.data.delete(firstKey);
      console.log('🗑️ Удален старый кэш, размер превышен');
    }
    
    this.cache.data.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });
    
    this.cache.lastUpdate = Date.now();
    console.log('💾 Данные сохранены в кэш, ключ:', cacheKey.substring(0, 20) + '...');
  }

  /**
   * Очистка кэша
   */
  clearCache() {
    const cacheSize = this.cache.data.size;
    this.cache.data.clear();
    this.cache.lastUpdate = null;
    console.log(`🗑️ Кэш очищен (было ${cacheSize} записей)`);
  }

  /**
   * Универсальный метод для обновления данных с опциями
   */
  async refreshData(options = {}) {
    const {
      clearCache: shouldClearCache = false,
      resetPage = false,
      forceRefresh = false
    } = options;

    console.log('🔄 refreshData вызван с опциями:', options);
    console.log('🔄 Текущее состояние сортировки:', this.currentSort);

    if (shouldClearCache) {
      console.log('🗑️ Очищаем кэш перед обновлением данных');
      this.clearCache();
    }

    if (resetPage) {
      this.currentPage = 1;
    }

    await this.loadData(forceRefresh);
    console.log('✅ refreshData завершен');
  }

  /**
   * Загрузка данных ПВЗ
   */
  async loadData(forceRefresh = false) {
    try {
      // Проверяем доступность apiClient
      if (!window.apiClient) {
        console.error('❌ window.apiClient не найден');
        throw new Error('API клиент не инициализирован');
      }
      
      // Проверяем кэш, если не принудительное обновление
      if (!forceRefresh) {
        try {
          const cachedData = this.getCachedData();
          if (cachedData && this.isCacheValid()) {
            console.log('📦 Используем кэшированные данные');
            this.data = cachedData.data.items;
            this.totalPages = cachedData.data.pagination.pages;
            this.totalItems = cachedData.data.pagination.total;
            this.renderTable();
            this.updatePagination();
            return;
          } else {
            console.log('📦 Кэш не найден или устарел, загружаем с сервера');
          }
        } catch (cacheError) {
          console.warn('⚠️ Ошибка работы с кэшем, загружаем данные с сервера:', cacheError);
          this.clearCache(); // Очищаем поврежденный кэш
        }
      } else {
        console.log('📦 Принудительное обновление, игнорируем кэш');
      }
      
      console.log('📊 Загрузка данных ПВЗ...');
      console.log('🔍 Параметры:', {
        page: this.currentPage,
        limit: this.pageSize,
        sort: this.currentSort,
        filters: this.currentFilters
      });
      
      const params = new URLSearchParams();
      // Убираем все параметры - сервер возвращает все данные без фильтрации и сортировки

      const url = `/api/data/pvz-with-comments?${params}`;
      console.log('🌐 URL запроса:', url);
      
      const response = await window.apiClient.get(url);
      console.log('📡 Ответ сервера:', response);
      
      if (response && response.success) {
        console.log('📊 Данные от сервера:', {
          items: response.data.items ? response.data.items.length : 0,
          total: response.data.total
        });
        
        // Сохраняем все данные для клиентской обработки
        this.allData = response.data.items;
        this.data = response.data.items; // Для совместимости
        this.totalItems = response.data.total;
        
        // Проверяем уникальность PVZID на клиенте
        const pvzIds = this.allData.map(item => item.pvz_id);
        const uniquePvzIds = [...new Set(pvzIds)];
        console.log(`🔍 Клиент: Проверка уникальности PVZID: ${pvzIds.length} записей, ${uniquePvzIds.length} уникальных PVZID`);
        
        if (pvzIds.length !== uniquePvzIds.length) {
          console.warn('⚠️ Клиент: Обнаружены дублирующиеся PVZID!');
          const duplicates = pvzIds.filter((id, index) => pvzIds.indexOf(id) !== index);
          console.warn('⚠️ Клиент: Дублирующиеся PVZID:', [...new Set(duplicates)]);
        }
        
        console.log('📊 Обновленные данные:', {
          allDataLength: this.allData.length,
          dataLength: this.data.length,
          totalItems: this.totalItems,
          currentPage: this.currentPage
        });
        
        // Сбрасываем отфильтрованные данные при загрузке новых данных
        this.filteredData = null;
        
        // Сохраняем в кэш
        try {
          this.setCachedData(response.data);
        } catch (cacheError) {
          console.warn('⚠️ Ошибка сохранения в кэш:', cacheError);
          // Продолжаем работу без кэша
        }
        
        console.log('🖼️ Вызываем renderTable...');
        this.renderTable();
        console.log('📄 Вызываем updatePagination...');
        this.updatePagination();
        console.log(`✅ Загружено ${this.allData.length} записей ПВЗ`);
      } else {
        const errorMessage = response?.error || response?.details || 'Ошибка загрузки данных';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки данных ПВЗ:', error);
      console.error('❌ Детали ошибки:', {
        message: error.message,
        stack: error.stack,
        currentPage: this.currentPage,
        currentSort: this.currentSort,
        currentFilters: this.currentFilters
      });
      if (window.utils) {
        window.utils.showNotification(`Ошибка загрузки данных ПВЗ: ${error.message}`, 'error');
      }
    }
  }

  /**
   * Загрузка регионов для фильтра
   */
  async loadRegions() {
    try {
      console.log('🔄 Загрузка регионов...');
      const response = await window.apiClient.get('/api/data/regions');
      if (response.success) {
        this.regions = response.data;
        console.log(`✅ Загружено ${this.regions.length} регионов:`, this.regions.slice(0, 5));
      } else {
        console.error('❌ Ошибка ответа сервера:', response);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки регионов:', error);
    }
  }

  /**
   * Обработка поиска регионов
   */
  handleRegionSearch(query) {
    if (!query || query.length < 2) {
      this.updateRegionSuggestions([]);
      return;
    }

    const filteredRegions = this.regions.filter(region => 
      region.toLowerCase().includes(query.toLowerCase())
    );

    this.updateRegionSuggestions(filteredRegions);
  }

  /**
   * Обновление списка предложений регионов
   */
  updateRegionSuggestions(regions) {
    if (!this.elements.regionSuggestions) return;

    this.elements.regionSuggestions.innerHTML = '';
    this.currentSuggestions = regions;
    this.selectedSuggestionIndex = -1;

    if (regions.length === 0) {
      this.elements.regionSuggestions.classList.remove('show');
      return;
    }

    regions.forEach((region, index) => {
      const suggestion = document.createElement('div');
      suggestion.className = 'suggestion-item';
      suggestion.textContent = region;
      suggestion.dataset.index = index;
      suggestion.addEventListener('click', () => {
        this.addRegionDirectly(region);
        this.updateRegionSuggestions([]);
        if (this.elements.regionSearchInput) {
          this.elements.regionSearchInput.value = '';
        }
      });
      this.elements.regionSuggestions.appendChild(suggestion);
    });

    this.elements.regionSuggestions.classList.add('show');
  }

  /**
   * Добавление региона напрямую
   */
  addRegionDirectly(region) {
    if (!this.currentFilters.regions.includes(region)) {
      this.currentFilters.regions.push(region);
      this.renderSelectedRegions();
      this.applyClientSideFilters(); // Применяем фильтр на клиенте
      if (window.utils) {
        window.utils.showNotification(`Регион "${region}" добавлен`, 'success');
      }
    } else {
      if (window.utils) {
        window.utils.showNotification(`Регион "${region}" уже добавлен`, 'warning');
      }
    }
  }

  /**
   * Добавление выбранного региона
   */
  addSelectedRegion() {
    const input = this.elements.regionSearchInput;
    if (!input || !input.value.trim()) return;

    const region = input.value.trim();
    this.addRegionDirectly(region);
    input.value = '';
    this.updateRegionSuggestions([]);
  }

  /**
   * Навигация по предложениям с клавиатуры
   */
  navigateSuggestions(direction) {
    if (this.currentSuggestions.length === 0) return;

    // Убираем выделение с текущего элемента
    if (this.selectedSuggestionIndex >= 0) {
      const currentSuggestion = this.elements.regionSuggestions.querySelector(`[data-index="${this.selectedSuggestionIndex}"]`);
      if (currentSuggestion) {
        currentSuggestion.classList.remove('highlighted');
      }
    }

    // Вычисляем новый индекс
    this.selectedSuggestionIndex += direction;

    // Ограничиваем индекс
    if (this.selectedSuggestionIndex < 0) {
      this.selectedSuggestionIndex = this.currentSuggestions.length - 1;
    } else if (this.selectedSuggestionIndex >= this.currentSuggestions.length) {
      this.selectedSuggestionIndex = 0;
    }

    // Выделяем новый элемент
    const newSuggestion = this.elements.regionSuggestions.querySelector(`[data-index="${this.selectedSuggestionIndex}"]`);
    if (newSuggestion) {
      newSuggestion.classList.add('highlighted');
      newSuggestion.scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * Выбор выделенного предложения
   */
  selectHighlightedSuggestion() {
    if (this.selectedSuggestionIndex >= 0 && this.selectedSuggestionIndex < this.currentSuggestions.length) {
      const region = this.currentSuggestions[this.selectedSuggestionIndex];
      this.addRegionDirectly(region);
      this.updateRegionSuggestions([]);
      if (this.elements.regionSearchInput) {
        this.elements.regionSearchInput.value = '';
      }
    } else {
      // Если ничего не выделено, добавляем то, что введено в поле
      this.addSelectedRegion();
    }
  }

  /**
   * Отображение выбранных регионов
   */
  renderSelectedRegions() {
    if (!this.elements.selectedRegions) return;

    this.elements.selectedRegions.innerHTML = '';
    
    this.currentFilters.regions.forEach(region => {
      const regionCloud = document.createElement('span');
      regionCloud.className = 'region-cloud';
      regionCloud.innerHTML = `
        <span class="region-name" title="${region}">${this.truncateText(region, 20)}</span>
        <button class="remove-region-btn" data-region="${region}">&times;</button>
      `;
      
      const removeBtn = regionCloud.querySelector('.remove-region-btn');
      removeBtn.addEventListener('click', () => {
        this.removeRegion(region);
      });
      
      this.elements.selectedRegions.appendChild(regionCloud);
    });
  }

  /**
   * Удаление региона из фильтра
   */
  removeRegion(region) {
    this.currentFilters.regions = this.currentFilters.regions.filter(r => r !== region);
    this.renderSelectedRegions();
    this.applyClientSideFilters(); // Применяем фильтр на клиенте
  }


  /**
   * Применение сортировки на клиенте
   */
  applyClientSideSorting() {
    console.log('🔄 Применяем сортировку на клиенте...');
    
    if (!this.allData || this.allData.length === 0) {
      console.log('📡 Нет данных для сортировки');
      return;
    }
    
    // Сортируем данные на клиенте
    const sortedData = [...this.allData].sort((a, b) => {
      const column = this.currentSort.column;
      const direction = this.currentSort.direction;
      
      let valueA = a[column] || '';
      let valueB = b[column] || '';
      
      // Обработка разных типов данных
      if (column === 'transaction_amount') {
        // Числовые значения
        valueA = parseFloat(valueA) || 0;
        valueB = parseFloat(valueB) || 0;
      } else if (column.includes('date') || column.includes('Date')) {
        // Даты
        valueA = new Date(valueA) || new Date(0);
        valueB = new Date(valueB) || new Date(0);
      } else {
        // Текстовые значения
        valueA = String(valueA).toLowerCase();
        valueB = String(valueB).toLowerCase();
      }
      
      let result = 0;
      if (valueA < valueB) result = -1;
      else if (valueA > valueB) result = 1;
      
      return direction === 'desc' ? -result : result;
    });
    
    console.log(`✅ Отсортировано ${sortedData.length} записей по ${this.currentSort.column} ${this.currentSort.direction}`);
    
    // Обновляем данные
    this.allData = sortedData;
    this.data = sortedData; // Для совместимости
    
    // Сбрасываем отфильтрованные данные
    this.filteredData = null;
    
    // Применяем фильтры, если они есть
    if (this.currentFilters.regions.length > 0 || 
        this.currentFilters.address || 
        this.currentFilters.company) {
      this.applyClientSideFilters();
    } else {
      // Просто перерисовываем таблицу
      this.currentPage = 1;
      this.renderTable();
      this.updatePagination();
    }
  }

  /**
   * Применение фильтров на клиенте (без запроса к серверу)
   */
  applyClientSideFilters() {
    console.log('🔍 Применяем фильтры на клиенте...');
    
    // Если у нас нет загруженных данных, загружаем их
    if (!this.allData || this.allData.length === 0) {
      console.log('📡 Нет данных для фильтрации, загружаем...');
      this.loadData();
      return;
    }
    
    // Фильтруем данные на клиенте
    let filteredData = [...this.allData];
    
    // Фильтр по PVZ ID
    if (this.currentFilters.pvzId && this.currentFilters.pvzId.trim()) {
      const pvzIdFilter = this.currentFilters.pvzId.toLowerCase().trim();
      filteredData = filteredData.filter(item => 
        item.pvz_id && item.pvz_id.toLowerCase().includes(pvzIdFilter)
      );
    }
    
    // Фильтр по регионам
    if (this.currentFilters.regions.length > 0) {
      filteredData = filteredData.filter(item => 
        this.currentFilters.regions.includes(item.region)
      );
    }
    
    // Фильтр по адресу
    if (this.currentFilters.address && this.currentFilters.address.trim()) {
      const addressFilter = this.currentFilters.address.toLowerCase().trim();
      filteredData = filteredData.filter(item => 
        item.address && item.address.toLowerCase().includes(addressFilter)
      );
    }
    
    // Фильтр по компании
    if (this.currentFilters.company && this.currentFilters.company.trim()) {
      const companyFilter = this.currentFilters.company.toLowerCase().trim();
      filteredData = filteredData.filter(item => 
        item.company_name && item.company_name.toLowerCase().includes(companyFilter)
      );
    }
    
    console.log(`✅ Отфильтровано ${filteredData.length} записей из ${this.allData.length}`);
    
    // Обновляем отображение
    this.currentPage = 1;
    this.filteredData = filteredData;
    this.renderTable();
    this.updatePagination();
  }

  /**
   * Обработка изменения текстовых фильтров
   */
  handleTextFilterChange(type, value) {
    this.currentFilters[type] = value;
    
    // Очищаем предыдущий таймер
    if (this.filterTimeout) {
      clearTimeout(this.filterTimeout);
    }
    
    // Устанавливаем новый таймер для применения фильтра
    this.filterTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.applyClientSideFilters();
    }, 300); // Уменьшили задержку для более быстрого отклика
  }

  /**
   * Очистка всех фильтров
   */
  clearFilters() {
    this.currentFilters = {
      pvzId: '',
      regions: [],
      address: '',
      company: ''
    };
    
    if (this.elements.pvzIdFilter) {
      this.elements.pvzIdFilter.value = '';
    }
    if (this.elements.regionSearchInput) {
      this.elements.regionSearchInput.value = '';
    }
    if (this.elements.addressFilter) {
      this.elements.addressFilter.value = '';
    }
    if (this.elements.companyFilter) {
      this.elements.companyFilter.value = '';
    }
    
    this.updateRegionSuggestions([]);
    this.renderSelectedRegions();
    
    // Сбрасываем клиентские фильтры
    this.filteredData = null;
    this.currentPage = 1;
    
    // Перерисовываем таблицу с исходными данными
    this.renderTable();
    this.updatePagination();
  }

  /**
   * Применение фильтров
   */
  applyFilters() {
    this.applyClientSideFilters();
  }

  /**
   * Отображение таблицы
   */
  renderTable() {
    if (!this.elements.tableBody) return;

    // Используем отфильтрованные данные, если они есть, иначе обычные данные
    const dataToRender = this.filteredData || this.data;
    
    console.log('🖼️ renderTable - данные для отображения:', {
      filteredData: this.filteredData ? this.filteredData.length : 0,
      data: this.data.length,
      dataToRender: dataToRender.length,
      currentPage: this.currentPage,
      pageSize: this.pageSize
    });
    
    if (dataToRender.length === 0) {
      this.elements.tableBody.innerHTML = `
        <tr>
          <td colspan="15" style="text-align: center; color: var(--text-muted);">
            Данные не найдены
          </td>
        </tr>
      `;
      return;
    }

    // Всегда применяем клиентскую пагинацию
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    const paginatedData = dataToRender.slice(startIndex, endIndex);
    
    console.log('🖼️ renderTable - клиентская пагинация:', {
      startIndex,
      endIndex,
      paginatedDataLength: paginatedData.length,
      totalDataLength: dataToRender.length
    });

    this.elements.tableBody.innerHTML = paginatedData.map(item => {
      // Форматируем каждую ячейку с тултипом
      const pvzId = this.formatCellWithTooltip(item.pvz_id || '');
      const region = this.formatCellWithTooltip(item.region || '');
      const address = this.formatCellWithTooltip(item.address || '');
      const serviceName = this.formatCellWithTooltip(item.service_name || '');
      const statusDate = this.formatCellWithTooltip(item.status_date || '');
      const statusName = this.formatCellWithTooltip(item.status_name || '');
      const companyName = this.formatCellWithTooltip(item.company_name || '');
      const transactionDate = this.formatCellWithTooltip(item.transaction_date || '');
      const transactionAmount = this.formatCellWithTooltip(item.transaction_amount || '');
      const phone = this.formatCellWithTooltip(item.phone || '');
      const postalCode = this.formatCellWithTooltip(item.postal_code || '');
      const fittingRoom = this.formatCellWithTooltip(item.fitting_room || '');
      const lastComment = this.formatCellWithTooltip(item.last_comment || '');
      const commentAuthor = this.formatCellWithTooltip(item.comment_author || '');
      const commentDate = this.formatCellWithTooltip(item.comment_date || '');

      // Отладочная информация для первого элемента
      if (this.data.indexOf(item) === 0) {
        console.log('🔍 Отладка тултипов для первого элемента:', {
          address: { display: address.display, tooltip: address.tooltip },
          lastComment: { display: lastComment.display, tooltip: lastComment.tooltip },
          companyName: { display: companyName.display, tooltip: companyName.tooltip }
        });
      }

    return `
      <tr data-pvz-id="${this.escapeHtmlForAttribute(item.pvz_id)}" class="clickable-row">
        <td ${pvzId.tooltip ? `data-tooltip="${this.escapeHtmlForAttribute(pvzId.tooltip)}"` : ''}>${this.escapeHtml(pvzId.display)}</td>
        <td ${region.tooltip ? `data-tooltip="${this.escapeHtmlForAttribute(region.tooltip)}"` : ''}>${this.escapeHtml(region.display)}</td>
        <td ${address.tooltip ? `data-tooltip="${this.escapeHtmlForAttribute(address.tooltip)}"` : ''}>${this.escapeHtml(address.display)}</td>
        <td ${serviceName.tooltip ? `data-tooltip="${this.escapeHtmlForAttribute(serviceName.tooltip)}"` : ''}>${this.escapeHtml(serviceName.display)}</td>
        <td ${statusDate.tooltip ? `data-tooltip="${this.escapeHtmlForAttribute(statusDate.tooltip)}"` : ''}>${this.escapeHtml(statusDate.display)}</td>
        <td ${statusName.tooltip ? `data-tooltip="${this.escapeHtmlForAttribute(statusName.tooltip)}"` : ''}>${this.escapeHtml(statusName.display)}</td>
        <td ${companyName.tooltip ? `data-tooltip="${this.escapeHtmlForAttribute(companyName.tooltip)}"` : ''}>${this.escapeHtml(companyName.display)}</td>
        <td ${transactionDate.tooltip ? `data-tooltip="${this.escapeHtmlForAttribute(transactionDate.tooltip)}"` : ''}>${this.escapeHtml(transactionDate.display)}</td>
        <td ${transactionAmount.tooltip ? `data-tooltip="${this.escapeHtmlForAttribute(transactionAmount.tooltip)}"` : ''}>${this.escapeHtml(transactionAmount.display)}</td>
        <td ${phone.tooltip ? `data-tooltip="${this.escapeHtmlForAttribute(phone.tooltip)}"` : ''}>${this.escapeHtml(phone.display)}</td>
        <td ${postalCode.tooltip ? `data-tooltip="${this.escapeHtmlForAttribute(postalCode.tooltip)}"` : ''}>${this.escapeHtml(postalCode.display)}</td>
        <td ${fittingRoom.tooltip ? `data-tooltip="${this.escapeHtmlForAttribute(fittingRoom.tooltip)}"` : ''}>${this.escapeHtml(fittingRoom.display)}</td>
        <td ${lastComment.tooltip ? `data-tooltip="${this.escapeHtmlForAttribute(lastComment.tooltip)}"` : ''}>${this.escapeHtml(lastComment.display)}</td>
        <td ${commentAuthor.tooltip ? `data-tooltip="${this.escapeHtmlForAttribute(commentAuthor.tooltip)}"` : ''}>${this.escapeHtml(commentAuthor.display)}</td>
        <td ${commentDate.tooltip ? `data-tooltip="${this.escapeHtmlForAttribute(commentDate.tooltip)}"` : ''}>${this.escapeHtml(commentDate.display)}</td>
      </tr>
    `;
    }).join('');

    // После рендеринга обновляем ширину столбцов с небольшой задержкой
    setTimeout(() => {
      this.updateColumnWidths();
      // Применяем настройки видимости столбцов только если элементы существуют
      if (this.elements.tableHead && this.elements.tableBody) {
        this.applyColumnVisibility();
      }
      
      // Отладочная проверка тултипов
      this.debugTooltips();
      
      // Добавляем обработчики клика по строкам
      this.setupRowClickHandlers();
    }, 100);
  }

  /**
   * Обработка изменения страницы пагинации
   */
  handlePaginationChange() {
    console.log('📄 Изменение страницы:', this.currentPage);
    console.log('📄 Состояние filteredData:', this.filteredData ? 'есть' : 'нет');
    console.log('📄 Количество отфильтрованных данных:', this.filteredData ? this.filteredData.length : 0);
    
    // Всегда используем клиентскую пагинацию
    console.log('🔄 Перерисовываем таблицу с клиентской пагинацией');
    this.renderTable();
    this.updatePagination();
  }

  /**
   * Обновление пагинации
   */
  updatePagination() {
    // Определяем данные для пагинации
    const dataForPagination = this.filteredData || this.allData || [];
    
    console.log('📄 updatePagination - состояние:', {
      filteredData: this.filteredData ? this.filteredData.length : 0,
      allData: this.allData ? this.allData.length : 0,
      dataForPagination: dataForPagination.length,
      currentPage: this.currentPage
    });
    
    // Пересчитываем пагинацию на основе данных
    this.totalItems = dataForPagination.length;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);
    
    console.log('📄 updatePagination - пересчитано:', {
      totalItems: this.totalItems,
      totalPages: this.totalPages
    });
    
    if (this.elements.btnFirstPage) {
      this.elements.btnFirstPage.disabled = this.currentPage <= 1;
    }
    
    if (this.elements.btnPrevPage) {
      this.elements.btnPrevPage.disabled = this.currentPage <= 1;
    }
    
    if (this.elements.btnNextPage) {
      this.elements.btnNextPage.disabled = this.currentPage >= this.totalPages;
    }
    
    if (this.elements.btnLastPage) {
      this.elements.btnLastPage.disabled = this.currentPage >= this.totalPages;
    }
    
    // Обновляем информацию о пагинации
    if (this.elements.paginationInfo) {
      const startItem = (this.currentPage - 1) * this.pageSize + 1;
      const endItem = Math.min(this.currentPage * this.pageSize, this.totalItems);
      
      this.elements.paginationInfo.textContent = `Показано ${startItem}-${endItem} из ${this.totalItems}`;
    }
    
    // Обновляем номера страниц
    this.updatePaginationPages();
  }

  /**
   * Обновление номеров страниц
   */
  updatePaginationPages() {
    if (!this.elements.paginationPages) return;

    this.elements.paginationPages.innerHTML = '';

    if (this.totalPages <= 1) {
      const pageBtn = document.createElement('button');
      pageBtn.className = 'pagination-page active';
      pageBtn.textContent = '1';
      this.elements.paginationPages.appendChild(pageBtn);
      return;
    }

    // Определяем диапазон страниц для отображения
    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(this.totalPages, this.currentPage + 2);

    // Если мы в начале, показываем больше страниц справа
    if (this.currentPage <= 3) {
      endPage = Math.min(this.totalPages, 5);
    }

    // Если мы в конце, показываем больше страниц слева
    if (this.currentPage >= this.totalPages - 2) {
      startPage = Math.max(1, this.totalPages - 4);
    }

    // Добавляем первую страницу если нужно
    if (startPage > 1) {
      const firstBtn = document.createElement('button');
      firstBtn.className = 'pagination-page';
      firstBtn.textContent = '1';
      firstBtn.addEventListener('click', () => {
        this.currentPage = 1;
        this.handlePaginationChange();
      });
      this.elements.paginationPages.appendChild(firstBtn);

      if (startPage > 2) {
        const dots = document.createElement('span');
        dots.textContent = '...';
        dots.style.padding = '0 8px';
        dots.style.color = 'var(--text-muted)';
        this.elements.paginationPages.appendChild(dots);
      }
    }

    // Добавляем страницы в диапазоне
    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `pagination-page ${i === this.currentPage ? 'active' : ''}`;
      pageBtn.textContent = i.toString();
      pageBtn.addEventListener('click', () => {
        this.currentPage = i;
        this.handlePaginationChange();
      });
      this.elements.paginationPages.appendChild(pageBtn);
    }

    // Добавляем последнюю страницу если нужно
    if (endPage < this.totalPages) {
      if (endPage < this.totalPages - 1) {
        const dots = document.createElement('span');
        dots.textContent = '...';
        dots.style.padding = '0 8px';
        dots.style.color = 'var(--text-muted)';
        this.elements.paginationPages.appendChild(dots);
      }

      const lastBtn = document.createElement('button');
      lastBtn.className = 'pagination-page';
      lastBtn.textContent = this.totalPages.toString();
      lastBtn.addEventListener('click', () => {
        this.currentPage = this.totalPages;
        this.handlePaginationChange();
      });
      this.elements.paginationPages.appendChild(lastBtn);
    }
  }

  /**
   * Форматирование содержимого ячейки
   */
  formatCellContent(text) {
    // Преобразуем в строку и обрабатываем null/undefined
    const textStr = String(text || '');
    if (!textStr) return '';
    
    // Если текст длиннее 75 символов, обрезаем до 3 строк
    if (textStr.length > 75) {
      return this.truncateToLines(textStr, 75);
    }
    
    // Если текст длиннее 25 символов, добавляем переносы для лучшего отображения
    if (textStr.length > 25) {
      return this.addLineBreaks(textStr, 25);
    }
    
    return textStr;
  }

  /**
   * Форматирование ячейки с тултипом
   */
  formatCellWithTooltip(text, originalText = null) {
    // Преобразуем в строку и обрабатываем null/undefined
    const textStr = String(text || '');
    const displayText = this.formatCellContent(textStr);
    const tooltipText = originalText || textStr;
    
    // Добавляем тултип если:
    // 1. Текст был обрезан или изменен
    // 2. Текст длиннее 25 символов
    // 3. Текст содержит переносы строк
    if (displayText !== tooltipText || textStr.length > 25 || textStr.includes('\n')) {
      return {
        display: displayText,
        tooltip: tooltipText
      };
    }
    
    return {
      display: displayText,
      tooltip: null
    };
  }

  /**
   * Добавление переносов строк для длинного текста
   */
  addLineBreaks(text, maxLineLength) {
    if (text.length <= maxLineLength) {
      return text;
    }
    
    // Для адресов используем более умный алгоритм переноса
    if (text.includes(',')) {
      return this.addLineBreaksForAddress(text, maxLineLength);
    }
    
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      if (testLine.length <= maxLineLength) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Если слово само по себе длиннее maxLineLength, обрезаем его
          lines.push(word.substring(0, maxLineLength - 3) + '...');
          currentLine = '';
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.join('\n');
  }

  /**
   * Специальный алгоритм переноса для адресов
   */
  addLineBreaksForAddress(address, maxLineLength) {
    // Разбиваем адрес по запятым
    const parts = address.split(',').map(part => part.trim());
    const lines = [];
    let currentLine = '';
    
    for (const part of parts) {
      const testLine = currentLine + (currentLine ? ', ' : '') + part;
      
      if (testLine.length <= maxLineLength) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = part;
        } else {
          // Если часть сама по себе длиннее maxLineLength, разбиваем её по словам
          const words = part.split(' ');
          let wordLine = '';
          
          for (const word of words) {
            const testWordLine = wordLine + (wordLine ? ' ' : '') + word;
            if (testWordLine.length <= maxLineLength) {
              wordLine = testWordLine;
            } else {
              if (wordLine) {
                lines.push(wordLine);
                wordLine = word;
              } else {
                // Если слово само по себе длиннее maxLineLength, обрезаем его
                lines.push(word.substring(0, maxLineLength - 3) + '...');
                wordLine = '';
              }
            }
          }
          
          if (wordLine) {
            currentLine = wordLine;
          }
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.join('\n');
  }

  /**
   * Обрезка текста до определенного количества строк
   */
  truncateToLines(text, maxLength) {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Обрезаем до maxLength символов и добавляем троеточие
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Обновление ширины столбцов на основе содержимого
   */
  updateColumnWidths() {
    if (!this.elements.table || !this.elements.tableHead) return;

    const headers = this.elements.tableHead.querySelectorAll('th');
    
    // Устанавливаем CSS переменные для ширины столбцов
    headers.forEach((header, index) => {
      const column = header.dataset.column;
      if (!column) return;

      // Определяем оптимальную ширину в зависимости от типа столбца
      let optimalWidth;
      if (['pvz_id', 'phone', 'postal_code'].includes(column)) {
        optimalWidth = '80px'; // Короткие поля
      } else if (['region', 'status_name', 'company_name'].includes(column)) {
        optimalWidth = '120px'; // Средние поля
      } else if (['address', 'last_comment'].includes(column)) {
        optimalWidth = '200px'; // Длинные поля
      } else {
        optimalWidth = '100px'; // Остальные поля
      }

      // Устанавливаем CSS переменную для ширины столбца
      this.elements.table.style.setProperty(`--col-${index}-width`, optimalWidth);
    });
  }

  /**
   * Получение ширины текста в пикселях
   */
  getTextWidth(text) {
    if (!text) return 0;
    
    // Создаем временный элемент для измерения
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    
    const metrics = context.measureText(text);
    return Math.ceil(metrics.width) + 24; // Добавляем padding
  }

  /**
   * Экранирование HTML для безопасности
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Экранирование HTML для атрибутов (сохраняет кавычки)
   */
  escapeHtmlForAttribute(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Отладочная проверка тултипов
   */
  debugTooltips() {
    const cells = this.elements.tableBody.querySelectorAll('td[data-tooltip]');
    console.log(`🔍 Найдено ячеек с тултипами: ${cells.length}`);
    
    if (cells.length > 0) {
      // Проверяем CSS переменные
      const root = document.documentElement;
      const bgTooltip = getComputedStyle(root).getPropertyValue('--bg-tooltip');
      const textTooltip = getComputedStyle(root).getPropertyValue('--text-tooltip');
      console.log('🔍 CSS переменные:', { bgTooltip: bgTooltip.trim(), textTooltip: textTooltip.trim() });
      
      // Добавляем обработчики событий для отладки ко всем ячейкам с тултипами
      cells.forEach((cell, index) => {
        const tooltip = cell.getAttribute('data-tooltip');
        const columnName = this.getColumnName(cell);
        
        cell.addEventListener('mouseenter', (e) => {
          console.log(`🖱️ Наведение на ячейку ${index + 1} (${columnName}): "${tooltip}"`);
          this.updateTooltipPosition(e, cell);
        });
        
        cell.addEventListener('mousemove', (e) => {
          this.updateTooltipPosition(e, cell);
        });
        
        cell.addEventListener('mouseleave', () => {
          console.log(`🖱️ Уход с ячейки ${index + 1} (${columnName})`);
        });
      });
    }
  }

  /**
   * Получение имени столбца для отладки
   */
  getColumnName(cell) {
    const cellIndex = Array.from(cell.parentNode.children).indexOf(cell);
    const columnNames = [
      'pvz_id', 'region', 'address', 'service_name', 'status_date', 
      'status_name', 'company_name', 'transaction_date', 'transaction_amount',
      'phone', 'postal_code', 'fitting_room', 'last_comment', 'comment_author', 'comment_date'
    ];
    return columnNames[cellIndex] || `column_${cellIndex}`;
  }

  /**
   * Обновление позиции тултипа относительно курсора мыши
   */
  updateTooltipPosition(event, cell) {
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    
    // Получаем размеры окна
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Примерные размеры тултипа
    const tooltipWidth = 300;
    const tooltipHeight = 100;
    
    // Вычисляем позицию тултипа
    let tooltipX = mouseX + 10; // 10px справа от курсора
    let tooltipY = mouseY - tooltipHeight - 10; // 10px выше курсора
    
    // Проверяем, не выходит ли тултип за границы экрана
    if (tooltipX + tooltipWidth > windowWidth) {
      tooltipX = mouseX - tooltipWidth - 10; // Слева от курсора
    }
    
    if (tooltipY < 0) {
      tooltipY = mouseY + 10; // Ниже курсора
    }
    
    // Устанавливаем позицию через CSS переменные
    document.documentElement.style.setProperty('--tooltip-x', `${tooltipX}px`);
    document.documentElement.style.setProperty('--tooltip-y', `${tooltipY}px`);
  }

  /**
   * Сокращение текста (старый метод для совместимости)
   */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text || '';
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Загрузка настроек таблицы
   */
  async loadTableSettings() {
    try {
      const response = await window.apiClient.get('/api/data/table-settings/pvz');
      if (response.success) {
        this.tableSettings = response.settings;
        // Не применяем настройки здесь, так как элементы еще не созданы
        // Настройки будут применены после рендеринга таблицы
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки настроек таблицы:', error);
    }
  }

  /**
   * Применение видимости столбцов
   */
  applyColumnVisibility() {
    if (!this.tableSettings || !this.tableSettings.columnVisibility) {
      return; // Если настройки не загружены, ничего не делаем
    }
    
    const headers = this.elements.tableHead.querySelectorAll('th');
    headers.forEach((header, index) => {
      const column = header.dataset.column;
      const isVisible = this.tableSettings.columnVisibility[column] !== false;
      
      // Скрываем/показываем заголовок
      header.style.display = isVisible ? '' : 'none';
      
      // Скрываем/показываем соответствующие ячейки в теле таблицы
      const rows = this.elements.tableBody.querySelectorAll('tr');
      rows.forEach(row => {
        const cell = row.children[index];
        if (cell) {
          cell.style.display = isVisible ? '' : 'none';
        }
      });
    });
  }

  /**
   * Применение настроек таблицы
   */
  applyTableSettings() {
    // Применяем видимость столбцов
    this.applyColumnVisibility();

    // Применяем ширину столбцов
    if (this.tableSettings.columnWidths) {
      const headers = this.elements.tableHead.querySelectorAll('th');
      headers.forEach(header => {
        const column = header.dataset.column;
        const width = this.tableSettings.columnWidths[column];
        if (width) {
          header.style.width = width;
        }
      });
    }

    // Применяем порядок столбцов
    if (this.tableSettings.columnOrder && this.tableSettings.columnOrder.length > 0) {
      this.reorderColumns(this.tableSettings.columnOrder);
    }
  }

  /**
   * Переупорядочивание столбцов
   */
  reorderColumns(newOrder) {
    // Реализация переупорядочивания столбцов
    // Это будет добавлено позже при реализации drag & drop
  }

  /**
   * Показать настройки таблицы
   */
  showTableSettings() {
    if (this.elements.tableSettingsModal) {
      this.renderColumnSettings();
      this.elements.tableSettingsModal.classList.add('show');
    }
  }

  /**
   * Скрыть настройки таблицы
   */
  hideTableSettings() {
    if (this.elements.tableSettingsModal) {
      this.elements.tableSettingsModal.classList.remove('show');
    }
  }

  /**
   * Отображение настроек столбцов
   */
  renderColumnSettings() {
    if (!this.elements.columnSettings) return;

    const columns = [
      { key: 'pvz_id', name: 'Внешний ID ПВЗ' },
      { key: 'region', name: 'Регион' },
      { key: 'address', name: 'Адрес' },
      { key: 'service_name', name: 'Наименование сервиса' },
      { key: 'status_date', name: 'Дата статуса' },
      { key: 'status_name', name: 'Наименование статуса' },
      { key: 'company_name', name: 'Наименование компании' },
      { key: 'transaction_date', name: 'Дата транзакции' },
      { key: 'transaction_amount', name: 'Сумма транзакции, руб' },
      { key: 'phone', name: 'Телефон' },
      { key: 'postal_code', name: 'Индекс' },
      { key: 'fitting_room', name: 'Примерочная' },
      { key: 'last_comment', name: 'Комментарий' },
      { key: 'comment_author', name: 'Кто комментировал' },
      { key: 'comment_date', name: 'Когда комментировал' }
    ];

    this.elements.columnSettings.innerHTML = columns.map(column => {
      const isVisible = this.tableSettings.columnVisibility[column.key] !== false;
      return `
        <div class="column-setting">
          <label>
            <input type="checkbox" ${isVisible ? 'checked' : ''} data-column="${column.key}">
            ${column.name}
          </label>
        </div>
      `;
    }).join('');

    // Добавляем обработчики для чекбоксов
    const checkboxes = this.elements.columnSettings.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const column = e.target.dataset.column;
        this.tableSettings.columnVisibility[column] = e.target.checked;
      });
    });
  }

  /**
   * Сброс настроек таблицы
   */
  async resetTableSettings() {
    try {
      await window.apiClient.delete('/api/data/table-settings/pvz');
      this.tableSettings = {
        columnVisibility: {},
        columnWidths: {},
        columnOrder: []
      };
      this.applyTableSettings();
      this.hideTableSettings();
      if (window.utils) {
        window.utils.showNotification('Настройки сброшены', 'success');
      }
    } catch (error) {
      console.error('❌ Ошибка сброса настроек:', error);
      if (window.utils) {
        window.utils.showNotification('Ошибка сброса настроек', 'error');
      }
    }
  }

  /**
   * Сохранение настроек таблицы
   */
  async saveTableSettings() {
    try {
      await window.apiClient.post('/api/data/table-settings/pvz', this.tableSettings);
      this.applyTableSettings();
      this.hideTableSettings();
      if (window.utils) {
        window.utils.showNotification('Настройки сохранены', 'success');
      }
    } catch (error) {
      console.error('❌ Ошибка сохранения настроек:', error);
      if (window.utils) {
        window.utils.showNotification('Ошибка сохранения настроек', 'error');
      }
    }
  }

  /**
   * Настройка обработчиков клика по строкам таблицы
   */
  setupRowClickHandlers() {
    if (!this.elements.tableBody) return;

    const rows = this.elements.tableBody.querySelectorAll('tr[data-pvz-id]');
    rows.forEach(row => {
      row.addEventListener('click', (e) => {
        e.preventDefault();
        const pvzId = row.dataset.pvzId;
        if (pvzId) {
          this.showCommentsModal(pvzId);
        }
      });
    });
  }

  /**
   * Показать модальное окно комментариев
   */
  async showCommentsModal(pvzId) {
    this.currentPvzId = pvzId;
    
    if (!this.elements.commentsModal) return;

    // Обновляем заголовок модального окна
    const title = this.elements.commentsModal.querySelector('.comments-modal-title');
    if (title) {
      title.textContent = `Комментарии - ПВЗ ${pvzId}`;
    }

    // Очищаем форму
    if (this.elements.newComment) {
      this.elements.newComment.value = '';
    }

    // Загружаем комментарии
    await this.loadComments(pvzId);

    // Показываем модальное окно
    this.elements.commentsModal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Скрыть модальное окно комментариев
   */
  hideCommentsModal() {
    if (!this.elements.commentsModal) return;

    this.elements.commentsModal.classList.remove('show');
    document.body.style.overflow = '';
    this.currentPvzId = null;
  }

  /**
   * Загрузить комментарии для ПВЗ
   */
  async loadComments(pvzId) {
    try {
      const response = await window.apiClient.get(`/api/data/comments?pvz_id=${pvzId}`);
      
      if (response.success) {
        this.renderComments(response.data);
      } else {
        console.error('❌ Ошибка загрузки комментариев:', response.message);
        this.renderComments([]);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки комментариев:', error);
      this.renderComments([]);
    }
  }

  /**
   * Отобразить комментарии
   */
  renderComments(comments) {
    if (!this.elements.commentsList) return;

    if (comments.length === 0) {
      this.elements.commentsList.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-muted);">
          Комментариев пока нет
        </div>
      `;
      return;
    }

    // Сортируем комментарии по дате (новые сверху)
    const sortedComments = comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    this.elements.commentsList.innerHTML = sortedComments.map(comment => `
      <div class="comment-item">
        <div class="comment-text">${this.escapeHtml(comment.comment)}</div>
        <div class="comment-meta">
          <span class="comment-author">${this.escapeHtml(comment.created_by)}</span>
          <span class="comment-date">${this.formatDate(comment.created_at)}</span>
        </div>
      </div>
    `).join('');
  }

  /**
   * Сохранить комментарий
   */
  async saveComment() {
    if (!this.currentPvzId || !this.elements.newComment) return;

    // Защита от множественных вызовов
    if (this.isSavingComment) {
      console.log('⚠️ Сохранение комментария уже выполняется, пропускаем');
      return;
    }
    this.isSavingComment = true;

    const commentText = this.elements.newComment.value.trim();
    if (!commentText) {
      this.isSavingComment = false;
      if (window.utils) {
        window.utils.showNotification('Введите текст комментария', 'warning');
      }
      return;
    }

    try {
      const response = await window.apiClient.post('/api/data/comments', {
        pvz_id: this.currentPvzId,
        comment: commentText
      });

      if (response.success) {
        if (window.utils) {
          window.utils.showNotification('Комментарий сохранен', 'success');
        }
        
        // Очищаем форму
        this.elements.newComment.value = '';
        
        // Перезагружаем комментарии
        await this.loadComments(this.currentPvzId);
        
        // Обновляем данные таблицы
        this.refreshData({ clearCache: true });
      } else {
        console.error('❌ Ошибка сохранения комментария:', response.message);
        if (window.utils) {
          window.utils.showNotification('Ошибка сохранения комментария', 'error');
        }
      }
    } catch (error) {
      console.error('❌ Ошибка сохранения комментария:', error);
      if (window.utils) {
        window.utils.showNotification('Ошибка сохранения комментария', 'error');
      }
    } finally {
      this.isSavingComment = false;
    }
  }

  /**
   * Форматирование даты для отображения
   */
  formatDate(dateString) {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Экспорт данных в Excel файл
   */
  async exportData() {
    // Защита от множественных вызовов
    if (this.isExporting) {
      console.log('⚠️ Экспорт уже выполняется, пропускаем');
      return;
    }
    this.isExporting = true;

    try {
      console.log('📊 Начинаем экспорт данных...');
      
      // Показываем индикатор загрузки
      if (this.elements.btnExport) {
        this.elements.btnExport.disabled = true;
        this.elements.btnExport.textContent = 'Экспорт...';
      }
      
      // Подготавливаем фильтры для отправки на сервер
      const filters = {
        pvzId: this.currentFilters.pvzId,
        regions: this.currentFilters.regions,
        address: this.currentFilters.address,
        company: this.currentFilters.company
      };
      
      console.log('📊 Отправляем фильтры:', filters);
      
      // Отправляем запрос на экспорт (используем прямой fetch для файлов)
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/data/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ filters })
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Токен невалиден или истек
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          window.location.href = '/';
          return;
        }
        
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      // Получаем файл
      const blob = await response.blob();
      
      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Генерируем имя файла с датой
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      const filename = `PVZ_export_${dateStr}_${timeStr}.xlsx`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      console.log(`✅ Файл ${filename} успешно скачан`);
      
      if (window.utils) {
        window.utils.showNotification('Данные успешно экспортированы', 'success');
      }
      
    } catch (error) {
      console.error('❌ Ошибка экспорта:', error);
      
      if (window.utils) {
        window.utils.showNotification(`Ошибка экспорта: ${error.message}`, 'error');
      }
    } finally {
      // Сбрасываем флаг экспорта
      this.isExporting = false;
      
      // Восстанавливаем кнопку
      if (this.elements.btnExport) {
        this.elements.btnExport.disabled = false;
        this.elements.btnExport.textContent = 'Экспорт';
      }
    }
  }
}

// Инициализация модуля при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  window.pvzModule = new PvzModule();
});
