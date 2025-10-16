/**
 * Модуль аналитики ПВЗ
 */
class AnalyticsModule {
  constructor() {
    this.charts = {};
    this.data = {
      pvz: [],
      regions: [],
      companies: [],
      problems: []
    };
    this.filters = {
      dateFrom: null,
      dateTo: null,
      region: '',
      company: ''
    };
    this.isInitialized = false;
    
    // Не инициализируем автоматически, ждем вызова init()
  }

  /**
   * Инициализация модуля
   */
  async init() {
    // Защита от повторной инициализации
    if (this.isInitialized) {
      console.log('📊 Модуль аналитики уже инициализирован');
      return;
    }
    
    console.log('📊 Инициализация модуля аналитики...');
    
    this.setupEventListeners();
    this.setupDateFilters();
    
    // Проверяем наличие API клиента
    if (window.secureApiClient && typeof window.secureApiClient.get === 'function') {
      console.log('✅ API клиент найден, загружаем данные...');
      await this.loadData();
      this.renderCharts();
      this.updateMetrics();
      this.renderTables();
    } else {
      console.error('❌ API клиент не найден или не инициализирован');
      if (window.utils && window.utils.showNotification) {
        window.utils.showNotification('Ошибка инициализации API клиента', 'error');
      }
    }
    
    this.isInitialized = true;
    console.log('✅ Модуль аналитики инициализирован');
  }

