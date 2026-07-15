// State variables
let monitorData = null;
let allStores = [];
let filteredStores = [];
let displayLimit = 50;
let ordersDisplayLimit = 50;
let ordersSearchQuery = '';
let ordersCancelFilter = 'ALL';


// Filter values
let currentStatusFilter = 'ALL';
let currentSearchQuery = '';
let currentDirector = '';
let currentDistrital = '';
let currentCoordinator = '';
let currentState = '';
let currentCategoryFilter = '';
let currentPaymentFilter = '';
let currentProductFilter = '';
let currentReasonFilter = '';
let queueSearchQuery = '';
let queueStatusFilter = 'ALL';

// Sorting state
let storesSortField = 'status'; // default status priority
let storesSortAsc = true;
let rankingSortField = 'cancelRate'; // default cancel rate desc
let rankingSortAsc = false;

let drillLevel = 'diretor'; // 'diretor', 'distrital', 'coordenador', 'filial'

// Chart instances
let hourlyChartInstance = null;
let statusChartInstance = null;
let coordinatorChartInstance = null;
let historyChartInstance = null;
let zeroSalesChartInstance = null;
let cumulativeOrdersChartInstance = null;
let ordersPieChartInstance = null;
let ordersCanceledChartInstance = null;

// DOM Elements
const syncStatusText = document.getElementById('sync-status-text');
const btnRefresh = document.getElementById('btn-refresh');
const kpiHealthScore = document.getElementById('kpi-health-score');
const kpiHealthFooter = document.getElementById('kpi-health-footer');
const kpiHealthCompare = document.getElementById('kpi-health-compare');
const kpiOfflineCount = document.getElementById('kpi-offline-count');
const kpiOfflineCompare = document.getElementById('kpi-offline-compare');
const kpiCriticalCount = document.getElementById('kpi-critical-count');
const kpiCriticalCompare = document.getElementById('kpi-critical-compare');
const kpiAlertCount = document.getElementById('kpi-alert-count');
const kpiAlertCompare = document.getElementById('kpi-alert-compare');
const kpiAvgIdle = document.getElementById('kpi-avg-idle');
const kpiAvgIdleCompare = document.getElementById('kpi-avg-idle-compare');


const stateTableBody = document.getElementById('state-table-body');
const cityTableBody = document.getElementById('city-table-body');
const coordinatorTableBody = document.getElementById('coordinator-table-body');

const searchInput = document.getElementById('search-input');
const selectDirector = document.getElementById('select-director');
const selectDistrital = document.getElementById('select-distrital');
const selectCoordinator = document.getElementById('select-coordinator');
const selectState = document.getElementById('select-state');
const selectCategory = document.getElementById('select-category');
const selectPayment = document.getElementById('select-payment');
const selectProduct = document.getElementById('select-product');
const selectReason = document.getElementById('select-reason');
const storesCountLabel = document.getElementById('stores-count-label');
const storesTableBody = document.getElementById('stores-table-body');
const btnLoadMore = document.getElementById('btn-load-more');

const queueSearchInput = document.getElementById('queue-search-input');
const selectQueueStatus = document.getElementById('select-queue-status');

const btnChartDrillBack = document.getElementById('btn-chart-drill-back');
const chartDrillTitle = document.getElementById('chart-drill-title');

const storeModal = document.getElementById('store-modal');
const modalStoreName = document.getElementById('modal-store-name');
const modalStoreRegion = document.getElementById('modal-store-region');
const modalStoreStatus = document.getElementById('modal-store-status');
const modalStoreSales = document.getElementById('modal-store-sales');
const modalStoreExpected = document.getElementById('modal-store-expected');
const modalStoreLast = document.getElementById('modal-store-last');
const modalStoreCanceled = document.getElementById('modal-store-canceled');
const modalStorePending = document.getElementById('modal-store-pending');
const btnCloseModal = document.getElementById('btn-close-modal');

const btnInfo = document.getElementById('btn-info');
const infoModal = document.getElementById('info-modal');
const btnCloseInfo = document.getElementById('btn-close-info');

const btnSyncTrigger = document.getElementById('btn-sync-trigger');
const syncProgressContainer = document.getElementById('sync-progress-container');
const syncProgressFill = document.getElementById('sync-progress-fill');

