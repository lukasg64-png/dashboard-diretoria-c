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

// Unmatched VTEX names
const vtexNames = [
  'STA MARIA 9', 'SAPUCAIA 6', 'SAO FRANC ASSIS 1', 'SAPUCAIA 9', 'SAPUCAIA 7',
  'SAPUCAIA 5', 'STO AMARO 2', 'SAO FRANC PAULA 3', 'SAO FRANC PAULA 2',
  'JULIO CASTILHOS 1', 'TAPEJARA 1 PR', 'TRES COROAS 1', 'PF MODELO',
  'BELA VISTA PARAISO 1', 'MAFRA 01', 'PF URUGUAI 02', 'SAO LOUREN DO SUL 1',
  'SARANDI 1 RS', 'Porto Alegre 06', 'VENANCIO 3', 'SAO SEBASTIAO CAI 1',
  'SAPUCAIA 8', 'SAO JOSE 7-SC', 'SARANDI 2 RS', 'SAO JOSE DO NORTE 1',
  'S MIGUEL IGUACU 1', 'SAO JOSE 8-SC', 'CAXIAS 37', 'SAO FRANC PAULA 1',
  'SAPUCAIA 2', 'PALMAS 2 PR', 'PALMAS 1 PR', 'ROSARIO 2', 'SAO JOSE 9-SC',
  'CANOAS 9', 'STO ANT MISSOES 1NOV', 'STA TEREZ DE ITAIPU1', 'VENANCIO 2',
  'VENANCIO 8', 'SAO PEDRO SUL 1 NV', 'QUEDAS IGUACU 1', 'VENANCIO 1', 'PF',
  'CERRO GRANDE DO SUL1', 'SAO JOSE DO NORTE 2', 'COLORADO 1', 'STO AMARO 1',
  'ENCRUZILHADA DO SUL1', 'PORTO ALEGRE 72', 'SAO LOUREN DO SUL 3', 'TORRES 7',
  'SAO LOUREN DO SUL 2', 'PF SHOPPING BELLA', 'SAPUCAIA 1', 'VENANCIO 4',
  'PF GENERAL NETTO 1', 'SAO MIGUEL DO OESTE1', 'XANGRI-LA 1', 'sjdigital1601',
  'SARANDI 3 RS', 'PALMEIRA 1 PR', 'ROSARIO 1', 'Gruarapuava 2',
  'CRUZEIRO OESTE 1', 'SAO LOUREN OESTE 1', 'VENANCIO 6', 'XANGRI-LA 5',
  'Cachoeira do Sul 9', 'REALEZA 1 PR', 'JULIO CASTILHOS 2', 'XANGRI-LA 4',
  'SAO SEBASTIAO CAI 2', 'BALN ARROIO SILVA 1', 'CAXIAS 21'
];

// Try to find close matches
vtexNames.forEach(vn => {
  const normV = normalize(vn);
  
  // Try direct
  if (csvNames[normV]) {
    console.log(`[EXACT] "${vn}" -> "${csvNames[normV]}"`);
    return;
  }
  
  // Find closest
  const csvKeys = Object.keys(csvNames);
  const candidates = csvKeys.filter(k => {
    const firstWord = normV.split(' ')[0];
    return k.includes(firstWord);
  });
  
  if (candidates.length > 0) {
    const sorted = candidates.sort((a, b) => {
      // Prefer closer length
      return Math.abs(a.length - normV.length) - Math.abs(b.length - normV.length);
    });
    console.log(`[MISS] "${vn}" (norm: "${normV}") -> closest CSV: ${sorted.slice(0, 3).map(k => `"${csvNames[k]}" (norm: "${k}")`).join(', ')}`);
  } else {
    console.log(`[MISS] "${vn}" (norm: "${normV}") -> NO close CSV match`);
  }
});