  /**
   * Настройка обработчиков событий
   */
  setupEventListeners() {
    // Кнопка обновления
    const btnRefresh = document.getElementById('btnRefresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        this.refreshData();
      });
    }

    // Кнопка применения фильтров
    const btnApplyFilters = document.getElementById('btnApplyFilters');
    if (btnApplyFilters) {
      btnApplyFilters.addEventListener('click', () => {
        this.applyFilters();
      });
    }

    // Кнопки экспорта графиков
    const exportButtons = [
      'exportStatusChart',
      'exportProblemsChart', 
      'exportRegionsChart',
      'exportCompaniesChart'
    ];

    exportButtons.forEach(buttonId => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.addEventListener('click', () => {
          this.exportChart(buttonId.replace('export', '').replace('Chart', ''));
        });
      }
    });

    // Кнопка выхода
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        this.logout();
      });
    }

    // Обработчик изменения размера окна для перерисовки графиков
    let resizeTimeout;
    window.addEventListener('resize', () => {
      // Дебаунсинг - перерисовываем графики только после окончания изменения размера
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.resizeCharts();
      }, 250);
    });

    // Обработчик изменения масштаба браузера
    let zoomTimeout;
    let lastDevicePixelRatio = window.devicePixelRatio;
    
    const handleZoomChange = () => {
      clearTimeout(zoomTimeout);
      zoomTimeout = setTimeout(() => {
        // Проверяем изменение devicePixelRatio (указывает на изменение масштаба)
        const currentDevicePixelRatio = window.devicePixelRatio;
        if (Math.abs(currentDevicePixelRatio - lastDevicePixelRatio) > 0.1) {
          console.log('🔍 Обнаружено изменение масштаба браузера');
          lastDevicePixelRatio = currentDevicePixelRatio;
          this.resizeCharts();
        } else {
          this.resizeCharts();
        }
      }, 500);
    };

    // Отслеживаем изменения масштаба через изменение размеров viewport
    window.addEventListener('resize', handleZoomChange);
    
    // Дополнительная проверка при изменении фокуса окна (может указывать на изменение масштаба)
    window.addEventListener('focus', () => {
      setTimeout(() => {
        this.resizeCharts();
      }, 100);
    });

    // Отслеживаем изменения devicePixelRatio
    const mediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mediaQuery.addEventListener('change', () => {
      console.log('🔍 Изменение devicePixelRatio обнаружено');
      setTimeout(() => {
        this.resizeCharts();
      }, 200);
    });
  }

  /**
   * Настройка фильтров по датам
   */
  setupDateFilters() {
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    
    if (dateFrom && dateTo) {
      // По умолчанию фильтры дат пустые - показываем данные за весь период
      dateFrom.value = '';
      dateTo.value = '';
      
      // Обновляем фильтры в объекте
      this.filters.dateFrom = null;
      this.filters.dateTo = null;
      
      // Добавляем обработчики событий для автоматического обновления графиков
      dateFrom.addEventListener('change', () => {
        this.applyFilters();
      });
      
      dateTo.addEventListener('change', () => {
        this.applyFilters();
      });
    }
  }

  /**
   * Загрузка данных
   */
  async loadData() {
    try {
      console.log('📊 Загрузка данных для аналитики...');
      console.log('🔍 API клиент инициализирован:', window.secureApiClient ? 'да' : 'нет');
      
      // Загружаем ВСЕ данные ПВЗ без фильтров
      const pvzResponse = await window.secureApiClient.get('/api/data/pvz?limit=10000');
      console.log('📊 Ответ API ПВЗ:', pvzResponse);
      if (pvzResponse.success) {
        this.data.pvz = pvzResponse.data || [];
        console.log(`✅ Загружено ${this.data.pvz.length} записей ПВЗ`);
      } else {
        console.error('❌ Ошибка загрузки ПВЗ:', pvzResponse);
      }

      // Загружаем регионы
      const regionsResponse = await window.secureApiClient.get('/api/data/regions');
      console.log('📊 Ответ API регионов:', regionsResponse);
      if (regionsResponse.success) {
        this.data.regions = regionsResponse.data || [];
        this.populateRegionFilter();
      } else {
        console.error('❌ Ошибка загрузки регионов:', regionsResponse);
      }

      // Загружаем компании
      const companiesResponse = await window.secureApiClient.get('/api/companies');
      console.log('📊 Ответ API компаний:', companiesResponse);
      if (companiesResponse.success) {
        this.data.companies = companiesResponse.data || [];
        this.populateCompanyFilter();
      } else {
        console.error('❌ Ошибка загрузки компаний:', companiesResponse);
      }

      // Обрабатываем данные о проблемах
      this.processProblemsData();

    } catch (error) {
      console.error('❌ Ошибка загрузки данных:', error);
      if (window.utils) {
        window.utils.showNotification('Ошибка загрузки данных аналитики', 'error');
      }
    }
  }

  /**
   * Заполнение фильтра регионов
   */
  populateRegionFilter() {
    const regionFilter = document.getElementById('regionFilter');
    if (!regionFilter) return;

    // Очищаем существующие опции (кроме "Все регионы")
    regionFilter.innerHTML = '<option value="">Все регионы</option>';
    
    // Добавляем уникальные регионы
    const uniqueRegions = [...new Set(this.data.pvz.map(pvz => pvz.region).filter(Boolean))];
    uniqueRegions.sort().forEach(region => {
      const option = document.createElement('option');
      option.value = region;
      option.textContent = region;
      regionFilter.appendChild(option);
    });
    
    // Добавляем обработчик события для автоматического обновления графиков
    regionFilter.addEventListener('change', () => {
      this.applyFilters();
    });
  }

  /**
   * Заполнение фильтра компаний
   */
  populateCompanyFilter() {
    const companyFilter = document.getElementById('companyFilter');
    if (!companyFilter) return;

    // Очищаем существующие опции (кроме "Все компании")
    companyFilter.innerHTML = '<option value="">Все компании</option>';
    
    // Добавляем уникальные компании
    const uniqueCompanies = [...new Set(this.data.pvz.map(pvz => pvz.company_name).filter(Boolean))];
    uniqueCompanies.sort().forEach(company => {
      const option = document.createElement('option');
      option.value = company;
      option.textContent = company;
      companyFilter.appendChild(option);
    });
    
    // Добавляем обработчик события для автоматического обновления графиков
    companyFilter.addEventListener('change', () => {
      this.applyFilters();
    });
  }

  /**
   * Обработка данных о проблемах
   */
  processProblemsData() {
    const problemsMap = new Map();
    
    this.data.pvz.forEach(pvz => {
      if (pvz.problems && pvz.problems.trim() !== '') {
        const problem = pvz.problems.trim();
        problemsMap.set(problem, (problemsMap.get(problem) || 0) + 1);
      }
    });

    this.data.problems = Array.from(problemsMap.entries()).map(([problem, count]) => ({
      problem,
      count
    })).sort((a, b) => b.count - a.count);
  }

  /**
   * Применение фильтров
   */
  applyFilters() {
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    const regionFilter = document.getElementById('regionFilter');
    const companyFilter = document.getElementById('companyFilter');

    this.filters = {
      dateFrom: dateFrom ? dateFrom.value : null,
      dateTo: dateTo ? dateTo.value : null,
      region: regionFilter ? regionFilter.value : '',
      company: companyFilter ? companyFilter.value : ''
    };

    console.log('🔍 Применение фильтров:', this.filters);
    
    this.renderCharts();
    this.updateMetrics();
    this.renderTables();
  }

  /**
   * Обновление метрик
   */
  updateMetrics() {
    const filteredData = this.getFilteredData();
    
    const totalPvz = filteredData.length;
    const problematicPvz = filteredData.filter(pvz => pvz.problems && pvz.problems.trim() !== '').length;
    const problemFreePvz = totalPvz - problematicPvz;
    const problemPercentage = totalPvz > 0 ? Math.round((problematicPvz / totalPvz) * 100) : 0;

    // Обновляем карточки метрик
    this.updateMetricCard('totalPvz', totalPvz);
    this.updateMetricCard('problematicPvz', problematicPvz);
    this.updateMetricCard('problemFreePvz', problemFreePvz);
    this.updateMetricCard('problemPercentage', `${problemPercentage}%`);
  }

  /**
   * Обновление карточки метрики
   */
  updateMetricCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value;
    }
  }

  /**
   * Получение отфильтрованных данных
   */
  getFilteredData() {
    let filtered = [...this.data.pvz];

    // Фильтр по региону
    if (this.filters.region) {
      filtered = filtered.filter(pvz => pvz.region === this.filters.region);
    }

    // Фильтр по компании
    if (this.filters.company) {
      filtered = filtered.filter(pvz => pvz.company_name === this.filters.company);
    }

    // Фильтр по датам (если есть поле даты в данных)
    if (this.filters.dateFrom || this.filters.dateTo) {
      filtered = filtered.filter(pvz => {
        if (!pvz.updated_at) return true;
        
        const pvzDate = new Date(pvz.updated_at);
        const fromDate = this.filters.dateFrom ? new Date(this.filters.dateFrom) : null;
        const toDate = this.filters.dateTo ? new Date(this.filters.dateTo) : null;

        if (fromDate && pvzDate < fromDate) return false;
        if (toDate && pvzDate > toDate) return false;
        
        return true;
      });
    }

    return filtered;
  }

  /**
   * Создание графиков
   */
  renderCharts() {
    const filteredData = this.getFilteredData();
    
    this.renderStatusChart(filteredData);
    this.renderProblemsChart(filteredData);
    this.renderRegionsChart(filteredData);
    this.renderCompaniesChart(filteredData);
  }

  /**
   * График по статусам
   */
  renderStatusChart(data) {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;

    // Уничтожаем существующий график
    if (this.charts.status) {
      this.charts.status.destroy();
    }

    // Принудительно обновляем размеры canvas
    this.resetCanvasSize(ctx);

    // Подсчитываем статусы
    const statusCounts = {};
    data.forEach(pvz => {
      const status = pvz.status_name || 'Не указан';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const labels = Object.keys(statusCounts);
    const values = Object.values(statusCounts);
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
      '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
    ];

    this.charts.status = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 0,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((context.parsed / total) * 100).toFixed(1);
                return `${context.label}: ${context.parsed} (${percentage}%)`;
              }
            }
          }
        }
      }
    });

    // Отображаем легенду
    this.renderLegend('statusLegend', labels, values, colors);
  }

  /**
   * График по проблемам
   */
  renderProblemsChart(data) {
    const ctx = document.getElementById('problemsChart');
    if (!ctx) return;

    if (this.charts.problems) {
      this.charts.problems.destroy();
    }

    // Принудительно обновляем размеры canvas
    this.resetCanvasSize(ctx);

    // Подсчитываем проблемы
    const problemCounts = {};
    data.forEach(pvz => {
      if (pvz.problems && pvz.problems.trim() !== '') {
        const problem = pvz.problems.trim();
        problemCounts[problem] = (problemCounts[problem] || 0) + 1;
      }
    });

    // Добавляем "Без проблем"
    const totalWithProblems = Object.values(problemCounts).reduce((a, b) => a + b, 0);
    const totalPvz = data.length;
    const withoutProblems = totalPvz - totalWithProblems;
    
    if (withoutProblems > 0) {
      problemCounts['Без проблем'] = withoutProblems;
    }

    const labels = Object.keys(problemCounts);
    const values = Object.values(problemCounts);
    const colors = [
      '#ef4444', '#8b5cf6', '#3b82f6', '#f59e0b',
      '#ef4444', '#f59e0b', '#06b6d4', '#84cc16', '#10b981'
    ];

    this.charts.problems = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Количество ПВЗ',
          data: values,
          backgroundColor: colors,
          borderWidth: 1,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 0,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });

    // Отображаем легенду
    this.renderLegend('problemsLegend', labels, values, colors);
  }

  /**
   * График по регионам
   */
  renderRegionsChart(data) {
    const ctx = document.getElementById('regionsChart');
    if (!ctx) return;

    if (this.charts.regions) {
      this.charts.regions.destroy();
    }

    // Принудительно обновляем размеры canvas
    this.resetCanvasSize(ctx);

    // Подсчитываем регионы
    const regionCounts = {};
    data.forEach(pvz => {
      const region = pvz.region || 'Не указан';
      regionCounts[region] = (regionCounts[region] || 0) + 1;
    });

    // Берем топ-10 регионов
    const sortedRegions = Object.entries(regionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    const labels = sortedRegions.map(([region]) => region);
    const values = sortedRegions.map(([, count]) => count);
    const colors = Array(labels.length).fill('#3b82f6');

    this.charts.regions = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Количество ПВЗ',
          data: values,
          backgroundColor: '#3b82f6',
          borderWidth: 1,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 0,
        indexAxis: 'y',
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });

    // Отображаем легенду
    this.renderLegend('regionsLegend', labels, values, colors);
  }

  /**
   * График по компаниям
   */
  renderCompaniesChart(data) {
    const ctx = document.getElementById('companiesChart');
    if (!ctx) return;

    if (this.charts.companies) {
      this.charts.companies.destroy();
    }

    // Принудительно обновляем размеры canvas
    this.resetCanvasSize(ctx);

    // Подсчитываем компании
    const companyCounts = {};
    data.forEach(pvz => {
      const company = pvz.company_name || 'Не указана';
      companyCounts[company] = (companyCounts[company] || 0) + 1;
    });

    // Берем топ-10 компаний
    const sortedCompanies = Object.entries(companyCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    const labels = sortedCompanies.map(([company]) => company);
    const values = sortedCompanies.map(([, count]) => count);
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
      '#8b5cf6', '#06b6d4', '#84cc16', '#f97316',
      '#ec4899', '#6366f1'
    ];

    this.charts.companies = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 0,
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });

    // Отображаем легенду
    this.renderLegend('companiesLegend', labels, values, colors);
  }

  /**
   * Отрисовка таблиц
   */
  renderTables() {
    const filteredData = this.getFilteredData();
    this.renderProblemsStatsTable(filteredData);
  }


  /**
   * Таблица статистики по проблемам
   */
  renderProblemsStatsTable(data) {
    const tbody = document.querySelector('#problemsStatsTable tbody');
    if (!tbody) return;

    // Подсчитываем проблемы
    const problemCounts = {};
    data.forEach(pvz => {
      if (pvz.problems && pvz.problems.trim() !== '') {
        const problem = pvz.problems.trim();
        problemCounts[problem] = (problemCounts[problem] || 0) + 1;
      }
    });

    const totalPvz = data.length;
    const totalWithProblems = Object.values(problemCounts).reduce((a, b) => a + b, 0);
    const withoutProblems = totalPvz - totalWithProblems;

    // Добавляем "Без проблем"
    if (withoutProblems > 0) {
      problemCounts['Без проблем'] = withoutProblems;
    }

    const sortedProblems = Object.entries(problemCounts)
      .sort(([,a], [,b]) => b - a);

    tbody.innerHTML = sortedProblems.map(([problem, count]) => {
      const percentage = totalPvz > 0 ? ((count / totalPvz) * 100).toFixed(1) : 0;
      const color = this.getProblemColor(problem);
      
      return `
        <tr>
          <td>${this.escapeHtml(problem)}</td>
          <td><strong>${count}</strong></td>
          <td>${percentage}%</td>
          <td><span style="color: ${color}; font-weight: bold;">●</span> ${color}</td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Получение цвета для проблемы
   */
  getProblemColor(problem) {
    const colors = {
      'Нет места': '#ff1111',
      'Нет мебели': '#cc22ff',
      'Не дозвонились': '#2288ff',
      'Некомплект': '#ff6600',
      'Не пустили в ОПС': '#ff2288',
      'Разбито зеркало для Дуги': '#b8860b',
      'Разбито зеркало для П': '#00ddff',
      'Отсрочка по монтажу': '#006600',
      'Без проблем': '#10b981'
    };
    return colors[problem] || '#666666';
  }

  /**
   * Экспорт графика
   */
  exportChart(chartType) {
    const chart = this.charts[chartType.toLowerCase()];
    if (chart) {
      const url = chart.toBase64Image();
      const link = document.createElement('a');
      link.download = `${chartType}_chart.png`;
      link.href = url;
      link.click();
      
      if (window.utils) {
        window.utils.showNotification(`График ${chartType} экспортирован`, 'success');
      }
    }
  }

  /**
   * Обновление данных
   */
  async refreshData() {
    console.log('🔄 Обновление данных аналитики...');
    await this.loadData();
    this.renderCharts();
    this.updateMetrics();
    this.renderTables();
    
    if (window.utils) {
      window.utils.showNotification('Данные аналитики обновлены', 'success');
    }
  }

  /**
   * Выход из системы
   */
  async logout() {
    try {
      await window.secureApiClient.post('/api/auth/logout');
      window.location.href = '/';
    } catch (error) {
      console.error('❌ Ошибка выхода:', error);
      window.location.href = '/';
    }
  }

  /**
   * Экранирование HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Обрезка текста
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Отображение легенды с цифрами
   */
  renderLegend(legendId, labels, values, colors) {
    const legendElement = document.getElementById(legendId);
    if (!legendElement) return;

    const total = values.reduce((sum, value) => sum + value, 0);
    
    legendElement.innerHTML = labels.map((label, index) => {
      const value = values[index];
      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
      const color = colors[index % colors.length];
      
      return `
        <div class="legend-item">
          <div class="legend-color" style="background-color: ${color}"></div>
          <div class="legend-label">${this.escapeHtml(label)}</div>
          <div class="legend-value">${value} (${percentage}%)</div>
        </div>
      `;
    }).join('');
  }

  /**
   * Сброс размеров canvas
   */
  resetCanvasSize(canvas) {
    if (!canvas) return;
    
    // Получаем размеры контейнера
    const container = canvas.parentElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // Сбрасываем все стили canvas
    canvas.style.width = '';
    canvas.style.height = '';
    canvas.style.maxWidth = '';
    canvas.style.maxHeight = '';
    
    // Устанавливаем размеры canvas
    canvas.width = containerWidth * window.devicePixelRatio;
    canvas.height = containerHeight * window.devicePixelRatio;
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = containerHeight + 'px';
    
    // Получаем контекст и устанавливаем масштаб
    const context = canvas.getContext('2d');
    if (context) {
      context.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
  }

  /**
   * Перерисовка графиков при изменении размера окна
   */
  resizeCharts() {
    console.log('🔄 Перерисовка графиков из-за изменения размера окна');
    
    // Получаем текущие данные для пересоздания графиков
    const filteredData = this.getFilteredData();
    
    // Пересоздаем все графики с текущими данными
    this.renderCharts(filteredData);
  }
}

// Создаем глобальный экземпляр модуля аналитики
window.analyticsModule = new AnalyticsModule();
