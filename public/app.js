// State variables
let monitorData = null;
let allStores = [];
let filteredStores = [];
let displayLimit = 50;

// Filter values
let currentStatusFilter = 'ALL';
let currentSearchQuery = '';
let currentDirector = '';
let currentDistrital = '';
let currentCoordinator = '';
let currentState = '';

let drillLevel = 'diretor'; // 'diretor', 'distrital', 'coordenador', 'filial'

// Chart instances
let hourlyChartInstance = null;
let statusChartInstance = null;
let coordinatorChartInstance = null;
let historyChartInstance = null;
let zeroSalesChartInstance = null;
let cumulativeOrdersChartInstance = null;

// DOM Elements
const syncStatusText = document.getElementById('sync-status-text');
const btnRefresh = document.getElementById('btn-refresh');
const kpiHealthScore = document.getElementById('kpi-health-score');
const kpiHealthFooter = document.getElementById('kpi-health-footer');
const kpiOfflineCount = document.getElementById('kpi-offline-count');
const kpiCriticalCount = document.getElementById('kpi-critical-count');
const kpiAlertCount = document.getElementById('kpi-alert-count');
const kpiAvgIdle = document.getElementById('kpi-avg-idle');


const stateTableBody = document.getElementById('state-table-body');
const cityTableBody = document.getElementById('city-table-body');
const coordinatorTableBody = document.getElementById('coordinator-table-body');

const searchInput = document.getElementById('search-input');
const selectDirector = document.getElementById('select-director');
const selectDistrital = document.getElementById('select-distrital');
const selectCoordinator = document.getElementById('select-coordinator');
const selectState = document.getElementById('select-state');
const storesCountLabel = document.getElementById('stores-count-label');
const storesTableBody = document.getElementById('stores-table-body');
const btnLoadMore = document.getElementById('btn-load-more');

const btnChartDrillBack = document.getElementById('btn-chart-drill-back');
const chartDrillTitle = document.getElementById('chart-drill-title');

const storeModal = document.getElementById('store-modal');
const modalStoreName = document.getElementById('modal-store-name');
const modalStoreRegion = document.getElementById('modal-store-region');
const modalStoreStatus = document.getElementById('modal-store-status');
const modalStoreSales = document.getElementById('modal-store-sales');
const modalStoreExpected = document.getElementById('modal-store-expected');
const modalStoreLast = document.getElementById('modal-store-last');
const btnCloseModal = document.getElementById('btn-close-modal');

const btnInfo = document.getElementById('btn-info');
const infoModal = document.getElementById('info-modal');
const btnCloseInfo = document.getElementById('btn-close-info');

const btnSyncTrigger = document.getElementById('btn-sync-trigger');
const syncProgressContainer = document.getElementById('sync-progress-container');
const syncProgressFill = document.getElementById('sync-progress-fill');

// API call to fetch data
async function loadMonitorData() {
  setLoadingState(true);
  try {
    const res = await fetch('/api/monitor');
    const json = await res.json();
    
    if (json.status === 'success') {
      monitorData = json.data;
      allStores = monitorData.stores;
      
      // Update UI Components
      updateKPIs(monitorData.summary, monitorData.referenceDate, monitorData.referenceTime);
      updateRegionTables(monitorData.stateAnalytics, monitorData.cityAnalytics, monitorData.coordinatorAnalytics, monitorData.distritalAnalytics);
      populateDropdowns(allStores);
      applyFilters();
      
      syncStatusText.textContent = `Atualizado: ${monitorData.referenceTime}`;
      syncStatusText.parentElement.firstElementChild.className = 'pulse-indicator status-green';
    } else {
      showError(json.message || 'Erro no processamento dos dados.');
    }
  } catch (err) {
    console.error('[App] Fetch error:', err);
    showError('Erro ao se conectar com o servidor monitor.');
  } finally {
    setLoadingState(false);
  }
}

function setLoadingState(loading) {
  if (loading) {
    btnRefresh.classList.add('loading');
    btnRefresh.disabled = true;
    btnRefresh.innerHTML = `<i data-lucide="refresh-cw" class="animate-spin"></i> Atualizando...`;
  } else {
    btnRefresh.classList.remove('loading');
    btnRefresh.disabled = false;
    btnRefresh.innerHTML = `<i data-lucide="refresh-cw"></i> Atualizar`;
  }
  lucide.createIcons();
}

function showError(msg) {
  syncStatusText.textContent = msg;
  syncStatusText.parentElement.firstElementChild.className = 'pulse-indicator status-red';
}

