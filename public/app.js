// Global Application State
const state = {
  currentPage: 1,
  limit: 15,
  sort: 'date_desc',
  filters: {
    startDate: '',
    endDate: '',
    seller: 'ALL',
    reasonCategory: 'ALL',
    paymentMethod: 'ALL',
    deliveryChannel: 'ALL',
    category: 'ALL',
    search: ''
  },
  charts: {},
  pollInterval: null
};

// Formatação Moeda Brasileira
function formatBrl(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

// Formatação Data BRT
function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Inicialização da Aplicação
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  setupDefaultDates();
  bindEvents();
  loadFilterOptions().then(() => {
    refreshAllData();
  });
  checkSyncStatus();
});

function setupDefaultDates() {
  const now = new Date();
  // Ontem (D-1)
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const endDateStr = yesterday.toISOString().slice(0, 10);

  // 90 dias atrás (D-90)
  const d90 = new Date(now);
  d90.setDate(d90.getDate() - 90);
  const startDateStr = d90.toISOString().slice(0, 10);

  document.getElementById('filterStartDate').value = startDateStr;
  document.getElementById('filterEndDate').value = endDateStr;

  state.filters.startDate = startDateStr;
  state.filters.endDate = endDateStr;
}

function bindEvents() {
  // Filtros
  document.getElementById('filterStartDate').addEventListener('change', (e) => {
    state.filters.startDate = e.target.value;
    state.currentPage = 1;
    refreshAllData();
  });

  document.getElementById('filterEndDate').addEventListener('change', (e) => {
    state.filters.endDate = e.target.value;
    state.currentPage = 1;
    refreshAllData();
  });

  document.getElementById('filterSeller').addEventListener('change', (e) => {
    state.filters.seller = e.target.value;
    state.currentPage = 1;
    refreshAllData();
  });

  document.getElementById('filterProductCategory').addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    state.currentPage = 1;
    refreshAllData();
  });

  document.getElementById('filterReason').addEventListener('change', (e) => {
    state.filters.reasonCategory = e.target.value;
    state.currentPage = 1;
    refreshAllData();
  });

  document.getElementById('filterPayment').addEventListener('change', (e) => {
    state.filters.paymentMethod = e.target.value;
    state.currentPage = 1;
    refreshAllData();
  });

  document.getElementById('filterChannel').addEventListener('change', (e) => {
    state.filters.deliveryChannel = e.target.value;
    state.currentPage = 1;
    refreshAllData();
  });

  // Busca rápida com Debounce
  let searchTimeout = null;
  document.getElementById('filterSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.filters.search = e.target.value;
      state.currentPage = 1;
      refreshAllData();
    }, 350);
  });

  // Limpar Filtros
  document.getElementById('btnResetFilters').addEventListener('click', () => {
    document.getElementById('filterSearch').value = '';
    document.getElementById('filterSeller').value = 'ALL';
    document.getElementById('filterProductCategory').value = 'ALL';
    document.getElementById('filterReason').value = 'ALL';
    document.getElementById('filterPayment').value = 'ALL';
    document.getElementById('filterChannel').value = 'ALL';
    state.filters.search = '';
    state.filters.seller = 'ALL';
    state.filters.category = 'ALL';
    state.filters.reasonCategory = 'ALL';
    state.filters.paymentMethod = 'ALL';
    state.filters.deliveryChannel = 'ALL';
    setupDefaultDates();
    state.currentPage = 1;
    refreshAllData();
  });

  // Exportar CSV
  document.getElementById('btnExportCSV').addEventListener('click', () => {
    const params = buildQueryParams();
    window.location.href = `/api/export/csv?${params.toString()}`;
  });

  // Sincronização Manual
  document.getElementById('btnSyncTrigger').addEventListener('click', async () => {
    try {
      await fetch('/api/sync/run', { method: 'POST', body: JSON.stringify({ forceFull: true }), headers: { 'Content-Type': 'application/json' } });
      checkSyncStatus();
    } catch (e) {
      alert('Erro ao iniciar sincronização: ' + e.message);
    }
  });

  // Paginação e Ordenação
  document.getElementById('tableSort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    loadTableData();
  });

  document.getElementById('btnPrevPage').addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      loadTableData();
    }
  });

  document.getElementById('btnNextPage').addEventListener('click', () => {
    state.currentPage++;
    loadTableData();
  });

  // Modal Fechamento
  document.getElementById('btnCloseModal').addEventListener('click', () => {
    document.getElementById('orderDetailModal').classList.add('hidden');
  });
}

