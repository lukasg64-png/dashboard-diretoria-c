const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const etl = require('./etl');
const scheduler = require('./scheduler');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Inicializar agendador diário 08:00 AM
scheduler.initScheduler();

// Helper para filtrar os pedidos com base nos parâmetros da requisição
function getFilteredOrders(req) {
  const cache = etl.loadCache();
  const allOrders = Object.values(cache.orders || {});

  const {
    startDate,
    endDate,
    seller,
    reasonCategory,
    paymentMethod,
    deliveryChannel,
    category,
    search
  } = req.query;

  return allOrders.filter(order => {
    // Filtro por Intervalo de Data (Creation Date)
    if (startDate) {
      const orderDateStr = order.creationDate.slice(0, 10);
      if (orderDateStr < startDate) return false;
    }
    if (endDate) {
      const orderDateStr = order.creationDate.slice(0, 10);
      if (orderDateStr > endDate) return false;
    }

    // Filtro por Loja / Seller
    if (seller && seller !== 'ALL') {
      if (order.sellerName !== seller && order.sellerId !== seller) return false;
    }

    // Filtro por Categoria do Motivo
    if (reasonCategory && reasonCategory !== 'ALL') {
      if (order.reasonCategory !== reasonCategory) return false;
    }

    // Filtro por Meio de Pagamento
    if (paymentMethod && paymentMethod !== 'ALL') {
      if (order.paymentMethod !== paymentMethod) return false;
    }

    // Filtro por Canal de Entrega
    if (deliveryChannel && deliveryChannel !== 'ALL') {
      if (order.deliveryChannel !== deliveryChannel) return false;
    }

    // Filtro por Categoria de Produto
    if (category && category !== 'ALL') {
      if (!order.categories || !order.categories.includes(category)) return false;
    }

    // Busca textual por ID do pedido, motivo, loja ou item
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      const matchId = order.orderId.toLowerCase().includes(q);
      const matchReason = (order.cancelReason || '').toLowerCase().includes(q);
      const matchSeller = order.sellerName.toLowerCase().includes(q);
      const matchItem = (order.items || []).some(i => i.name.toLowerCase().includes(q));
      const matchCategory = (order.categories || []).some(c => c.toLowerCase().includes(q));
      if (!matchId && !matchReason && !matchSeller && !matchItem && !matchCategory) return false;
    }

    return true;
  });
}

// Endpoint status de sincronização
app.get('/api/status', (req, res) => {
  res.json(etl.getSyncStatus());
});

// Endpoint acionamento de sincronização manual
app.post('/api/sync/run', async (req, res) => {
  etl.runETL(req.body?.forceFull || false).catch(err => console.error('[API] Erro ao rodar ETL:', err.message));
  res.json({ message: 'Sincronização iniciada com sucesso!' });
});

// Endpoint Resumo de KPIs
app.get('/api/summary', (req, res) => {
  const filtered = getFilteredOrders(req);
  const totalCount = filtered.length;
  const totalValue = filtered.reduce((acc, o) => acc + (o.value || 0), 0);
  const avgTicket = totalCount > 0 ? totalValue / totalCount : 0;

  // Encontrar loja com mais cancelamentos
  const sellerCounts = {};
  const reasonCounts = {};
  const categoryCounts = {};

  filtered.forEach(o => {
    sellerCounts[o.sellerName] = (sellerCounts[o.sellerName] || 0) + 1;
    reasonCounts[o.reasonCategory] = (reasonCounts[o.reasonCategory] || 0) + 1;
    (o.categories || ['Outros']).forEach(cat => {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
  });

  const topSeller = Object.entries(sellerCounts).sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];
  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];

  const cache = etl.loadCache();

  res.json({
    totalCount,
    totalValue,
    avgTicket,
    topSeller: { name: topSeller[0], count: topSeller[1] },
    topReason: { category: topReason[0], count: topReason[1] },
    topCategory: { name: topCategory[0], count: topCategory[1] },
    range: cache.range || etl.get90DaysCompletedRange(),
    lastSync: cache.lastSync
  });
});

