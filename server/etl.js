const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('./config');

const headers = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'X-VTEX-API-AppKey': config.vtex.appKey,
  'X-VTEX-API-AppToken': config.vtex.appToken,
  'User-Agent': 'VTEX-Cancellation-Dashboard/1.0'
};

let syncStatus = {
  isSyncing: false,
  progressPercent: 0,
  lastSyncTime: null,
  totalOrdersProcessed: 0,
  lastError: null,
  logs: []
};

function addLog(msg) {
  const timestamp = new Date().toLocaleTimeString('pt-BR');
  const logMsg = `[${timestamp}] ${msg}`;
  console.log(`[ETL VTEX] ${msg}`);
  syncStatus.logs.unshift(logMsg);
  if (syncStatus.logs.length > 50) syncStatus.logs.pop();
}

function ensureDataDirExists() {
  if (!fs.existsSync(config.paths.dataDir)) {
    fs.mkdirSync(config.paths.dataDir, { recursive: true });
  }
}

function loadCache() {
  ensureDataDirExists();
  if (fs.existsSync(config.paths.cacheFile)) {
    try {
      const data = fs.readFileSync(config.paths.cacheFile, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      addLog(`Erro ao carregar cache existente: ${e.message}`);
    }
  }
  return { lastSync: null, orders: {} };
}

async function saveCache(cacheData) {
  ensureDataDirExists();
  const tempPath = config.paths.cacheFile + '.tmp';
  try {
    await fs.promises.writeFile(tempPath, JSON.stringify(cacheData), 'utf-8');
    if (fs.existsSync(config.paths.cacheFile)) {
      await fs.promises.unlink(config.paths.cacheFile);
    }
    await fs.promises.rename(tempPath, config.paths.cacheFile);
    addLog(`Cache salvo com sucesso! (${Object.keys(cacheData.orders).length} pedidos arquivados).`);
  } catch (e) {
    addLog(`Erro ao salvar cache: ${e.message}`);
  }
}

/**
 * Retorna as datas de início (D-90) e fim (D-1 23:59:59)
 * Exclui rigorosamente o dia atual (D-0).
 */
function get90DaysCompletedRange() {
  const utcOffsetMs = -3 * 3600 * 1000; // BRT
  const now = new Date();
  
  // Ontem (D-1) 23:59:59 BRT
  const yesterday = new Date(now.getTime() + utcOffsetMs);
  yesterday.setDate(yesterday.getDate() - 1);
  const endIso = `${yesterday.toISOString().slice(0, 10)}T23:59:59.999Z`;

  // 90 dias atrás (D-90) 00:00:00 BRT
  const d90 = new Date(now.getTime() + utcOffsetMs);
  d90.setDate(d90.getDate() - 90);
  const startIso = `${d90.toISOString().slice(0, 10)}T00:00:00.000Z`;

  return { startIso, endIso, startDateStr: d90.toISOString().slice(0, 10), endDateStr: yesterday.toISOString().slice(0, 10) };
}

function categorizeReason(reason) {
  if (!reason) return 'Não Especificado / Automático';
  const r = reason.toLowerCase();

  if (r.includes('estoque') || r.includes('divergência') || r.includes('sem saldo') || r.includes('indispon')) {
    return 'Divergência de Estoque';
  }
  if (r.includes('pagamento') || r.includes('recus') || r.includes('cartao') || r.includes('cartão') || r.includes('antifraude') || r.includes('saldo insuficiente')) {
    return 'Pagamento Recusado / Antifraude';
  }
  if (r.includes('expir') || r.includes('boleto') || r.includes('pix') || r.includes('prazo')) {
    return 'Expiração de Pagamento (PIX/Boleto)';
  }
  if (r.includes('cliente') || r.includes('desist') || r.includes('cancelado pelo comprador') || r.includes('arrependimento') || r.includes('solicitacao')) {
    return 'Cancelado pelo Cliente';
  }
  if (r.includes('entrega') || r.includes('atraso') || r.includes('logistica') || r.includes('frete') || r.includes('tentativa')) {
    return 'Problema de Logística / Entrega';
  }
  return 'Outros / Operacional';
}

function minifyOrderDetails(order) {
  if (!order) return null;

  const payment = order.paymentData?.transactions?.[0]?.payments?.[0]?.paymentSystemName || 'Não Informado';
  const seller = order.sellers?.[0] ? { id: order.sellers[0].id, name: order.sellers[0].name } : { id: '1', name: 'São João E-commerce' };
  const deliveryChannel = order.shippingData?.logisticsInfo?.[0]?.deliveryChannel || 'N/A';
  const city = order.shippingData?.address?.city || 'Desconhecida';
  const state = order.shippingData?.address?.state || 'RS';

  // Extração das categorias dos itens
  const categoriesSet = new Set();
  const items = (order.items || []).map(i => {
    const itemCats = (i.additionalInfo?.categories || []).map(c => c.name).filter(Boolean);
    itemCats.forEach(cat => categoriesSet.add(cat));
    return {
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      price: (i.price || 0) / 100,
      categories: itemCats,
      primaryCategory: itemCats[0] || 'Outros'
    };
  });

  const categories = Array.from(categoriesSet);
  const primaryCategory = categories[0] || 'Outros';
  const department = categories[categories.length - 1] || 'Geral';

  const rawReason = order.cancelReason || null;
  const reasonCategory = categorizeReason(rawReason);

  return {
    orderId: order.orderId,
    creationDate: order.creationDate,
    lastChange: order.lastChange || order.creationDate,
    cancelReason: rawReason,
    reasonCategory: reasonCategory,
    value: (order.value || 0) / 100,
    sellerName: seller.name,
    sellerId: seller.id,
    paymentMethod: payment,
    deliveryChannel: deliveryChannel,
    city: city,
    state: state,
    origin: order.origin || 'VTEX',
    categories: categories,
    primaryCategory: primaryCategory,
    department: department,
    itemsCount: items.length,
    items: items
  };
}

/**
 * Busca os pedidos cancelados DIA A DIA nos últimos 90 dias
 * Isso evita a limitação da VTEX de no máximo 3.000 resultados por consulta!
 */
async function fetchAllCanceledOrders90DaysDaily(startDateStr, endDateStr) {
  addLog(`Iniciando varredura diária de ${startDateStr} até ${endDateStr} (superando o limite de 3.000 resultados da VTEX)...`);
  
  const allOrders = [];
  const startMs = new Date(startDateStr + 'T00:00:00.000Z').getTime();
  const endMs = new Date(endDateStr + 'T23:59:59.999Z').getTime();
  const oneDayMs = 24 * 3600 * 1000;

  const totalDays = Math.round((endMs - startMs) / oneDayMs);
  let currentDayIdx = 0;

  for (let t = startMs; t <= endMs; t += oneDayMs) {
    currentDayIdx++;
    const dayDate = new Date(t);
    const dayStr = dayDate.toISOString().slice(0, 10);
    const dayStartIso = `${dayStr}T00:00:00.000Z`;
    const dayEndIso = `${dayStr}T23:59:59.999Z`;

    let page = 1;
    let totalPages = 1;
    let dayCount = 0;

    while (page <= totalPages && page <= 30) {
      const url = `https://${config.vtex.account}.vtexcommercestable.com.br/api/oms/pvt/orders?f_status=canceled&f_creationDate=creationDate:[${encodeURIComponent(dayStartIso)}%20TO%20${encodeURIComponent(dayEndIso)}]&per_page=100&page=${page}`;
      
      try {
        const res = await axios.get(url, { headers, timeout: 15000 });
        if (res.data && res.data.list) {
          allOrders.push(...res.data.list);
          dayCount += res.data.list.length;
          if (res.data.paging) {
            totalPages = res.data.paging.pages;
          }
        }
        page++;
      } catch (err) {
        addLog(`Erro ao listar dia ${dayStr} página ${page}: ${err.message}`);
        break;
      }
    }

    if (currentDayIdx % 10 === 0 || currentDayIdx === totalDays) {
      addLog(`[Varredura 90 Dias] Dia ${currentDayIdx}/${totalDays} (${dayStr}): +${dayCount} pedidos (Acumulado: ${allOrders.length}).`);
    }
  }

  return allOrders;
}

async function runETL(forceFull = false) {
  if (syncStatus.isSyncing) {
    addLog('Sincronização já em andamento. Ignorando solicitação redundante.');
    return loadCache();
  }

  syncStatus.isSyncing = true;
  syncStatus.progressPercent = 0;
  syncStatus.lastError = null;
  addLog('Iniciando sincronização dos 90 dias completos de cancelamentos VTEX...');

  const cache = loadCache();
  const { startDateStr, endDateStr, startIso, endIso } = get90DaysCompletedRange();

  try {
    // 1. Limpar pedidos fora da janela de 90 dias
    const minKeepDate = new Date(startDateStr).getTime();
    let prunedCount = 0;
    for (const id in cache.orders) {
      const orderDate = new Date(cache.orders[id].creationDate).getTime();
      if (isNaN(orderDate) || orderDate < minKeepDate) {
        delete cache.orders[id];
        prunedCount++;
      }
    }
    if (prunedCount > 0) {
      addLog(`Removidos ${prunedCount} pedidos com mais de 90 dias do cache.`);
    }

    // 2. Buscar lista de pedidos cancelados dia a dia para garantir os 90 dias sem corte
    const orderList = await fetchAllCanceledOrders90DaysDaily(startDateStr, endDateStr);
    addLog(`Total REAL de pedidos cancelados nos 90 dias ($D-90$ a $D-1$): ${orderList.length}`);

    // 3. Filtrar pedidos que ainda não estão detalhados ou sem categorias
    const missingOrders = orderList.filter(o => !cache.orders[o.orderId] || !cache.orders[o.orderId].categories || forceFull);
    addLog(`Novos/Pendente de detalhamento e categorias: ${missingOrders.length} pedidos.`);

    const totalToFetch = missingOrders.length;
    let fetchedCount = 0;

    // 4. Detalhar pedidos em lotes concorrentes
    const BATCH_SIZE = 12;
    for (let i = 0; i < missingOrders.length; i += BATCH_SIZE) {
      const batch = missingOrders.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (item) => {
        try {
          const detailUrl = `https://${config.vtex.account}.vtexcommercestable.com.br/api/oms/pvt/orders/${item.orderId}`;
          const res = await axios.get(detailUrl, { headers, timeout: 12000 });
          const minified = minifyOrderDetails(res.data);
          if (minified) {
            cache.orders[item.orderId] = minified;
          }
        } catch (e) {
          cache.orders[item.orderId] = {
            orderId: item.orderId,
            creationDate: item.creationDate,
            lastChange: item.lastChange || item.creationDate,
            cancelReason: null,
            reasonCategory: 'Não Especificado / Automático',
            value: (item.totalValue || 0) / 100,
            sellerName: item.clientName ? 'Filial / E-commerce' : 'São João E-commerce',
            sellerId: '1',
            paymentMethod: item.paymentNames || 'Outros',
            deliveryChannel: 'N/A',
            city: 'Desconhecida',
            state: 'RS',
            origin: item.origin || 'VTEX',
            categories: ['Geral'],
            primaryCategory: 'Geral',
            department: 'Geral',
            itemsCount: item.totalItems || 1,
            items: []
          };
        } finally {
          fetchedCount++;
        }
      }));

      syncStatus.progressPercent = totalToFetch > 0 ? Math.round((fetchedCount / totalToFetch) * 100) : 100;
      
      if (fetchedCount % 300 === 0 || fetchedCount === totalToFetch) {
        cache.lastSync = new Date().toISOString();
        cache.range = { startIso, endIso, startDateStr, endDateStr };
        await saveCache(cache);
        addLog(`Progresso do Detalhamento: ${syncStatus.progressPercent}% (${fetchedCount}/${totalToFetch})`);
      }

      await new Promise(r => setTimeout(r, 120));
    }

    cache.lastSync = new Date().toISOString();
    cache.range = { startIso, endIso, startDateStr, endDateStr };
    await saveCache(cache);

    syncStatus.lastSyncTime = cache.lastSync;
    syncStatus.totalOrdersProcessed = Object.keys(cache.orders).length;
    syncStatus.progressPercent = 100;
    addLog(`Sincronização concluída com sucesso! Total na base de 90 dias: ${syncStatus.totalOrdersProcessed} pedidos.`);

  } catch (err) {
    syncStatus.lastError = err.message;
    addLog(`FALHA NA SINCRONIZAÇÃO: ${err.message}`);
  } finally {
    syncStatus.isSyncing = false;
  }

  return cache;
}

module.exports = {
  runETL,
  loadCache,
  getSyncStatus: () => syncStatus,
  get90DaysCompletedRange
};
