const fs = require('fs');
const path = require('path');

const CSV_FILE = path.resolve(__dirname, '../../Analise venda Hora/detalhado_lojas_impacto_vtex.csv');
const content = fs.readFileSync(CSV_FILE, 'utf-8');
const lines = content.split('\n');

function normalize(str) {
  if (!str) return '';
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

const csvNames = {};
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const parts = line.split(',');
  if (parts.length >= 4) {
    const name = parts[0].trim();
    csvNames[normalize(name)] = name;
  }
}

// Find specific patterns
const patterns = ['franc', 'louren', 'xangri', 'sapucaia', 'amaro', 'terez', 'torres', 'cerro', 'tres coroa', 'caxias 2', 'sebastiao', 'modelo', 'uruguai', 'shopping', 'netto', 'general'];

patterns.forEach(p => {
  const matches = Object.entries(csvNames).filter(([k]) => k.includes(p));
  if (matches.length > 0) {
    console.log(`\n=== Pattern "${p}" ===`);
    matches.forEach(([norm, raw]) => console.log(`  "${raw}" (norm: "${norm}")`));
  }
});
