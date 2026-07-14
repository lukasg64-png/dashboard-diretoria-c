const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DATA_DIR = path.join(__dirname, 'data');
const CACHE_FILE = path.join(DATA_DIR, 'vtex_orders_cache.json');

const account = process.env.VTEX_ACCOUNT || 'sjdigital';
const headers = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'X-VTEX-API-AppKey': process.env.VTEX_APP_KEY,
  'X-VTEX-API-AppToken': process.env.VTEX_APP_TOKEN
};

// Global sync state flag
let isSyncing = false;
let progressPercent = 0;
let lastSyncTime = null;

function loadOrdersCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) || {};
    } catch (e) {
      console.error('[VTEX Sync] Erro ao carregar cache de pedidos:', e.message);
    }
  }
  return {};
}

function saveCacheStreamSync(cacheObj, filePath) {
  const tempPath = filePath + '.tmp';
  const fd = fs.openSync(tempPath, 'w');
  fs.writeSync(fd, '{\n');
  const keys = Object.keys(cacheObj);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    fs.writeSync(fd, `"${key}": ${JSON.stringify(cacheObj[key])}`);
    if (i < keys.length - 1) fs.writeSync(fd, ',\n');
  }
  fs.writeSync(fd, '\n}\n');
  fs.closeSync(fd);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error('[VTEX Sync] Erro ao mover arquivo temporario para cache oficial:', err.message);
  }
}

function pruneCache(cache) {
  const utcOffset = -3;
  const getBrtDateStr = (daysAgo) => {
    const d = new Date(Date.now() - daysAgo * 24 * 3600000);
    const localDate = new Date(d.getTime() + (utcOffset * 3600000));
    return localDate.toISOString().slice(0, 10);
  };
  
  const keepDates = new Set([
    getBrtDateStr(0),
    getBrtDateStr(1),
    getBrtDateStr(7)
  ]);
  
  let count = 0;
  for (const id in cache) {
    const order = cache[id];
    if (order && order.creationDate) {
      const creation = new Date(order.creationDate);
      const localCreation = new Date(creation.getTime() + (utcOffset * 3600000));
      const brtDateStr = localCreation.toISOString().slice(0, 10);
      
      if (!keepDates.has(brtDateStr)) {
        delete cache[id];
        count++;
      }
    } else {
      delete cache[id];
      count++;
    }
  }
  if (count > 0) {
    console.log(`[VTEX Sync] Removidos ${count} pedidos antigos do cache.`);
  }
}

function minifyOrder(order) {
  if (!order) return null;

  return {
    orderId: order.orderId,
    status: order.status,
    creationDate: order.creationDate,
    value: order.value,
    sellers: (order.sellers || []).map(s => ({
      id: s.id,
      name: s.name
    })),
    shippingData: {
      address: {
        state: order.shippingData?.address?.state,
        city: order.shippingData?.address?.city
      }
    },
    paymentNames: (order.paymentData?.transactions || []).flatMap(t => (t.payments || []).map(p => p.paymentSystemName)).filter(Boolean),
    deliveryChannels: (order.shippingData?.logisticsInfo || []).map(l => l.deliveryChannel).filter(Boolean),
    items: (order.items || []).map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      brand: item.additionalInfo?.brandName || 'Desconhecido',
      category: item.additionalInfo?.categories?.[0]?.name || 'Outros'
    }))
  };
}

const getTimeBlocks = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const utcOffset = -3;
  const localDate = new Date(d.getTime() + (utcOffset * 3600000));
  const dateString = localDate.toISOString().slice(0, 10);
  
  const nextDay = new Date(localDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayString = nextDay.toISOString().slice(0, 10);

  return [
    { start: `${dateString}T03:00:00.000Z`, end: `${dateString}T06:59:59.999Z` },
    { start: `${dateString}T07:00:00.000Z`, end: `${dateString}T10:59:59.999Z` },
    { start: `${dateString}T11:00:00.000Z`, end: `${dateString}T14:59:59.999Z` },
    { start: `${dateString}T15:00:00.000Z`, end: `${dateString}T18:59:59.999Z` },
    { start: `${dateString}T19:00:00.000Z`, end: `${dateString}T22:59:59.999Z` },
    { start: `${dateString}T23:00:00.000Z`, end: `${nextDayString}T02:59:59.999Z` }
  ];
};