// KPI card values
function updateKPIs(summary, refDate, refTime) {
  kpiHealthScore.textContent = `${summary.healthScore}%`;
  kpiHealthFooter.textContent = `Monitoradas: ${summary.totalMonitored} | Inativas: ${summary.inativeCount}`;
  
  kpiOfflineCount.textContent = summary.offlineCount;
  kpiCriticalCount.textContent = summary.criticalCount;
  kpiAlertCount.textContent = summary.alertCount;
  

  
  if (summary.avgIdleMinutesGlobal != null) {
    kpiAvgIdle.textContent = formatIdleTime(summary.avgIdleMinutesGlobal);
  } else {
    kpiAvgIdle.textContent = '--';
  }

  // ── Comparative KPIs ──
  // Total orders today
  const kpiTotalOrders = document.getElementById('kpi-total-orders');
  const kpiOrdersCompare = document.getElementById('kpi-orders-compare');
  if (kpiTotalOrders) {
    kpiTotalOrders.textContent = (summary.totalOrdersToday || 0).toLocaleString('pt-BR');
  }
  if (kpiOrdersCompare && summary.totalOrdersYesterday != null) {
    const deltaYest = summary.totalOrdersToday - summary.totalOrdersYesterday;
    const deltaWeek = summary.totalOrdersToday - summary.totalOrdersLastWeek;
    kpiOrdersCompare.innerHTML = `${formatDelta(deltaYest, 'pedidos', true)} vs Ontem &nbsp;|&nbsp; ${formatDelta(deltaWeek, 'pedidos', true)} vs Semana`;
  }

  // Offline stores comparison
  const kpiOfflineCompare = document.getElementById('kpi-offline-compare');
  if (kpiOfflineCompare && summary.zeroSalesYesterday != null) {
    const deltaYest = summary.zeroSalesToday - summary.zeroSalesYesterday;
    const deltaWeek = summary.zeroSalesToday - summary.zeroSalesLastWeek;
    kpiOfflineCompare.innerHTML = `${formatDelta(deltaYest, 'lojas', false)} vs Ontem &nbsp;|&nbsp; ${formatDelta(deltaWeek, 'lojas', false)} vs Semana`;
  }

  // ── Global Status Banner ──
  updateGlobalStatusBanner(summary.zeroSalesToday, summary.zeroSalesYesterday, summary.zeroSalesLastWeek);
}

function updateGlobalStatusBanner(zeroToday, zeroYesterday, zeroLastWeek) {
  const banner = document.getElementById('global-status-banner');
  const title = document.getElementById('global-status-title');
  const desc = document.getElementById('global-status-desc');
  
  if (!banner || zeroYesterday == null) return;

  const baseline = (zeroYesterday + zeroLastWeek) / 2;
  // If baseline is 0, just assume 1 to avoid division by zero
  const ratio = zeroToday / Math.max(baseline, 1);

  let cluster = 'normal';
  let titleText = '';
  let descText = '';

  if (ratio <= 0.85) {
    cluster = 'excelente';
    titleText = 'Termômetro Operacional: EXCELENTE';
    descText = `Temos significativamente menos lojas paradas do que a média histórica (${zeroToday} vs média de ${Math.round(baseline)}). Operação muito saudável!`;
  } else if (ratio > 0.85 && ratio <= 1.15) {
    cluster = 'normal';
    titleText = 'Termômetro Operacional: NORMAL';
    descText = `Volume de lojas sem faturamento (${zeroToday}) está dentro da média histórica (${Math.round(baseline)}). Nada fora do comum.`;
  } else if (ratio > 1.15 && ratio <= 1.4) {
    cluster = 'atencao';
    titleText = 'Termômetro Operacional: ATENÇÃO';
    descText = `Volume de lojas sem faturamento está acima do esperado (${zeroToday} vs média de ${Math.round(baseline)}). Fique de olho.`;
  } else if (ratio > 1.4 && ratio <= 2.0) {
    cluster = 'critico';
    titleText = 'Termômetro Operacional: CRÍTICO';
    descText = `Muitas lojas paradas em comparação com o histórico (${zeroToday} vs média de ${Math.round(baseline)}). Possível instabilidade sistêmica em andamento.`;
  } else {
    cluster = 'severo';
    titleText = 'Termômetro Operacional: INCIDENTE / SEVERO';
    descText = `Volume massivo de lojas sem venda hoje (${zeroToday} vs média de ${Math.round(baseline)}). Desvio grave na operação!`;
  }

  // Update classes
  banner.className = `global-status-banner status-${cluster}`;
  title.textContent = titleText;
  desc.textContent = descText;

  // Update clusters UI
  const clusters = ['excelente', 'normal', 'atencao', 'critico', 'severo'];
  clusters.forEach(c => {
    const el = document.getElementById(`cluster-${c}`);
    if (el) {
      if (c === cluster) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    }
  });
}

/**
 * Format a delta value with arrow and color.
 * @param {number} delta - The difference (positive = increase)
 * @param {string} unit - Unit label
 * @param {boolean} positiveIsGood - If true, positive delta is green (more orders = good). If false, positive is red (more offline = bad).
 */
function formatDelta(delta, unit, positiveIsGood) {
  if (delta === 0) return `<span style="color:#8b949e;">= 0</span>`;
  const arrow = delta > 0 ? '▲' : '▼';
  const isGood = positiveIsGood ? delta > 0 : delta < 0;
  const color = isGood ? '#10b981' : '#ef4444';
  const sign = delta > 0 ? '+' : '';
  return `<span style="color:${color}; font-weight:700;">${arrow} ${sign}${delta}</span>`;
}