// API call to fetch data
async function fetchWithTimeout(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function loadMonitorData(isRetry = false) {
  if (!isRetry) setLoadingState(true);
  try {
    const res = await fetchWithTimeout('/api/monitor', 45000);
    const json = await res.json();
    
    if (json.status === 'success') {
      monitorData = json.data;
      allStores = monitorData.stores;
      
      // Update UI Components
      updateKPIs(monitorData.summary, monitorData.referenceDate, monitorData.referenceTime);
      updateRegionTables(monitorData.stateAnalytics, monitorData.cityAnalytics, monitorData.coordinatorAnalytics, monitorData.distritalAnalytics);
      populateDropdowns(allStores);
      populateOrderLevelFilters();
      applyFilters();
      
      syncStatusText.textContent = `Atualizado: ${monitorData.referenceTime}`;
      syncStatusText.parentElement.firstElementChild.className = 'pulse-indicator status-green';
    } else {
      // Server is up but data not ready (syncing)
      const syncInfo = json.sync;
      const pct = syncInfo && syncInfo.progressPercent ? syncInfo.progressPercent : 0;
      const msg = syncInfo && syncInfo.isSyncing 
        ? `Sincronizando dados da VTEX (${pct}%)... Aguarde.`
        : (json.message || 'Erro no processamento dos dados.');
      showError(msg);
      // Auto-retry while syncing
      if (syncInfo && syncInfo.isSyncing) {
        setTimeout(() => loadMonitorData(true), 10000);
      } else {
        setTimeout(() => loadMonitorData(true), 15000);
      }
    }
  } catch (err) {
    console.error('[App] Fetch error:', err);
    syncStatusText.textContent = 'Reconectando ao servidor...';
    syncStatusText.parentElement.firstElementChild.className = 'pulse-indicator status-yellow';
    // Always auto-retry on network errors (cold start, timeout, etc.)
    setTimeout(() => loadMonitorData(true), 10000);
  } finally {
    if (!isRetry) setLoadingState(false);
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
  
  // 1. Total orders today
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

  // 2. Health Score comparison
  if (kpiHealthCompare && summary.healthScoreYesterday != null) {
    const deltaYest = summary.healthScore - summary.healthScoreYesterday;
    const deltaWeek = summary.healthScore - summary.healthScoreLastWeek;
    kpiHealthCompare.innerHTML = `${formatDelta(deltaYest, '%', true)} vs Ontem &nbsp;|&nbsp; ${formatDelta(deltaWeek, '%', true)} vs Semana`;
  }

  // 3. Offline stores comparison
  if (kpiOfflineCompare && summary.offlineCountYesterday != null) {
    const deltaYest = summary.offlineCount - summary.offlineCountYesterday;
    const deltaWeek = summary.offlineCount - summary.offlineCountLastWeek;
    kpiOfflineCompare.innerHTML = `${formatDelta(deltaYest, 'lojas', false)} vs Ontem &nbsp;|&nbsp; ${formatDelta(deltaWeek, 'lojas', false)} vs Semana`;
  }

  // 4. Critical stores comparison
  if (kpiCriticalCompare && summary.criticalCountYesterday != null) {
    const deltaYest = summary.criticalCount - summary.criticalCountYesterday;
    const deltaWeek = summary.criticalCount - summary.criticalCountLastWeek;
    kpiCriticalCompare.innerHTML = `${formatDelta(deltaYest, 'lojas', false)} vs Ontem &nbsp;|&nbsp; ${formatDelta(deltaWeek, 'lojas', false)} vs Semana`;
  }

  // 5. Alert stores comparison
  if (kpiAlertCompare && summary.alertCountYesterday != null) {
    const deltaYest = summary.alertCount - summary.alertCountYesterday;
    const deltaWeek = summary.alertCount - summary.alertCountLastWeek;
    kpiAlertCompare.innerHTML = `${formatDelta(deltaYest, 'lojas', false)} vs Ontem &nbsp;|&nbsp; ${formatDelta(deltaWeek, 'lojas', false)} vs Semana`;
  }

  // 6. Average idle time comparison
  if (kpiAvgIdleCompare && summary.avgIdleMinutesGlobal != null && summary.avgIdleMinutesYesterday != null) {
    const deltaYest = summary.avgIdleMinutesGlobal - summary.avgIdleMinutesYesterday;
    const deltaWeek = summary.avgIdleMinutesGlobal - summary.avgIdleMinutesLastWeek;
    kpiAvgIdleCompare.innerHTML = `${formatDelta(deltaYest, 'min', false)} vs Ontem &nbsp;|&nbsp; ${formatDelta(deltaWeek, 'min', false)} vs Semana`;
  } else if (kpiAvgIdleCompare) {
    kpiAvgIdleCompare.innerHTML = `<span style="color:#8b949e;">= 0</span> vs Ontem &nbsp;|&nbsp; <span style="color:#8b949e;">= 0</span> vs Semana`;
  }

  // ── Global Status Banner ──
  updateGlobalStatusBanner(summary);
}

function updateGlobalStatusBanner(summary) {
  const banner = document.getElementById('global-status-banner');
  const title = document.getElementById('global-status-title');
  const desc = document.getElementById('global-status-desc');
  
  if (!banner || !summary || summary.zeroSalesYesterday == null) return;

  const zeroToday = summary.zeroSalesToday;
  const zeroYesterday = summary.zeroSalesYesterday;
  const zeroLastWeek = summary.zeroSalesLastWeek;

  const criticalToday = summary.criticalCount;
  const criticalYesterday = summary.criticalCountYesterday;
  const criticalLastWeek = summary.criticalCountLastWeek;

  // 1. Calculate Zero Sales stress level
  const baselineZero = (zeroYesterday + zeroLastWeek) / 2;
  const ratioZero = zeroToday / Math.max(baselineZero, 1);
  let levelZero = 1; // Default normal
  if (ratioZero <= 0.85) levelZero = 0; // Excelente
  else if (ratioZero <= 1.15) levelZero = 1; // Normal
  else if (ratioZero <= 1.4) levelZero = 2; // Atenção
  else if (ratioZero <= 2.0) levelZero = 3; // Crítico
  else levelZero = 4; // Severo

  // 2. Calculate Critical Inactivity stress level
  const baselineCrit = (criticalYesterday + criticalLastWeek) / 2;
  const ratioCrit = criticalToday / Math.max(baselineCrit, 5); // Base min of 5 to avoid noise
  let levelCrit = 1; // Default normal
  if (ratioCrit <= 0.85) levelCrit = 0; // Excelente
  else if (ratioCrit <= 1.2) levelCrit = 1; // Normal
  else if (ratioCrit <= 1.5) levelCrit = 2; // Atenção
  else if (ratioCrit <= 2.2) levelCrit = 3; // Crítico
  else levelCrit = 4; // Severo

  // Final level is the maximum of both
  let finalLevel = Math.max(levelZero, levelCrit);

  // Gating based on overall Health Score to ensure proportionality
  const health = summary.healthScore;
  const pctOffline = summary.offlineCount / Math.max(summary.totalMonitored, 1);
  const pctCritical = summary.criticalCount / Math.max(summary.totalMonitored, 1);

  // Downgrade if health is high to prevent small noise in low baselines from causing alert states
  if (health >= 95) {
    finalLevel = Math.min(finalLevel, 1);
    if (pctOffline < 0.01 && pctCritical < 0.005) {
      finalLevel = 0; // Excelente
    }
  } else if (health >= 88) {
    finalLevel = Math.min(finalLevel, 2); // At most Atenção
  } else if (health >= 78) {
    finalLevel = Math.min(finalLevel, 3); // At most Crítico
  }

  // Upgrade if overall health is poor
  if (health < 70) {
    finalLevel = Math.max(finalLevel, 4); // Severo
  } else if (health < 80) {
    finalLevel = Math.max(finalLevel, 3); // Crítico
  } else if (health < 90) {
    finalLevel = Math.max(finalLevel, 2); // Atenção
  }

  const clusters = ['excelente', 'normal', 'atencao', 'critico', 'severo'];
  const cluster = clusters[finalLevel];

  let titleText = '';
  let descText = '';

  if (finalLevel === 0) {
    titleText = 'Termômetro Operacional: EXCELENTE';
    descText = 'Volume de lojas sem faturamento e inatividade recente estão abaixo da média histórica. Operação muito saudável!';
  } else if (finalLevel === 1) {
    titleText = 'Termômetro Operacional: NORMAL';
    descText = 'Operação dentro da normalidade histórica. Lojas paradas e inatividade recente sob controle.';
  } else if (finalLevel === 2) {
    titleText = 'Termômetro Operacional: ATENÇÃO';
    if (levelCrit > levelZero) {
      descText = `Alerta de Inatividade Recente: Há um aumento de lojas ativas que pararam de vender nas últimas 2h (${criticalToday} vs média de ${Math.round(baselineCrit)}).`;
    } else {
      descText = `Volume de lojas sem venda hoje está acima do esperado (${zeroToday} vs média de ${Math.round(baselineZero)}). Fique de olho.`;
    }
  } else if (finalLevel === 3) {
    titleText = 'Termômetro Operacional: CRÍTICO';
    if (levelCrit > levelZero) {
      descText = `Desvio Operacional Grave: Pico anômalo de lojas em inatividade crítica (${criticalToday} vs média de ${Math.round(baselineCrit)}). Várias filiais pararam de faturar nas últimas 2 horas! Sugerimos verificar integrações de TI.`;
    } else {
      descText = `Muitas lojas paradas em comparação com o histórico (${zeroToday} vs média de ${Math.round(baselineZero)}). Possível instabilidade sistêmica em andamento.`;
    }
  } else if (finalLevel === 4) {
    titleText = 'Termômetro Operacional: INCIDENTE / SEVERO';
    if (levelCrit > levelZero) {
      descText = `INCIDENTE GRAVE DETECTADO: Interrupção repentina de faturamento em massa! ${criticalToday} lojas em inatividade crítica (média histórica para o horário: ${Math.round(baselineCrit)}). Acione imediatamente os times de T.I. e Infraestrutura!`;
    } else {
      descText = `Volume massivo de lojas sem venda hoje (${zeroToday} vs média de ${Math.round(baselineZero)}). Desvio grave na operação!`;
    }
  }

  // Update classes
  banner.className = `global-status-banner status-${cluster}`;
  title.textContent = titleText;
  
  const zeroOffline = summary.offlineCount || 0;
  const zeroAlert = (summary.zeroSalesToday || 0) - zeroOffline;
  desc.innerHTML = descText + `<br><span style="opacity:0.9; font-size:0.82rem; display:block; margin-top:6px; border-top: 1px solid rgba(255,255,255,0.08); padding-top:6px;"><i data-lucide="info" style="width:13px; height:13px; display:inline-block; vertical-align:middle; margin-right:4px; margin-top:-2px;"></i> <strong>Diagnóstico de Estresse:</strong> Das ${zeroToday} lojas sem vendas acumuladas hoje, <strong>${zeroOffline}</strong> são de alto volume (classificadas como <strong>Offline</strong>) e <strong>${zeroAlert > 0 ? zeroAlert : 0}</strong> são de baixo volume esperado (em <strong>Atenção</strong>).</span>`;
  lucide.createIcons();

  // Update clusters UI
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

function formatIdleTimeDelta(mins) {
  const absMins = Math.abs(mins);
  const sign = mins > 0 ? '+' : '-';
  if (absMins < 60) return `${sign}${absMins}m`;
  const hrs = Math.floor(absMins / 60);
  const remMins = absMins % 60;
  if (remMins === 0) return `${sign}${hrs}h`;
  return `${sign}${hrs}h ${remMins}m`;
}

/**
 * Format a delta value with arrow and color.
 * @param {number} delta - The difference (positive = increase)
 * @param {string} unit - Unit label
 * @param {boolean} positiveIsGood - If true, positive delta is green (more orders = good). If false, positive is red (more offline = bad).
 */
function formatDelta(delta, unit, positiveIsGood) {
  if (delta === 0 || delta === null) return `<span style="color:#8b949e;">= 0</span>`;
  const arrow = delta > 0 ? '▲' : '▼';
  const isGood = positiveIsGood ? delta > 0 : delta < 0;
  const color = isGood ? '#10b981' : '#ef4444';
  
  let formattedValue = '';
  if (unit === '%') {
    const sign = delta > 0 ? '+' : '-';
    formattedValue = `${sign}${Math.abs(delta)}%`;
  } else if (unit === 'min') {
    formattedValue = formatIdleTimeDelta(delta);
  } else {
    const sign = delta > 0 ? '+' : '-';
    formattedValue = `${sign}${Math.abs(delta)}`;
  }
  
  return `<span style="color:${color}; font-weight:700;">${arrow} ${formattedValue}</span>`;
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

// Helper to calculate a store's status at a specific hour in the frontend
function getStoreStatusAtHour(s, h, dayType) {
  let hourlySales;
  if (dayType === 'today') hourlySales = s.hourlySales || [];
  else if (dayType === 'yesterday') hourlySales = s.hourlySalesYesterday || [];
  else hourlySales = s.hourlySales7DaysAgo || [];

  const salesH = hourlySales.slice(0, h + 1).reduce((a, b) => a + b, 0);
  
  const salesYesterdayH = (s.hourlySalesYesterday || []).slice(0, h + 1).reduce((a, b) => a + b, 0);
  const sales7DaysAgoH = (s.hourlySales7DaysAgo || []).slice(0, h + 1).reduce((a, b) => a + b, 0);
  const expectedSalesH = (salesYesterdayH + sales7DaysAgoH) / 2;

  const expectedSalesFull = ((s.salesYesterdayFull || 0) + (s.sales7DaysAgoFull || 0)) / 2;
  const activeMinutes = 720;
  const expectedInterval = expectedSalesFull > 0 ? activeMinutes / expectedSalesFull : 0;

  let lastSaleHour = null;
  for (let hr = h; hr >= 0; hr--) {
    if (hourlySales[hr] > 0) {
      lastSaleHour = hr;
      break;
    }
  }

  let minutesSinceLastOrder = null;
  if (lastSaleHour !== null) {
    minutesSinceLastOrder = (h - lastSaleHour) * 60;
  }

  if (expectedSalesFull <= 0.6) {
    return salesH === 0 ? 'INATIVA' : 'ONLINE';
  }

  if (salesH === 0) {
    return expectedSalesH >= 1.2 ? 'OFFLINE' : 'ALERTA';
  }

  if (minutesSinceLastOrder !== null && expectedInterval > 0) {
    const deviation = minutesSinceLastOrder / expectedInterval;
    if (minutesSinceLastOrder > 120 && deviation > 3.0) {
      return 'CRITICO';
    }
    if (minutesSinceLastOrder > 60 && deviation > 2.0) {
      return 'ALERTA';
    }
  }

  if (salesH < expectedSalesH * 0.4) {
    return 'ALERTA';
  }

  return 'ONLINE';
}

// CSV Export
function exportFilteredCSV() {
  if (!filteredStores || filteredStores.length === 0) {
    alert('Nenhuma loja para exportar. Ajuste os filtros e tente novamente.');
    return;
  }

  const headers = ['Filial', 'Cidade', 'UF', 'Vendas Hoje', 'Esperado', 'Intervalo Médio (min)', 'Última Venda', 'Tempo Inativo (min)', 'Coordenador', 'Distrital', 'Diretor', 'Status', 'Cancelados Hoje', 'Pendentes Hoje', 'Diagnóstico'];
  
  const rows = filteredStores.map(s => [
    `"${(s.name || '').replace(/"/g, '""')}"`,
    `"${(s.city || '').replace(/"/g, '""')}"`,
    s.state || '',
    s.salesToday,
    s.expectedSalesSoFar,
    s.expectedIntervalMinutes || '',
    s.lastOrderTimeStr || 'N/A',
    s.minutesSinceLastOrder != null ? s.minutesSinceLastOrder : '',
    `"${(s.coordenador || '').replace(/"/g, '""')}"`,
    `"${(s.distrital || '').replace(/"/g, '""')}"`,
    `"${(s.diretor || '').replace(/"/g, '""')}"`,
    s.status,
    s.canceledToday || 0,
    s.pendingToday || 0,
    `"${(s.details || '').replace(/"/g, '""')}"`
  ]);

  const bom = '\uFEFF';
  const csvContent = bom + headers.join(';') + '\n' + rows.map(r => r.join(';')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
  link.href = url;
  link.download = `monitor_lojas_${dateStr}_${timeStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function updateAnalyticsCharts(storesList) {
  // Define allNonInactive for downstream charts (such as Cumulative Orders)
  const allNonInactive = storesList.filter(s => s.status !== 'INATIVA');

  // 1. Calculate status distribution for status-pie-chart
  const activeMonitored = allNonInactive;
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
  // 4. COMPARATIVE: Hourly Status/Sales Curve — Today × Yesterday × Last Week
  // ────────────────────────────────────────────────────────────────────
  const zeroCtx = document.getElementById('zero-sales-comparison-chart').getContext('2d');
  if (zeroSalesChartInstance) zeroSalesChartInstance.destroy();

  // Dynamic Chart Title based on Selected Status
  const chartTitleEl = document.getElementById('zero-sales-chart-title');
  let currentMetricName = 'lojas sem venda';
  if (chartTitleEl) {
    let titleText = 'Lojas Sem Venda por Hora';
    if (currentStatusFilter === 'OFFLINE') {
      titleText = 'Lojas Offline por Hora';
      currentMetricName = 'lojas offline';
    } else if (currentStatusFilter === 'CRITICO') {
      titleText = 'Lojas em Inatividade Crítica por Hora';
      currentMetricName = 'lojas críticas';
    } else if (currentStatusFilter === 'ALERTA') {
      titleText = 'Lojas em Atenção por Hora';
      currentMetricName = 'lojas em alerta';
    } else if (currentStatusFilter === 'ONLINE') {
      titleText = 'Lojas Online por Hora';
      currentMetricName = 'lojas online';
    }
    
    chartTitleEl.innerHTML = `<i data-lucide="line-chart"></i> ${titleText} — Hoje × Ontem × Semana Passada`;
    lucide.createIcons();
  }

  // Filter stores using director, distrital, coordinator, state, and search, but NOT by status filter
  const storesForChart = allStores.filter(s => {
    if (currentDirector && s.diretor !== currentDirector) return false;
    if (currentDistrital && s.distrital !== currentDistrital) return false;
    if (currentCoordinator && s.coordenador !== currentCoordinator) return false;
    if (currentState && s.state !== currentState) return false;
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

  const allNonInactiveForChart = storesForChart.filter(s => s.status !== 'INATIVA');

  const zeroToday = [];
  const zeroYesterday = [];
  const zeroLastWeek = [];
  const zeroLabels = [];

  for (let h = 0; h <= refHour; h++) {
    zeroLabels.push(`${String(h).padStart(2, '0')}h`);

    let countToday = 0, countYesterday = 0, countLastWeek = 0;

    allNonInactiveForChart.forEach(s => {
      if (currentStatusFilter === 'ALL') {
        const cumToday = (s.hourlySales || []).slice(0, h + 1).reduce((a, b) => a + b, 0);
        const cumYesterday = (s.hourlySalesYesterday || []).slice(0, h + 1).reduce((a, b) => a + b, 0);
        const cumLastWeek = (s.hourlySales7DaysAgo || []).slice(0, h + 1).reduce((a, b) => a + b, 0);

        if (cumToday === 0) countToday++;
        if (cumYesterday === 0) countYesterday++;
        if (cumLastWeek === 0) countLastWeek++;
      } else {
        if (getStoreStatusAtHour(s, h, 'today') === currentStatusFilter) countToday++;
        if (getStoreStatusAtHour(s, h, 'yesterday') === currentStatusFilter) countYesterday++;
        if (getStoreStatusAtHour(s, h, 'lastWeek') === currentStatusFilter) countLastWeek++;
      }
    });

    zeroToday.push(countToday);
    zeroYesterday.push(countYesterday);
    zeroLastWeek.push(countLastWeek);
  }

  const todayLabel = currentStatusFilter === 'ALL' ? '🔴 Hoje (sem venda)' : `🔴 Hoje (${currentStatusFilter})`;

  zeroSalesChartInstance = new Chart(zeroCtx, {
    type: 'line',
    data: {
      labels: zeroLabels,
      datasets: [
        {
          label: todayLabel,
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
              return ` ${ctx.dataset.label}: ${ctx.parsed.y} ${currentMetricName}`;
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

  // Use allStores filtered by org hierarchy only (not by status) for total volume
  const storesForCum = allStores.filter(s => {
    if (s.status === 'INATIVA') return false;
    if (currentDirector && s.diretor !== currentDirector) return false;
    if (currentDistrital && s.distrital !== currentDistrital) return false;
    if (currentCoordinator && s.coordenador !== currentCoordinator) return false;
    if (currentState && s.state !== currentState) return false;
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

  for (let h = 0; h <= refHour; h++) {
    cumLabels.push(`${String(h).padStart(2, '0')}h`);

    let totalToday = 0, totalYesterday = 0, totalLastWeek = 0;

    storesForCum.forEach(s => {
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

function populateOrderLevelFilters() {
  if (!monitorData || !monitorData.cancellationsAnalytics) return;
  const analytics = monitorData.cancellationsAnalytics;
  const todayOrders = analytics.todayOrders || [];

  const categories = new Set();
  const payments = new Set();
  const products = new Set();
  const reasons = new Set();

  todayOrders.forEach(o => {
    o.paymentNames.forEach(p => payments.add(p));
    o.items.forEach(item => {
      if (item.category) categories.add(item.category);
      if (item.name) products.add(item.name);
    });
    const statusLower = (o.status || '').toLowerCase();
    if (statusLower === 'canceled' || statusLower === 'cancel') {
      const normReason = normalizeCancelReason(o.cancelReason);
      reasons.add(normReason);
    }
  });

  if (selectCategory) {
    const curVal = selectCategory.value;
    selectCategory.innerHTML = '<option value="">Categoria: Todas</option>' + 
      Array.from(categories).sort().map(c => `<option value="${c}">${c}</option>`).join('');
    selectCategory.value = categories.has(curVal) ? curVal : '';
  }

  if (selectPayment) {
    const curVal = selectPayment.value;
    selectPayment.innerHTML = '<option value="">Pagamento: Todos</option>' + 
      Array.from(payments).sort().map(p => `<option value="${p}">${p}</option>`).join('');
    selectPayment.value = payments.has(curVal) ? curVal : '';
  }

  if (selectProduct) {
    const curVal = selectProduct.value;
    selectProduct.innerHTML = '<option value="">Produto: Todos</option>' + 
      Array.from(products).sort().map(p => `<option value="${p}">${p}</option>`).join('');
    selectProduct.value = products.has(curVal) ? curVal : '';
  }

  if (selectReason) {
    const curVal = selectReason.value;
    selectReason.innerHTML = '<option value="">Motivo: Todos</option>' + 
      Array.from(reasons).sort().map(r => `<option value="${r}">${r}</option>`).join('');
    selectReason.value = reasons.has(curVal) ? curVal : '';
  }
}

// Dynamic summary calculator for organization filters
function calculateSummary(storesSubset) {
  const activeMonitored = storesSubset.filter(s => s.status !== 'INATIVA');
  const totalMonitored = activeMonitored.length;
  const offlineCount = activeMonitored.filter(s => s.status === 'OFFLINE').length;
  const criticalCount = activeMonitored.filter(s => s.status === 'CRITICO').length;
  const alertCount = activeMonitored.filter(s => s.status === 'ALERTA').length;
  const onlineCount = activeMonitored.filter(s => s.status === 'ONLINE').length;
  const inativeCount = storesSubset.filter(s => s.status === 'INATIVA').length;

  const activeWithIdle = activeMonitored.filter(s => s.minutesSinceLastOrder !== null);
  const avgIdleMinutesGlobal = activeWithIdle.length > 0
    ? Math.round(activeWithIdle.reduce((sum, s) => sum + s.minutesSinceLastOrder, 0) / activeWithIdle.length)
    : null;

  // Yesterday
  const activeMonitoredYesterday = storesSubset.filter(s => s.statusYesterday !== 'INATIVA');
  const totalMonitoredYesterday = activeMonitoredYesterday.length;
  const offlineCountYesterday = activeMonitoredYesterday.filter(s => s.statusYesterday === 'OFFLINE').length;
  const criticalCountYesterday = activeMonitoredYesterday.filter(s => s.statusYesterday === 'CRITICO').length;
  const alertCountYesterday = activeMonitoredYesterday.filter(s => s.statusYesterday === 'ALERTA').length;
  const onlineCountYesterday = activeMonitoredYesterday.filter(s => s.statusYesterday === 'ONLINE').length;
  
  const activeWithIdleYesterday = activeMonitoredYesterday.filter(s => s.minutesSinceLastOrderYesterday !== null);
  const avgIdleMinutesYesterday = activeWithIdleYesterday.length > 0
    ? Math.round(activeWithIdleYesterday.reduce((sum, s) => sum + s.minutesSinceLastOrderYesterday, 0) / activeWithIdleYesterday.length)
    : null;
  const healthScoreYesterday = totalMonitoredYesterday > 0
    ? Math.round(((onlineCountYesterday + alertCountYesterday * 0.5) / totalMonitoredYesterday) * 100)
    : 100;

  // Last Week
  const activeMonitoredLastWeek = storesSubset.filter(s => s.status7DaysAgo !== 'INATIVA');
  const totalMonitoredLastWeek = activeMonitoredLastWeek.length;
  const offlineCountLastWeek = activeMonitoredLastWeek.filter(s => s.status7DaysAgo === 'OFFLINE').length;
  const criticalCountLastWeek = activeMonitoredLastWeek.filter(s => s.status7DaysAgo === 'CRITICO').length;
  const alertCountLastWeek = activeMonitoredLastWeek.filter(s => s.status7DaysAgo === 'ALERTA').length;
  const onlineCountLastWeek = activeMonitoredLastWeek.filter(s => s.status7DaysAgo === 'ONLINE').length;

  const activeWithIdleLastWeek = activeMonitoredLastWeek.filter(s => s.minutesSinceLastOrder7DaysAgo !== null);
  const avgIdleMinutesLastWeek = activeWithIdleLastWeek.length > 0
    ? Math.round(activeWithIdleLastWeek.reduce((sum, s) => sum + s.minutesSinceLastOrder7DaysAgo, 0) / activeWithIdleLastWeek.length)
    : null;
  const healthScoreLastWeek = totalMonitoredLastWeek > 0
    ? Math.round(((onlineCountLastWeek + alertCountLastWeek * 0.5) / totalMonitoredLastWeek) * 100)
    : 100;

  // Comparative KPIs
  let totalOrdersToday = 0, totalOrdersYesterday = 0, totalOrdersLastWeek = 0;
  let zeroSalesToday = 0, zeroSalesYesterday = 0, zeroSalesLastWeek = 0;
  let totalRevenueToday = 0;

  // Reference hour
  let refHour = 23;
  if (monitorData && monitorData.referenceTime) {
    refHour = parseInt(monitorData.referenceTime.split(':')[0], 10);
  }

  activeMonitored.forEach(s => {
    const cumToday = s.hourlySales.slice(0, refHour + 1).reduce((a, b) => a + b, 0);
    const cumYesterday = s.hourlySalesYesterday.slice(0, refHour + 1).reduce((a, b) => a + b, 0);
    const cumLastWeek = s.hourlySales7DaysAgo.slice(0, refHour + 1).reduce((a, b) => a + b, 0);

    totalOrdersToday += cumToday;
    totalOrdersYesterday += cumYesterday;
    totalOrdersLastWeek += cumLastWeek;
    totalRevenueToday += s.revenueToday;

    if (cumToday === 0) zeroSalesToday++;
    if (cumYesterday === 0) zeroSalesYesterday++;
    if (cumLastWeek === 0) zeroSalesLastWeek++;
  });

  return {
    totalMonitored,
    offlineCount,
    criticalCount,
    alertCount,
    onlineCount,
    inativeCount,
    avgIdleMinutesGlobal,
    healthScore: totalMonitored > 0 ? Math.round(((onlineCount + alertCount * 0.5) / totalMonitored) * 100) : 100,

    // Yesterday
    offlineCountYesterday,
    criticalCountYesterday,
    alertCountYesterday,
    avgIdleMinutesYesterday,
    healthScoreYesterday,

    // Last Week
    offlineCountLastWeek,
    criticalCountLastWeek,
    alertCountLastWeek,
    avgIdleMinutesLastWeek,
    healthScoreLastWeek,

    // Comparative KPIs
    totalOrdersToday,
    totalOrdersYesterday,
    totalOrdersLastWeek,
    zeroSalesToday,
    zeroSalesYesterday,
    zeroSalesLastWeek,
    totalRevenueToday
  };
}

// Clean/normalize cancellation reason comments (matches backend)
function normalizeCancelReason(reason) {
  if (!reason) return 'Problema de pagamento / gateway';
  const r = reason.toLowerCase();
  if (r.includes('estoque') || r.includes('divergencia') || r.includes('divergência')) return 'Divergência de estoque';
  if (r.includes('receita') || r.includes('controlado')) return 'Falta de receita do controlado';
  if (r.includes('pagamento') || r.includes('autorização') || r.includes('autorizacao') || r.includes('recusa')) return 'Problema no pagamento';
  if (r.includes('desistiu') || r.includes('desistencia') || r.includes('desistência') || r.includes('cliente quis')) return 'Desistência do cliente';
  if (r.includes('duplicado') || r.includes('duplicidade')) return 'Pedido duplicado';
  if (r.includes('teste')) return 'Pedido de teste';
  
  const trimmed = reason.trim().replace(/[\r\n\t]+/g, ' ');
  if (!trimmed) return 'Problema de pagamento / gateway';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

// Apply reactive filters
function applyFilters() {
  // Pre-process store sales counts if order-level filters are active
  const todayOrders = (monitorData && monitorData.cancellationsAnalytics && monitorData.cancellationsAnalytics.todayOrders) || [];
  
  // Clone stores list to avoid mutating global data
  const storesCopy = allStores.map(s => {
    if (s._origSalesToday === undefined) s._origSalesToday = s.salesToday;
    if (s._origCanceledToday === undefined) s._origCanceledToday = s.canceledToday;
    if (s._origPendingToday === undefined) s._origPendingToday = s.pendingToday;
    return { ...s };
  });

  if (currentCategoryFilter || currentPaymentFilter || currentProductFilter || currentReasonFilter) {
    // Zero out count for all stores
    storesCopy.forEach(s => {
      s.salesToday = 0;
      s.canceledToday = 0;
      s.pendingToday = 0;
    });

    todayOrders.forEach(o => {
      if (currentCategoryFilter) {
        const hasCat = o.items.some(i => i.category === currentCategoryFilter);
        if (!hasCat) return;
      }
      if (currentPaymentFilter) {
        if (!o.paymentNames.includes(currentPaymentFilter)) return;
      }
      if (currentProductFilter) {
        const hasProd = o.items.some(i => i.name === currentProductFilter);
        if (!hasProd) return;
      }
      if (currentReasonFilter) {
        const normReason = normalizeCancelReason(o.cancelReason);
        if (normReason !== currentReasonFilter) return;
      }

      const store = storesCopy.find(s => s.name === o.storeName);
      if (store) {
        const statusLower = (o.status || '').toLowerCase();
        if (statusLower === 'canceled' || statusLower === 'cancel') {
          store.canceledToday++;
        } else if (statusLower === 'payment-pending') {
          store.pendingToday++;
        } else {
          store.salesToday++;
        }
      }
    });
  } else {
    // Restore original values
    storesCopy.forEach(s => {
      s.salesToday = s._origSalesToday;
      s.canceledToday = s._origCanceledToday;
      s.pendingToday = s._origPendingToday;
    });
  }

  // First, filter by organizational/search criteria (without status filter)
  const orgFilteredStores = storesCopy.filter(s => {
    // Dropdown selectors
    if (currentDirector && s.diretor !== currentDirector) return false;
    if (currentDistrital && s.distrital !== currentDistrital) return false;
    if (currentCoordinator && s.coordenador !== currentCoordinator) return false;
    if (currentState && s.state !== currentState) return false;

    // Filter out stores that had zero transactions under order-level filters
    if (currentCategoryFilter || currentPaymentFilter || currentProductFilter || currentReasonFilter) {
      if (s.salesToday === 0 && s.canceledToday === 0 && s.pendingToday === 0) {
        return false;
      }
    }

    // Search match
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

  // Calculate and update dynamic KPIs for the selected organization
  if (monitorData) {
    const summary = calculateSummary(orgFilteredStores);
    updateKPIs(summary, monitorData.referenceDate, monitorData.referenceTime);
  }

  // Then filter by status
  filteredStores = orgFilteredStores.filter(s => {
    if (currentStatusFilter !== 'ALL' && s.status !== currentStatusFilter) return false;
    return true;
  });

  // Sort stores dynamically
  if (storesSortField === 'status') {
    filteredStores.sort((a, b) => {
      const priority = { OFFLINE: 0, CRITICO: 1, ALERTA: 2, ONLINE: 3, INATIVA: 4 };
      const priorityDiff = priority[a.status] - priority[b.status];
      if (priorityDiff !== 0) return storesSortAsc ? priorityDiff : -priorityDiff;
      return b.expectedSalesSoFar - a.expectedSalesSoFar; // sub-sort desc
    });
  } else {
    filteredStores.sort((a, b) => {
      let valA = a[storesSortField];
      let valB = b[storesSortField];
      
      if (storesSortField === 'expectedIntervalMinutes') {
        valA = valA === null ? 999999 : valA;
        valB = valB === null ? 999999 : valB;
      }
      
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
      }
      if (valA == null) return 1;
      if (valB == null) return -1;
      
      if (valA < valB) return storesSortAsc ? -1 : 1;
      if (valA > valB) return storesSortAsc ? 1 : -1;
      return 0;
    });
  }

  // Update header arrow indicators
  updateHeaderIcons();

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

  // Re-render active tab if currently active
  const activeTabBtn = document.querySelector('.btn-tab.active');
  if (activeTabBtn) {
    const tab = activeTabBtn.getAttribute('data-tab');
    if (tab === 'tab-orders') {
      renderOrdersTab();
    } else if (tab === 'tab-funnel') {
      renderFunnelTab();
    }
  }
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
          ${(s.canceledToday > 0 || s.pendingToday > 0) ? `
            <div style="margin-top: 4px; font-size: 0.72rem; color: var(--color-yellow); display: flex; align-items: center; gap: 4px;">
              <i data-lucide="alert-triangle" style="width:12px; height:12px; flex-shrink:0;"></i>
              <span>${s.canceledToday > 0 ? `${s.canceledToday} cancelado${s.canceledToday > 1 ? 's' : ''}` : ''}${s.canceledToday > 0 && s.pendingToday > 0 ? ', ' : ''}${s.pendingToday > 0 ? `${s.pendingToday} pendente${s.pendingToday > 1 ? 's' : ''}` : ''} hoje</span>
            </div>
          ` : ''}
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
  modalStoreCanceled.textContent = store.canceledToday || 0;
  modalStorePending.textContent = store.pendingToday || 0;

  // Render channels and payments
  const modalDelivery = document.getElementById('modal-store-delivery-channels');
  const modalPayments = document.getElementById('modal-store-payment-methods');
  
  if (modalDelivery) {
    if (!store.deliveryChannels || Object.keys(store.deliveryChannels).length === 0) {
      modalDelivery.innerHTML = '<span style="color:var(--text-secondary); font-style:italic; font-weight:normal;">Nenhuma venda hoje</span>';
    } else {
      modalDelivery.innerHTML = Object.entries(store.deliveryChannels)
        .map(([channel, count]) => `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; font-weight:normal;">
            <span>${channel}</span>
            <span class="stores-count-label" style="padding: 1px 6px; font-size: 0.72rem; font-weight:700;">${count}</span>
          </div>
        `).join('');
    }
  }

  if (modalPayments) {
    if (!store.paymentMethods || Object.keys(store.paymentMethods).length === 0) {
      modalPayments.innerHTML = '<span style="color:var(--text-secondary); font-style:italic; font-weight:normal;">Nenhuma venda hoje</span>';
    } else {
      modalPayments.innerHTML = Object.entries(store.paymentMethods)
        .map(([method, count]) => `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; font-weight:normal;">
            <span>${method}</span>
            <span class="stores-count-label" style="padding: 1px 6px; font-size: 0.72rem; font-weight:700; background:rgba(59,130,246,0.1); color:var(--color-blue); border:1px solid rgba(59,130,246,0.15);">${count}</span>
          </div>
        `).join('');
    }
  }

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

selectCategory.addEventListener('change', (e) => {
  currentCategoryFilter = e.target.value;
  applyFilters();
});

selectPayment.addEventListener('change', (e) => {
  currentPaymentFilter = e.target.value;
  applyFilters();
});

selectProduct.addEventListener('change', (e) => {
  currentProductFilter = e.target.value;
  applyFilters();
});

selectReason.addEventListener('change', (e) => {
  currentReasonFilter = e.target.value;
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

// Clear all filters handler
const btnClearFilters = document.getElementById('btn-clear-filters');
if (btnClearFilters) {
  btnClearFilters.addEventListener('click', () => {
    currentDirector = '';
    currentDistrital = '';
    currentCoordinator = '';
    currentState = '';
    currentSearchQuery = '';
    currentStatusFilter = 'ALL';
    currentCategoryFilter = '';
    currentPaymentFilter = '';
    currentProductFilter = '';
    currentReasonFilter = '';
    
    // Reset inputs
    selectDirector.value = '';
    selectDistrital.value = '';
    selectCoordinator.value = '';
    selectState.value = '';
    searchInput.value = '';
    if (selectCategory) selectCategory.value = '';
    if (selectPayment) selectPayment.value = '';
    if (selectProduct) selectProduct.value = '';
    if (selectReason) selectReason.value = '';
    
    // Reset status buttons
    document.querySelectorAll('.btn-status').forEach(b => b.classList.remove('active'));
    document.querySelector('.btn-status[data-status="ALL"]').classList.add('active');
    document.querySelectorAll('.kpi-card.interactive-card').forEach(c => c.classList.remove('selected'));
    
    applyFilters();
  });
}

// Export CSV handler
const btnExportCSV = document.getElementById('btn-export-csv');
if (btnExportCSV) {
  btnExportCSV.addEventListener('click', exportFilteredCSV);
}

// Initialize sorting click listeners for Table 1 (Monitor de Inatividade)
document.querySelectorAll('#tab-monitor th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const field = th.getAttribute('data-sort');
    if (storesSortField === field) {
      storesSortAsc = !storesSortAsc;
    } else {
      storesSortField = field;
      const descFields = ['salesToday', 'expectedSalesSoFar', 'expectedIntervalMinutes', 'lastOrderTimeStr'];
      storesSortAsc = !descFields.includes(field);
    }
    applyFilters();
  });
});

// Initialize sorting click listeners for Table 2 (Ranking de Cancelamentos)
document.querySelectorAll('#tab-orders th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const field = th.getAttribute('data-sort');
    if (rankingSortField === field) {
      rankingSortAsc = !rankingSortAsc;
    } else {
      rankingSortField = field;
      const descFields = ['salesToday', 'canceledToday', 'pendingToday', 'cancelRate'];
      rankingSortAsc = !descFields.includes(field);
    }
    renderOrdersTab();
  });
});

// =============================================
// ORDERS AND CANCELLATIONS TAB
// =============================================

// Tab buttons click handlers
document.querySelectorAll('.btn-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTab = btn.getAttribute('data-tab');
    
    document.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.add('hide'));
    const activeTabContainer = document.getElementById(targetTab);
    if (activeTabContainer) {
      activeTabContainer.classList.remove('hide');
    }
    
    if (targetTab === 'tab-orders') {
      renderOrdersTab();
    } else if (targetTab === 'tab-funnel') {
      renderFunnelTab();
    }
  });
});

function renderOrdersTab() {
  if (!monitorData || !filteredStores) return;

  // Aggregate current stats
  let totalSalesToday = 0;
  let totalCanceledToday = 0;
  let totalPendingToday = 0;
  
  let totalSalesYesterday = 0;
  let totalCanceledYesterday = 0;
  
  let totalSales7DaysAgo = 0;
  let totalCanceled7DaysAgo = 0;

  // We filter out INATIVA stores from the order aggregates to have an accurate operational picture
  const nonInactiveStores = filteredStores.filter(s => s.status !== 'INATIVA');

  nonInactiveStores.forEach(s => {
    totalSalesToday += (s.salesToday || 0);
    totalCanceledToday += (s.canceledToday || 0);
    totalPendingToday += (s.pendingToday || 0);
    
    totalSalesYesterday += (s.salesYesterdaySoFar || 0);
    totalCanceledYesterday += (s.canceledYesterday || 0);
    
    totalSales7DaysAgo += (s.sales7DaysAgoSoFar || 0);
    totalCanceled7DaysAgo += (s.canceled7DaysAgo || 0);
  });

  const totalOrdersToday = totalSalesToday + totalCanceledToday + totalPendingToday;
  const totalOrdersYesterday = totalSalesYesterday + totalCanceledYesterday;
  const totalOrders7DaysAgo = totalSales7DaysAgo + totalCanceled7DaysAgo;

  const cancelRateToday = totalOrdersToday > 0 ? (totalCanceledToday / totalOrdersToday) * 100 : 0;
  const cancelRateYesterday = totalOrdersYesterday > 0 ? (totalCanceledYesterday / totalOrdersYesterday) * 100 : 0;
  const cancelRate7DaysAgo = totalOrders7DaysAgo > 0 ? (totalCanceled7DaysAgo / totalOrders7DaysAgo) * 100 : 0;

  // Update DOM elements
  document.getElementById('kpi-orders-total').textContent = totalOrdersToday.toLocaleString('pt-BR');
  document.getElementById('kpi-orders-invoiced').textContent = totalSalesToday.toLocaleString('pt-BR');
  document.getElementById('kpi-orders-canceled').textContent = totalCanceledToday.toLocaleString('pt-BR');
  document.getElementById('kpi-orders-pending').textContent = totalPendingToday.toLocaleString('pt-BR');
  document.getElementById('kpi-orders-cancel-rate').textContent = cancelRateToday.toFixed(1) + '%';

  // Set comparison labels with monetary values if available
  const analytics = monitorData.cancellationsAnalytics || {};
  const formattedCanceledVal = analytics.totalCanceledValueToday ? ` | Val: <strong>R$ ${analytics.totalCanceledValueToday.toLocaleString('pt-BR')}</strong>` : '';
  const formattedInvoicedVal = analytics.totalSuccessfulValueToday ? ` | Val: <strong>R$ ${analytics.totalSuccessfulValueToday.toLocaleString('pt-BR')}</strong>` : '';

  document.getElementById('kpi-orders-invoiced-desc').innerHTML = `Ontem: <strong>${totalSalesYesterday}</strong> | 7d: <strong>${totalSales7DaysAgo}</strong>${formattedInvoicedVal}`;
  document.getElementById('kpi-orders-canceled-desc').innerHTML = `Ontem: <strong>${totalCanceledYesterday}</strong> | 7d: <strong>${totalCanceled7DaysAgo}</strong>${formattedCanceledVal}`;
  document.getElementById('kpi-orders-cancel-rate-desc').innerHTML = `Ontem: <strong>${cancelRateYesterday.toFixed(1)}%</strong> | 7d: <strong>${cancelRate7DaysAgo.toFixed(1)}%</strong>`;

  // Update Charts
  updateOrdersCharts(totalSalesToday, totalCanceledToday, totalPendingToday, nonInactiveStores);
  // Render the cancellations table
  renderOrdersTable();
  // Render the cancellations widgets (items, categories, payment methods)
  renderCancellationsInsights();
}

function renderCancellationsInsights() {
  const pList = document.getElementById('cancellation-top-products');
  const cList = document.getElementById('cancellation-top-categories');
  const payList = document.getElementById('cancellation-top-payments');
  const reasonList = document.getElementById('cancellation-top-reasons');
  const operatorList = document.getElementById('cancellation-top-operators');
  
  if (!pList || !cList || !payList || !reasonList || !operatorList) return;

  if (!monitorData || !monitorData.cancellationsAnalytics) {
    pList.innerHTML = `<span style="color:var(--text-secondary); font-style:italic; text-align: center; margin: auto;">Nenhum dado disponível</span>`;
    cList.innerHTML = `<span style="color:var(--text-secondary); font-style:italic; text-align: center; margin: auto;">Nenhum dado disponível</span>`;
    payList.innerHTML = `<span style="color:var(--text-secondary); font-style:italic; text-align: center; margin: auto;">Nenhum dado disponível</span>`;
    reasonList.innerHTML = `<span style="color:var(--text-secondary); font-style:italic; text-align: center; margin: auto;">Nenhum dado disponível</span>`;
    operatorList.innerHTML = `<span style="color:var(--text-secondary); font-style:italic; text-align: center; margin: auto;">Nenhum dado disponível</span>`;
    return;
  }

  const analytics = monitorData.cancellationsAnalytics;

  // Render Top Canceled Products
  const canceledProds = analytics.topCanceledProducts || [];
  if (canceledProds.length === 0) {
    pList.innerHTML = `<span style="color:var(--text-secondary); font-style:italic; text-align: center; margin: auto; padding: 20px 0;">Sem produtos cancelados hoje</span>`;
  } else {
    const maxQty = Math.max(...canceledProds.map(p => p.quantity), 1);
    pList.innerHTML = canceledProds.map(p => {
      const pct = (p.quantity / maxQty) * 100;
      const formattedPrice = (p.price ? `R$ ${(p.price/100).toFixed(2)}` : 'R$ 0,00');
      const escapedName = p.name.replace(/'/g, "\\'");
      return `
        <div onclick="clickFilterProduct('${escapedName}')" style="cursor:pointer; font-size: 0.8rem; line-height: 1.4; border-bottom: 1px solid rgba(255,255,255,0.02); padding: 4px 6px; margin-bottom: 2px; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom: 2px;">
            <span style="font-weight:700; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:210px;" title="${p.name}">${p.name}</span>
            <span style="color:var(--color-red); font-weight:800; flex-shrink:0;">${p.quantity} un</span>
          </div>
          <div style="display:flex; justify-content:space-between; color:var(--text-secondary); font-size:0.72rem; margin-bottom:4px;">
            <span>${p.category} | ${p.brand}</span>
            <span>Un: ${formattedPrice}</span>
          </div>
          <div style="background:rgba(255,255,255,0.05); height:4px; border-radius:2px; overflow:hidden;">
            <div style="background:var(--color-red); width:${pct}%; height:100%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Top Canceled Categories
  const canceledCats = analytics.topCanceledCategories || [];
  if (canceledCats.length === 0) {
    cList.innerHTML = `<span style="color:var(--text-secondary); font-style:italic; text-align: center; margin: auto; padding: 20px 0;">Sem categorias canceladas hoje</span>`;
  } else {
    const maxCat = Math.max(...canceledCats.map(c => c.count), 1);
    cList.innerHTML = canceledCats.map(c => {
      const pct = (c.count / maxCat) * 100;
      const escapedCat = c.category.replace(/'/g, "\\'");
      return `
        <div onclick="clickFilterCategory('${escapedCat}')" style="cursor:pointer; font-size: 0.8rem; line-height: 1.4; border-bottom: 1px solid rgba(255,255,255,0.02); padding: 4px 6px; margin-bottom: 2px; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <span style="font-weight:700; color:var(--text-primary);">${c.category}</span>
            <span style="color:var(--color-red); font-weight:800;">${c.count} un</span>
          </div>
          <div style="background:rgba(255,255,255,0.05); height:4px; border-radius:2px; overflow:hidden;">
            <div style="background:var(--color-red); width:${pct}%; height:100%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Top Canceled Payments
  const canceledPays = analytics.topCanceledPayments || [];
  if (canceledPays.length === 0) {
    payList.innerHTML = `<span style="color:var(--text-secondary); font-style:italic; text-align: center; margin: auto; padding: 20px 0;">Sem pagamentos cancelados hoje</span>`;
  } else {
    const maxPay = Math.max(...canceledPays.map(p => p.count), 1);
    payList.innerHTML = canceledPays.map(p => {
      const pct = (p.count / maxPay) * 100;
      const escapedPay = p.paymentName.replace(/'/g, "\\'");
      return `
        <div onclick="clickFilterPayment('${escapedPay}')" style="cursor:pointer; font-size: 0.8rem; line-height: 1.4; border-bottom: 1px solid rgba(255,255,255,0.02); padding: 4px 6px; margin-bottom: 2px; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <span style="font-weight:700; color:var(--text-primary);">${p.paymentName}</span>
            <span style="color:var(--color-red); font-weight:800;">${p.count} ped.</span>
          </div>
          <div style="background:rgba(255,255,255,0.05); height:4px; border-radius:2px; overflow:hidden;">
            <div style="background:var(--color-red); width:${pct}%; height:100%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Top Cancellation Reasons
  const canceledReasons = analytics.topCanceledReasons || [];
  if (canceledReasons.length === 0) {
    reasonList.innerHTML = `<span style="color:var(--text-secondary); font-style:italic; text-align: center; margin: auto; padding: 20px 0;">Sem motivos de cancelamento hoje</span>`;
  } else {
    const maxReason = Math.max(...canceledReasons.map(r => r.count), 1);
    reasonList.innerHTML = canceledReasons.map(r => {
      const pct = (r.count / maxReason) * 100;
      const escapedReason = r.reason.replace(/'/g, "\\'");
      return `
        <div onclick="clickFilterReason('${escapedReason}')" style="cursor:pointer; font-size: 0.8rem; line-height: 1.4; border-bottom: 1px solid rgba(255,255,255,0.02); padding: 4px 6px; margin-bottom: 2px; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <span style="font-weight:700; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:210px;" title="${r.reason}">${r.reason}</span>
            <span style="color:var(--color-red); font-weight:800;">${r.count} ped.</span>
          </div>
          <div style="background:rgba(255,255,255,0.05); height:4px; border-radius:2px; overflow:hidden;">
            <div style="background:var(--color-red); width:${pct}%; height:100%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Top Cancellation Operators
  const canceledOperators = analytics.topCanceledOperators || [];
  if (canceledOperators.length === 0) {
    operatorList.innerHTML = `<span style="color:var(--text-secondary); font-style:italic; text-align: center; margin: auto; padding: 20px 0;">Sem operadores hoje</span>`;
  } else {
    const maxOp = Math.max(...canceledOperators.map(o => o.count), 1);
    operatorList.innerHTML = canceledOperators.map(o => {
      const pct = (o.count / maxOp) * 100;
      return `
        <div style="font-size: 0.8rem; line-height: 1.4; border-bottom: 1px solid rgba(255,255,255,0.02); padding: 4px 6px; margin-bottom: 2px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <span style="font-weight:700; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:210px;" title="${o.operator}">${o.operator}</span>
            <span style="color:var(--color-red); font-weight:800;">${o.count} ped.</span>
          </div>
          <div style="background:rgba(255,255,255,0.05); height:4px; border-radius:2px; overflow:hidden;">
            <div style="background:var(--color-red); width:${pct}%; height:100%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  lucide.createIcons();
}

function clickFilterProduct(prodName) {
  if (selectProduct) {
    selectProduct.value = prodName;
    currentProductFilter = prodName;
    applyFilters();
  }
}

function clickFilterCategory(catName) {
  if (selectCategory) {
    selectCategory.value = catName;
    currentCategoryFilter = catName;
    applyFilters();
  }
}

function clickFilterPayment(payName) {
  if (selectPayment) {
    selectPayment.value = payName;
    currentPaymentFilter = payName;
    applyFilters();
  }
}

function clickFilterReason(reasonName) {
  if (selectReason) {
    selectReason.value = reasonName;
    currentReasonFilter = reasonName;
    applyFilters();
  }
}

function updateOrdersCharts(sales, canceled, pending, storesList) {
  // Cancellation Hourly Curve
  const cancelCtx = document.getElementById('orders-canceled-chart').getContext('2d');
  if (ordersCanceledChartInstance) {
    ordersCanceledChartInstance.destroy();
  }

  const hourlyCanceledSum = Array(24).fill(0);
  const hourlyCanceledYesterdaySum = Array(24).fill(0);
  const hourlyCanceled7DaysAgoSum = Array(24).fill(0);

  storesList.forEach(s => {
    if (s.hourlyCanceled) {
      for (let i = 0; i < 24; i++) {
        hourlyCanceledSum[i] += (s.hourlyCanceled[i] || 0);
        hourlyCanceledYesterdaySum[i] += (s.hourlyCanceledYesterday[i] || 0);
        hourlyCanceled7DaysAgoSum[i] += (s.hourlyCanceled7DaysAgo[i] || 0);
      }
    }
  });

  const hoursArray = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}h`);

  ordersCanceledChartInstance = new Chart(cancelCtx, {
    type: 'line',
    data: {
      labels: hoursArray,
      datasets: [
        {
          label: 'Cancelamentos Hoje',
          data: hourlyCanceledSum,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
          borderWidth: 3,
          tension: 0.35,
          fill: true
        },
        {
          label: 'Ontem',
          data: hourlyCanceledYesterdaySum,
          borderColor: '#f97316',
          borderDash: [5, 5],
          borderWidth: 2,
          tension: 0.35,
          fill: false
        },
        {
          label: '7 Dias Atrás',
          data: hourlyCanceled7DaysAgoSum,
          borderColor: '#9ca3af',
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
          position: 'top',
          labels: { color: '#9ca3af', font: { size: 10, weight: 'bold' } }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', font: { size: 10 } }, beginAtZero: true }
      }
    }
  });
  lucide.createIcons();
}
function updateHeaderIcons() {
  // Table 1
  document.querySelectorAll('#tab-monitor th[data-sort]').forEach(th => {
    const field = th.getAttribute('data-sort');
    const iconSpan = th.querySelector('.sort-icon');
    if (iconSpan) {
      if (storesSortField === field) {
        iconSpan.textContent = storesSortAsc ? ' ▲' : ' ▼';
        iconSpan.style.opacity = '1';
      } else {
        iconSpan.textContent = '';
        iconSpan.style.opacity = '0.3';
      }
    }
  });
}

// Render dynamic cancellations table
function renderOrdersTable() {
  const tableBody = document.getElementById('orders-table-body');
  const countLabel = document.getElementById('orders-table-count-label');
  const btnLoadMore = document.getElementById('btn-orders-load-more');
  
  if (!tableBody || !filteredStores) return;

  // We filter out INATIVA stores from the cancellations view
  let storesList = filteredStores.filter(s => s.status !== 'INATIVA');

  // Apply tab-local search query
  if (ordersSearchQuery) {
    const q = ordersSearchQuery.toLowerCase();
    storesList = storesList.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.city.toLowerCase().includes(q)
    );
  }

  // Apply local cancellation filter dropdown
  if (ordersCancelFilter === 'WITH_CANCELLATIONS') {
    storesList = storesList.filter(s => (s.canceledToday || 0) > 0);
  } else if (ordersCancelFilter === 'HIGH_CANCEL_RATE') {
    storesList = storesList.filter(s => {
      const total = (s.salesToday || 0) + (s.canceledToday || 0) + (s.pendingToday || 0);
      const rate = total > 0 ? (s.canceledToday / total) * 100 : 0;
      return rate > 10;
    });
  } else if (ordersCancelFilter === 'WITH_PENDING') {
    storesList = storesList.filter(s => (s.pendingToday || 0) > 0);
  }

  // Calculate totalOrders and cancelRate helper properties for sorting
  storesList.forEach(s => {
    s.totalOrders = (s.salesToday || 0) + (s.canceledToday || 0) + (s.pendingToday || 0);
    s.cancelRate = s.totalOrders > 0 ? (s.canceledToday / s.totalOrders) * 100 : 0;
  });

  // Sort stores dynamically
  storesList.sort((a, b) => {
    let valA = a[rankingSortField];
    let valB = b[rankingSortField];

    // If sorting by name or city, compare as strings
    if (rankingSortField === 'name' || rankingSortField === 'city') {
      valA = (valA || '').toLowerCase();
      valB = (valB || '').toLowerCase();
    } else {
      valA = Number(valA || 0);
      valB = Number(valB || 0);
    }

    if (valA < valB) return rankingSortAsc ? -1 : 1;
    if (valA > valB) return rankingSortAsc ? 1 : -1;
    return 0;
  });

  // Update header arrow indicators for Table 2
  document.querySelectorAll('#tab-orders th[data-sort]').forEach(th => {
    const field = th.getAttribute('data-sort');
    const iconSpan = th.querySelector('.sort-icon');
    if (iconSpan) {
      if (rankingSortField === field) {
        iconSpan.textContent = rankingSortAsc ? ' ▲' : ' ▼';
        iconSpan.style.opacity = '1';
      } else {
        iconSpan.textContent = '';
        iconSpan.style.opacity = '0.3';
      }
    }
  });

  countLabel.textContent = `${storesList.length} lojas encontradas`;

  const slice = storesList.slice(0, ordersDisplayLimit);

  if (slice.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 32px; color: var(--text-secondary);">
          <i data-lucide="info" style="margin: 0 auto 8px; width: 24px; height: 24px;"></i>
          Nenhuma loja com pedidos corresponde aos filtros selecionados.
        </td>
      </tr>
    `;
    if (btnLoadMore) btnLoadMore.classList.add('hide');
    lucide.createIcons();
    return;
  }

  tableBody.innerHTML = slice.map((s, idx) => {
    let statusColor = 'var(--text-secondary)';
    let diagText = 'Sem cancelamentos hoje';
    
    if (s.canceledToday > 0) {
      if (s.cancelRate > 30) {
        statusColor = 'var(--color-red)';
        diagText = `Crítico: Taxa de cancelamento elevada (${s.cancelRate.toFixed(1)}%)`;
      } else if (s.cancelRate > 15) {
        statusColor = 'var(--color-orange)';
        diagText = `Alerta: Taxa de cancelamento média (${s.cancelRate.toFixed(1)}%)`;
      } else {
        statusColor = 'var(--color-yellow)';
        diagText = `Taxa sob controle (${s.cancelRate.toFixed(1)}%)`;
      }
    } else if (s.pendingToday > 0) {
      statusColor = 'var(--color-yellow)';
      diagText = `${s.pendingToday} pedido(s) aguardando aprovação`;
    }

    return `
      <tr onclick="openStoreDetails('${s.name}')" style="cursor:pointer;">
        <td style="font-weight:800;">${s.name}</td>
        <td>
          <span class="store-meta-region">
            <i data-lucide="map-pin"></i>
            ${s.city} - ${s.state}
          </span>
        </td>
        <td class="text-center" style="font-weight:700;">${s.salesToday}</td>
        <td class="text-center" style="color:var(--color-red); font-weight:700;">${s.canceledToday || 0}</td>
        <td class="text-center" style="color:var(--color-yellow); font-weight:700;">${s.pendingToday || 0}</td>
        <td class="text-center" style="font-weight:800; font-size: 0.95rem;">${s.totalOrders}</td>
        <td class="text-center" style="color:${statusColor}; font-weight:800;">${s.cancelRate.toFixed(1)}%</td>
        <td style="font-size:0.8rem; color:var(--text-secondary); max-width:240px; white-space:normal;">
          ${diagText}
        </td>
      </tr>
    `;
  }).join('');

  if (btnLoadMore) {
    if (storesList.length > ordersDisplayLimit) {
      btnLoadMore.classList.remove('hide');
    } else {
      btnLoadMore.classList.add('hide');
    }
  }

  lucide.createIcons();
}

function exportOrdersCSV() {
  if (!filteredStores || filteredStores.length === 0) {
    alert('Nenhuma loja para exportar.');
    return;
  }
  
  let storesList = filteredStores.filter(s => s.status !== 'INATIVA');
  
  if (ordersSearchQuery) {
    const q = ordersSearchQuery.toLowerCase();
    storesList = storesList.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.city.toLowerCase().includes(q)
    );
  }

  if (ordersCancelFilter === 'WITH_CANCELLATIONS') {
    storesList = storesList.filter(s => (s.canceledToday || 0) > 0);
  } else if (ordersCancelFilter === 'HIGH_CANCEL_RATE') {
    storesList = storesList.filter(s => {
      const total = (s.salesToday || 0) + (s.canceledToday || 0) + (s.pendingToday || 0);
      const rate = total > 0 ? (s.canceledToday / total) * 100 : 0;
      return rate > 10;
    });
  } else if (ordersCancelFilter === 'WITH_PENDING') {
    storesList = storesList.filter(s => (s.pendingToday || 0) > 0);
  }

  let csvContent = '\uFEFF'; // UTF-8 BOM
  csvContent += 'Filial,Cidade/UF,Pedidos Faturados,Pedidos Cancelados,Pedidos Pendentes,Total Pedidos,Taxa de Cancelamento\n';
  
  storesList.forEach(s => {
    const total = (s.salesToday || 0) + (s.canceledToday || 0) + (s.pendingToday || 0);
    const rate = total > 0 ? (s.canceledToday / total) * 100 : 0;
    csvContent += `"${s.name}","${s.city} - ${s.state}",${s.salesToday},${s.canceledToday || 0},${s.pendingToday || 0},${total},${rate.toFixed(2)}%\n`;
  });
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `monitor_cancelamentos_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Bind Order Tab specific event listeners
const ordersSearchInput = document.getElementById('orders-search-input');
if (ordersSearchInput) {
  ordersSearchInput.addEventListener('input', (e) => {
    ordersSearchQuery = e.target.value;
    renderOrdersTable();
  });
}

const selectCancelFilter = document.getElementById('select-cancel-filter');
if (selectCancelFilter) {
  selectCancelFilter.addEventListener('change', (e) => {
    ordersCancelFilter = e.target.value;
    ordersDisplayLimit = 50; // reset pagination
    renderOrdersTable();
  });
}

const btnOrdersLoadMore = document.getElementById('btn-orders-load-more');
if (btnOrdersLoadMore) {
  btnOrdersLoadMore.addEventListener('click', () => {
    ordersDisplayLimit += 50;
    renderOrdersTable();
  });
}

const btnExportOrdersCSV = document.getElementById('btn-export-orders-csv');
if (btnExportOrdersCSV) {
  btnExportOrdersCSV.addEventListener('click', exportOrdersCSV);
}


// =============================================
// TRANSACTIONAL SALES FUNNEL TAB
// =============================================

function renderFunnelTab() {
  if (!monitorData || !monitorData.funnelAnalytics) return;
  const f = monitorData.funnelAnalytics;

  // 1. Calculate KPI values
  const convToday = f.today.total > 0 ? (f.today.approved / f.today.total * 100) : 0;
  const convYesterday = f.yesterday.total > 0 ? (f.yesterday.approved / f.yesterday.total * 100) : 0;
  const conv7Days = f.sevenDaysAgo.total > 0 ? (f.sevenDaysAgo.approved / f.sevenDaysAgo.total * 100) : 0;

  const payToday = (f.today.approved + f.today.canceled) > 0 
    ? (f.today.approved / (f.today.approved + f.today.canceled) * 100) 
    : 0;

  const fulfillmentToday = f.today.approved > 0 ? (f.today.invoiced / f.today.approved * 100) : 0;

  // 2. Update DOM elements
  document.getElementById('kpi-funnel-conversion').textContent = convToday.toFixed(1) + '%';
  document.getElementById('kpi-funnel-conversion-desc').innerHTML = `Ontem: <strong>${convYesterday.toFixed(1)}%</strong> | 7d: <strong>${conv7Days.toFixed(1)}%</strong>`;
  
  document.getElementById('kpi-funnel-payment-success').textContent = payToday.toFixed(1) + '%';
  document.getElementById('kpi-funnel-fulfillment-rate').textContent = fulfillmentToday.toFixed(1) + '%';

  // 3. Render visual funnel columns
  document.getElementById('funnel-container-today').innerHTML = drawFunnelColumn(f.today);
  document.getElementById('funnel-container-yesterday').innerHTML = drawFunnelColumn(f.yesterday);
  document.getElementById('funnel-container-7days').innerHTML = drawFunnelColumn(f.sevenDaysAgo);

  // 4. Render Active Queue Table
  renderQueueTable();
}

function drawFunnelColumn(data) {
  const total = data.total || 0;
  const pending = data.pending || 0;
  const approved = data.approved || 0;
  const invoiced = data.invoiced || 0;
  const canceled = data.canceled || 0;

  const appPct = total > 0 ? (approved / total * 100).toFixed(1) : '0.0';
  const invPct = total > 0 ? (invoiced / total * 100).toFixed(1) : '0.0';
  const cancPct = total > 0 ? (canceled / total * 100).toFixed(1) : '0.0';

  return `
    <!-- Created -->
    <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 6px; border-left: 4px solid var(--color-blue);">
      <div style="display:flex; justify-content:space-between; margin-bottom: 4px; font-size: 0.8rem; font-weight:700;">
        <span style="color: var(--text-primary);">1. Pedidos Criados</span>
        <span style="color: var(--color-blue); font-weight:800;">${total.toLocaleString('pt-BR')} ped.</span>
      </div>
      <div style="background: rgba(59, 130, 246, 0.1); height: 16px; border-radius: 4px; overflow:hidden; position:relative; display:flex; align-items:center;">
        <div style="background: var(--color-blue); width: 100%; height: 100%; transition: width 0.3s;"></div>
        <span style="position:absolute; right: 8px; font-size: 0.65rem; color: #fff; font-weight: 700;">100%</span>
      </div>
    </div>

    <!-- Approved -->
    <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 6px; border-left: 4px solid var(--color-yellow);">
      <div style="display:flex; justify-content:space-between; margin-bottom: 4px; font-size: 0.8rem; font-weight:700;">
        <span style="color: var(--text-primary);">2. Pagamento Autorizado</span>
        <span style="color: var(--color-yellow); font-weight:800;">${approved.toLocaleString('pt-BR')} ped.</span>
      </div>
      <div style="background: rgba(245, 158, 11, 0.1); height: 16px; border-radius: 4px; overflow:hidden; position:relative; display:flex; align-items:center;">
        <div style="background: var(--color-yellow); width: ${appPct}%; height: 100%; transition: width 0.3s;"></div>
        <span style="position:absolute; right: 8px; font-size: 0.65rem; color: #fff; font-weight: 700;">${appPct}%</span>
      </div>
    </div>

    <!-- Invoiced -->
    <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 6px; border-left: 4px solid var(--color-green);">
      <div style="display:flex; justify-content:space-between; margin-bottom: 4px; font-size: 0.8rem; font-weight:700;">
        <span style="color: var(--text-primary);">3. Faturado (Sucesso)</span>
        <span style="color: var(--color-green); font-weight:800;">${invoiced.toLocaleString('pt-BR')} ped.</span>
      </div>
      <div style="background: rgba(16, 185, 129, 0.1); height: 16px; border-radius: 4px; overflow:hidden; position:relative; display:flex; align-items:center;">
        <div style="background: var(--color-green); width: ${invPct}%; height: 100%; transition: width 0.3s;"></div>
        <span style="position:absolute; right: 8px; font-size: 0.65rem; color: #fff; font-weight: 700;">${invPct}%</span>
      </div>
    </div>

    <!-- Canceled -->
    <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 6px; border-left: 4px solid var(--color-red);">
      <div style="display:flex; justify-content:space-between; margin-bottom: 4px; font-size: 0.8rem; font-weight:700;">
        <span style="color: var(--text-primary);">Cancelados (Fuga)</span>
        <span style="color: var(--color-red); font-weight:800;">${canceled.toLocaleString('pt-BR')} ped.</span>
      </div>
      <div style="background: rgba(239, 68, 68, 0.1); height: 16px; border-radius: 4px; overflow:hidden; position:relative; display:flex; align-items:center;">
        <div style="background: var(--color-red); width: ${cancPct}%; height: 100%; transition: width 0.3s;"></div>
        <span style="position:absolute; right: 8px; font-size: 0.65rem; color: #fff; font-weight: 700;">${cancPct}%</span>
      </div>
    </div>
  `;
}

function renderQueueTable() {
  const tbody = document.getElementById('queue-table-body');
  if (!tbody || !monitorData) return;

  const queue = monitorData.activeOrdersQueue || [];
  
  // Filter queue
  const filteredQueue = queue.filter(o => {
    // Status filter
    if (queueStatusFilter !== 'ALL' && o.status !== queueStatusFilter) return false;

    // Search query match (store name or order ID)
    if (queueSearchQuery) {
      const q = queueSearchQuery.toLowerCase();
      const match = o.orderId.toLowerCase().includes(q) || o.storeName.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  if (filteredQueue.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-secondary); font-style: italic; padding: 30px;">
          Nenhum pedido correspondente na fila.
        </td>
      </tr>
    `;
    return;
  }

  const now = new Date();
  tbody.innerHTML = filteredQueue.map(o => {
    const elapsedMs = now - new Date(o.creationDate);
    const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
    
    let elapsedStr = '';
    if (elapsedMinutes < 60) {
      elapsedStr = `Há ${elapsedMinutes} min`;
    } else {
      const hrs = Math.floor(elapsedMinutes / 60);
      const mins = elapsedMinutes % 60;
      elapsedStr = `Há ${hrs}h ${mins}m`;
    }

    const valueStr = `R$ ${o.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const paymentsStr = o.paymentNames.join(', ') || 'Desconhecido';
    
    let statusBadge = '';
    if (o.status === 'payment-pending') {
      statusBadge = `<span class="badge badge-yellow">Aguardando Pagamento</span>`;
    } else {
      statusBadge = `<span class="badge badge-blue">Aprovado p/ Faturamento</span>`;
    }

    return `
      <tr>
        <td style="font-family: monospace; font-weight: 700; color: var(--color-blue);">${o.orderId}</td>
        <td>${o.storeName}</td>
        <td>${statusBadge}</td>
        <td style="font-weight: 600; color: var(--text-primary);">${elapsedStr}</td>
        <td style="font-weight: 700;">${valueStr}</td>
        <td style="color: var(--text-secondary); font-size: 0.78rem;">${paymentsStr}</td>
      </tr>
    `;
  }).join('');
}

// Queue filters listeners
if (queueSearchInput) {
  queueSearchInput.addEventListener('input', (e) => {
    queueSearchQuery = e.target.value;
    renderQueueTable();
  });
}

if (selectQueueStatus) {
  selectQueueStatus.addEventListener('change', (e) => {
    queueStatusFilter = e.target.value;
    renderQueueTable();
  });
}



