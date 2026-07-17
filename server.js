const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const XLSX = require('xlsx');
const vtexSync = require('./vtexSync');
const abbiamoSync = require('./abbiamoSync');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Paths to datasets (with cloud-deployment fallbacks)
const CSV_FILE = fs.existsSync(path.resolve(__dirname, 'data/detalhado_lojas_impacto_vtex.csv'))
  ? path.resolve(__dirname, 'data/detalhado_lojas_impacto_vtex.csv')
  : path.resolve(__dirname, '../Analise venda Hora/detalhado_lojas_impacto_vtex.csv');

const XLSX_FILE = fs.existsSync(path.resolve(__dirname, 'data/BAse Cintia.xlsx'))
  ? path.resolve(__dirname, 'data/BAse Cintia.xlsx')
  : path.resolve(__dirname, '../projeto C/BAse Cintia.xlsx');

const CACHE_FILE = path.resolve(__dirname, 'data/vtex_orders_cache.json');

// Normalizes store name for dictionary matching
function normalizeStoreName(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Parses store mapping from CSV
function loadOrgMap() {
  const map = {};
  if (!fs.existsSync(CSV_FILE)) {
    console.warn(`[Server] CSV mapping file not found at ${CSV_FILE}`);
    return map;
  }
  try {
    const content = fs.readFileSync(CSV_FILE, 'utf-8');
    const lines = content.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(',');
      if (parts.length >= 4) {
        const storeName = parts[0].trim();
        const coord = parts[1].trim();
        const distrital = parts[2].trim();
        const diretor = parts[3].trim();
        
        map[normalizeStoreName(storeName)] = {
          rawName: storeName,
          coordenador: coord,
          distrital: distrital,
          diretor: diretor
        };
      }
    }
  } catch (err) {
    console.error('[Server] Error loading CSV organization map:', err.message);
  }
  return map;
}

// Abbreviation expansions used by VTEX seller names vs CSV store names
const ABBREVIATION_MAP = {
  'baln': 'balneario',
  'bal': 'balneario',
  'floripa': 'florianopolis',
  'sta': 'santa',
  'sto': 'santo',
  'eng': 'engenheiro',
  'mal': 'marechal',
  'dioni': 'dionisio',
  'cnel': 'coronel',
  'fco': 'francisco',
  'franc': 'francisco',
  'gal': 'galeria',
  'hosp': 'hospital',
  'louren': 'lourenco',
  'terez': 'terezinha',
  'ant': 'antonio',
  's': 'sao',
};

// City name completions: VTEX abbreviates by dropping the city suffix
// Applied AFTER abbreviation expansion — values must match CANONICAL CSV names
const CITY_SUFFIX_MAP = {
  'sapucaia': 'sapucaia sul',
  'venancio': 'venancio aires',
  'rosario': 'rosario do sul',
  'cachoeira': 'cachoeira do sul',
  'sao lourenco do sul': 'sao lourenco',    // Fix for SAO LOUREN DO SUL 1
  'sao lourenco oeste': 'sao lourenco do oeste',
  'sao sebastiao cai': 'sao sebastiao',     // Fix for SAO SEBASTIAO CAI 1
  'julio castilhos': 'julio de castilhos',
  'quedas iguacu': 'quedas do iguacu',
  'cruzeiro oeste': 'cruzeiro do oeste',
  'sao miguel iguacu': 'sao miguel do iguacu',
  'encruzilhada sul': 'encruzilhada do sul',
  'cerro grande sul': 'cerro grande',       // Fix for CERRO GRANDE DO SUL 1
  'cerro grande do sul': 'cerro grande',
  'sao miguel oeste': 'sao miguel do oeste',
  'bela vista paraiso': 'bela vista do paraiso',
  'balneario arroio silva': 'balneario arroio do silva',
  'sao pedro sul': 'sao pedro do sul',
};

// Special hard-coded mappings for names that can't be resolved algorithmically
// Values MUST be normalized CSV store names (after normalizeStoreName)
const SPECIAL_VTEX_TO_CSV = {
  'farmacias sao joao delivery': 'porto alegre dark store',
  'pf': 'pf matriz',
  'pf matriz': 'pf matriz',
  'pf modelo': 'pf loja modelo',
  'pf uruguai': 'pf uruguai',
  'pf shopping bella': 'pf shopping',
  'pf general netto': 'pf general neto',
  'gruarapuava': 'guarapuava',
  'santo amaro': 'santo amaro imperatriz', // CSV "sto amaro imperatriz" canonicalizes to "santo amaro imperatriz"
  'sao francisco paula': 'sao fran paula', // Corrected to map to Sao Francisco de Paula stores (s fran paula) instead of Assis
  'sao francisco de paula': 'sao fran paula',
  'santa terezinha de itaipu': 'santa terezinha do itaipu', // CSV canonicalizes to "santa terezinha do itaipu"
  'santa terezinha itaipu': 'santa terezinha do itaipu',
  'santo antonio missoes': 'santo antonio das missoes',
  'caxias 21': 'caxias 20', // Best guess for Caxias 21
  'sjdigital1601': 'santo antonio das missoes', // Best guess
};

/**
 * Expands known abbreviations in a normalized store name and strips common suffixes.
 * Handles: abbreviations, city suffix completions, concatenated numbers, state suffixes, leading zeros.
 */