// Regional Rankings Tables
function updateRegionTables(stateArr, cityArr, coordArr, distritalArr) {
  // State Analytics Table
  stateTableBody.innerHTML = stateArr.map(st => `
    <tr>
      <td style="font-weight:800;">${st.state}</td>
      <td class="text-center" style="font-weight:${st.offline > 0 ? 800 : 400}; color:${st.offline > 0 ? 'var(--color-red)' : 'inherit'};">${st.offline}</td>
      <td class="text-center" style="font-weight:${st.critical > 0 ? 800 : 400}; color:${st.critical > 0 ? 'var(--color-orange)' : 'inherit'};">${st.critical}</td>
      <td class="text-center" style="color:${st.alert > 0 ? 'var(--color-yellow)' : 'inherit'};">${st.alert}</td>
      <td class="text-center" style="color:var(--color-green); font-weight:600;">${st.online}</td>
      <td class="text-center" style="font-weight:600;">${formatIdleTime(st.avgIdleMinutes)}</td>
    </tr>
  `).join('');

  // City Analytics Table
  cityTableBody.innerHTML = cityArr.slice(0, 10).map(c => `
    <tr>
      <td style="font-weight:700;">${c.city} - ${c.state}</td>
      <td class="text-center" style="font-weight:${c.offline > 0 ? 800 : 400}; color:${c.offline > 0 ? 'var(--color-red)' : 'inherit'};">${c.offline}</td>
      <td class="text-center" style="font-weight:${c.critical > 0 ? 800 : 400}; color:${c.critical > 0 ? 'var(--color-orange)' : 'inherit'};">${c.critical}</td>
      <td class="text-center">${formatIdleTime(c.avgIdleMinutes)}</td>
    </tr>
  `).join('');

  // Distrital Analytics Table (using coordinator-table-body element)
  const displayList = (distritalArr && distritalArr.length > 0) ? distritalArr : coordArr;
  coordinatorTableBody.innerHTML = displayList.slice(0, 8).map(c => {
    const name = c.distrital || c.coordenador || 'Desconhecido';
    return `
    <tr>
      <td style="font-weight:700;">${name}</td>
      <td class="text-center" style="font-weight:${c.offline > 0 ? 800 : 400}; color:${c.offline > 0 ? 'var(--color-red)' : 'inherit'};">${c.offline}</td>
      <td class="text-center" style="font-weight:${c.critical > 0 ? 800 : 400}; color:${c.critical > 0 ? 'var(--color-orange)' : 'inherit'};">${c.critical}</td>
      <td class="text-center">${c.alert}</td>
      <td class="text-center" style="font-weight:600;">${c.total}</td>
    </tr>
  `}).join('');
}

