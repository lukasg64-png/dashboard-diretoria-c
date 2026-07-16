const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ABBIAMO_CACHE_FILE = path.join(DATA_DIR, 'abbiamo_cache.json');
const VTEX_CACHE_FILE = path.join(DATA_DIR, 'vtex_orders_cache.json');

const API_KEY = process.env.ABBIAMO_API_KEY || 'abbiamo-key-GXYOAlkLJvJ68MM';
const BASE_URL = 'https://api.abbiamo.io/seller-group/v1';

// Sync state
let isSyncing = false;
let progressPercent = 0;
let lastSyncTime = null;
let lastError = null;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Load the Abbiamo cache from disk (orderId -> abbiamo data).
 */
function loadAbbiamoCache() {
  if (fs.existsSync(ABBIAMO_CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(ABBIAMO_CACHE_FILE, 'utf-8')) || {};
    } catch (e) {
      console.warn('[Abbiamo Sync] Erro ao ler cache existente, criando novo.', e.message);
    }
  }
  return {};
}

/**
 * Save the Abbiamo cache to disk atomically.
 */
async function saveAbbiamoCache(cacheObj) {
  const tempPath = ABBIAMO_CACHE_FILE + '.tmp';
  try {
    const json = JSON.stringify(cacheObj);
    await fs.promises.writeFile(tempPath, json, 'utf-8');
    if (fs.existsSync(ABBIAMO_CACHE_FILE)) {
      await fs.promises.unlink(ABBIAMO_CACHE_FILE);
    }
    await fs.promises.rename(tempPath, ABBIAMO_CACHE_FILE);
  } catch (err) {
    console.error('[Abbiamo Sync] Erro ao salvar cache:', err.message);
  }
}

/**
 * Extract branchId from VTEX seller id (e.g., 'sjdigital1134' -> '1134').
 */
function extractBranchId(sellerId) {
  if (!sellerId) return null;
  const match = sellerId.match(/\d+$/);
  return match ? match[0] : null;
}

/**
 * Minify Abbiamo response to keep only the fields we need.
 */
function minifyAbbiamoOrder(data) {
  if (!data) return null;
  return {
    status: data.status_name || data.status || null,
    subStatus: data.sub_status || null,
    deliveryMethod: data.last_delivery_type || data.last_delivery_method_name || null,
    deliveryWindowEnd: data.promised_delivery_date || data.delivery_window_end || null,
    deliveryEta: data.last_delivery_delivery_eta || data.successful_at || null,
    successfulAt: data.successful_at || data.last_delivery_delivery_eta || null,
    createdAt: data.created_at || null,
    dispatchedAt: data.dispatched_at || null,
    npsDelivery: data.customer_delivery_experience_rating || (data.csat ? data.csat.customer_delivery_experience_rating : null) || null,
    npsPurchase: data.customer_purchase_experience_rating || (data.csat ? data.csat.customer_purchase_experience_rating : null) || null,
    feedbackComment: data.customer_feedback_comment || (data.csat ? data.csat.customer_feedback_comment : null) || null
  };
}

/**
 * Main sync function. Reads VTEX orders cache, fetches Abbiamo status for
 * invoiced orders from the last 2 days, and saves to local cache.
 */