// Endpoint Dados para Gráficos
app.get('/api/charts', (req, res) => {
  const filtered = getFilteredOrders(req);

  // 1. Timeline Diária
  const timelineMap = {};
  filtered.forEach(o => {
    const day = o.creationDate.slice(0, 10);
    if (!timelineMap[day]) {
      timelineMap[day] = { date: day, count: 0, value: 0 };
    }
    timelineMap[day].count += 1;
    timelineMap[day].value += (o.value || 0);
  });
  const timeline = Object.values(timelineMap).sort((a, b) => a.date.localeCompare(b.date));

  // 2. Motivos de Cancelamento
  const reasonsMap = {};
  filtered.forEach(o => {
    const cat = o.reasonCategory || 'Outros / Operacional';
    if (!reasonsMap[cat]) {
      reasonsMap[cat] = { category: cat, count: 0, value: 0 };
    }
    reasonsMap[cat].count += 1;
    reasonsMap[cat].value += (o.value || 0);
  });
  const reasons = Object.values(reasonsMap).sort((a, b) => b.count - a.count);

  // 3. Lojas / Sellers (Top 15)
  const sellersMap = {};
  filtered.forEach(o => {
    const sName = o.sellerName || 'São João E-commerce';
    if (!sellersMap[sName]) {
      sellersMap[sName] = { name: sName, count: 0, value: 0 };
    }
    sellersMap[sName].count += 1;
    sellersMap[sName].value += (o.value || 0);
  });
  const topSellers = Object.values(sellersMap).sort((a, b) => b.count - a.count).slice(0, 15);

  // 4. Categorias de Produtos (Top 10)
  const categoriesMap = {};
  filtered.forEach(o => {
    (o.categories || ['Outros']).forEach(cat => {
      if (!categoriesMap[cat]) {
        categoriesMap[cat] = { category: cat, count: 0, value: 0 };
      }
      categoriesMap[cat].count += 1;
      categoriesMap[cat].value += (o.value || 0);
    });
  });
  const topCategories = Object.values(categoriesMap).sort((a, b) => b.count - a.count).slice(0, 10);

  // 5. Canais de Entrega
  const channelsMap = {};
  filtered.forEach(o => {
    const ch = o.deliveryChannel === 'pickup-in-point' ? 'Retirada em Loja (Pickup)' : 
               (o.deliveryChannel === 'delivery' ? 'Entrega em Domicílio' : o.deliveryChannel);
    if (!channelsMap[ch]) channelsMap[ch] = { channel: ch, count: 0, value: 0 };
    channelsMap[ch].count += 1;
    channelsMap[ch].value += (o.value || 0);
  });
  const channels = Object.values(channelsMap);

  // 6. Meios de Pagamento
  const paymentsMap = {};
  filtered.forEach(o => {
    const p = o.paymentMethod || 'Outros';
    if (!paymentsMap[p]) paymentsMap[p] = { payment: p, count: 0, value: 0 };
    paymentsMap[p].count += 1;
    paymentsMap[p].value += (o.value || 0);
  });
  const payments = Object.values(paymentsMap).sort((a, b) => b.count - a.count);

  // 7. Distribuição por Horário do Dia
  const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, '0')}h`, count: 0, value: 0 }));
  filtered.forEach(o => {
    const hourNum = new Date(o.creationDate).getHours();
    if (hourly[hourNum]) {
      hourly[hourNum].count += 1;
      hourly[hourNum].value += (o.value || 0);
    }
  });

  res.json({
    timeline,
    reasons,
    topSellers,
    topCategories,
    channels,
    payments,
    hourly
  });
});

// Endpoint Lista de Opções de Filtros
app.get('/api/filters-options', (req, res) => {
  const cache = etl.loadCache();
  const orders = Object.values(cache.orders || {});

  const sellers = Array.from(new Set(orders.map(o => o.sellerName))).filter(Boolean).sort();
  const reasons = Array.from(new Set(orders.map(o => o.reasonCategory))).filter(Boolean).sort();
  const payments = Array.from(new Set(orders.map(o => o.paymentMethod))).filter(Boolean).sort();
  const channels = Array.from(new Set(orders.map(o => o.deliveryChannel))).filter(Boolean).sort();
  const categories = Array.from(new Set(orders.flatMap(o => o.categories || []))).filter(Boolean).sort();

  res.json({
    sellers,
    reasons,
    payments,
    channels,
    categories
  });
});

// Endpoint Tabela de Pedidos Paginada
app.get('/api/orders', (req, res) => {
  const filtered = getFilteredOrders(req);
  
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '15', 10);
  const sort = req.query.sort || 'date_desc';

  // Ordenação
  filtered.sort((a, b) => {
    if (sort === 'date_desc') return new Date(b.creationDate) - new Date(a.creationDate);
    if (sort === 'date_asc') return new Date(a.creationDate) - new Date(b.creationDate);
    if (sort === 'value_desc') return (b.value || 0) - (a.value || 0);
    if (sort === 'value_asc') return (a.value || 0) - (b.value || 0);
    return 0;
  });

  const startIndex = (page - 1) * limit;
  const paginated = filtered.slice(startIndex, startIndex + limit);

  res.json({
    total: filtered.length,
    page,
    totalPages: Math.ceil(filtered.length / limit) || 1,
    orders: paginated
  });
});

// Endpoint Exportação CSV
app.get('/api/export/csv', (req, res) => {
  const filtered = getFilteredOrders(req);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="cancelamentos_vtex_90dias.csv"');

  res.write('\uFEFF');
  res.write('ID Pedido;Data Criacao;Loja / Seller;Motivo Cancelamento;Categoria Motivo;Categoria Produto;Valor (R$);Meio Pagamento;Canal Entrega;Cidade;UF\n');

  filtered.forEach(o => {
    const cleanReason = (o.cancelReason || 'Automático / N/A').replace(/[\r\n;]/g, ' ');
    const catStr = (o.categories || []).join(', ');
    const line = [
      o.orderId,
      o.creationDate,
      `"${o.sellerName}"`,
      `"${cleanReason}"`,
      `"${o.reasonCategory}"`,
      `"${catStr}"`,
      (o.value || 0).toFixed(2).replace('.', ','),
      `"${o.paymentMethod}"`,
      `"${o.deliveryChannel}"`,
      `"${o.city}"`,
      `"${o.state}"`
    ].join(';') + '\n';
    res.write(line);
  });

  res.end();
});

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 SERVIDOR DASHBOARD CANCELAMENTOS VTEX ONLINE`);
  console.log(`🔗 Acesse: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
