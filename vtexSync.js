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
  'X-VTEX-API-AppToken': process.env.VTEX_APP_TOKEN,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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

async function saveCacheAsync(cacheObj, filePath) {
  const tempPath = filePath + '.tmp';
  try {
    const json = JSON.stringify(cacheObj);
    await fs.promises.writeFile(tempPath, json, 'utf-8');
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
    await fs.promises.rename(tempPath, filePath);
  } catch (err) {
    console.error('[VTEX Sync] Erro ao salvar cache de forma assíncrona:', err.message);
  }
}

function pruneCache(cache) {
  const utcOffset = -3;
  const getBrtDateStr = (daysAgo) => {
    const d = new Date(Date.now() - daysAgo * 24 * 3600000);
    const localDate = new Date(d.getTime() + (utcOffset * 3600000));
    return localDate.toISOString().slice(0, 10);
  };
  const keepDates = new Set();
  for (let i = 0; i <= 7; i++) {
    keepDates.add(getBrtDateStr(i));
  }
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
    sellers: (order.sellers || []).map(s => ({ id: s.id, name: s.name })),
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
    })),
    cancelReason: order.cancelReason || order.cancellationData?.Reason || (order.cancellationData?.RequestedByPaymentNotification ? 'Problema no pagamento / autorização' : null),
    cancelledBy: order.cancelledBy || (order.cancellationData?.RequestedByPaymentNotification ? 'Gateway de Pagamento' : null),
    cancellationDate: order.cancellationData?.CancellationDate || null
  };
}

const getDayRange = (daysAgo, startFromIso = null) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const utcOffset = -3;
  const localDate = new Date(d.getTime() + (utcOffset * 3600000));
  const dateString = localDate.toISOString().slice(0, 10);
  const nextDay = new Date(localDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayString = nextDay.toISOString().slice(0, 10);

  if (startFromIso) {
    return [{
      start: startFromIso,
      end: `${nextDayString}T02:59:59Z`
    }];
  }

  // Split into 8 blocks of 3 hours to avoid VTEX 30-page limit (3000 orders per block max)
  return [
    { start: `${dateString}T03:00:00Z`, end: `${dateString}T05:59:59Z` },
    { start: `${dateString}T06:00:00Z`, end: `${dateString}T08:59:59Z` },
    { start: `${dateString}T09:00:00Z`, end: `${dateString}T11:59:59Z` },
    { start: `${dateString}T12:00:00Z`, end: `${dateString}T14:59:59Z` },
    { start: `${dateString}T15:00:00Z`, end: `${dateString}T17:59:59Z` },
    { start: `${dateString}T18:00:00Z`, end: `${dateString}T20:59:59Z` },
    { start: `${dateString}T21:00:00Z`, end: `${dateString}T23:59:59Z` },
    { start: `${nextDayString}T00:00:00Z`, end: `${nextDayString}T02:59:59Z` }
  ];
};