function buildQueryParams() {
  const params = new URLSearchParams();
  if (state.filters.startDate) params.append('startDate', state.filters.startDate);
  if (state.filters.endDate) params.append('endDate', state.filters.endDate);
  if (state.filters.seller !== 'ALL') params.append('seller', state.filters.seller);
  if (state.filters.category !== 'ALL') params.append('category', state.filters.category);
  if (state.filters.reasonCategory !== 'ALL') params.append('reasonCategory', state.filters.reasonCategory);
  if (state.filters.paymentMethod !== 'ALL') params.append('paymentMethod', state.filters.paymentMethod);
  if (state.filters.deliveryChannel !== 'ALL') params.append('deliveryChannel', state.filters.deliveryChannel);
  if (state.filters.search) params.append('search', state.filters.search);
  return params;
}

// Carregar opções dos filtros dropdown
async function loadFilterOptions() {
  try {
    const res = await fetch('/api/filters-options');
    const options = await res.json();

    populateSelect('filterSeller', options.sellers, 'Todas as Lojas');
    populateSelect('filterProductCategory', options.categories, 'Todas as Categorias');
    populateSelect('filterReason', options.reasons, 'Todos os Motivos');
    populateSelect('filterPayment', options.payments, 'Todos os Pagamentos');
    populateSelect('filterChannel', options.channels, 'Todos os Canais');
  } catch (e) {
    console.error('Erro ao carregar opções de filtro:', e);
  }
}

function populateSelect(id, list, defaultText) {
  const select = document.getElementById(id);
  select.innerHTML = `<option value="ALL">${defaultText}</option>`;
  (list || []).forEach(item => {
    const opt = document.createElement('option');
    opt.value = item;
    opt.textContent = item === 'pickup-in-point' ? 'Retirada em Loja (Pickup)' : (item === 'delivery' ? 'Entrega em Domicílio' : item);
    select.appendChild(opt);
  });
}

// Atualiza KPIs, Gráficos e Tabela
function refreshAllData() {
  loadSummary();
  loadCharts();
  loadTableData();
}