async function syncAbbiamoData() {
  if (isSyncing) {
    console.log('[Abbiamo Sync] Já em execução, pulando.');
    return;
  }

  isSyncing = true;
  progressPercent = 0;
  lastError = null;

  console.log('[Abbiamo Sync] Iniciando sincronização...');

  try {
    // 1. Load VTEX orders cache
    if (!fs.existsSync(VTEX_CACHE_FILE)) {
      console.warn('[Abbiamo Sync] Cache VTEX não encontrado. Pulando sync.');
      return;
    }

    const vtexCache = JSON.parse(fs.readFileSync(VTEX_CACHE_FILE, 'utf-8')) || {};
    const orderIds = Object.keys(vtexCache);
    // 2. Filter to invoiced orders and group by target days
    const now = Date.now();
    const todayOrders = [];
    const yesterdayOrders = [];
    const sevenDaysOrders = [];

    for (const id of orderIds) {
      const order = vtexCache[id];
      const status = (order.status || '').toLowerCase();
      
      // Only sync invoiced orders (they're the ones that go to logistics)
      if (status !== 'invoiced' && status !== 'invoice') continue;

      // Must have a seller with a branchId
      let branchId = null;
      if (order.sellers && order.sellers.length > 0) {
        branchId = extractBranchId(order.sellers[0].id);
      }
      if (!branchId) continue;

      // Categorize into target days: 0-24h (today), 24-48h (yesterday), 144-192h (7 days ago)
      if (order.creationDate) {
        const ageHours = (now - new Date(order.creationDate).getTime()) / 3600000;
        if (ageHours >= 0 && ageHours <= 24) {
          todayOrders.push({ orderId: id, branchId, creationDate: order.creationDate });
        } else if (ageHours > 24 && ageHours <= 48) {
          yesterdayOrders.push({ orderId: id, branchId, creationDate: order.creationDate });
        } else if (ageHours >= 144 && ageHours <= 192) {
          sevenDaysOrders.push({ orderId: id, branchId, creationDate: order.creationDate });
        }
      }
    }

    // Sort descending (newest first)
    const sortDesc = (arr) => arr.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
    sortDesc(todayOrders);
    sortDesc(yesterdayOrders);
    sortDesc(sevenDaysOrders);

    // Take a balanced sample of up to 400 orders from each period
    const SAMPLE_CAP = 400;
    const targetOrders = [
      ...todayOrders.slice(0, SAMPLE_CAP),
      ...yesterdayOrders.slice(0, SAMPLE_CAP),
      ...sevenDaysOrders.slice(0, SAMPLE_CAP)
    ];

    console.log(`[Abbiamo Sync] Elegíveis - Hoje: ${todayOrders.length}, Ontem: ${yesterdayOrders.length}, 7d: ${sevenDaysOrders.length}.`);
    console.log(`[Abbiamo Sync] Selecionados para busca equilibrada: ${targetOrders.length} pedidos.`);

    if (targetOrders.length === 0) {
      console.log('[Abbiamo Sync] Nenhum pedido elegível. Finalizando.');
      return;
    }

    // 3. Load existing Abbiamo cache
    const abbiamoCache = loadAbbiamoCache();

    // 4. Fetch from API with rate limiting (5 req/s = 200ms between requests)
    const DELAY_MS = 200;
    let fetchedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let saveCounter = 0;
    let apiCallsCount = 0;
    
    // Limit actual API calls per cycle to prevent long runs, while traversing the entire list
    const MAX_API_CALLS = 800;
    console.log(`[Abbiamo Sync] Iniciando busca. Limite de chamadas de API por ciclo: ${MAX_API_CALLS}`);

    for (let i = 0; i < targetOrders.length; i++) {
      if (apiCallsCount >= MAX_API_CALLS) {
        console.log(`[Abbiamo Sync] Limite de ${MAX_API_CALLS} chamadas de API atingido. Interrompendo sync.`);
        break;
      }

      const { orderId, branchId } = targetOrders[i];
      progressPercent = Math.round((i / targetOrders.length) * 100);

      // Skip already-completed deliveries (SUCCESSFUL + DELIVERED) or recently checked not-found orders
      const existing = abbiamoCache[orderId];
      if (existing) {
        const isDelivered = (existing.status === 'SUCCESSFUL' && existing.subStatus === 'DELIVERED') || existing.status === 'SUCCESSFUL';
        if (isDelivered) {
          skippedCount++;
          continue;
        }

        if (existing.status === 'NOT_FOUND') {
          const checkedAgeMinutes = (now - (existing.checkedAt || 0)) / 60000;
          const orderAgeHours = (now - new Date(targetOrders[i].creationDate).getTime()) / 3600000;
          // Skip if checked less than 30 minutes ago, or if the order is older than 6 hours (unlikely to appear in Abbiamo now)
          if (checkedAgeMinutes < 30 || orderAgeHours > 6) {
            skippedCount++;
            continue;
          }
        }
      }

      apiCallsCount++;

      try {
        const url = `${BASE_URL}/seller/identifier/${branchId}/orders/external_id/${orderId}`;
        const response = await fetch(url, {
          headers: {
            'x-abbiamo-seller-group-key': API_KEY,
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          const data = await response.json();
          const orderData = Array.isArray(data) ? data[0] : data;
          if (orderData) {
            abbiamoCache[orderId] = minifyAbbiamoOrder(orderData);
            fetchedCount++;
          } else {
            abbiamoCache[orderId] = { status: 'NOT_FOUND', checkedAt: Date.now() };
            skippedCount++;
          }
        } else if (response.status === 429) {
          console.warn(`[Abbiamo Sync] Rate limit (429) no pedido ${orderId}, aguardando...`);
          await sleep(3000);
          // Don't increment errorCount, just retry next cycle
        } else if (response.status === 404 || response.status === 400) {
          // Cache NOT_FOUND so we don't spam the API for non-Abbiamo orders
          abbiamoCache[orderId] = { status: 'NOT_FOUND', checkedAt: Date.now() };
          skippedCount++;
        } else {
          errorCount++;
          if (errorCount <= 3) {
            console.warn(`[Abbiamo Sync] HTTP ${response.status} para ${orderId}`);
          }
        }
      } catch (err) {
        errorCount++;
        if (errorCount <= 3) {
          console.error(`[Abbiamo Sync] Erro de rede para ${orderId}:`, err.message);
        }
      }

      saveCounter++;

      // Save progress every 50 orders
      if (saveCounter >= 50) {
        await saveAbbiamoCache(abbiamoCache);
        saveCounter = 0;
      }

      await sleep(DELAY_MS);
    }

    // 5. Prune old entries (older than 3 days)
    const threeDaysMs = 3 * 24 * 3600000;
    let pruned = 0;
    for (const id in abbiamoCache) {
      const entry = abbiamoCache[id];
      if (entry && entry.createdAt) {
        const age = now - new Date(entry.createdAt).getTime();
        if (age > threeDaysMs) {
          delete abbiamoCache[id];
          pruned++;
        }
      }
    }

    // 6. Final save
    await saveAbbiamoCache(abbiamoCache);
    
    lastSyncTime = new Date().toISOString();
    progressPercent = 100;

    console.log(`[Abbiamo Sync] Concluído. Buscados: ${fetchedCount}, Pulados: ${skippedCount}, Erros: ${errorCount}, Podados: ${pruned}. Total no cache: ${Object.keys(abbiamoCache).length}`);

  } catch (err) {
    console.error('[Abbiamo Sync] Falha geral:', err.message);
    lastError = err.message;
  } finally {
    isSyncing = false;
  }
}

/**
 * Get current sync state for status reporting.
 */
function getAbbiamoSyncState() {
  return { isSyncing, progressPercent, lastSyncTime, lastError };
}

/**
 * Get cached Abbiamo data for use in processStoreHealth.
 * Returns { orderId: { status, deliveryMethod, ... } }
 */
let cachedAbbiamoData = null;
let lastAbbiamoCacheMtime = 0;

function getAbbiamoCache() {
  if (!fs.existsSync(ABBIAMO_CACHE_FILE)) {
    return {};
  }
  try {
    const stat = fs.statSync(ABBIAMO_CACHE_FILE);
    const mtime = stat.mtimeMs;
    if (!cachedAbbiamoData || mtime > lastAbbiamoCacheMtime) {
      cachedAbbiamoData = JSON.parse(fs.readFileSync(ABBIAMO_CACHE_FILE, 'utf-8')) || {};
      lastAbbiamoCacheMtime = mtime;
    }
  } catch (err) {
    console.error('[Abbiamo Cache] Erro ao carregar:', err.message);
    if (!cachedAbbiamoData) cachedAbbiamoData = {};
  }
  return cachedAbbiamoData;
}

module.exports = {
  syncAbbiamoData,
  getAbbiamoSyncState,
  getAbbiamoCache
};