async function fetchOrderDetails(orderIds, cache) {
  const chunkSize = 30;
  const totalChunks = Math.ceil(orderIds.length / chunkSize);

  for (let i = 0; i < orderIds.length; i += chunkSize) {
    const chunkIdx = Math.floor(i / chunkSize) + 1;
    progressPercent = Math.round((chunkIdx / totalChunks) * 100);
    
    if (chunkIdx % 10 === 0 || chunkIdx === 1 || chunkIdx === totalChunks) {
      console.log(`[VTEX Sync] Buscando detalhes: lote ${chunkIdx}/${totalChunks}...`);
    }

    const chunk = orderIds.slice(i, i + chunkSize);
    const promises = chunk.map(async id => {
      let retries = 3;
      let delay = 1000;
      while (retries > 0) {
        try {
          const res = await axios.get(`https://${account}.vtexcommercestable.com.br/api/oms/pvt/orders/${id}`, { 
            headers, 
            timeout: 30000
          });
          return res.data;
        } catch (err) {
          if (err.response && err.response.status === 429) {
            retries--;
            await new Promise(r => setTimeout(r, delay));
            delay += 1000;
          } else {
            return null;
          }
        }
      }
      return null;
    });
    
    const results = await Promise.all(promises);
    const validResults = results.filter(r => r !== null);
    
    for (const order of validResults) {
      const minified = minifyOrder(order);
      if (minified) {
        cache[minified.orderId] = minified;
      }
    }

    await new Promise(r => setTimeout(r, 100));
  }
}

async function syncPeriod(daysAgo, cache) {
  console.log(`[VTEX Sync] Buscando ordens para daysAgo=${daysAgo}...`);
  progressPercent = 0;
  const blocks = getTimeBlocks(daysAgo);
  let orderIds = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    let page = 1;
    const maxPages = 30;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      try {
        const url = `https://${account}.vtexcommercestable.com.br/api/oms/pvt/orders?f_creationDate=creationDate:[${block.start} TO ${block.end}]&per_page=100&page=${page}`;
        const res = await axios.get(url, { headers, timeout: 30000 });
        const list = res.data.list || [];
        if (list.length > 0) {
          list.forEach(o => {
            orderIds.push(o.orderId);
            if (cache[o.orderId] && cache[o.orderId].status !== o.status) {
              cache[o.orderId].status = o.status;
            }
          });
          page++;
        } else {
          hasMore = false;
        }
      } catch (e) {
        console.error(`[VTEX Sync] Erro página ${page} bloco ${i} daysAgo=${daysAgo}:`, e.message);
        hasMore = false;
      }
    }
  }

  orderIds = Array.from(new Set(orderIds));
  console.log(`[VTEX Sync] IDs localizados para daysAgo=${daysAgo}: ${orderIds.length}`);

  if (orderIds.length > 0) {
    let selfHealedCount = 0;
    const toFetch = orderIds.filter(id => {
      const cached = cache[id];
      if (!cached) return true;
      const needsCure = cached.paymentNames === undefined || 
                        cached.deliveryChannels === undefined || 
                        (cached.status === 'canceled' && cached.items === undefined);
      if (needsCure) {
        if (selfHealedCount < 10000) {
          selfHealedCount++;
          return true;
        }
      }
      return false;
    });
    console.log(`[VTEX Sync] Do cache (completos): ${orderIds.length - toFetch.length}. Para buscar (inclui auto-cura): ${toFetch.length}`);
    
    if (toFetch.length > 0) {
      await fetchOrderDetails(toFetch, cache);
    }
  }
}

async function syncVtexData(forceFull = false) {
  if (isSyncing) return;
  isSyncing = true;
  progressPercent = 0;
  console.log(`[VTEX Sync] Iniciando sincronização autônoma de pedidos (forceFull=${forceFull})...`);
  
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const cache = loadOrdersCache();

  try {
    pruneCache(cache);

    // Sync only days 0, 1, and 7 if forceFull is true, or if lastSyncTime is null (startup)
    const targetDays = (forceFull || !lastSyncTime) ? [0, 1, 7] : [0];
    for (const d of targetDays) {
      await syncPeriod(d, cache);
      saveCacheStreamSync(cache, CACHE_FILE);
      console.log(`[VTEX Sync] Cache salvo pós-dia ${d} (${Object.keys(cache).length} pedidos).`);
    }
    
    pruneCache(cache);
    saveCacheStreamSync(cache, CACHE_FILE);
    
    lastSyncTime = new Date().toISOString();
    console.log(`[VTEX Sync] Sincronização concluída com sucesso às ${lastSyncTime}.`);
  } catch (err) {
    console.error('[VTEX Sync] Falha geral:', err.message);
  } finally {
    isSyncing = false;
    progressPercent = 100;
  }
}

module.exports = {
  syncVtexData,
  getSyncState: () => ({
    isSyncing,
    progressPercent,
    lastSyncTime
  })
};