// KPIs
async function loadSummary() {
  try {
    const params = buildQueryParams();
    const res = await fetch(`/api/summary?${params.toString()}`);
    const summary = await res.json();

    document.getElementById('kpiTotalCount').textContent = (summary.totalCount || 0).toLocaleString('pt-BR');
    document.getElementById('kpiTotalValue').textContent = formatBrl(summary.totalValue);
    document.getElementById('kpiAvgTicket').textContent = formatBrl(summary.avgTicket);

    document.getElementById('kpiTopReason').textContent = summary.topReason?.category || '--';
    document.getElementById('kpiTopReasonSub').textContent = `${(summary.topReason?.count || 0).toLocaleString('pt-BR')} cancelamentos`;

    document.getElementById('kpiTopSeller').textContent = summary.topSeller?.name || '--';
    document.getElementById('kpiTopSellerSub').textContent = `${(summary.topSeller?.count || 0).toLocaleString('pt-BR')} cancelamentos`;

    if (summary.lastSync) {
      const syncDate = new Date(summary.lastSync);
      document.getElementById('syncStatusText').textContent = `Atualizado às ${syncDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (e) {
    console.error('Erro ao carregar resumo:', e);
  }
}

// Gráficos (Chart.js)
async function loadCharts() {
  try {
    const params = buildQueryParams();
    const res = await fetch(`/api/charts?${params.toString()}`);
    const data = await res.json();

    renderTimelineChart(data.timeline);
    renderReasonsChart(data.reasons);
    renderSellersChart(data.topSellers);
    renderCategoriesChart(data.topCategories);
    renderChannelsChart(data.channels);
    renderPaymentsChart(data.payments);
    renderHourlyChart(data.hourly);
  } catch (e) {
    console.error('Erro ao carregar gráficos:', e);
  }
}

// 1. Chart Timeline COM PONTOS MARCADOS EM CADA DIA
function renderTimelineChart(timeline) {
  const ctx = document.getElementById('chartTimeline').getContext('2d');
  if (state.charts.timeline) state.charts.timeline.destroy();

  const labels = (timeline || []).map(t => {
    const [y, m, d] = t.date.split('-');
    return `${d}/${m}`;
  });
  const counts = (timeline || []).map(t => t.count);
  const values = (timeline || []).map(t => t.value);

  state.charts.timeline = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Qtd Cancelamentos',
          data: counts,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1,
          fill: true,
          tension: 0.2,
          yAxisID: 'y'
        },
        {
          label: 'Perda R$',
          data: values,
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: '#f59e0b',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1,
          borderDash: [4, 4],
          tension: 0.2,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#94a3b8' } }
      },
      scales: {
        x: { ticks: { color: '#64748b', maxRotation: 45 }, grid: { color: '#1e293d' } },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          ticks: { color: '#ef4444' },
          grid: { color: '#1e293d' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          ticks: { color: '#f59e0b', callback: v => 'R$' + v.toLocaleString('pt-BR') },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

// 2. Chart Motivos
function renderReasonsChart(reasons) {
  const ctx = document.getElementById('chartReasons').getContext('2d');
  if (state.charts.reasons) state.charts.reasons.destroy();

  const labels = (reasons || []).map(r => r.category);
  const counts = (reasons || []).map(r => r.count);

  state.charts.reasons = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Cancelamentos',
        data: counts,
        backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#64748b'],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
        y: { ticks: { color: '#64748b' }, grid: { color: '#1e293d' } }
      }
    }
  });
}

// 3. Chart Sellers / Lojas
function renderSellersChart(sellers) {
  const ctx = document.getElementById('chartSellers').getContext('2d');
  if (state.charts.sellers) state.charts.sellers.destroy();

  const labels = (sellers || []).map(s => s.name.length > 22 ? s.name.substring(0, 22) + '...' : s.name);
  const counts = (sellers || []).map(s => s.count);

  state.charts.sellers = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Cancelamentos',
        data: counts,
        backgroundColor: '#3b82f6',
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: '#1e293d' } },
        y: { ticks: { color: '#94a3b8' }, grid: { display: false } }
      }
    }
  });
}

// 4. Chart Categorias de Produtos
function renderCategoriesChart(categories) {
  const ctx = document.getElementById('chartCategories').getContext('2d');
  if (state.charts.categories) state.charts.categories.destroy();

  const labels = (categories || []).map(c => c.category.length > 22 ? c.category.substring(0, 22) + '...' : c.category);
  const counts = (categories || []).map(c => c.count);

  state.charts.categories = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Produtos Cancelados',
        data: counts,
        backgroundColor: '#10b981',
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: '#1e293d' } },
        y: { ticks: { color: '#94a3b8' }, grid: { display: false } }
      }
    }
  });
}

// 5. Chart Canais
function renderChannelsChart(channels) {
  const ctx = document.getElementById('chartChannels').getContext('2d');
  if (state.charts.channels) state.charts.channels.destroy();

  const labels = (channels || []).map(c => c.channel);
  const counts = (channels || []).map(c => c.count);

  state.charts.channels = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8' } }
      }
    }
  });
}

// 6. Chart Meios de Pagamento
function renderPaymentsChart(payments) {
  const ctx = document.getElementById('chartPayments').getContext('2d');
  if (state.charts.payments) state.charts.payments.destroy();

  const labels = (payments || []).map(p => p.payment);
  const counts = (payments || []).map(p => p.count);

  state.charts.payments = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#64748b'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8' } }
      }
    }
  });
}

// 7. Chart Horário do Dia
function renderHourlyChart(hourly) {
  const ctx = document.getElementById('chartHourly').getContext('2d');
  if (state.charts.hourly) state.charts.hourly.destroy();

  const labels = (hourly || []).map(h => h.hour);
  const counts = (hourly || []).map(h => h.count);

  state.charts.hourly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Cancelamentos',
        data: counts,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: '#3b82f6',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
        y: { ticks: { color: '#64748b' }, grid: { color: '#1e293d' } }
      }
    }
  });
}

// Tabela de Pedidos
async function loadTableData() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '<tr><td colspan="10" class="loading-cell">Carregando pedidos...</td></tr>';

  try {
    const params = buildQueryParams();
    params.append('page', state.currentPage);
    params.append('limit', state.limit);
    params.append('sort', state.sort);

    const res = await fetch(`/api/orders?${params.toString()}`);
    const data = await res.json();

    document.getElementById('tableSubCount').textContent = `Total de ${data.total.toLocaleString('pt-BR')} pedidos encontrados`;
    document.getElementById('paginationInfo').textContent = `Página ${data.page} de ${data.totalPages}`;
    
    document.getElementById('btnPrevPage').disabled = data.page <= 1;
    document.getElementById('btnNextPage').disabled = data.page >= data.totalPages;

    if (!data.orders || data.orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:30px; color:#64748b;">Nenhum pedido cancelado encontrado para os filtros selecionados.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    data.orders.forEach(order => {
      const tr = document.createElement('tr');

      let badgeClass = 'outros';
      if (order.reasonCategory.includes('Estoque')) badgeClass = 'estoque';
      else if (order.reasonCategory.includes('Pagamento')) badgeClass = 'pagamento';
      else if (order.reasonCategory.includes('Cliente')) badgeClass = 'cliente';

      const channelLabel = order.deliveryChannel === 'pickup-in-point' ? 'Pickup' : (order.deliveryChannel === 'delivery' ? 'Entrega' : order.deliveryChannel);
      const catText = (order.categories && order.categories.length > 0) ? order.categories.slice(0, 2).join(', ') : 'Outros';

      tr.innerHTML = `
        <td><span class="order-id">${order.orderId}</span></td>
        <td>${formatDate(order.creationDate)}</td>
        <td>${order.sellerName}</td>
        <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${order.cancelReason || ''}">
          ${order.cancelReason || 'Sem motivo informado'}
        </td>
        <td><span class="reason-badge ${badgeClass}">${order.reasonCategory}</span></td>
        <td style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${(order.categories || []).join(', ')}">${catText}</td>
        <td>${channelLabel}</td>
        <td>${order.paymentMethod}</td>
        <td style="font-weight:600; color:#f8fafc;">${formatBrl(order.value)}</td>
        <td>
          <button class="btn-detail" onclick="showOrderDetail('${order.orderId}')">Detalhes</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (e) {
    console.error('Erro ao carregar tabela:', e);
    tbody.innerHTML = '<tr><td colspan="10" style="color:#ef4444; text-align:center;">Erro ao carregar dados da tabela.</td></tr>';
  }
}

// Modal de Detalhes do Pedido
async function showOrderDetail(orderId) {
  const modal = document.getElementById('orderDetailModal');
  const bodyContent = document.getElementById('modalBodyContent');

  document.getElementById('modalOrderId').textContent = `Pedido #${orderId}`;
  bodyContent.innerHTML = '<p>Buscando detalhes do pedido...</p>';
  modal.classList.remove('hidden');

  try {
    const res = await fetch(`/api/orders?search=${orderId}&limit=1`);
    const data = await res.json();
    const order = data.orders?.[0];

    if (!order) {
      bodyContent.innerHTML = '<p style="color:#ef4444;">Detalhes do pedido não encontrados.</p>';
      return;
    }

    document.getElementById('modalOrderDate').textContent = `Criado em: ${formatDate(order.creationDate)}`;

    const itemsHtml = (order.items || []).map(i => `
      <tr>
        <td>${i.name}</td>
        <td>${i.quantity}</td>
        <td>${formatBrl(i.price)}</td>
        <td>${formatBrl(i.price * i.quantity)}</td>
      </tr>
    `).join('');

    bodyContent.innerHTML = `
      <div class="detail-row"><span class="detail-label">Motivo do Cancelamento:</span><span class="detail-value" style="color:#ef4444;">${order.cancelReason || 'Automático / N/A'}</span></div>
      <div class="detail-row"><span class="detail-label">Categoria do Motivo:</span><span class="detail-value">${order.reasonCategory}</span></div>
      <div class="detail-row"><span class="detail-label">Categorias do Produto:</span><span class="detail-value" style="color:#3b82f6;">${(order.categories || []).join(' > ') || 'Geral'}</span></div>
      <div class="detail-row"><span class="detail-label">Loja / Filial:</span><span class="detail-value">${order.sellerName} (ID: ${order.sellerId})</span></div>
      <div class="detail-row"><span class="detail-label">Valor Total:</span><span class="detail-value" style="font-size:16px;">${formatBrl(order.value)}</span></div>
      <div class="detail-row"><span class="detail-label">Meio de Pagamento:</span><span class="detail-value">${order.paymentMethod}</span></div>
      <div class="detail-row"><span class="detail-label">Canal de Entrega:</span><span class="detail-value">${order.deliveryChannel}</span></div>
      <div class="detail-row"><span class="detail-label">Cidade / UF:</span><span class="detail-value">${order.city} / ${order.state}</span></div>

      <h4 style="margin-top:16px; font-family:var(--font-heading);">Itens do Pedido (${order.itemsCount || 0})</h4>
      <table class="items-list-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Qtd</th>
            <th>Preço Un.</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml || '<tr><td colspan="4">Sem itens detalhados.</td></tr>'}
        </tbody>
      </table>
    `;

  } catch (e) {
    bodyContent.innerHTML = `<p style="color:#ef4444;">Erro ao carregar detalhes: ${e.message}</p>`;
  }
}

// Checagem de Status da Sincronização
async function checkSyncStatus() {
  try {
    const res = await fetch('/api/status');
    const status = await res.json();

    const banner = document.getElementById('syncProgressBanner');
    const fill = document.getElementById('progressBarFill');
    const pct = document.getElementById('progressPercentage');
    const btnSync = document.getElementById('btnSyncTrigger');

    if (status.isSyncing) {
      banner.classList.remove('hidden');
      fill.style.width = `${status.progressPercent}%`;
      pct.textContent = `${status.progressPercent}%`;
      btnSync.disabled = true;
      btnSync.innerHTML = `<i data-lucide="loader"></i> Sincronizando (${status.progressPercent}%)...`;
      lucide.createIcons();

      if (!state.pollInterval) {
        state.pollInterval = setInterval(checkSyncStatus, 2500);
      }
    } else {
      banner.classList.add('hidden');
      btnSync.disabled = false;
      btnSync.innerHTML = `<i data-lucide="refresh-cw"></i> <span>Atualizar VTEX</span>`;
      lucide.createIcons();

      if (state.pollInterval) {
        clearInterval(state.pollInterval);
        state.pollInterval = null;
        refreshAllData();
        loadFilterOptions();
      }
    }
  } catch (e) {
    console.error('Erro ao verificar status da sincronização:', e);
  }
}
