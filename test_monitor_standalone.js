const fs = require('fs');
const path = require('path');

const CSV_FILE = path.resolve(__dirname, '../Analise venda Hora/detalhado_lojas_impacto_vtex.csv');
const CACHE_FILE = path.resolve(__dirname, '../360 Online/server/data/vtex_orders_cache.json');

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

function loadOrgMap() {
  const map = {};
  if (!fs.existsSync(CSV_FILE)) {
    console.warn(`[Server] CSV mapping file not found at ${CSV_FILE}`);
    return map;
  }
  try {
    const content = fs.readFileSync(CSV_FILE, 'utf-8');
    const lines = content.split('\n');
    let loaded = 0;
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
        loaded++;
      }
    }
    console.log(`Loaded ${loaded} stores from CSV.`);
  } catch (err) {
    console.error('[Server] Error loading CSV organization map:', err.message);
  }
  return map;
}

const map = loadOrgMap();
console.log('CSV Keys length:', Object.keys(map).length);

if (!fs.existsSync(CACHE_FILE)) {
  console.log('Cache file does not exist at:', CACHE_FILE);
  process.exit(1);
}

const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
const orders = Object.values(cache);
console.log('Total orders in cache:', orders.length);

// Let's run the date calculation
const utcOffset = -3;
const latestOrderDate = new Date(Math.max(...orders.map(o => new Date(o.creationDate).getTime())));
const latestOrderBrt = new Date(latestOrderDate.getTime() + (utcOffset * 3600000));
const calendarNowBrt = new Date(Date.now() + (utcOffset * 3600000));

console.log('Latest order date UTC:', latestOrderDate.toISOString());
console.log('Latest order date BRT:', latestOrderBrt.toISOString());
console.log('Calendar now BRT:', calendarNowBrt.toISOString());

let todayStr, yesterdayStr, sevenDaysStr;
let localNowBrt;

const timeDiffDays = (calendarNowBrt.getTime() - latestOrderBrt.getTime()) / (24 * 3600000);
console.log('Time diff in days:', timeDiffDays);

if (timeDiffDays < 3.0) {
  localNowBrt = calendarNowBrt;
  todayStr = localNowBrt.toISOString().slice(0, 10);
  yesterdayStr = new Date(localNowBrt.getTime() - 86400000).toISOString().slice(0, 10);
  sevenDaysStr = new Date(localNowBrt.getTime() - 7 * 86400000).toISOString().slice(0, 10);
} else {
  localNowBrt = latestOrderBrt;
  const uniqueDates = Array.from(new Set(orders.map(o => {
    const d = new Date(o.creationDate);
    return new Date(d.getTime() + (utcOffset * 3600000)).toISOString().slice(0, 10);
  }))).sort();
  
  console.log('Unique dates in cache:', uniqueDates);
  if (uniqueDates.length >= 3) {
    todayStr = uniqueDates[uniqueDates.length - 1];
    yesterdayStr = uniqueDates[uniqueDates.length - 2];
    sevenDaysStr = uniqueDates[uniqueDates.length - 3];
  } else {
    todayStr = latestOrderBrt.toISOString().slice(0, 10);
    yesterdayStr = new Date(latestOrderBrt.getTime() - 86400000).toISOString().slice(0, 10);
    sevenDaysStr = new Date(latestOrderBrt.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  }
}

console.log('Calculated Today:', todayStr);
console.log('Calculated Yesterday:', yesterdayStr);
console.log('Calculated 7 Days Ago:', sevenDaysStr);

const currentSeconds = localNowBrt.getUTCHours() * 3600 + localNowBrt.getUTCMinutes() * 60 + localNowBrt.getUTCSeconds();
console.log('currentSeconds:', currentSeconds);

const parseBRT = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return new Date(d.getTime() + (utcOffset * 3600000));
};

// Check some order counts
let todayOrders = 0;
let yesterdayOrders = 0;
let sevenDaysOrders = 0;

for (const o of orders) {
  const creationBrt = parseBRT(o.creationDate);
  if (!creationBrt) continue;
  const dayStr = creationBrt.toISOString().slice(0, 10);
  if (dayStr === todayStr) todayOrders++;
  if (dayStr === yesterdayStr) yesterdayOrders++;
  if (dayStr === sevenDaysStr) sevenDaysOrders++;
}

console.log('Orders on Today:', todayOrders);
console.log('Orders on Yesterday:', yesterdayOrders);
console.log('Orders on 7 Days Ago:', sevenDaysOrders);
