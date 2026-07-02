/**
 * server.js — Dashboard Diretoria C
 * Lê APENAS a aba BASE DASHBOARD do arquivo Excel.
 * Atualizar o Excel = atualizar o dashboard. Simples e rápido.
 *
 * Porta: 3005 (configurável via .env PORT=)
 * Arquivo padrão: ../ base Dashboard.xlsx
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors    = require('cors');
const XLSX    = require('xlsx');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const { Storage } = require('@google-cloud/storage');

const app  = express();
const PORT = process.env.PORT || 3005;

// Caminho padrão local
const DEFAULT_EXCEL = path.join(__dirname, '..', '..', 'base Dashboard.xlsx');
const EXCEL_PATH    = process.env.EXCEL_PATH || DEFAULT_EXCEL;

// Configuração Google Cloud Storage (GCS)
const GCS_BUCKET = process.env.GCS_BUCKET;
const FILE_NAME  = 'base Dashboard.xlsx'; // Nome fixo do arquivo no bucket
let storageClient = null;

if (GCS_BUCKET) {
  // Localmente, tenta carregar o arquivo de credenciais da pasta Downloads se existir,
  // senão utiliza Application Default Credentials (ADC) em produção
  const saKeyPath = 'C:\\Users\\lucas.alves6\\Downloads\\ga-fsj-c165e892c46a.json';
  if (fs.existsSync(saKeyPath)) {
    storageClient = new Storage({ keyFilename: saKeyPath });
  } else {
    storageClient = new Storage();
  }
  console.log(`☁️ GCS configurado: bucket = ${GCS_BUCKET}`);
}

app.use(cors());
app.use(express.json());

// ─── Helpers ───────────────────────────────────────────────────────────────
function safe(v) {
  if (v === null || v === undefined || v === '' || v === '-') return 0;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function round2(v) { return Math.round(v * 100) / 100; }
function pct(val, base)   { return base ? round2((val / base) * 100) : 0; }
function varP(cur, prev)  { return prev ? round2(((cur - prev) / prev) * 100) : 0; }

// Função para baixar a planilha do GCS
async function downloadFromGCS(destPath) {
  if (!storageClient || !GCS_BUCKET) return false;
  try {
    const bucket = storageClient.bucket(GCS_BUCKET);
    const file = bucket.file(FILE_NAME);
    const [exists] = await file.exists();
    if (!exists) {
      console.log(`⚠️ Planilha ${FILE_NAME} não encontrada no bucket GCS. Usando fallback local.`);
      return false;
    }
    await file.download({ destination: destPath });
    console.log(`☁️ Planilha baixada do GCS com sucesso.`);
    return true;
  } catch (err) {
    console.error(`❌ Erro ao baixar planilha do GCS:`, err.message);
    return false;
  }
}

// ─── Leitura do Excel (apenas BASE DASHBOARD) ───────────────────────────────
async function readExcelAsync() {
  const tmp = path.join(require('os').tmpdir(), `dash_c_${Date.now()}.xlsx`);
  
  let loaded = false;
  if (GCS_BUCKET && storageClient) {
    loaded = await downloadFromGCS(tmp);
  }
  
  if (!loaded) {
    if (!fs.existsSync(EXCEL_PATH)) {
      throw new Error(`Arquivo não encontrado: ${EXCEL_PATH}`);
    }
    fs.copyFileSync(EXCEL_PATH, tmp);
  }

  let wb;
  try {
    wb = XLSX.readFile(tmp, { cellDates: true, dense: true });
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }

  return wb;
}

// ─── Parse BASE DASHBOARD ─────────────────────────────────────────────────
function parseBASE(wb) {
  const ws = wb.Sheets['BASE DASHBOARD'];
  if (!ws) throw new Error('Aba "BASE DASHBOARD" não encontrada.');

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const header = rows[0] || [];

  function findColIndex(predicate, fallbackIndex) {
    const i = header.findIndex(predicate);
    return i >= 0 ? i : fallbackIndex;
  }

  const distIndex = findColIndex(h => /distrital/i.test(String(h)), 1);
  const coordIndex = findColIndex(h => /coordenador/i.test(String(h)), 2);
  const filialIndex = findColIndex(h => /desc_filial|filial/i.test(String(h)), 3);
  const grupoIndex = findColIndex(h => /desc_grupo|grupo/i.test(String(h)), 4);
  const linhaIndex = findColIndex(h => /desc_linha|linha/i.test(String(h)), 5);
  const metaParcIndex = findColIndex(h => /meta\s+parcial/i.test(String(h)), 7);

  // Achar coluna de Meta Total (ex: Meta Julho, Meta Agosto)
  const metaTotIndex = findColIndex(h => /^meta\s+(?!parcial)/i.test(String(h)), 6);
  const metaTotHeader = header[metaTotIndex] ? String(header[metaTotIndex]) : '';
  const currentMonth = metaTotHeader.replace(/^meta\s+/i, '').trim();

  // Se não detectar mês (ex: planilha sem formato padrão), usa fallbacks fixos para Julho
  const monthRegex = currentMonth ? new RegExp(currentMonth, 'i') : /julho/i;

  const vJul26Index = findColIndex(h => /venda/i.test(String(h)) && monthRegex.test(String(h)) && /(26|2026)$/.test(String(h)), 8);
  const vJul25Index = findColIndex(h => /venda/i.test(String(h)) && monthRegex.test(String(h)) && /(25|2025)$/.test(String(h)), 9);
  
  // Venda do mês anterior (ano atual): contém "venda", contém "26" ou "2026", mas NÃO contém o mês atual (ex: Venda Parcial junho/26)
  const vJun26Index = findColIndex(h => /venda/i.test(String(h)) && !monthRegex.test(String(h)) && /(26|2026)$/.test(String(h)), 10);

  const beJul26Index = findColIndex(h => /base\s+empresa/i.test(String(h)) && monthRegex.test(String(h)) && /(26|2026)$/.test(String(h)), 11);
  const beJul25Index = findColIndex(h => /base\s+empresa/i.test(String(h)) && monthRegex.test(String(h)) && /(25|2025)$/.test(String(h)), 12);

  const C = {
    dist:      distIndex,
    coord:     coordIndex,
    filial:    filialIndex,
    grupo:     grupoIndex,
    linha:     linhaIndex,
    metaTot:   metaTotIndex,
    metaParc:  metaParcIndex,
    vJul26:    vJul26Index,
    vJul25:    vJul25Index,
    vJun26:    vJun26Index,
    beJul26:   beJul26Index,
    beJul25:   beJul25Index,
  };

  const labelJul26 = String(header[C.vJul26] || 'Julho/26').replace('Venda Parcial ', '');
  const labelJun26 = String(header[C.vJun26] || 'Junho/26').replace('Venda Parcial ', '');

  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row[C.dist] == null) continue;

    records.push({
      dist:   String(row[C.dist]   || '').trim(),
      coord:  String(row[C.coord]  || '').trim(),
      filial: String(row[C.filial] || '').trim(),
      grupo:  String(row[C.grupo]  || '').trim(),
      linha:  String(row[C.linha]  || '').trim(),
      mt:     safe(row[C.metaTot]),
      mp:     safe(row[C.metaParc]),
      v26:    safe(row[C.vJul26]),
      v25:    safe(row[C.vJul25]),
      jun:    safe(row[C.vJun26]),
      be26:   safe(row[C.beJul26]),
      be25:   safe(row[C.beJul25]),
    });
  }

  return {
    records,
    label_mes_atual: labelJul26,
    label_mes_ant:   labelJun26,
    arquivo:         path.basename(EXCEL_PATH),
    lido_em:         new Date().toISOString(),
  };
}

// ─── Agregação de registros ──────────────────────────────────────────────────
function aggregate(records) {
  const dists    = {};
  const coords   = {};
  const grupos   = {};
  const linhas   = {};  // key = "grupo||linha" para manter relação
  const filiais  = {};
  const cdDist   = {};  // coordenador → distrital
  const flCoord  = {};  // filial → coordenador
  const lgMap    = {};  // linha → grupo (primeiro grupo encontrado)
  
  let gt = { 
    mt:0, mp:0, v26:0, v25:0, jun:0, be26:0, be25:0,
    v26_eb:0, be26_eb:0, v25_eb:0, be25_eb:0 
  };

  for (const r of records) {
    const { dist, coord, filial, grupo, linha, mt, mp, v26, v25, jun, be26, be25 } = r;

    function add(map, key) {
      if (!map[key]) {
        map[key] = { 
          mt:0, mp:0, v26:0, v25:0, jun:0, be26:0, be25:0,
          v26_eb:0, be26_eb:0, v25_eb:0, be25_eb:0 
        };
      }
      map[key].mt  += mt;
      map[key].mp  += mp;
      map[key].v26 += v26;
      map[key].v25 += v25;
      map[key].jun += jun;
      map[key].be26+= be26;
      map[key].be25+= be25;
      
      if (be26 > 0) {
        map[key].v26_eb  += v26;
        map[key].be26_eb += be26;
      }
      if (be25 > 0) {
        map[key].v25_eb  += v25;
        map[key].be25_eb += be25;
      }
    }

    gt.mt  += mt;
    gt.mp  += mp;
    gt.v26 += v26;
    gt.v25 += v25;
    gt.jun += jun;
    gt.be26+= be26;
    gt.be25+= be25;

    if (be26 > 0) {
      gt.v26_eb  += v26;
      gt.be26_eb += be26;
    }
    if (be25 > 0) {
      gt.v25_eb  += v25;
      gt.be25_eb += be25;
    }

    if (dist)   { add(dists,   dist); }
    if (coord)  { add(coords,  coord); cdDist[coord] = dist; }
    if (filial) { add(filiais, filial); flCoord[filial] = coord; }
    if (grupo)  { add(grupos,  grupo); }
    // Agrupa linhas por grupo: chave composta para manter relação
    if (linha) {
      const linhaKey = grupo ? `${grupo}||${linha}` : linha;
      add(linhas, linhaKey);
      if (!lgMap[linhaKey]) lgMap[linhaKey] = grupo || '';
    }
  }

  function m(v) {
    return {
      meta_total:       round2(v.mt),
      meta_parcial:     round2(v.mp),
      venda_jul26:     round2(v.v26),
      venda_jul25:     round2(v.v25),
      venda_jun26:     round2(v.jun),
      base_emp_jul26:  round2(v.be26),
      base_emp_jul25:  round2(v.be25),
      pct_meta_total:   pct(v.v26, v.mt),
      pct_meta_parcial: pct(v.v26, v.mp),
      evol_yoy:         varP(v.v26, v.v25),
      evol_mom:         varP(v.v26, v.jun),
      pct_ecomm_jul26:  pct(v.v26_eb, v.be26_eb),
      pct_ecomm_jul25:  pct(v.v25_eb, v.be25_eb),
    };
  }

  return {
    total: m(gt),
    distritoriais: Object.entries(dists).map(([nome, v]) => ({
      nome, ...m(v),
    })),
    coordenadores: Object.entries(coords).map(([nome, v]) => ({
      nome, distrital: cdDist[nome] || '', ...m(v),
    })),
    filiais: Object.entries(filiais).map(([nome, v]) => ({
      nome, coordenador: flCoord[nome] || '', ...m(v),
    })),
    grupos: Object.entries(grupos).map(([nomeOrig, v]) => ({
      nome:         nomeOrig.replace(/\(\d+\)$/, '').trim(),
      nomeOriginal: nomeOrig,
      ...m(v),
    })),
    linhas: Object.entries(linhas).map(([key, v]) => {
      const sep = key.indexOf('||');
      const grupoNome = sep >= 0 ? key.substring(0, sep).replace(/\(\d+\)$/, '').trim() : (lgMap[key] || '');
      const linhaName = sep >= 0 ? key.substring(sep + 2) : key;
      return {
        nome: linhaName,
        grupo: grupoNome,
        ...m(v),
      };
    }),
  };
}

// ─── Cache em memória ───────────────────────────────────────────────────────
let cache = { data: null, ts: 0 };
const CACHE_TTL_MS = 30_000; // 30 segundos

async function getCached() {
  const now = Date.now();
  if (cache.data && (now - cache.ts) < CACHE_TTL_MS) return cache.data;
  const rawExcel = await readExcelAsync();
  const data = parseBASE(rawExcel);
  cache = { data, ts: now };
  console.log(`[cache] dados brutos carregados às ${new Date().toLocaleTimeString('pt-BR')} — ${data.records.length} linhas de registro`);
  return data;
}

function clearCache() { cache = { data: null, ts: 0 }; }

// ─── Filtro pós-cache ───────────────────────────────────────────────────────
function applyFilters(full, filters) {
  const { distrital, coordenador, filial } = filters;

  let records = full.records;

  // Filtragem sequencial
  if (distrital && distrital !== 'all') {
    records = records.filter(r => r.dist === distrital);
  }
  if (coordenador && coordenador !== 'all') {
    records = records.filter(r => r.coord === coordenador);
  }
  if (filial && filial !== 'all') {
    records = records.filter(r => r.filial === filial);
  }

  const globalAgg = aggregate(full.records);
  const filteredAgg = aggregate(records);

  return {
    total:          globalAgg.total,
    filtered_total: filteredAgg.total,
    distritoriais:  filteredAgg.distritoriais,
    coordenadores:  filteredAgg.coordenadores,
    filiais:        filteredAgg.filiais,
    grupos:         filteredAgg.grupos,
    linhas:         filteredAgg.linhas,
    label_mes_atual: full.label_mes_atual,
    label_mes_ant:   full.label_mes_ant,
    arquivo:         full.arquivo,
    lido_em:         full.lido_em,
  };
}

// ─── Rotas ─────────────────────────────────────────────────────────────────
const upload = multer({ dest: require('os').tmpdir() });
const UPLOAD_TOKEN = process.env.UPLOAD_TOKEN || 'sjcomercial';

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const token = req.body.token;
    if (token !== UPLOAD_TOKEN) {
      return res.status(401).json({ status: 'error', error: 'Senha incorreta para upload.' });
    }

    if (!req.file) {
      return res.status(400).json({ status: 'error', error: 'Nenhum arquivo enviado.' });
    }

    const localTempPath = req.file.path;

    // Validar se o arquivo é um Excel válido
    try {
      const testWb = XLSX.readFile(localTempPath, { sheetRows: 1 });
      if (!testWb.SheetNames.includes('BASE DASHBOARD')) {
        throw new Error('Aba "BASE DASHBOARD" não encontrada na planilha.');
      }
    } catch (err) {
      try { fs.unlinkSync(localTempPath); } catch (_) {}
      return res.status(400).json({ status: 'error', error: `Arquivo Excel inválido: ${err.message}` });
    }

    // Salvar no GCS se configurado, ou substituir arquivo local
    if (GCS_BUCKET && storageClient) {
      try {
        console.log(`☁️ Enviando nova planilha para o GCS gs://${GCS_BUCKET}/${FILE_NAME}...`);
        const bucket = storageClient.bucket(GCS_BUCKET);
        await bucket.upload(localTempPath, {
          destination: FILE_NAME,
          metadata: { cacheControl: 'no-cache' }
        });
        console.log(`☁️ Planilha salva no GCS.`);
      } catch (gcsErr) {
        try { fs.unlinkSync(localTempPath); } catch (_) {}
        throw new Error(`Erro ao salvar no Google Cloud Storage: ${gcsErr.message}`);
      }
    } else {
      console.log(`💾 Salvando planilha localmente em ${EXCEL_PATH}...`);
      fs.copyFileSync(localTempPath, EXCEL_PATH);
    }

    try { fs.unlinkSync(localTempPath); } catch (_) {}
    clearCache();

    res.json({ status: 'ok', msg: 'Planilha atualizada com sucesso!' });
  } catch (err) {
    console.error('[/api/upload] Erro:', err.message);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/api/metas', async (req, res) => {
  try {
    const full = await getCached();
    const filters = {
      distrital:   req.query.distrital   || 'all',
      coordenador: req.query.coordenador || 'all',
      filial:      req.query.filial      || 'all',
    };
    const data = applyFilters(full, filters);

    // Calcular as opções globais de filtros e seus relacionamentos
    const globalAgg = aggregate(full.records);
    const options = {
      distritoriais: globalAgg.distritoriais.map(d => ({ nome: d.nome })),
      coordenadores: globalAgg.coordenadores.map(c => ({ nome: c.nome, distrital: c.distrital })),
      filiais: globalAgg.filiais.map(f => ({ nome: f.nome, coordenador: f.coordenador }))
    };

    res.json({ status: 'ok', data, filters, options, cache_age_ms: Date.now() - cache.ts });
  } catch (err) {
    console.error('[/api/metas] Erro:', err.message);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/api/detalhes', async (req, res) => {
  try {
    const full = await getCached();
    const filters = {
      distrital:   req.query.distrital   || 'all',
      coordenador: req.query.coordenador || 'all',
      filial:      req.query.filial      || 'all',
    };
    const data = applyFilters(full, filters);
    res.json({
      status:   'ok',
      grupos:   data.grupos,
      linhas:   data.linhas,
      filiais:  data.filiais,
      total:    data.grupos.reduce((s, g) => s + 1, 0),
      label_mes_atual: data.label_mes_atual,
      label_mes_ant:   data.label_mes_ant,
    });
  } catch (err) {
    console.error('[/api/detalhes] Erro:', err.message);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/api/filtros', async (req, res) => {
  try {
    const full = await getCached();
    const globalAgg = aggregate(full.records);
    res.json({
      status:        'ok',
      distritoriais:  globalAgg.distritoriais.map(d => d.nome).sort(),
      coordenadores:  globalAgg.coordenadores.map(c => c.nome).sort(),
      filiais:        globalAgg.filiais.map(f => f.nome).sort(),
    });
  } catch (err) {
    console.error('[/api/filtros] Erro:', err.message);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Limpar cache + recarregar (para botão de refresh)
app.post('/api/refresh', async (req, res) => {
  clearCache();
  try {
    const full = await getCached();
    res.json({ status: 'ok', msg: 'Cache limpo e dados recarregados', rows: full.filiais.length });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status:        'ok',
    excel_path:    EXCEL_PATH,
    excel_exists:  fs.existsSync(EXCEL_PATH),
    port:          PORT,
    cache_age_ms:  cache.ts ? Date.now() - cache.ts : null,
  });
});

// Servir arquivos estáticos do frontend React compilados (pasta dist)
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  console.log(`🌐 Servindo frontend estático de: ${distPath}`);
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log(`⚠️ Pasta dist do frontend não encontrada. Rodando apenas em modo API.`);
}

app.listen(PORT, () => {
  console.log(`\n🚀 Dashboard Diretoria C — http://localhost:${PORT}`);
  console.log(`📊 Excel: ${EXCEL_PATH}`);
  console.log(`   Existe: ${fs.existsSync(EXCEL_PATH) ? '✅' : '❌'}\n`);
});