function canonicalize(normName) {
  let res = normName;
  
  if (SPECIAL_VTEX_TO_CSV[res] && SPECIAL_VTEX_TO_CSV[res] !== res) {
    return canonicalize(SPECIAL_VTEX_TO_CSV[res]);
  }

  res = res.replace(/([a-z])(\d)/g, '$1 $2');
  res = res.replace(/\b0+(\d+)\b/g, '$1');
  res = res.replace(/\s+(rs|pr|sc)\s*$/g, '');
  res = res.replace(/\s+(rs|pr|sc)\s+(\d)/g, ' $2');
  res = res
    .replace(/\s*-\s*(nova|shop|gal|hosp|merc|pr|sc|rs)\b/gi, '')
    .replace(/\b(nova|shop|gal|hosp|merc)\b/gi, '')
    .replace(/\bnv\b/g, '')
    .replace(/\bnov\b/g, '')
    .replace(/\b1nov\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const words = res.split(' ');
  const expanded = words.map(w => ABBREVIATION_MAP[w] || w);
  res = expanded.join(' ');
  res = res.replace(/d\s+/g, 'd').replace(/d'/g, 'd');

  const numberMatch = res.match(/^(.+?)\s+(\d+)$/);
  if (numberMatch) {
    const baseName = numberMatch[1].trim();
    const num = numberMatch[2];
    if (CITY_SUFFIX_MAP[baseName]) {
      res = CITY_SUFFIX_MAP[baseName] + ' ' + num;
    }
  } else {
    if (CITY_SUFFIX_MAP[res]) {
      res = CITY_SUFFIX_MAP[res];
    }
  }

  // Also apply SPECIAL matching again to handle bases + numbers (like PF URUGUAI 1)
  const finalNumMatch = res.match(/^(.+?)\s+(\d+)$/);
  if (finalNumMatch) {
      const bName = finalNumMatch[1].trim();
      if (SPECIAL_VTEX_TO_CSV[bName] && SPECIAL_VTEX_TO_CSV[bName] !== bName) {
          res = SPECIAL_VTEX_TO_CSV[bName] + ' ' + finalNumMatch[2];
      }
  }

  if (SPECIAL_VTEX_TO_CSV[res] && SPECIAL_VTEX_TO_CSV[res] !== res) {
    return canonicalize(SPECIAL_VTEX_TO_CSV[res]);
  }

  return res.replace(/\s+/g, ' ').trim();
}

// Parses store mapping from Cintia's XLSX base
function loadStoreLocationsFromXlsx() {
  const storeMap = {};
  if (!fs.existsSync(XLSX_FILE)) {
    console.warn(`[Server] XLSX file not found at ${XLSX_FILE}`);
    return storeMap;
  }
  try {
    const workbook = XLSX.readFile(XLSX_FILE);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet);
    
    rows.forEach(row => {
      const filial = row['Filial Nome'] || row['Filial'];
      const uf = row['UF Sigla'] || row['UF'] || row['Estado'];
      const city = row['Município Nome'] || row['Município'] || row['Cidade'];
      const coord = row['Coordenador'];
      const distrital = row['Distrital'];
      const diretor = row['Diretor'];

      if (filial) {
        storeMap[normalizeStoreName(filial)] = {
          rawName: filial,
          state: uf ? uf.trim() : 'RS',
          city: city ? city.trim() : 'Desconhecida',
          coordenador: coord ? coord.trim() : 'Desconhecido',
          distrital: distrital ? distrital.trim() : 'Desconhecido',
          diretor: diretor ? diretor.trim() : 'Desconhecido'
        };
      }
    });
  } catch (err) {
    console.error('[Server] Error loading Cintia\'s XLSX base:', err.message);
  }
  return storeMap;
}

// Combines CSV mapping and Cintia's XLSX base
let _storesBase = null;
let _storesBaseFuzzy = null;

function loadStoresBase() {
  if (_storesBase) return _storesBase;

  const stores = {};
  const fuzzy = {};
  
  // 1. Load from CSV (which has 1231 stores)
  const csvMap = loadOrgMap();
  Object.keys(csvMap).forEach(key => {
    const info = csvMap[key];
    const entry = {
      rawName: info.rawName,
      state: 'RS', // default state
      city: 'Desconhecida',
      coordenador: info.coordenador,
      distrital: info.distrital,
      diretor: info.diretor
    };
    stores[key] = entry;
    
    const canon = canonicalize(key);
    if (!fuzzy[canon]) fuzzy[canon] = entry;
  });

  // 2. Overwrite/supplement with Cintia's XLSX base (which has city, state and coordinates)
  const xlsxMap = loadStoreLocationsFromXlsx();
  Object.keys(xlsxMap).forEach(key => {
    const info = xlsxMap[key];
    const entry = {
      rawName: info.rawName,
      state: info.state,
      city: info.city,
      coordenador: info.coordenador,
      distrital: info.distrital,
      diretor: info.diretor
    };
    stores[key] = entry;
    
    const canon = canonicalize(key);
    if (!fuzzy[canon]) fuzzy[canon] = entry;
  });

  _storesBase = stores;
  _storesBaseFuzzy = fuzzy;
  return stores;
}

/**
 * Look up store info for a VTEX seller name.
 * Tries exact match first, then canonical/fuzzy match.
 */
function lookupStore(vtexCleanName) {
  const stores = loadStoresBase();
  const normName = normalizeStoreName(vtexCleanName);

  // 1. Exact normalized match
  if (stores[normName]) return stores[normName];

  // 2. Canonical (fuzzy) match
  if (_storesBaseFuzzy) {
    const canon = canonicalize(normName);
    if (_storesBaseFuzzy[canon]) return _storesBaseFuzzy[canon];

    // 3. Try stripping trailing " 1"
    if (canon.endsWith(' 1')) {
      const withoutOne = canon.slice(0, -2).trim();
      if (_storesBaseFuzzy[withoutOne]) return _storesBaseFuzzy[withoutOne];
    }
    // 4. Try adding " 1"
    const withOne = canon + ' 1';
    if (_storesBaseFuzzy[withOne]) return _storesBaseFuzzy[withOne];
  }

  return null;
}

// Timezone safe helper (High performance manual UTC-3 calculation)
function getBrtTimeDetails(date) {
  const brtMs = date.getTime() - (3 * 3600 * 1000);
  const brtDate = new Date(brtMs);
  
  const hour = brtDate.getUTCHours();
  const minute = brtDate.getUTCMinutes();
  const second = brtDate.getUTCSeconds();
  
  const yyyy = brtDate.getUTCFullYear();
  const mm = String(brtDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(brtDate.getUTCDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  
  return { hour, minute, second, dateStr };
}

// Clean/normalize cancellation reason comments
function normalizeCancelReason(reason) {
  if (!reason) return 'Problema de pagamento / gateway';
  const r = reason.toLowerCase();
  if (r.includes('estoque') || r.includes('divergencia') || r.includes('divergência')) return 'Divergência de estoque';
  if (r.includes('receita') || r.includes('controlado')) return 'Falta de receita do controlado';
  if (r.includes('pagamento') || r.includes('autorização') || r.includes('autorizacao') || r.includes('recusa')) return 'Problema no pagamento';
  if (r.includes('desistiu') || r.includes('desistencia') || r.includes('desistência') || r.includes('cliente quis')) return 'Desistência do cliente';
  if (r.includes('duplicado') || r.includes('duplicidade')) return 'Pedido duplicado';
  if (r.includes('teste')) return 'Pedido de teste';
  
  // Format operator notes cleanly (e.g. capitalize)
  const trimmed = reason.trim().replace(/[\r\n\t]+/g, ' ');
  if (!trimmed) return 'Problema de pagamento / gateway';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

// Helper to evaluate store status
function evaluateStoreStatus(sales, expectedSalesSoFar, expectedSalesFull, expectedInterval, minutesSinceLastOrder) {
  if (expectedSalesFull <= 0.6) {
    if (sales === 0) {
      return 'INATIVA';
    } else {
      return 'ONLINE';
    }
  } else {
    if (sales === 0) {
      if (expectedSalesSoFar >= 1.2) {
        return 'OFFLINE';
      } else {
        return 'ALERTA';
      }
    } else {
      if (minutesSinceLastOrder !== null && expectedInterval > 0) {
        const deviation = minutesSinceLastOrder / expectedInterval;
        if (minutesSinceLastOrder > 120 && deviation > 3.0) {
          return 'CRITICO';
        } else if (minutesSinceLastOrder > 60 && deviation > 2.0) {
          return 'ALERTA';
        } else if (sales < expectedSalesSoFar * 0.4) {
          return 'ALERTA';
        } else {
          return 'ONLINE';
        }
      } else {
        return 'ONLINE';
      }
    }
  }
}

let cachedOrders = null;
let lastCacheMtime = 0;

function getOrdersCache() {
  if (!fs.existsSync(CACHE_FILE)) {
    return {};
  }
  try {
    const stat = fs.statSync(CACHE_FILE);
    const mtime = stat.mtimeMs;
    if (!cachedOrders || mtime > lastCacheMtime) {
      console.log(`[Cache] Carregando cache de pedidos do disco (${(stat.size / 1024 / 1024).toFixed(2)} MB)...`);
      cachedOrders = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) || {};
      lastCacheMtime = mtime;
    }
  } catch (err) {
    console.error('[Cache] Erro ao carregar cache de pedidos do disco:', err.message);
    if (!cachedOrders) cachedOrders = {};
  }
  return cachedOrders;
}

// Abbiamo delivery metrics helpers
function enrichDeliveryMetrics(metrics, abData, vtexOrder) {
  // SLA: compare delivery_window_end with successfulAt
  if (abData.deliveryWindowEnd && abData.successfulAt) {
    const windowEnd = new Date(abData.deliveryWindowEnd).getTime();
    const deliveredAt = new Date(abData.successfulAt).getTime();
    if (!isNaN(windowEnd) && !isNaN(deliveredAt)) {
      if (deliveredAt <= windowEnd) {
        metrics.slaOnTime++;
      } else {
        metrics.slaDelayed++;
      }
    }
  }

  // Delivery time: from VTEX creationDate to Abbiamo successfulAt
  if (abData.successfulAt && vtexOrder.creationDate) {
    const created = new Date(vtexOrder.creationDate).getTime();
    const delivered = new Date(abData.successfulAt).getTime();
    if (!isNaN(created) && !isNaN(delivered) && delivered > created) {
      const minutes = (delivered - created) / 60000;
      metrics.totalDeliveryMinutes += minutes;
      metrics.deliveredWithTime++;
    }
  }

  // NPS
  if (abData.npsDelivery && typeof abData.npsDelivery === 'number') {
    metrics.npsSum += abData.npsDelivery;
    metrics.npsCount++;
  }

  // Modal breakdown
  const modal = abData.deliveryMethod || 'Desconhecido';
  metrics.modals[modal] = (metrics.modals[modal] || 0) + 1;
}

function summarizeDeliveryMetrics(metrics) {
  const totalSla = metrics.slaOnTime + metrics.slaDelayed;
  return {
    slaOnTime: metrics.slaOnTime,
    slaDelayed: metrics.slaDelayed,
    slaPct: totalSla > 0 ? Math.round((metrics.slaOnTime / totalSla) * 1000) / 10 : null,
    avgDeliveryMinutes: metrics.deliveredWithTime > 0 ? Math.round(metrics.totalDeliveryMinutes / metrics.deliveredWithTime) : null,
    npsAvg: metrics.npsCount > 0 ? Math.round((metrics.npsSum / metrics.npsCount) * 10) / 10 : null,
    npsCount: metrics.npsCount,
    modals: Object.entries(metrics.modals)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  };
}

// Main processing logic
function processStoreHealth() {
  const storesBase = loadStoresBase();
  
  const cache = getOrdersCache();
  const orders = Object.values(cache);
  
  if (orders.length === 0) {
    return {
      status: 'error',
      message: 'Base de dados vazia. Aguardando sincronização de pedidos.'
    };
  }

  // 1. Calculate latest order date in cache to check for snapshot mode
  let latestOrderDate = null;
  if (orders.length > 0) {
    const times = orders.map(o => new Date(o.creationDate).getTime()).filter(t => !isNaN(t));
    if (times.length > 0) {
      latestOrderDate = new Date(Math.max(...times));
    }
  }

  const timeDiffHours = latestOrderDate 
    ? (Date.now() - latestOrderDate.getTime()) / 3600000 
    : 0;


  // 2. Determine reference date and time timezone safe
  const syncState = vtexSync.getSyncState();
  let refDate = new Date();

  // Only use snapshot mode when NOT actively syncing, and when the latest order is from today's BRT date
  // (prevents using yesterday's data as today's reference during startup before sync finishes)
  const realNowBrt = getBrtTimeDetails(refDate);
  const latestOrderBrt = latestOrderDate ? getBrtTimeDetails(latestOrderDate) : null;
  const isFromToday = latestOrderBrt && latestOrderBrt.dateStr === realNowBrt.dateStr;

  const isSnapshotMode = !syncState.isSyncing && timeDiffHours >= 3.0 && latestOrderDate && isFromToday;
  if (isSnapshotMode) {
    refDate = latestOrderDate;
  }

  const calendarNowBrt = getBrtTimeDetails(refDate);

  const todayStr = calendarNowBrt.dateStr;
  const currentHour = calendarNowBrt.hour;
  const currentMinute = calendarNowBrt.minute;
  const currentSecond = calendarNowBrt.second;

  const tDate = new Date(refDate.getTime());
  tDate.setDate(tDate.getDate() - 1);
  const yesterdayStr = getBrtTimeDetails(tDate).dateStr;

  const sDate = new Date(refDate.getTime());
  sDate.setDate(sDate.getDate() - 7);
  const sevenDaysStr = getBrtTimeDetails(sDate).dateStr;

  const currentSeconds = currentHour * 3600 + currentMinute * 60 + currentSecond;

  // Initialize storeStats
  const storeStats = {};
  Object.keys(storesBase).forEach(normName => {
    const info = storesBase[normName];
    storeStats[info.rawName] = {
      id: null,
      name: info.rawName,
      coordenador: info.coordenador,
      distrital: info.distrital,
      diretor: info.diretor,
      city: info.city,
      state: info.state,
      salesToday: 0,
      salesYesterday: 0,
      salesYesterdayFull: 0,
      sales7DaysAgo: 0,
      sales7DaysAgoFull: 0,
      revenueToday: 0,
      revenueYesterday: 0,
      revenue7DaysAgo: 0,
      canceledToday: 0,
      canceledYesterday: 0,
      canceled7DaysAgo: 0,
      pendingToday: 0,
      lastOrderDate: null,
      lastOrderSecondsYesterday: null,
      lastOrderSeconds7DaysAgo: null,
      hourlySales: Array(24).fill(0),
      hourlySalesYesterday: Array(24).fill(0),
      hourlySales7DaysAgo: Array(24).fill(0),
      hourlyCanceled: Array(24).fill(0),
      hourlyCanceledYesterday: Array(24).fill(0),
      hourlyCanceled7DaysAgo: Array(24).fill(0),
      paymentMethods: {},
      deliveryChannels: {}
    };
  });

  // Analytics aggregation for today's orders
  const topCanceledProducts = {};
  const topCanceledCategories = {};
  const topCanceledPayments = {};
  const topCanceledReasons = {};
  const topCanceledOperators = {};
  let totalCanceledValueToday = 0;
  
  const topSuccessfulProducts = {};
  const topSuccessfulCategories = {};
  const topSuccessfulPayments = {};
  let totalSuccessfulValueToday = 0;

  const todayOrders = [];
  const funnelToday = { total: 0, pending: 0, approved: 0, invoiced: 0, canceled: 0, dispatched: 0, delivered: 0, totalChecked: 0 };
  const funnelYesterday = { total: 0, pending: 0, approved: 0, invoiced: 0, canceled: 0, dispatched: 0, delivered: 0, totalChecked: 0 };
  const funnelSevenDaysAgo = { total: 0, pending: 0, approved: 0, invoiced: 0, canceled: 0, dispatched: 0, delivered: 0, totalChecked: 0 };
  const activeOrdersQueue = [];
  const abbiamoDeliveries = [];

  // Abbiamo delivery metrics accumulators
  const deliveryMetrics = {
    today: { slaOnTime: 0, slaDelayed: 0, totalDeliveryMinutes: 0, deliveredWithTime: 0, npsSum: 0, npsCount: 0, modals: {} },
    yesterday: { slaOnTime: 0, slaDelayed: 0, totalDeliveryMinutes: 0, deliveredWithTime: 0, npsSum: 0, npsCount: 0, modals: {} },
    sevenDaysAgo: { slaOnTime: 0, slaDelayed: 0, totalDeliveryMinutes: 0, deliveredWithTime: 0, npsSum: 0, npsCount: 0, modals: {} }
  };

  // Load Abbiamo cache for delivery enrichment
  const abbiamoCache = abbiamoSync.getAbbiamoCache();

  // Aggregate order metrics
  for (const o of orders) {
    const status = (o.status || '').toLowerCase();
    
    const isCanceled = status === 'canceled' || status === 'cancel';
    const isPending = status === 'payment-pending' || status === 'waiting-for-seller-decision';
    const isApproved = status === 'payment-approved' || status === 'invoiced';
    const isInvoiced = status === 'invoiced';

    if (!o.sellers || o.sellers.length === 0) continue;

    const creationDate = new Date(o.creationDate);
    const detailsBrt = getBrtTimeDetails(creationDate);
    const dayStr = detailsBrt.dateStr;
    const hour = detailsBrt.hour;
    const orderSeconds = detailsBrt.hour * 3600 + detailsBrt.minute * 60 + detailsBrt.second;
    const value = (o.value || 0) / 100;

    // Build Abbiamo deliveries list for the logistics tab (Today and Yesterday only)
    const abData = abbiamoCache[o.orderId];
    if (abData && isInvoiced && abData.status !== 'NOT_FOUND' && (dayStr === todayStr || dayStr === yesterdayStr)) {
      let storeName = 'sjdigital';
      if (o.sellers && o.sellers.length > 0) {
        const s = o.sellers.find(sel => sel.id !== '1' && sel.id !== 'sjdigital' && sel.name !== 'sjdigital') || o.sellers[0];
        const cleanName = (s.name || s.id).split(' - ')[0].trim();
        const orgInfo = lookupStore(cleanName);
        storeName = orgInfo ? orgInfo.rawName : cleanName;
      }
      abbiamoDeliveries.push({
        orderId: o.orderId,
        storeName,
        creationDate: o.creationDate,
        dayType: dayStr === todayStr ? 'today' : 'yesterday',
        status: abData.status,
        subStatus: abData.subStatus,
        deliveryMethod: abData.deliveryMethod,
        deliveryWindowEnd: abData.deliveryWindowEnd,
        deliveryEta: abData.deliveryEta,
        successfulAt: abData.successfulAt,
        npsDelivery: abData.npsDelivery,
        feedbackComment: abData.feedbackComment
      });
    }

    // Populating funnel stats
    if (dayStr === todayStr) {
      funnelToday.total++;
      if (isPending) funnelToday.pending++;
      if (isApproved) funnelToday.approved++;
      if (isInvoiced) funnelToday.invoiced++;
      if (isCanceled) funnelToday.canceled++;

      // Enrich with Abbiamo delivery data
      const abData = abbiamoCache[o.orderId];
      if (abData && isInvoiced) {
        const abStatus = (abData.status || '').toUpperCase();
        if (abStatus !== 'NOT_FOUND') {
          funnelToday.totalChecked++;
          if (['DISPATCHED','START_DELIVERY','SUCCESSFUL','DELIVERED','RETURNED'].includes(abStatus)) {
            funnelToday.dispatched++;
          }
          if (abStatus === 'SUCCESSFUL' || abStatus === 'DELIVERED') {
            funnelToday.delivered++;
            enrichDeliveryMetrics(deliveryMetrics.today, abData, o);
          }
        }
      }

      // If active order (pending or approved but not invoiced/canceled), push to active queue
      const statusLower = status.toLowerCase();
      if (statusLower === 'payment-pending' || statusLower === 'waiting-for-seller-decision' || statusLower === 'payment-approved') {
        let storeName = 'sjdigital';
        if (o.sellers && o.sellers.length > 0) {
          const s = o.sellers.find(sel => sel.id !== '1' && sel.id !== 'sjdigital' && sel.name !== 'sjdigital') || o.sellers[0];
          const cleanName = (s.name || s.id).split(' - ')[0].trim();
          const orgInfo = lookupStore(cleanName);
          storeName = orgInfo ? orgInfo.rawName : cleanName;
        }

        activeOrdersQueue.push({
          orderId: o.orderId,
          status: o.status,
          storeName,
          creationDate: o.creationDate,
          value: value,
          paymentNames: o.paymentNames || []
        });
      }
    } else if (dayStr === yesterdayStr) {
      if (orderSeconds <= currentSeconds) {
        funnelYesterday.total++;
        if (isPending) funnelYesterday.pending++;
        if (isApproved) funnelYesterday.approved++;
        if (isInvoiced) funnelYesterday.invoiced++;
        if (isCanceled) funnelYesterday.canceled++;

        const abData = abbiamoCache[o.orderId];
        if (abData && isInvoiced) {
          const abStatus = (abData.status || '').toUpperCase();
          if (abStatus !== 'NOT_FOUND') {
            funnelYesterday.totalChecked++;
            if (['DISPATCHED','START_DELIVERY','SUCCESSFUL','DELIVERED','RETURNED'].includes(abStatus)) {
              funnelYesterday.dispatched++;
            }
            if (abStatus === 'SUCCESSFUL' || abStatus === 'DELIVERED') {
              funnelYesterday.delivered++;
              enrichDeliveryMetrics(deliveryMetrics.yesterday, abData, o);
            }
          }
        }
      }
    } else if (dayStr === sevenDaysStr) {
      if (orderSeconds <= currentSeconds) {
        funnelSevenDaysAgo.total++;
        if (isPending) funnelSevenDaysAgo.pending++;
        if (isApproved) funnelSevenDaysAgo.approved++;
        if (isInvoiced) funnelSevenDaysAgo.invoiced++;
        if (isCanceled) funnelSevenDaysAgo.canceled++;

        const abData = abbiamoCache[o.orderId];
        if (abData && isInvoiced) {
          const abStatus = (abData.status || '').toUpperCase();
          if (abStatus !== 'NOT_FOUND') {
            funnelSevenDaysAgo.totalChecked++;
            if (['DISPATCHED','START_DELIVERY','SUCCESSFUL','DELIVERED','RETURNED'].includes(abStatus)) {
              funnelSevenDaysAgo.dispatched++;
            }
            if (abStatus === 'SUCCESSFUL' || abStatus === 'DELIVERED') {
              funnelSevenDaysAgo.delivered++;
              enrichDeliveryMetrics(deliveryMetrics.sevenDaysAgo, abData, o);
            }
          }
        }
      }
    }

    // Compile global order statistics for today
    if (dayStr === todayStr) {
      const val = (o.value || 0) / 100;
      
      // Resolve clean storeName using lookupStore
      let storeName = 'sjdigital';
      if (o.sellers && o.sellers.length > 0) {
        const s = o.sellers.find(sel => sel.id !== '1' && sel.id !== 'sjdigital' && sel.name !== 'sjdigital') || o.sellers[0];
        const cleanName = (s.name || s.id).split(' - ')[0].trim();
        const orgInfo = lookupStore(cleanName);
        storeName = orgInfo ? orgInfo.rawName : cleanName;
      }

      todayOrders.push({
        orderId: o.orderId,
        status: o.status,
        storeName,
        value: val,
        paymentNames: o.paymentNames || [],
        items: o.items || [],
        cancelReason: o.cancelReason || null,
        cancelledBy: o.cancelledBy || null
      });

      if (isCanceled) {
        totalCanceledValueToday += val;
        
        // Aggregate cancellation reasons
        const rawReason = o.cancelReason;
        const normReason = normalizeCancelReason(rawReason);
        topCanceledReasons[normReason] = (topCanceledReasons[normReason] || 0) + 1;

        // Aggregate cancellation operators
        const operator = o.cancelledBy || 'Desconhecido';
        topCanceledOperators[operator] = (topCanceledOperators[operator] || 0) + 1;

        if (o.paymentNames) {
          o.paymentNames.forEach(pm => {
            topCanceledPayments[pm] = (topCanceledPayments[pm] || 0) + 1;
          });
        }
        if (o.items) {
          o.items.forEach(item => {
            const itemKey = item.name || item.id;
            if (!topCanceledProducts[itemKey]) {
              topCanceledProducts[itemKey] = { name: item.name, category: item.category, brand: item.brand, quantity: 0, cancelCount: 0 };
            }
            topCanceledProducts[itemKey].quantity += (item.quantity || 1);
            topCanceledProducts[itemKey].cancelCount++;

            const cat = item.category || 'Outros';
            topCanceledCategories[cat] = (topCanceledCategories[cat] || 0) + (item.quantity || 1);
          });
        }
      } else if (!isPending) {
        totalSuccessfulValueToday += val;
        if (o.paymentNames) {
          o.paymentNames.forEach(pm => {
            topSuccessfulPayments[pm] = (topSuccessfulPayments[pm] || 0) + 1;
          });
        }
        if (o.items) {
          o.items.forEach(item => {
            const itemKey = item.name || item.id;
            if (!topSuccessfulProducts[itemKey]) {
              topSuccessfulProducts[itemKey] = { name: item.name, category: item.category, brand: item.brand, quantity: 0, salesCount: 0 };
            }
            topSuccessfulProducts[itemKey].quantity += (item.quantity || 1);
            topSuccessfulProducts[itemKey].salesCount++;

            const cat = item.category || 'Outros';
            topSuccessfulCategories[cat] = (topSuccessfulCategories[cat] || 0) + (item.quantity || 1);
          });
        }
      }
    }

    o.sellers.forEach(s => {
      if (s.id === '1' || s.id === 'sjdigital' || s.name === 'sjdigital') return;

      const fullSellerName = s.name || s.id;
      const cleanName = fullSellerName.split(' - ')[0].trim();

      // Use fuzzy lookup to find the CSV/XLSX org info
      const orgInfo = lookupStore(cleanName);
      const storeKey = orgInfo ? orgInfo.rawName : cleanName;

      if (!storeStats[storeKey]) {
        storeStats[storeKey] = {
          id: s.id,
          name: storeKey,
          coordenador: orgInfo ? orgInfo.coordenador : 'Desconhecido',
          distrital: orgInfo ? orgInfo.distrital : 'Desconhecido',
          diretor: orgInfo ? orgInfo.diretor : 'Desconhecido',
          city: orgInfo ? (orgInfo.city || 'Desconhecida') : 'Desconhecida',
          state: orgInfo ? (orgInfo.state || 'RS') : 'RS',
          salesToday: 0,
          salesYesterday: 0,
          salesYesterdayFull: 0,
          sales7DaysAgo: 0,
          sales7DaysAgoFull: 0,
          revenueToday: 0,
          revenueYesterday: 0,
          revenue7DaysAgo: 0,
          canceledToday: 0,
          canceledYesterday: 0,
          canceled7DaysAgo: 0,
          pendingToday: 0,
          lastOrderDate: null,
          lastOrderSecondsYesterday: null,
          lastOrderSeconds7DaysAgo: null,
          hourlySales: Array(24).fill(0),
          hourlySalesYesterday: Array(24).fill(0),
          hourlySales7DaysAgo: Array(24).fill(0),
          hourlyCanceled: Array(24).fill(0),
          hourlyCanceledYesterday: Array(24).fill(0),
          hourlyCanceled7DaysAgo: Array(24).fill(0),
          paymentMethods: {},
          deliveryChannels: {}
        };
      }

      const stats = storeStats[storeKey];
      if (!stats.id) stats.id = s.id;

      if (stats.canceledToday === undefined) stats.canceledToday = 0;
      if (stats.canceledYesterday === undefined) stats.canceledYesterday = 0;
      if (stats.canceled7DaysAgo === undefined) stats.canceled7DaysAgo = 0;
      if (stats.pendingToday === undefined) stats.pendingToday = 0;
      if (!stats.hourlyCanceled) stats.hourlyCanceled = Array(24).fill(0);
      if (!stats.hourlyCanceledYesterday) stats.hourlyCanceledYesterday = Array(24).fill(0);
      if (!stats.hourlyCanceled7DaysAgo) stats.hourlyCanceled7DaysAgo = Array(24).fill(0);

      if (dayStr === todayStr) {
        if (isCanceled) {
          stats.canceledToday++;
          stats.hourlyCanceled[hour]++;
          return;
        }
        if (isPending) {
          stats.pendingToday++;
          return;
        }
      } else if (dayStr === yesterdayStr) {
        if (isCanceled) {
          stats.hourlyCanceledYesterday[hour]++;
          if (orderSeconds <= currentSeconds) {
            stats.canceledYesterday++;
          }
          return;
        }
        if (isPending) return;
      } else if (dayStr === sevenDaysStr) {
        if (isCanceled) {
          stats.hourlyCanceled7DaysAgo[hour]++;
          if (orderSeconds <= currentSeconds) {
            stats.canceled7DaysAgo++;
          }
          return;
        }
        if (isPending) return;
      }

      const orderTime = creationDate.getTime();
      if (!stats.lastOrderDate || orderTime > stats.lastOrderDate.getTime()) {
        stats.lastOrderDate = creationDate;
      }

      if (dayStr === todayStr) {
        stats.salesToday++;
        stats.revenueToday += value;
        stats.hourlySales[hour]++;

        // Aggregate payment methods and delivery channels for today's orders (deduplicated per order)
        if (o.paymentNames && o.paymentNames.length > 0) {
          const uniquePayments = [...new Set(o.paymentNames)];
          uniquePayments.forEach(pm => {
            stats.paymentMethods[pm] = (stats.paymentMethods[pm] || 0) + 1;
          });
        }
        if (o.deliveryChannels && o.deliveryChannels.length > 0) {
          const uniqueChannels = [...new Set(o.deliveryChannels)];
          uniqueChannels.forEach(dc => {
            const dcFriendly = dc === 'pickup-in-point' ? 'Retirada' : (dc === 'delivery' ? 'Entrega' : dc);
            stats.deliveryChannels[dcFriendly] = (stats.deliveryChannels[dcFriendly] || 0) + 1;
          });
        }
      } else if (dayStr === yesterdayStr) {
        stats.salesYesterdayFull++;
        stats.hourlySalesYesterday[hour]++;
        if (orderSeconds <= currentSeconds) {
          stats.salesYesterday++;
          stats.revenueYesterday += value;
          if (stats.lastOrderSecondsYesterday === null || orderSeconds > stats.lastOrderSecondsYesterday) {
            stats.lastOrderSecondsYesterday = orderSeconds;
          }
        }
      } else if (dayStr === sevenDaysStr) {
        stats.sales7DaysAgoFull++;
        stats.hourlySales7DaysAgo[hour]++;
        if (orderSeconds <= currentSeconds) {
          stats.sales7DaysAgo++;
          stats.revenue7DaysAgo += value;
          if (stats.lastOrderSeconds7DaysAgo === null || orderSeconds > stats.lastOrderSeconds7DaysAgo) {
            stats.lastOrderSeconds7DaysAgo = orderSeconds;
          }
        }
      }
    });
  }

  // Classify and structure results
  const storeList = Object.values(storeStats);
  const nowMs = refDate.getTime();

  const processedStores = storeList.map(s => {
    let minutesSinceLastOrder = null;
    if (s.lastOrderDate) {
      const lastOrderTime = s.lastOrderDate.getTime();
      minutesSinceLastOrder = Math.round((nowMs - lastOrderTime) / (60 * 1000));
      // Clamp for snapshot modes
      if (timeDiffHours >= 3.0) {
        const latestOrderTime = latestOrderDate.getTime();
        minutesSinceLastOrder = Math.round((latestOrderTime - lastOrderTime) / (60 * 1000));
      }
    }

    const expectedSalesSoFar = (s.salesYesterday + s.sales7DaysAgo) / 2;
    const expectedSalesFull = (s.salesYesterdayFull + s.sales7DaysAgoFull) / 2;
    const activeMinutes = 720;
    const expectedInterval = expectedSalesFull > 0 ? activeMinutes / expectedSalesFull : 0;

    // Evaluate Today's Status
    const status = evaluateStoreStatus(s.salesToday, expectedSalesSoFar, expectedSalesFull, expectedInterval, minutesSinceLastOrder);

    // Set details text for Today
    let details = 'Operando normalmente';
    if (status === 'INATIVA') {
      details = 'Sem histórico de vendas online recente';
    } else if (status === 'OFFLINE') {
      details = `Sem faturamento hoje. Esperado para o horário: ${expectedSalesSoFar.toFixed(1)} pedidos.`;
    } else if (status === 'ALERTA') {
      if (s.salesToday === 0) {
        details = `Sem faturamento hoje. Baixo volume esperado: ${expectedSalesSoFar.toFixed(1)} pedidos.`;
      } else if (minutesSinceLastOrder !== null && expectedInterval > 0 && minutesSinceLastOrder > 60 && minutesSinceLastOrder / expectedInterval > 2.0) {
        details = `Alerta de silêncio: ${minutesSinceLastOrder} min sem vendas (esperado: cada ${Math.round(expectedInterval)} min).`;
      } else {
        details = `Faturamento abaixo da curva: ${s.salesToday} pedidos (esperado: ${expectedSalesSoFar.toFixed(1)} pedidos).`;
      }
    } else if (status === 'CRITICO') {
      const deviation = minutesSinceLastOrder / expectedInterval;
      details = `Inatividade prolongada: ${minutesSinceLastOrder} min sem vendas (esperado: cada ${Math.round(expectedInterval)} min). Desvio de ${deviation.toFixed(1)}x.`;
    }

    // Evaluate Yesterday's Status
    let minutesSinceLastOrderYesterday = null;
    if (s.lastOrderSecondsYesterday !== null) {
      minutesSinceLastOrderYesterday = Math.round((currentSeconds - s.lastOrderSecondsYesterday) / 60);
    }
    const statusYesterday = evaluateStoreStatus(s.salesYesterday, expectedSalesSoFar, expectedSalesFull, expectedInterval, minutesSinceLastOrderYesterday);

    // Evaluate Last Week's Status
    let minutesSinceLastOrder7DaysAgo = null;
    if (s.lastOrderSeconds7DaysAgo !== null) {
      minutesSinceLastOrder7DaysAgo = Math.round((currentSeconds - s.lastOrderSeconds7DaysAgo) / 60);
    }
    const status7DaysAgo = evaluateStoreStatus(s.sales7DaysAgo, expectedSalesSoFar, expectedSalesFull, expectedInterval, minutesSinceLastOrder7DaysAgo);

    // Format last order time in BRT
    let lastOrderTimeStr = 'N/A';
    if (s.lastOrderDate) {
      const detailsLast = getBrtTimeDetails(s.lastOrderDate);
      lastOrderTimeStr = `${String(detailsLast.hour).padStart(2, '0')}:${String(detailsLast.minute).padStart(2, '0')}`;
    }

    return {
      name: s.name,
      id: s.id,
      coordenador: s.coordenador,
      distrital: s.distrital,
      diretor: s.diretor,
      city: s.city,
      state: s.state,
      salesToday: s.salesToday,
      salesYesterdaySoFar: s.salesYesterday,
      salesYesterdayFull: s.salesYesterdayFull,
      sales7DaysAgoSoFar: s.sales7DaysAgo,
      sales7DaysAgoFull: s.sales7DaysAgoFull,
      revenueToday: Math.round(s.revenueToday),
      revenueYesterdaySoFar: Math.round(s.revenueYesterday),
      revenue7DaysAgoSoFar: Math.round(s.revenue7DaysAgo),
      canceledToday: s.canceledToday || 0,
      canceledYesterday: s.canceledYesterday || 0,
      canceled7DaysAgo: s.canceled7DaysAgo || 0,
      pendingToday: s.pendingToday || 0,
      expectedSalesSoFar: +expectedSalesSoFar.toFixed(1),
      expectedIntervalMinutes: expectedInterval > 0 ? Math.round(expectedInterval) : null,
      minutesSinceLastOrder: minutesSinceLastOrder >= 0 ? minutesSinceLastOrder : null,
      minutesSinceLastOrderYesterday: minutesSinceLastOrderYesterday >= 0 ? minutesSinceLastOrderYesterday : null,
      minutesSinceLastOrder7DaysAgo: minutesSinceLastOrder7DaysAgo >= 0 ? minutesSinceLastOrder7DaysAgo : null,
      lastOrderTimeStr,
      status,
      statusYesterday,
      status7DaysAgo,
      details,
      hourlySales: s.hourlySales,
      hourlySalesYesterday: s.hourlySalesYesterday,
      hourlySales7DaysAgo: s.hourlySales7DaysAgo,
      hourlyCanceled: s.hourlyCanceled || Array(24).fill(0),
      hourlyCanceledYesterday: s.hourlyCanceledYesterday || Array(24).fill(0),
      hourlyCanceled7DaysAgo: s.hourlyCanceled7DaysAgo || Array(24).fill(0),
      paymentMethods: s.paymentMethods,
      deliveryChannels: s.deliveryChannels
    };
  });

  const activeMonitored = processedStores.filter(s => s.status !== 'INATIVA');
  const totalMonitored = activeMonitored.length;
  const offlineCount = activeMonitored.filter(s => s.status === 'OFFLINE').length;
  const criticalCount = activeMonitored.filter(s => s.status === 'CRITICO').length;
  const alertCount = activeMonitored.filter(s => s.status === 'ALERTA').length;
  const onlineCount = activeMonitored.filter(s => s.status === 'ONLINE').length;
  const inativeCount = processedStores.filter(s => s.status === 'INATIVA').length;

  // City and State Aggregation
  const cityStats = {};
  const stateStats = {};

  activeMonitored.forEach(s => {
    const cKey = `${s.city}|${s.state}`;
    if (!cityStats[cKey]) {
      cityStats[cKey] = { city: s.city, state: s.state, total: 0, offline: 0, critical: 0, alert: 0, online: 0, totalIdleTime: 0, idleCount: 0 };
    }
    const c = cityStats[cKey];
    c.total++;
    if (s.status === 'OFFLINE') c.offline++;
    else if (s.status === 'CRITICO') c.critical++;
    else if (s.status === 'ALERTA') c.alert++;
    else if (s.status === 'ONLINE') c.online++;

    if (s.minutesSinceLastOrder !== null) {
      c.totalIdleTime += s.minutesSinceLastOrder;
      c.idleCount++;
    }

    if (!stateStats[s.state]) {
      stateStats[s.state] = { state: s.state, total: 0, offline: 0, critical: 0, alert: 0, online: 0, totalIdleTime: 0, idleCount: 0 };
    }
    const st = stateStats[s.state];
    st.total++;
    if (s.status === 'OFFLINE') st.offline++;
    else if (s.status === 'CRITICO') st.critical++;
    else if (s.status === 'ALERTA') st.alert++;
    else if (s.status === 'ONLINE') st.online++;

    if (s.minutesSinceLastOrder !== null) {
      st.totalIdleTime += s.minutesSinceLastOrder;
      st.idleCount++;
    }
  });

  const cityList = Object.values(cityStats).map(c => ({
    city: c.city,
    state: c.state,
    total: c.total,
    offline: c.offline,
    critical: c.critical,
    alert: c.alert,
    online: c.online,
    avgIdleMinutes: c.idleCount > 0 ? Math.round(c.totalIdleTime / c.idleCount) : null
  })).sort((a, b) => (b.offline + b.critical) - (a.offline + a.critical) || b.total - a.total);

  const stateList = Object.values(stateStats).map(st => ({
    state: st.state,
    total: st.total,
    offline: st.offline,
    critical: st.critical,
    alert: st.alert,
    online: st.online,
    avgIdleMinutes: st.idleCount > 0 ? Math.round(st.totalIdleTime / st.idleCount) : null
  })).sort((a, b) => (b.offline + b.critical) - (a.offline + a.critical));

  // Coordinator Aggregation
  const coordinatorStats = {};
  activeMonitored.forEach(s => {
    const coord = s.coordenador || 'Desconhecido';
    if (!coordinatorStats[coord]) {
      coordinatorStats[coord] = { coordenador: coord, total: 0, offline: 0, alert: 0, critical: 0, online: 0 };
    }
    const cStats = coordinatorStats[coord];
    cStats.total++;
    if (s.status === 'OFFLINE') cStats.offline++;
    else if (s.status === 'CRITICO') cStats.critical++;
    else if (s.status === 'ALERTA') cStats.alert++;
    else if (s.status === 'ONLINE') cStats.online++;
  });

  const coordinatorList = Object.values(coordinatorStats)
    .sort((a, b) => (b.offline + b.critical) - (a.offline + a.critical) || b.total - a.total);

  // Distrital Aggregation
  const distritalStats = {};
  activeMonitored.forEach(s => {
    const dist = s.distrital || 'Desconhecido';
    if (!distritalStats[dist]) {
      distritalStats[dist] = { distrital: dist, total: 0, offline: 0, alert: 0, critical: 0, online: 0 };
    }
    const dStats = distritalStats[dist];
    dStats.total++;
    if (s.status === 'OFFLINE') dStats.offline++;
    else if (s.status === 'CRITICO') dStats.critical++;
    else if (s.status === 'ALERTA') dStats.alert++;
    else if (s.status === 'ONLINE') dStats.online++;
  });

  const distritalList = Object.values(distritalStats)
    .sort((a, b) => (b.offline + b.critical) - (a.offline + a.critical) || b.total - a.total);

  // Global avg time since last order (idle time)
  const activeWithIdle = activeMonitored.filter(s => s.minutesSinceLastOrder !== null);
  const avgIdleMinutesGlobal = activeWithIdle.length > 0
    ? Math.round(activeWithIdle.reduce((sum, s) => sum + s.minutesSinceLastOrder, 0) / activeWithIdle.length)
    : null;

  // Format reference time
  const refTimeStr = `${String(calendarNowBrt.hour).padStart(2, '0')}:${String(calendarNowBrt.minute).padStart(2, '0')}`;

  // Calculate hourly status history (0 to 23)
  const hourlyStatusHistory = Array(24).fill(null).map(() => ({
    offline: 0,
    critical: 0,
    alert: 0,
    online: 0,
    inative: 0
  }));

  for (let h = 0; h < 24; h++) {
    // Only evaluate up to currentHour for Today
    if (h > currentHour) continue;

    processedStores.forEach(s => {
      // Calculate cumulative sales up to hour h
      const salesTodayH = s.hourlySales.slice(0, h + 1).reduce((a, b) => a + b, 0);
      const salesYesterdayH = s.hourlySalesYesterday.slice(0, h + 1).reduce((a, b) => a + b, 0);
      const sales7DaysAgoH = s.hourlySales7DaysAgo.slice(0, h + 1).reduce((a, b) => a + b, 0);
      
      const expectedSalesH = (salesYesterdayH + sales7DaysAgoH) / 2;
      
      // Expected full-day average interval
      const expectedSalesFull = (s.salesYesterdayFull + s.sales7DaysAgoFull) / 2;
      const activeMinutes = 720;
      const expectedInterval = expectedSalesFull > 0 ? activeMinutes / expectedSalesFull : 0;

      // Find last sale hour up to h
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
        if (salesTodayH === 0) {
          status = 'INATIVA';
        } else {
          status = 'ONLINE';
        }
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
            } else {
              status = 'ONLINE';
            }
          } else {
            status = 'ONLINE';
          }
        }
      }

      if (status === 'OFFLINE') hourlyStatusHistory[h].offline++;
      else if (status === 'CRITICO') hourlyStatusHistory[h].critical++;
      else if (status === 'ALERTA') hourlyStatusHistory[h].alert++;
      else if (status === 'ONLINE') hourlyStatusHistory[h].online++;
      else if (status === 'INATIVA') hourlyStatusHistory[h].inative++;
    });
  }
  // ── Comparative aggregation (Today vs Yesterday vs Last Week at current hour) ──
  let totalOrdersToday = 0, totalOrdersYesterday = 0, totalOrdersLastWeek = 0;
  let zeroSalesToday = 0, zeroSalesYesterday = 0, zeroSalesLastWeek = 0;
  let totalRevenueToday = 0;

  activeMonitored.forEach(s => {
    const cumToday = s.hourlySales.slice(0, currentHour + 1).reduce((a, b) => a + b, 0);
    const cumYesterday = s.hourlySalesYesterday.slice(0, currentHour + 1).reduce((a, b) => a + b, 0);
    const cumLastWeek = s.hourlySales7DaysAgo.slice(0, currentHour + 1).reduce((a, b) => a + b, 0);

    totalOrdersToday += cumToday;
    totalOrdersYesterday += cumYesterday;
    totalOrdersLastWeek += cumLastWeek;
    totalRevenueToday += s.revenueToday;

    if (cumToday === 0) zeroSalesToday++;
    if (cumYesterday === 0) zeroSalesYesterday++;
    if (cumLastWeek === 0) zeroSalesLastWeek++;
  });

  // ── Yesterday's aggregations ──
  const activeMonitoredYesterday = processedStores.filter(s => s.statusYesterday !== 'INATIVA');
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

  // ── Last week's aggregations ──
  const activeMonitoredLastWeek = processedStores.filter(s => s.status7DaysAgo !== 'INATIVA');
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

  // Format top items as sorted arrays
  const topCanceledProductsList = Object.values(topCanceledProducts)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 15);

  const topCanceledReasonsList = Object.entries(topCanceledReasons)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topCanceledOperatorsList = Object.entries(topCanceledOperators)
    .map(([operator, count]) => ({ operator, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topCanceledCategoriesList = Object.entries(topCanceledCategories)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topCanceledPaymentsList = Object.entries(topCanceledPayments)
    .map(([paymentName, count]) => ({ paymentName, count }))
    .sort((a, b) => b.count - a.count);

  const topSuccessfulProductsList = Object.values(topSuccessfulProducts)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 15);

  const topSuccessfulCategoriesList = Object.entries(topSuccessfulCategories)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topSuccessfulPaymentsList = Object.entries(topSuccessfulPayments)
    .map(([paymentName, count]) => ({ paymentName, count }))
    .sort((a, b) => b.count - a.count);

  // Use only raw Abbiamo tracking data from the cache without any extrapolation or fallbacks

  return {
    referenceDate: todayStr,
    referenceTime: refTimeStr,
    summary: {
      totalMonitored,
      offlineCount,
      criticalCount,
      alertCount,
      onlineCount,
      inativeCount,
      avgIdleMinutesGlobal,
      healthScore: totalMonitored > 0 ? Math.round(((onlineCount + alertCount * 0.5) / totalMonitored) * 100) : 100,
      
      // Yesterday stats
      offlineCountYesterday,
      criticalCountYesterday,
      alertCountYesterday,
      avgIdleMinutesYesterday,
      healthScoreYesterday,

      // Last Week stats
      offlineCountLastWeek,
      criticalCountLastWeek,
      alertCountLastWeek,
      avgIdleMinutesLastWeek,
      healthScoreLastWeek,

      // Comparative KPIs (original variables)
      totalOrdersToday,
      totalOrdersYesterday,
      totalOrdersLastWeek,
      zeroSalesToday,
      zeroSalesYesterday,
      zeroSalesLastWeek,
      totalRevenueToday
    },
    cityAnalytics: cityList,
    stateAnalytics: stateList,
    coordinatorAnalytics: coordinatorList,
    distritalAnalytics: distritalList,
    hourlyStatusHistory,
    stores: processedStores,
    cancellationsAnalytics: {
      totalCanceledValueToday: Math.round(totalCanceledValueToday),
      totalSuccessfulValueToday: Math.round(totalSuccessfulValueToday),
      topCanceledProducts: topCanceledProductsList,
      topCanceledCategories: topCanceledCategoriesList,
      topCanceledPayments: topCanceledPaymentsList,
      topCanceledReasons: topCanceledReasonsList,
      topCanceledOperators: topCanceledOperatorsList,
      topSuccessfulProducts: topSuccessfulProductsList,
      topSuccessfulCategories: topSuccessfulCategoriesList,
      topSuccessfulPayments: topSuccessfulPaymentsList,
      todayOrders: todayOrders
    },
    funnelAnalytics: {
      today: funnelToday,
      yesterday: funnelYesterday,
      sevenDaysAgo: funnelSevenDaysAgo,
      deliveryMetrics: {
        today: summarizeDeliveryMetrics(deliveryMetrics.today),
        yesterday: summarizeDeliveryMetrics(deliveryMetrics.yesterday),
        sevenDaysAgo: summarizeDeliveryMetrics(deliveryMetrics.sevenDaysAgo)
      }
    },
    abbiamoSyncState: abbiamoSync.getAbbiamoSyncState(),
    activeOrdersQueue: activeOrdersQueue,
    abbiamoDeliveries: abbiamoDeliveries
  };
}

let cachedMonitorData = null;
let lastCacheUpdate = 0;

function updateMonitorCache() {
  try {
    const result = processStoreHealth();
    if (result && result.status !== 'error') {
      cachedMonitorData = result;
      lastCacheUpdate = Date.now();
      return true;
    }
  } catch (err) {
    console.error('[Monitor Cache] Erro ao pre-processar dados:', err.message);
  }
  return false;
}

// Endpoint
app.get('/api/monitor', (req, res) => {
  if (!cachedMonitorData) {
    console.log('[API] Primeiro request, gerando cache de monitoramento de forma sincrona...');
    updateMonitorCache();
  }
  
  if (!cachedMonitorData) {
    return res.json({
      status: 'error',
      message: 'Base de dados de cache da VTEX indisponível ou vazia. Aguarde a sincronização.',
      sync: vtexSync.getSyncState()
    });
  }

  res.json({
    status: 'success',
    sync: vtexSync.getSyncState(),
    data: cachedMonitorData
  });
});

// Endpoint to get current sync state
app.get('/api/sync/state', (req, res) => {
  res.json({ status: 'success', data: vtexSync.getSyncState() });
});

// Endpoint to trigger manual sync
app.post('/api/sync/trigger', async (req, res) => {
  vtexSync.syncVtexData(true).catch(err => console.error('[Trigger Sync] Failed:', err.message));
  res.json({ status: 'success', message: 'Sincronização iniciada no plano de fundo.' });
});

// Ping endpoint for heartbeat
app.get('/ping', (req, res) => {
  res.send('pong');
});

// Serve static

// Debug endpoint
app.get('/debug', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const cachePath = path.join(__dirname, 'data', 'vtex_orders_cache.json');
    let cacheStats = 'File does not exist';
    if (fs.existsSync(cachePath)) {
      const stats = fs.statSync(cachePath);
      cacheStats = `Exists, size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`;
    }
    
    // Test direct VTEX OMS request (first page of today)
    const axios = require('axios');
    const account = process.env.VTEX_ACCOUNT || 'sjdigital';
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-VTEX-API-AppKey': process.env.VTEX_APP_KEY,
      'X-VTEX-API-AppToken': process.env.VTEX_APP_TOKEN,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    };
    
    const today = new Date().toISOString().slice(0, 10);
    const start = `${today}T00:00:00Z`;
    const end = `${today}T23:59:59Z`;
    const url = `https://${account}.vtexcommercestable.com.br/api/oms/pvt/orders?f_creationDate=creationDate:[${start} TO ${end}]&per_page=5&page=1`;
    
    const startReq = Date.now();
    let vtexTest = '';
    try {
      const vtexRes = await axios.get(url, { headers, timeout: 5000 });
      vtexTest = `Success in ${Date.now() - startReq}ms, total orders: ${vtexRes.data?.paging?.total}`;
    } catch (err) {
      vtexTest = `Failed in ${Date.now() - startReq}ms: ${err.message}`;
    }

    res.json({
      memory: process.memoryUsage(),
      cacheStats,
      vtexTest,
      envKeys: Object.keys(process.env).filter(k => k.includes('VTEX') || k.includes('RENDER'))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`🚀 Standalone Store Health Monitor running on http://localhost:${PORT}`);

  // Initial pre-calculation of monitor cache
  console.log('[Monitor Cache] Inicializando cache de monitoramento em segundo plano...');
  setTimeout(() => {
    updateMonitorCache();
  }, 1000);

  // Update monitor cache in the background every 30 seconds
  setInterval(() => {
    updateMonitorCache();
  }, 30 * 1000);

  // Self-ping heartbeat to prevent Render sleep on free tier (DISABLED by user request)
  /*
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (selfUrl) {
    console.log(`[Heartbeat] Active. Self-pinging URL: ${selfUrl}/ping every 10 minutes.`);
    setInterval(async () => {
      try {
        const response = await fetch(`${selfUrl}/ping`);
        console.log(`[Heartbeat] Ping sent successfully. Status: ${response.status}`);
      } catch (err) {
        console.error(`[Heartbeat] Ping failed:`, err.message);
      }
    }, 10 * 60 * 1000);
  } else {
    console.log('[Heartbeat] RENDER_EXTERNAL_URL not defined. Self-ping skipped.');
  }
  */
  
  // Always run sync on startup in the background to catch up with new orders
  console.log('[Init Sync] Running startup sync in background to fetch latest orders...');
  vtexSync.syncVtexData().then(() => {
    // Force immediate update of cache when sync finishes
    console.log('[Monitor Cache] Sincronizacao concluida, atualizando cache...');
    updateMonitorCache();
  }).catch(err => console.error('[Init Sync] Failed:', err.message));
  
  // Set sync interval every 20 minutes
  setInterval(() => {
    console.log('[Interval] Executando sincronização programada com VTEX...');
    vtexSync.syncVtexData().then(() => {
      updateMonitorCache();
    }).catch(err => console.error('[Interval Sync] Failed:', err.message));
  }, 20 * 60 * 1000);

  // Abbiamo sync: run 30 seconds after VTEX startup sync, then every 30 minutes
  setTimeout(() => {
    console.log('[Init Sync] Iniciando primeira sincronização Abbiamo...');
    abbiamoSync.syncAbbiamoData().then(() => {
      console.log('[Abbiamo Sync] Primeira sincronização concluída.');
      updateMonitorCache();
    }).catch(err => console.error('[Abbiamo Sync] Failed:', err.message));
  }, 30000);

  setInterval(() => {
    console.log('[Interval] Executando sincronização programada com Abbiamo...');
    abbiamoSync.syncAbbiamoData().then(() => {
      updateMonitorCache();
    }).catch(err => console.error('[Abbiamo Interval Sync] Failed:', err.message));
  }, 30 * 60 * 1000);
});