function updateAnalyticsCharts(storesList) {
  // 1. Calculate status distribution for status-pie-chart
  const activeMonitored = storesList.filter(s => s.status !== 'INATIVA');
  const onlineCount = activeMonitored.filter(s => s.status === 'ONLINE').length;
  const alertCount = activeMonitored.filter(s => s.status === 'ALERTA').length;
  const criticalCount = activeMonitored.filter(s => s.status === 'CRITICO').length;
  const offlineCount = activeMonitored.filter(s => s.status === 'OFFLINE').length;

  const statusCtx = document.getElementById('status-pie-chart').getContext('2d');
  if (statusChartInstance) {
    statusChartInstance.destroy();
  }
  
  statusChartInstance = new Chart(statusCtx, {
    type: 'doughnut',
    data: {
      labels: ['Online', 'Alerta', 'Crítico', 'Offline'],
      datasets: [{
        data: [onlineCount, alertCount, criticalCount, offlineCount],
        backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444'],
        borderWidth: 2,
        borderColor: '#0d1117'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#8b949e', font: { family: 'Inter', size: 10, weight: 600 } }
        }
      },
      cutout: '65%'
    }
  });

  // 2. Calculate drill-down analytics for management bar chart
  const drillStats = {};
  activeMonitored.forEach(s => {
    let key = 'Desconhecido';
    if (drillLevel === 'diretor') {
      key = s.diretor || 'Desconhecido';
    } else if (drillLevel === 'distrital') {
      key = s.distrital || 'Desconhecido';
    } else if (drillLevel === 'coordenador') {
      key = s.coordenador || 'Desconhecido';
    } else if (drillLevel === 'filial') {
      key = s.name; // Store Name
    }

    if (!drillStats[key]) {
      drillStats[key] = { name: key, total: 0, offline: 0, alert: 0, critical: 0, online: 0 };
    }
    const stats = drillStats[key];
    stats.total++;
    if (s.status === 'OFFLINE') stats.offline++;
    else if (s.status === 'CRITICO') stats.critical++;
    else if (s.status === 'ALERTA') stats.alert++;
    else if (s.status === 'ONLINE') stats.online++;
  });

  const drillArr = Object.values(drillStats)
    .sort((a, b) => (b.offline + b.critical) - (a.offline + a.critical) || b.total - a.total);

  // Take top elements (top 15 for stores, top 8 for management levels)
  const limit = drillLevel === 'filial' ? 15 : 8;
  const topDrill = drillArr
    .filter(c => c.name && c.name !== 'Desconhecido')
    .slice(0, limit);

  // Shorten labels: if coordinator, show first + last name. If store, show clean name.
  const labels = topDrill.map(c => {
    if (drillLevel === 'filial') {
      return c.name;
    }
    return c.name.split(' ').slice(0, 2).join(' '); // Show first + last name for people
  });

  const barOffline = topDrill.map(c => c.offline);
  const barCritical = topDrill.map(c => c.critical);
  const barAlert = topDrill.map(c => c.alert);

  const barCtx = document.getElementById('coordinator-bar-chart').getContext('2d');
  if (coordinatorChartInstance) {
    coordinatorChartInstance.destroy();
  }

  coordinatorChartInstance = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Offline',
          data: barOffline,
          backgroundColor: '#ef4444'
        },
        {
          label: 'Crítico',
          data: barCritical,
          backgroundColor: '#f97316'
        },
        {
          label: 'Alerta',
          data: barAlert,
          backgroundColor: '#f59e0b'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8b949e', font: { family: 'Inter', size: 9, weight: 600 } }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: '#8b949e', font: { size: 9 } }
        },
        y: {
          stacked: true,
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { color: '#8b949e', font: { size: 9 } }
        }
      },
      onClick: (e, activeEls) => {
        if (!activeEls || activeEls.length === 0) return;
        const index = activeEls[0].index;
        const label = topDrill[index].name;
        
        if (drillLevel === 'diretor') {
          currentDirector = label;
          selectDirector.value = label;
        } else if (drillLevel === 'distrital') {
          currentDistrital = label;
          selectDistrital.value = label;
        } else if (drillLevel === 'coordenador') {
          currentCoordinator = label;
          selectCoordinator.value = label;
        } else if (drillLevel === 'filial') {
          openStoreDetails(label);
          return;
        }
        applyFilters();
      }
    }
  });

  // 3. Calculate hourly status history trend for status-history-chart
  const historyCtx = document.getElementById('status-history-chart').getContext('2d');
  if (historyChartInstance) {
    historyChartInstance.destroy();
  }

  // Calculate status history trend for storesList (0 to 23)
  const historyData = Array(24).fill(null).map(() => ({
    offline: 0,
    critical: 0,
    alert: 0,
    online: 0
  }));

  // Find reference hour from monitorData
  let refHour = 23;
  if (monitorData && monitorData.referenceTime) {
    refHour = parseInt(monitorData.referenceTime.split(':')[0], 10);
  }

  for (let h = 0; h < 24; h++) {
    if (h > refHour) continue;

    storesList.forEach(s => {
      if (s.status === 'INATIVA') return;

      const salesTodayH = s.hourlySales.slice(0, h + 1).reduce((a, b) => a + b, 0);
      const salesYesterdayH = s.hourlySalesYesterday.slice(0, h + 1).reduce((a, b) => a + b, 0);
      const sales7DaysAgoH = s.hourlySales7DaysAgo.slice(0, h + 1).reduce((a, b) => a + b, 0);
      
      const expectedSalesH = (salesYesterdayH + sales7DaysAgoH) / 2;
      const expectedSalesFull = (s.salesYesterdayFull + s.sales7DaysAgoFull) / 2;
      const expectedInterval = expectedSalesFull > 0 ? 720 / expectedSalesFull : 0;

      let lastSaleHour = null;
      for (let hr = h; hr >= 0; hr--) {
        if (s.hourlySales[hr] > 0) {
          lastSaleHour = hr;
          break;
        }
      }
      
      let minutesSinceLastOrder = null;
      if (lastSaleHour !== null) {
        minutesSinceLastOrder = (h - lastSaleHour) * 60;
      }

      let status = 'ONLINE';

      if (expectedSalesFull <= 0.6) {
        status = 'ONLINE';
      } else {
        if (salesTodayH === 0) {
          if (expectedSalesH >= 1.2) {
            status = 'OFFLINE';
          } else {
            status = 'ALERTA';
          }
        } else {
          if (minutesSinceLastOrder !== null && expectedInterval > 0) {
            const deviation = minutesSinceLastOrder / expectedInterval;
            if (minutesSinceLastOrder > 120 && deviation > 3.0) {
              status = 'CRITICO';
            } else if (minutesSinceLastOrder > 60 && deviation > 2.0) {
              status = 'ALERTA';
            } else if (salesTodayH < expectedSalesH * 0.4) {
              status = 'ALERTA';
            }
          }
        }
      }

      if (status === 'OFFLINE') historyData[h].offline++;
      else if (status === 'CRITICO') historyData[h].critical++;
      else if (status === 'ALERTA') historyData[h].alert++;
      else if (status === 'ONLINE') historyData[h].online++;
    });
  }

  const hoursLabels = Array.from({ length: refHour + 1 }, (_, i) => `${String(i).padStart(2, '0')}h`);
  const offlineTrend = historyData.slice(0, refHour + 1).map(h => h.offline);
  const criticalTrend = historyData.slice(0, refHour + 1).map(h => h.critical);
  const alertTrend = historyData.slice(0, refHour + 1).map(h => h.alert);
  const onlineTrend = historyData.slice(0, refHour + 1).map(h => h.online);

  historyChartInstance = new Chart(historyCtx, {
    type: 'line',
    data: {
      labels: hoursLabels,
      datasets: [
        {
          label: 'Offline (Crítico)',
          data: offlineTrend,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.04)',
          borderWidth: 2,
          tension: 0.35,
          fill: true
        },
        {
          label: 'Inatividade Crítica',
          data: criticalTrend,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.04)',
          borderWidth: 2,
          tension: 0.35,
          fill: true
        },
        {
          label: 'Alerta',
          data: alertTrend,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.03)',
          borderWidth: 2,
          tension: 0.35,
          fill: true
        },
        {
          label: 'Online',
          data: onlineTrend,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.03)',
          borderWidth: 2,
          tension: 0.35,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#8b949e', font: { family: 'Inter', size: 10, weight: 600 } }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#8b949e', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { color: '#8b949e', font: { size: 10 } },
          min: 0
        }
      }
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // 4. COMPARATIVE: Stores with ZERO sales per hour — Today × Yesterday × Last Week
  // ────────────────────────────────────────────────────────────────────
  const zeroCtx = document.getElementById('zero-sales-comparison-chart').getContext('2d');
  if (zeroSalesChartInstance) zeroSalesChartInstance.destroy();

  // For each hour 0..refHour, count stores with cumulative sales == 0
  // Only consider stores that have a meaningful historical average (not INATIVA)
  const allNonInactive = storesList.filter(s => s.status !== 'INATIVA');

  const zeroToday = [];
  const zeroYesterday = [];
  const zeroLastWeek = [];
  const zeroLabels = [];

  for (let h = 0; h <= refHour; h++) {
    zeroLabels.push(`${String(h).padStart(2, '0')}h`);

    let countToday = 0, countYesterday = 0, countLastWeek = 0;

    allNonInactive.forEach(s => {
      const cumToday = s.hourlySales.slice(0, h + 1).reduce((a, b) => a + b, 0);
      const cumYesterday = s.hourlySalesYesterday.slice(0, h + 1).reduce((a, b) => a + b, 0);
      const cumLastWeek = s.hourlySales7DaysAgo.slice(0, h + 1).reduce((a, b) => a + b, 0);

      if (cumToday === 0) countToday++;
      if (cumYesterday === 0) countYesterday++;
      if (cumLastWeek === 0) countLastWeek++;
    });

    zeroToday.push(countToday);
    zeroYesterday.push(countYesterday);
    zeroLastWeek.push(countLastWeek);
  }

  zeroSalesChartInstance = new Chart(zeroCtx, {
    type: 'line',
    data: {
      labels: zeroLabels,
      datasets: [
        {
          label: '🔴 Hoje (sem venda)',
          data: zeroToday,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          borderWidth: 3,
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#ef4444'
        },
        {
          label: '🟡 Ontem',
          data: zeroYesterday,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.04)',
          borderWidth: 2,
          borderDash: [6, 3],
          tension: 0.3,
          fill: false,
          pointRadius: 3,
          pointBackgroundColor: '#f59e0b'
        },
        {
          label: '🔵 Semana Passada',
          data: zeroLastWeek,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.04)',
          borderWidth: 2,
          borderDash: [3, 3],
          tension: 0.3,
          fill: false,
          pointRadius: 3,
          pointBackgroundColor: '#3b82f6'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#c9d1d9', font: { family: 'Inter', size: 11, weight: 600 }, padding: 16 }
        },
        tooltip: {
          backgroundColor: 'rgba(13,17,23,0.95)',
          titleFont: { family: 'Inter', size: 12, weight: 700 },
          bodyFont: { family: 'Inter', size: 11 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(ctx) {
              return ` ${ctx.dataset.label}: ${ctx.parsed.y} lojas sem venda`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#8b949e', font: { size: 10, weight: 500 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#8b949e', font: { size: 10 } },
          min: 0
        }
      }
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // 5. COMPARATIVE: Cumulative Orders per hour — Today × Yesterday × Last Week
  // ────────────────────────────────────────────────────────────────────
  const cumCtx = document.getElementById('cumulative-orders-chart').getContext('2d');
  if (cumulativeOrdersChartInstance) cumulativeOrdersChartInstance.destroy();

  const cumToday = [];
  const cumYesterday = [];
  const cumLastWeek = [];
  const cumLabels = [];

  for (let h = 0; h <= refHour; h++) {
    cumLabels.push(`${String(h).padStart(2, '0')}h`);

    let totalToday = 0, totalYesterday = 0, totalLastWeek = 0;

    allNonInactive.forEach(s => {
      totalToday += s.hourlySales.slice(0, h + 1).reduce((a, b) => a + b, 0);
      totalYesterday += s.hourlySalesYesterday.slice(0, h + 1).reduce((a, b) => a + b, 0);
      totalLastWeek += s.hourlySales7DaysAgo.slice(0, h + 1).reduce((a, b) => a + b, 0);
    });

    cumToday.push(totalToday);
    cumYesterday.push(totalYesterday);
    cumLastWeek.push(totalLastWeek);
  }

  cumulativeOrdersChartInstance = new Chart(cumCtx, {
    type: 'line',
    data: {
      labels: cumLabels,
      datasets: [
        {
          label: '🟢 Hoje',
          data: cumToday,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          borderWidth: 3,
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#10b981'
        },
        {
          label: '🟡 Ontem',
          data: cumYesterday,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.04)',
          borderWidth: 2,
          borderDash: [6, 3],
          tension: 0.3,
          fill: false,
          pointRadius: 3,
          pointBackgroundColor: '#f59e0b'
        },
        {
          label: '🔵 Semana Passada',
          data: cumLastWeek,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.04)',
          borderWidth: 2,
          borderDash: [3, 3],
          tension: 0.3,
          fill: false,
          pointRadius: 3,
          pointBackgroundColor: '#3b82f6'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#c9d1d9', font: { family: 'Inter', size: 11, weight: 600 }, padding: 16 }
        },
        tooltip: {
          backgroundColor: 'rgba(13,17,23,0.95)',
          titleFont: { family: 'Inter', size: 12, weight: 700 },
          bodyFont: { family: 'Inter', size: 11 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(ctx) {
              return ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('pt-BR')} pedidos`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#8b949e', font: { size: 10, weight: 500 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#8b949e',
            font: { size: 10 },
            callback: function(value) {
              return value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value;
            }
          },
          min: 0
        }
      }
    }
  });
}

// Populate search filter selects
function populateDropdowns(stores) {
  const directors = new Set();
  const coordinators = new Set();
  const distritals = new Set();
  const states = new Set();
  
  stores.forEach(s => {
    if (s.diretor && s.diretor !== 'Desconhecido') directors.add(s.diretor);
    if (s.coordenador && s.coordenador !== 'Desconhecido') coordinators.add(s.coordenador);
    if (s.distrital && s.distrital !== 'Desconhecido') distritals.add(s.distrital);
    if (s.state) states.add(s.state);
  });

  // Keep existing selection if any
  const prevDir = selectDirector.value;
  const prevCoord = selectCoordinator.value;
  const prevDist = selectDistrital.value;
  const prevSt = selectState.value;

  selectDirector.innerHTML = '<option value="">Diretor: Todos</option>' + 
    Array.from(directors).sort().map(d => `<option value="${d}">${d}</option>`).join('');

  selectCoordinator.innerHTML = '<option value="">Coordenador: Todos</option>' + 
    Array.from(coordinators).sort().map(c => `<option value="${c}">${c}</option>`).join('');

  selectDistrital.innerHTML = '<option value="">Distrital: Todos</option>' + 
    Array.from(distritals).sort().map(d => `<option value="${d}">${d}</option>`).join('');

  selectState.innerHTML = '<option value="">Estado: Todos</option>' + 
    Array.from(states).sort().map(st => `<option value="${st}">${st}</option>`).join('');

  selectDirector.value = prevDir;
  selectCoordinator.value = prevCoord;
  selectDistrital.value = prevDist;
  selectState.value = prevSt;
}

// Apply reactive filters
function applyFilters() {
  filteredStores = allStores.filter(s => {
    // 1. Status Filter
    if (currentStatusFilter !== 'ALL' && s.status !== currentStatusFilter) return false;
    
    // 2. Dropdown selectors
    if (currentDirector && s.diretor !== currentDirector) return false;
    if (currentDistrital && s.distrital !== currentDistrital) return false;
    if (currentCoordinator && s.coordenador !== currentCoordinator) return false;
    if (currentState && s.state !== currentState) return false;

    // 3. Search match
    if (currentSearchQuery) {
      const q = currentSearchQuery.toLowerCase();
      const match = 
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        (s.coordenador && s.coordenador.toLowerCase().includes(q)) ||
        (s.distrital && s.distrital.toLowerCase().includes(q)) ||
        (s.diretor && s.diretor.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  // Sort order: OFFLINE -> CRITICO -> ALERTA -> ONLINE -> INATIVA. Sub-sort by expected sales volume.
  filteredStores.sort((a, b) => {
    const priority = { OFFLINE: 0, CRITICO: 1, ALERTA: 2, ONLINE: 3, INATIVA: 4 };
    if (priority[a.status] !== priority[b.status]) {
      return priority[a.status] - priority[b.status];
    }
    return b.expectedSalesSoFar - a.expectedSalesSoFar;
  });

  storesCountLabel.textContent = `${filteredStores.length} lojas encontradas`;
  
  // Update drill level based on which selects are set
  if (currentCoordinator) {
    drillLevel = 'filial';
  } else if (currentDistrital) {
    drillLevel = 'coordenador';
  } else if (currentDirector) {
    drillLevel = 'distrital';
  } else {
    drillLevel = 'diretor';
  }
  
  updateDrillChartTitle();
  
  // Reset Display limit and render table
  displayLimit = 50;
  renderStoresTable();

  // Dynamic charts update based on filtered stores!
  updateAnalyticsCharts(filteredStores);
}

function renderStoresTable() {
  const slice = filteredStores.slice(0, displayLimit);
  
  if (slice.length === 0) {
    storesTableBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding: 32px; color: var(--text-secondary);">
          <i data-lucide="info" style="margin: 0 auto 8px; width: 24px; height: 24px;"></i>
          Nenhuma loja corresponde aos filtros selecionados.
        </td>
      </tr>
    `;
    btnLoadMore.classList.add('hide');
    lucide.createIcons();
    return;
  }

  storesTableBody.innerHTML = slice.map((s, idx) => {
    let rowClass = 'row-online';
    let badgeClass = 'badge-green';
    
    if (s.status === 'OFFLINE') { rowClass = 'row-offline'; badgeClass = 'badge-red'; }
    else if (s.status === 'CRITICO') { rowClass = 'row-critical'; badgeClass = 'badge-orange'; }
    else if (s.status === 'ALERTA') { rowClass = 'row-alert'; badgeClass = 'badge-yellow'; }
    else if (s.status === 'INATIVA') { rowClass = 'row-inativa'; badgeClass = 'badge-grey'; }

    const isSilent = s.status === 'OFFLINE' || s.status === 'CRITICO';

    return `
      <tr class="${rowClass}" onclick="openStoreDetails('${s.name}')">
        <td style="font-weight:800;">${s.name}</td>
        <td>
          <span class="store-meta-region">
            <i data-lucide="map-pin"></i>
            ${s.city} - ${s.state}
          </span>
        </td>
        <td class="text-center" style="font-weight:800; font-size: 0.95rem;">${s.salesToday}</td>
        <td class="text-center" style="color:var(--text-secondary);">${s.expectedSalesSoFar}</td>
        <td class="text-center" style="color:var(--text-secondary);">
          ${s.expectedIntervalMinutes ? `a cada ${s.expectedIntervalMinutes}m` : 'Eventual'}
        </td>
        <td class="text-center">
          <div class="store-idle-cell ${isSilent ? 'silent' : ''}">
            <span>${s.lastOrderTimeStr}</span>
            ${s.minutesSinceLastOrder !== null ? `
              <span class="time-ago">(${formatIdleTime(s.minutesSinceLastOrder)} atrás)</span>
            ` : ''}
          </div>
        </td>
        <td>
          <div class="store-org-cell">
            <span class="coord">${s.coordenador || 'Desconhecido'}</span>
            <span class="dist">D: ${s.distrital || 'Desconhecido'}</span>
          </div>
        </td>
        <td>
          <span class="status-badge ${badgeClass}">
            ${isSilent ? '<span class="blinking-dot"></span>' : ''}
            ${s.status}
          </span>
        </td>
        <td style="font-size:0.8rem; color:var(--text-secondary); max-width:240px; white-space:normal;">
          ${s.details}
        </td>
      </tr>
    `;
  }).join('');

  if (filteredStores.length > displayLimit) {
    btnLoadMore.classList.remove('hide');
  } else {
    btnLoadMore.classList.add('hide');
  }
  
  lucide.createIcons();
}

// Open detail modal with Chart.js curve
function openStoreDetails(storeName) {
  const store = allStores.find(s => s.name === storeName);
  if (!store) return;

  modalStoreName.textContent = store.name;
  modalStoreRegion.textContent = `${store.city} - ${store.state} | Coordenador: ${store.coordenador || 'Desconhecido'} (D: ${store.distrital || 'Desconhecido'})`;
  
  let badgeClass = 'badge-green';
  if (store.status === 'OFFLINE') badgeClass = 'badge-red';
  else if (store.status === 'CRITICO') badgeClass = 'badge-orange';
  else if (store.status === 'ALERTA') badgeClass = 'badge-yellow';
  else if (store.status === 'INATIVA') badgeClass = 'badge-grey';

  modalStoreStatus.className = `status-badge ${badgeClass}`;
  modalStoreStatus.textContent = store.status;
  
  modalStoreSales.textContent = store.salesToday;
  modalStoreExpected.textContent = store.expectedSalesSoFar;
  modalStoreLast.textContent = store.lastOrderTimeStr + (store.minutesSinceLastOrder != null ? ` (${formatIdleTime(store.minutesSinceLastOrder)} atrás)` : '');

  // Render Chart.js line chart for hourly sales
  const ctx = document.getElementById('store-hourly-chart').getContext('2d');
  
  // Destroy previous chart instance if exists
  if (hourlyChartInstance) {
    hourlyChartInstance.destroy();
  }

  const hoursArray = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}h`);
  
  hourlyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: hoursArray,
      datasets: [
        {
          label: 'Hoje (Acumulado por Hora)',
          data: store.hourlySales || Array(24).fill(0),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          borderWidth: 3,
          tension: 0.35,
          fill: true
        },
        {
          label: 'Ontem',
          data: store.hourlySalesYesterday || Array(24).fill(0),
          borderColor: '#f97316',
          borderDash: [5, 5],
          borderWidth: 2,
          tension: 0.35,
          fill: false
        },
        {
          label: '7 Dias Atrás',
          data: store.hourlySales7DaysAgo || Array(24).fill(0),
          borderColor: '#10b981',
          borderDash: [2, 2],
          borderWidth: 2,
          tension: 0.35,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#8b949e', font: { family: 'Inter', size: 11, weight: 600 } }
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#8b949e', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { color: '#8b949e', font: { size: 10 } },
          min: 0,
          suggestedMax: 4
        }
      }
    }
  });

  const modalOverlay = document.getElementById('store-modal');
  modalOverlay.classList.remove('hide');
}

function closeModal() {
  const modalOverlay = document.getElementById('store-modal');
  modalOverlay.classList.add('hide');
  if (hourlyChartInstance) {
    hourlyChartInstance.destroy();
    hourlyChartInstance = null;
  }
}

// Helpers
function formatIdleTime(mins) {
  if (mins == null) return 'N/A';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return `${hrs}h ${remMins}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d +`;
}

// Drill-down Chart Title & Back Button management
function updateDrillChartTitle() {
  const drillLabels = {
    diretor: 'Impacto por Diretor',
    distrital: 'Impacto por Distrital',
    coordenador: 'Impacto por Coordenador',
    filial: 'Lojas com Maior Impacto'
  };

  const titleEl = document.getElementById('chart-drill-title');
  const backBtn = document.getElementById('btn-chart-drill-back');

  if (titleEl) {
    // Preserve the icon inside h3
    const icon = titleEl.querySelector('i');
    const iconHtml = icon ? icon.outerHTML : '<i data-lucide="bar-chart-2"></i>';
    titleEl.innerHTML = `${iconHtml} ${drillLabels[drillLevel] || ''}`;
    lucide.createIcons({ icons: { 'bar-chart-2': true } });
  }

  if (backBtn) {
    if (drillLevel !== 'diretor') {
      backBtn.style.display = 'flex';
    } else {
      backBtn.style.display = 'none';
    }
  }
}

// Event Listeners
btnRefresh.addEventListener('click', loadMonitorData);

// Back button for drill-down chart
btnChartDrillBack.addEventListener('click', () => {
  // Step back one level: clear the deepest active filter
  if (currentCoordinator) {
    currentCoordinator = '';
    selectCoordinator.value = '';
    drillLevel = 'coordenador';
  } else if (currentDistrital) {
    currentDistrital = '';
    selectDistrital.value = '';
    drillLevel = 'distrital';
  } else if (currentDirector) {
    currentDirector = '';
    selectDirector.value = '';
    drillLevel = 'diretor';
  }
  applyFilters();
});

searchInput.addEventListener('input', (e) => {
  currentSearchQuery = e.target.value;
  applyFilters();
});

selectDirector.addEventListener('change', (e) => {
  currentDirector = e.target.value;
  // Cascade: reset downstream filters when going up the hierarchy
  if (!currentDirector) {
    currentDistrital = '';
    currentCoordinator = '';
    selectDistrital.value = '';
    selectCoordinator.value = '';
  }
  applyFilters();
});

selectCoordinator.addEventListener('change', (e) => {
  currentCoordinator = e.target.value;
  applyFilters();
});

selectDistrital.addEventListener('change', (e) => {
  currentDistrital = e.target.value;
  // Cascade: reset downstream filter when going up
  if (!currentDistrital) {
    currentCoordinator = '';
    selectCoordinator.value = '';
  }
  applyFilters();
});

selectState.addEventListener('change', (e) => {
  currentState = e.target.value;
  applyFilters();
});

// Status buttons interaction
document.querySelectorAll('.btn-status').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-status').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentStatusFilter = btn.dataset.status;
    applyFilters();
  });
});

// Interactive KPI cards filter
document.querySelectorAll('.kpi-card.interactive-card').forEach(card => {
  card.addEventListener('click', () => {
    const isSelected = card.classList.contains('selected');
    document.querySelectorAll('.kpi-card.interactive-card').forEach(c => c.classList.remove('selected'));
    
    if (isSelected) {
      currentStatusFilter = 'ALL';
      document.querySelector('.btn-status[data-status="ALL"]').click();
    } else {
      card.classList.add('selected');
      const filter = card.dataset.filter;
      currentStatusFilter = filter;
      document.querySelector(`.btn-status[data-status="${filter}"]`).click();
    }
  });
});

btnLoadMore.addEventListener('click', () => {
  displayLimit += 50;
  renderStoresTable();
});

btnCloseModal.addEventListener('click', closeModal);
btnInfo.addEventListener('click', () => infoModal.classList.remove('hide'));
btnCloseInfo.addEventListener('click', () => infoModal.classList.add('hide'));

// Close modal when clicking outside
window.addEventListener('click', (e) => {
  const modalOverlay = document.getElementById('store-modal');
  if (e.target === modalOverlay) {
    closeModal();
  }
  if (e.target === infoModal) {
    infoModal.classList.add('hide');
  }
});

// Esc key closes modal
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});

// Initial run
loadMonitorData();
pollSyncState();
// Auto refresh every 60s
setInterval(loadMonitorData, 60000);
// Poll sync state every 3s
setInterval(pollSyncState, 3000);

// Poll VTEX sync state
async function pollSyncState() {
  try {
    const res = await fetch('/api/sync/state');
    const json = await res.json();
    if (json.status === 'success') {
      const state = json.data;
      if (state.isSyncing) {
        syncProgressContainer.classList.remove('hide');
        syncProgressFill.style.width = `${state.progressPercent}%`;
        btnSyncTrigger.disabled = true;
        btnSyncTrigger.innerHTML = `<i data-lucide="loader" class="animate-spin"></i> ${state.progressPercent}%`;
      } else {
        syncProgressContainer.classList.add('hide');
        btnSyncTrigger.disabled = false;
        btnSyncTrigger.innerHTML = `<i data-lucide="play"></i> Sinc. VTEX`;
      }
      lucide.createIcons();
    }
  } catch (err) {
    console.error('[Sync Poll] Error:', err);
  }
}

// Trigger manual sync
btnSyncTrigger.addEventListener('click', async () => {
  try {
    btnSyncTrigger.disabled = true;
    btnSyncTrigger.innerHTML = `<i data-lucide="refresh-cw" class="animate-spin"></i> Iniciando...`;
    lucide.createIcons();
    
    const res = await fetch('/api/sync/trigger', { method: 'POST' });
    const json = await res.json();
    if (json.status === 'success') {
      pollSyncState();
    }
  } catch (err) {
    console.error('[Sync Trigger] Error:', err);
    btnSyncTrigger.disabled = false;
    btnSyncTrigger.innerHTML = `<i data-lucide="play"></i> Sinc. VTEX`;
    lucide.createIcons();
  }
});