async function fetchOrderDetails(orderIds, cache) {
  // Use chunk size 50 and small delay to maximize throughput without hitting rate limits
  const chunkSize = 50;
  const totalChunks = Math.ceil(orderIds.length / chunkSize);
  let savedChunks = 0;

  for (let i = 0; i < orderIds.length; i += chunkSize) {
    const chunkIdx = Math.floor(i / chunkSize) + 1;
    progressPercent = Math.round((chunkIdx / totalChunks) * 100);
    if (chunkIdx % 5 === 0 || chunkIdx === 1 || chunkIdx === totalChunks) {
      console.log(`[VTEX Sync] Buscando detalhes: lote ${chunkIdx}/${totalChunks} (${progressPercent}%)...`);
    }
    const chunk = orderIds.slice(i, i + chunkSize);
    const promises = chunk.map(async id => {
      let retries = 3;
      let delay = 1000;
      while (retries > 0) {
        try {
          const res = await axios.get(
            `https://${account}.vtexcommercestable.com.br/api/oms/pvt/orders/${id}`,
            { headers, timeout: 15000 }
          );
          return res.data;
        } catch (err) {
          retries--;
          if (retries > 0) {
            await new Promise(r => setTimeout(r, delay));
            delay += 1000;
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

    // Minimal delay between batches
    await new Promise(r => setTimeout(r, 50));
  }
  
  // Save cache once after all details are fetched
  await saveCacheAsync(cache, CACHE_FILE);
}

async function syncPeriod(daysAgo, cache) {
  progressPercent = 0;

  // Incremental sync for today: find the latest order already in cache and only fetch from there
  let startFromIso = null;
  if (daysAgo === 0) {
    const utcOffset = -3;
    const todayBrt = new Date(Date.now() + utcOffset * 3600000).toISOString().slice(0, 10);
    // Find latest order from today BRT
    const todayOnly = Object.values(cache).filter(o => {
      if (!o.creationDate) return false;
      const brt = new Date(new Date(o.creationDate).getTime() + utcOffset * 3600000);
      return brt.toISOString().slice(0, 10) === todayBrt;
    });
    if (todayOnly.length > 0) {
      const latestMs = Math.max(...todayOnly.map(o => new Date(o.creationDate).getTime()));
      // Go back 5 minutes to avoid missing orders due to clock skew
      const fromMs = latestMs - 5 * 60 * 1000;
      startFromIso = new Date(fromMs).toISOString().slice(0, 19) + 'Z';
      console.log(`[VTEX Sync] Incremental sync daysAgo=0 a partir de ${startFromIso} (${todayOnly.length} pedidos hoje em cache)`);
    } else {
      console.log(`[VTEX Sync] Sync completo daysAgo=0 (sem pedidos de hoje em cache)`);
    }
  } else {
    console.log(`[VTEX Sync] Buscando ordens para daysAgo=${daysAgo}...`);
  }

  const blocks = getDayRange(daysAgo, startFromIso);
  let allListItems = []; // store full list items, not just IDs

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];
    let page = 1;
    const maxPages = 40;
    let hasMore = true;
    let totalPages = null;

    while (hasMore && page <= maxPages) {
      let retries = 3;
      let delay = 2000;
      let success = false;
      while (retries > 0 && !success) {
        try {
          const url = `https://${account}.vtexcommercestable.com.br/api/oms/pvt/orders?f_creationDate=creationDate:[${block.start} TO ${block.end}]&per_page=100&page=${page}`;
          const res = await axios.get(url, { headers, timeout: 20000 });
          const list = res.data.list || [];
          const paging = res.data.paging;

          if (totalPages === null && paging && paging.pages) {
            totalPages = paging.pages;
            console.log(`[VTEX Sync] daysAgo=${daysAgo} bloco ${b+1}/${blocks.length}: Total de páginas=${totalPages}, pedidos estimados=${paging.total}`);
          }

          if (list.length > 0) {
            allListItems.push(...list);

            // Update status of already-cached orders from the listing
            list.forEach(o => {
              if (cache[o.orderId] && cache[o.orderId].status !== o.status) {
                cache[o.orderId].status = o.status;
              }
            });

            if (paging && paging.pages && page >= paging.pages) {
              hasMore = false;
            }
            page++;
          } else {
            hasMore = false;
          }
          success = true;
        } catch (e) {
          retries--;
          console.error(`[VTEX Sync] Erro página ${page} bloco ${b+1} daysAgo=${daysAgo} (Tentativas restantes: ${retries}):`, e.message);
          if (retries > 0) {
            await new Promise(r => setTimeout(r, delay));
            delay += 2000;
          } else {
            // Skip this page and continue
            hasMore = false;
          }
        }
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  const orderIds = Array.from(new Set(allListItems.map(o => o.orderId)));
  console.log(`[VTEX Sync] IDs localizados para daysAgo=${daysAgo}: ${orderIds.length}`);

  if (orderIds.length > 0) {
    // Determine which orders need full detail fetch
    // Orders need fetch if: (a) not in cache at all, or (b) missing sellers (key field), or (c) canceled and missing items
    const toFetch = orderIds.filter(id => {
      const cached = cache[id];
      if (!cached) return true;
      if (!cached.sellers || cached.sellers.length === 0) return true;
      // Re-fetch canceled orders that lack items (for canceledAnalytics)
      if (cached.status === 'canceled' && (!cached.items || cached.items.length === 0)) return true;
      return false;
    });

    console.log(`[VTEX Sync] Do cache (completos): ${orderIds.length - toFetch.length}. Para buscar: ${toFetch.length}`);

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
    // Always sync today. Sync yesterday and 7 days ago on forceFull or first run.
    const targetDays = (forceFull || !lastSyncTime) ? [0, 1, 7] : [0];
    for (const d of targetDays) {
      await syncPeriod(d, cache);
      await saveCacheAsync(cache, CACHE_FILE);
      console.log(`[VTEX Sync] Cache salvo pós-dia ${d} (${Object.keys(cache).length} pedidos).`);
    }
    pruneCache(cache);
    await saveCacheAsync(cache, CACHE_FILE);
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
  getSyncState: () => ({ isSyncing, progressPercent, lastSyncTime })
};
