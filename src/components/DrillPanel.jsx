import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, TrendingDown, Upload, RefreshCw, ChevronDown, X } from 'lucide-react';
import API from '../api';

// ── Formatadores ────────────────────────────────────────────────────────────
const fmtR = v => {
  if (v == null || v === '') return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(2).replace('.', ',') + 'M';
  if (abs >= 1_000)     return (v / 1_000).toFixed(1).replace('.', ',') + 'K';
  return Number(v).toFixed(0);
};
const fmtPct = v => v == null ? '—' : `${Number(v).toFixed(1).replace('.', ',')}%`;
const fmtEvol = v => {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + Number(v).toFixed(1).replace('.', ',') + '%';
};

// ── Cores ───────────────────────────────────────────────────────────────────
const cEvol = v => v == null ? '#94a3b8' : v >= 0 ? '#059669' : '#dc2626';
const cMeta = v => {
  if (v == null) return '#94a3b8';
  if (v >= 90) return '#059669';
  if (v >= 60) return '#d97706';
  return '#dc2626';
};
const desvioAbs = (venda, meta) => (venda != null && meta != null) ? venda - meta : null;
const desvioPct = (venda, meta) => (meta && meta !== 0) ? ((venda - meta) / meta) * 100 : null;

// ── KPI Block ───────────────────────────────────────────────────────────────
function KpiBlock({ label, value, evol, evolLabel, highlight }) {
  const ec = cEvol(evol);
  return (
    <div style={{
      flex: 1, minWidth: 140,
      padding: '15px 18px',
      borderRight: '1px solid #e2e8f0',
      background: highlight ? '#0f2050' : '#fff',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: highlight ? 'rgba(255,255,255,0.55)' : '#64748b' }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 21, fontWeight: 800, lineHeight: 1, color: highlight ? '#fff' : '#0f2050' }}>
          {value}
        </span>
        {evol != null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: highlight ? (evol >= 0 ? '#6ee7b7' : '#fca5a5') : ec }}>
            {fmtEvol(evol)}
            {evolLabel && <span style={{ fontWeight: 400, fontSize: 10, color: highlight ? 'rgba(255,255,255,0.4)' : '#94a3b8', marginLeft: 3 }}>{evolLabel}</span>}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Barra de Meta ───────────────────────────────────────────────────────────
function MetaBar({ pct }) {
  const c = cMeta(pct);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 100 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct || 0, 100)}%`, background: c, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: c, minWidth: 44, textAlign: 'right' }}>{fmtPct(pct)}</span>
    </div>
  );
}

// ── Célula Evolução ─────────────────────────────────────────────────────────
function Evol({ v }) {
  if (v == null) return <span style={{ color: '#94a3b8' }}>—</span>;
  const color = cEvol(v);
  const Icon = v >= 0 ? TrendingUp : TrendingDown;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color, fontWeight: 700, fontSize: 12 }}>
      <Icon size={11} />{fmtEvol(v)}
    </span>
  );
}

// ── Célula Desvio ───────────────────────────────────────────────────────────
function Desvio({ venda, meta }) {
  const abs = desvioAbs(venda, meta);
  const pct = desvioPct(venda, meta);
  if (abs == null) return <span style={{ color: '#94a3b8' }}>—</span>;
  const color = abs >= 0 ? '#059669' : '#dc2626';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontWeight: 700, fontSize: 12, color }}>{abs >= 0 ? '+' : ''}{fmtR(abs)}</span>
      <span style={{ fontSize: 10, color }}>{fmtEvol(pct)}</span>
    </div>
  );
}

// ── Célula Participação ─────────────────────────────────────────────────────
function Part({ pct26, pct25, labelAno }) {
  if (pct26 == null) return <span style={{ color: '#94a3b8' }}>—</span>;
  const evol = (pct25 != null) ? pct26 - pct25 : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontWeight: 700, fontSize: 12, color: '#7c3aed' }}>{fmtPct(pct26)}</span>
      {evol != null && <span style={{ fontSize: 10, color: cEvol(evol) }}>{fmtEvol(evol)} p.p.</span>}
    </div>
  );
}

// ── Dropdown de Filtro ──────────────────────────────────────────────────────
function FilterSelect({ label, value, options, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)' }}>
        {label}
      </span>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          style={{
            background: value !== 'all' ? 'rgba(123,97,255,0.25)' : 'rgba(255,255,255,0.08)',
            border: value !== 'all' ? '1px solid rgba(123,97,255,0.6)' : '1px solid rgba(255,255,255,0.2)',
            color: '#fff', borderRadius: 6, padding: '5px 28px 5px 10px',
            fontSize: 12, fontWeight: value !== 'all' ? 700 : 400,
            cursor: disabled ? 'not-allowed' : 'pointer',
            outline: 'none', appearance: 'none', minWidth: 160,
            opacity: disabled ? 0.4 : 1,
          }}
        >
          <option value="all" style={{ background: '#1e293b', color: '#fff' }}>Todos</option>
          {options.map(o => (
            <option key={o} value={o} style={{ background: '#1e293b', color: '#fff' }}>{o}</option>
          ))}
        </select>
        <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

// ── Linha da hierarquia principal ───────────────────────────────────────────
function HRow({ row, depth, expanded, hasChildren, onToggle, labelAtualAno }) {
  const bgRow = depth === 0 ? 'rgba(15,32,80,0.04)' : depth === 1 ? 'rgba(15,32,80,0.015)' : 'transparent';
  return (
    <tr
      style={{ borderBottom: '1px solid #e9eef4', background: bgRow, transition: 'background 0.1s' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.05)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = bgRow; }}
    >
      <td style={{ padding: '9px 12px 9px 0', paddingLeft: 12 + depth * 22, whiteSpace: 'nowrap', minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {hasChildren ? (
            <button onClick={onToggle} style={{
              width: 18, height: 18, borderRadius: 3,
              border: `1px solid ${depth === 0 ? '#1e3a8a' : '#94a3b8'}`,
              background: expanded ? '#1e3a8a' : '#fff',
              color: expanded ? '#fff' : '#1e3a8a',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, lineHeight: 1, flexShrink: 0,
            }}>
              {expanded ? '−' : '+'}
            </button>
          ) : (
            <span style={{ width: 18, display: 'inline-block', flexShrink: 0 }} />
          )}
          <span style={{
            fontSize: depth === 0 ? 13 : 12,
            fontWeight: depth === 0 ? 700 : depth === 1 ? 600 : 400,
            color: depth === 0 ? '#0f2050' : depth === 1 ? '#1e3a8a' : '#475569',
          }}>
            {row.nome}
          </span>
        </div>
      </td>
      <td style={td(true)}>{fmtR(row.venda_jul26)}</td>
      <td style={td()}>{fmtR(row.venda_jul25)}</td>
      <td style={td()}>{fmtR(row.meta_total)}</td>
      <td style={{ ...td(), minWidth: 130 }}><MetaBar pct={row.pct_meta_total} /></td>
      <td style={{ ...td(), minWidth: 90 }}><Desvio venda={row.venda_jul26} meta={row.meta_total} /></td>
      <td style={{ ...td(), textAlign: 'center' }}><Evol v={row.evol_yoy} /></td>
      <td style={{ ...td(), textAlign: 'center' }}><Evol v={row.evol_mom} /></td>
      <td style={{ ...td(), minWidth: 110 }}>
        <Part pct26={row.pct_ecomm_jul26} pct25={row.pct_ecomm_jul25} labelAno={labelAtualAno} />
      </td>
    </tr>
  );
}

// ── Linha de Grupo/Linha (aba Categorias) ───────────────────────────────────
function CatRow({ row, depth, expanded, hasChildren, onToggle }) {
  const bgRow = depth === 0 ? 'rgba(15,32,80,0.04)' : 'transparent';
  return (
    <tr
      style={{ borderBottom: '1px solid #e9eef4', background: bgRow, transition: 'background 0.1s' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.05)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = bgRow; }}
    >
      <td style={{ padding: '9px 12px 9px 0', paddingLeft: 12 + depth * 22, whiteSpace: 'nowrap', minWidth: 220 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {hasChildren ? (
            <button onClick={onToggle} style={{
              width: 18, height: 18, borderRadius: 3,
              border: '1px solid #1e3a8a',
              background: expanded ? '#1e3a8a' : '#fff',
              color: expanded ? '#fff' : '#1e3a8a',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, lineHeight: 1, flexShrink: 0,
            }}>
              {expanded ? '−' : '+'}
            </button>
          ) : (
            <span style={{ width: 18, display: 'inline-block', flexShrink: 0 }} />
          )}
          <span style={{
            fontSize: depth === 0 ? 13 : 12,
            fontWeight: depth === 0 ? 700 : 400,
            color: depth === 0 ? '#0f2050' : '#475569',
          }}>
            {row.nome}
          </span>
        </div>
      </td>
      <td style={td(true)}>{fmtR(row.venda_jul26)}</td>
      <td style={td()}>{fmtR(row.venda_jul25)}</td>
      <td style={td()}>{fmtR(row.meta_total)}</td>
      <td style={{ ...td(), minWidth: 130 }}><MetaBar pct={row.pct_meta_total} /></td>
      <td style={{ ...td(), minWidth: 90 }}><Desvio venda={row.venda_jul26} meta={row.meta_total} /></td>
      <td style={{ ...td(), textAlign: 'center' }}><Evol v={row.evol_yoy} /></td>
      <td style={{ ...td(), textAlign: 'center' }}>
        <span style={{ color: '#94a3b8' }}>—</span>
      </td>
    </tr>
  );
}

// ── Tabela Hierárquica ──────────────────────────────────────────────────────
function HierTable({ distritais, coordenadores, filiais, labelAtualAno }) {
  const [openDist, setOpenDist] = useState(new Set());
  const [openCoord, setOpenCoord] = useState(new Set());
  const tog = (set, setSet, key) =>
    setSet(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const sorted = [...distritais].sort((a, b) => (b.venda_jul26 || 0) - (a.venda_jul26 || 0));
  const rows = [];

  sorted.forEach(dist => {
    const isDistOpen = openDist.has(dist.nome);
    const coords = coordenadores.filter(c => c.distrital === dist.nome)
      .sort((a, b) => (b.venda_jul26 || 0) - (a.venda_jul26 || 0));

    rows.push(
      <HRow key={`d-${dist.nome}`} row={dist} depth={0} expanded={isDistOpen}
        hasChildren={coords.length > 0} onToggle={() => tog(openDist, setOpenDist, dist.nome)}
        labelAtualAno={labelAtualAno} />
    );

    if (isDistOpen) {
      coords.forEach(coord => {
        const isCoordOpen = openCoord.has(coord.nome);
        const fils = filiais.filter(f => f.coordenador === coord.nome)
          .sort((a, b) => (b.venda_jul26 || 0) - (a.venda_jul26 || 0));

        rows.push(
          <HRow key={`c-${coord.nome}`} row={coord} depth={1} expanded={isCoordOpen}
            hasChildren={fils.length > 0} onToggle={() => tog(openCoord, setOpenCoord, coord.nome)}
            labelAtualAno={labelAtualAno} />
        );

        if (isCoordOpen) {
          fils.forEach(fil =>
            rows.push(
              <HRow key={`f-${fil.nome}`} row={fil} depth={2} expanded={false}
                hasChildren={false} onToggle={null} labelAtualAno={labelAtualAno} />
            )
          );
        }
      });
    }
  });

  return <>{rows}</>;
}

// ── Tabela Grupos → Linhas ──────────────────────────────────────────────────
function CatTable({ grupos, linhas }) {
  const [openGrupo, setOpenGrupo] = useState(new Set());
  const tog = key =>
    setOpenGrupo(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // Mapear linhas por grupo
  const linhasByGrupo = useMemo(() => {
    const map = {};
    (linhas || []).forEach(l => {
      const g = l.grupo || '';
      if (!map[g]) map[g] = [];
      map[g].push(l);
    });
    return map;
  }, [linhas]);

  const sortedGrupos = [...grupos].sort((a, b) => (b.venda_jul26 || 0) - (a.venda_jul26 || 0));
  const rows = [];

  sortedGrupos.forEach(grupo => {
    const isOpen = openGrupo.has(grupo.nome);
    const grupoLinhas = (linhasByGrupo[grupo.nomeOriginal] || linhasByGrupo[grupo.nome] || [])
      .sort((a, b) => (b.venda_jul26 || 0) - (a.venda_jul26 || 0));

    rows.push(
      <CatRow key={`g-${grupo.nome}`} row={grupo} depth={0} expanded={isOpen}
        hasChildren={grupoLinhas.length > 0} onToggle={() => tog(grupo.nome)} />
    );

    if (isOpen) {
      grupoLinhas.forEach(linha =>
        rows.push(
          <CatRow key={`l-${grupo.nome}-${linha.nome}`} row={linha} depth={1}
            expanded={false} hasChildren={false} onToggle={null} />
        )
      );
    }
  });

  return <>{rows}</>;
}

// ── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function DrillPanel({ onUpload }) {
  const [data, setData] = useState(null);
  const [rawFull, setRawFull] = useState(null); // dados sem filtro para popular opções
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('hierarquia');

  // Filtros
  const [fDist, setFDist] = useState('all');
  const [fCoord, setFCoord] = useState('all');
  const [fFilial, setFFilial] = useState('all');

  const hasFilter = fDist !== 'all' || fCoord !== 'all' || fFilial !== 'all';

  const filters = { distrital: fDist, coordenador: fCoord, filial: fFilial };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Sempre busca sem filtro para ter as opções de dropdown
      const resAll = await API.getMetas({ distrital: 'all', coordenador: 'all', filial: 'all' });
      setRawFull(resAll.data);

      // Se tem filtro, busca com filtro
      if (hasFilter) {
        const res = await API.getMetas(filters);
        setData(res.data);
      } else {
        setData(resAll.data);
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [fDist, fCoord, fFilial]);

  useEffect(() => { load(); }, [load]);

  // Opções dos dropdowns (sempre do dado completo)
  const distOptions = useMemo(() =>
    [...new Set((rawFull?.distritoriais || []).map(d => d.nome))].sort(), [rawFull]);

  const coordOptions = useMemo(() =>
    [...new Set((rawFull?.coordenadores || [])
      .filter(c => fDist === 'all' || c.distrital === fDist)
      .map(c => c.nome))].sort(), [rawFull, fDist]);

  const filialOptions = useMemo(() => {
    const allFiliais = rawFull?.filiais || [];
    const allCoords = rawFull?.coordenadores || [];
    return [...new Set(allFiliais
      .filter(f => {
        if (fCoord !== 'all') return f.coordenador === fCoord;
        if (fDist !== 'all') {
          const coord = allCoords.find(c => c.nome === f.coordenador);
          return coord && coord.distrital === fDist;
        }
        return true;
      })
      .map(f => f.nome))].sort();
  }, [rawFull, fDist, fCoord]);

  const t = data?.filtered_total || data?.total || {};
  const labelAtual    = data?.label_mes_atual || 'Jul/26';
  const labelAtualAno = labelAtual.replace(/(\d{2})$/, m => String(Number(m) - 1).padStart(2, '0'));
  const labelAnt      = data?.label_mes_ant || 'Jun/26';

  const distritais    = data?.distritoriais || [];
  const coordenadores = data?.coordenadores || [];
  const filiais       = data?.filiais || [];
  const grupos        = data?.grupos || [];
  const linhas        = data?.linhas || [];

  const tDesvio   = desvioAbs(t.venda_jul26, t.meta_total);
  const tPartEvol = (t.pct_ecomm_jul26 != null && t.pct_ecomm_jul25 != null) ? t.pct_ecomm_jul26 - t.pct_ecomm_jul25 : null;

  const COLS_HIER = [
    `Venda E-comm\n${labelAtual}`,
    `Venda\n${labelAtualAno}`,
    'Meta',
    '% Meta',
    'Desvio da Meta',
    `Crescimento\nYoY vs ${labelAtualAno}`,
    `Evolução\nMoM vs ${labelAnt}`,
    'Part. Digital',
  ];

  const COLS_CAT = [
    `Venda E-comm\n${labelAtual}`,
    `Venda\n${labelAtualAno}`,
    'Meta',
    '% Meta',
    'Desvio da Meta',
    `Crescimento\nYoY vs ${labelAtualAno}`,
    'MoM',
  ];
      {/* ── Topbar ── */}
      <div style={{
        background: '#0f2050', color: '#fff', padding: '0 24px',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
      }}>
        {/* Linha 1: título e botões */}
        <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 6, background: '#e91e8c',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 900, color: '#fff',
            }}>SJ</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Dashboard E-Commerce — Diretoria C</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                {data?.arquivo || 'base Dashboard.xlsx'} · {labelAtual}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onUpload && (
              <button onClick={onUpload} style={btnS}>
                <Upload size={13} /> Atualizar Excel
              </button>
            )}
            <button onClick={load} title="Recarregar" style={{ ...btnS, padding: '5px 8px' }}>
              <RefreshCw size={13} className={loading ? 'spinning' : ''} />
            </button>
          </div>
        </div>

        {/* Linha 2: Filtros */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 16,
          paddingBottom: 10, paddingTop: 4, flexWrap: 'wrap',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.4)', marginRight: 4 }}>
            Filtros:
          </span>
          <FilterSelect
            label="Distrital"
            value={fDist}
            options={distOptions}
            onChange={v => { setFDist(v); setFCoord('all'); setFFilial('all'); }}
          />
          <FilterSelect
            label="Coordenação"
            value={fCoord}
            options={coordOptions}
            disabled={distOptions.length === 0}
            onChange={v => { setFCoord(v); setFFilial('all'); }}
          />
          <FilterSelect
            label="Filial"
            value={fFilial}
            options={filialOptions}
            disabled={coordOptions.length === 0 && distOptions.length === 0}
            onChange={v => setFFilial(v)}
          />
          {hasFilter && (
            <button
              onClick={() => { setFDist('all'); setFCoord('all'); setFFilial('all'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                color: '#fca5a5', borderRadius: 6, padding: '5px 10px',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', marginBottom: 0, alignSelf: 'flex-end',
              }}
            >
              <X size={11} /> Limpar filtros
            </button>
          )}

          {/* Chips de filtro ativo */}
          {hasFilter && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 4 }}>
              {fDist !== 'all' && <span style={chip}>{fDist}</span>}
              {fCoord !== 'all' && <span style={chip}>{fCoord}</span>}
              {fFilial !== 'all' && <span style={chip}>{fFilial}</span>}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 24px', maxWidth: 1700, margin: '0 auto' }}>

        {/* ── KPIs ── */}
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '6px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, color: '#64748b', textAlign: 'right' }}>
            Período: <strong style={{ color: '#0f2050' }}>{labelAtual}</strong>
            &nbsp;·&nbsp; vs Ano Ant.: <strong>{labelAtualAno}</strong>
            &nbsp;·&nbsp; vs Mês Ant.: <strong>{labelAnt}</strong>
            {hasFilter && <span style={{ marginLeft: 12, color: '#7c3aed', fontWeight: 700 }}>• Dados filtrados</span>}
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
            <KpiBlock label={`Venda E-commerce — ${labelAtual}`} value={loading ? '...' : fmtR(t.venda_jul26)} evol={t.evol_yoy} evolLabel={`vs ${labelAtualAno}`} />
            <KpiBlock label={`Venda Ano Anterior — ${labelAtualAno}`} value={loading ? '...' : fmtR(t.venda_jul25)} />
            <KpiBlock label={`Mês Anterior — ${labelAnt}`} value={loading ? '...' : fmtR(t.venda_jun26)} evol={t.evol_mom} evolLabel="MoM" />
            <KpiBlock label="% Participação Digital" value={loading ? '...' : fmtPct(t.pct_ecomm_jul26)} evol={tPartEvol} evolLabel={`p.p. vs ${labelAtualAno}`} />
            <KpiBlock label="% Meta Atingida" value={loading ? '...' : fmtPct(t.pct_meta_total)} highlight />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <KpiBlock label="Meta Total" value={loading ? '...' : fmtR(t.meta_total)} />
            <KpiBlock label="Meta Parcial" value={loading ? '...' : fmtR(t.meta_parcial)} />
            <KpiBlock label="Desvio da Meta (R$)" value={loading ? '...' : (tDesvio != null ? (tDesvio >= 0 ? '+' : '') + fmtR(tDesvio) : '—')} evol={desvioPct(t.venda_jul26, t.meta_total)} />
            <KpiBlock label="Crescimento YoY" value={loading ? '...' : fmtEvol(t.evol_yoy)} evol={t.evol_yoy} evolLabel={`vs ${labelAtualAno}`} />
            <KpiBlock label="Evolução MoM" value={loading ? '...' : fmtEvol(t.evol_mom)} evol={t.evol_mom} evolLabel={`vs ${labelAnt}`} />
          </div>
        </div>

        {/* ── Erro ── */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', marginBottom: 12, fontSize: 13 }}>
            Erro: {error} · <button onClick={load} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Tentar novamente</button>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 0 }}>
          {[
            { key: 'hierarquia', label: 'Hierarquia — Distrital · Coord. · Filial' },
            { key: 'categorias', label: 'Grupos / Categorias → Linhas' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: '8px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: activeTab === tab.key ? '#fff' : 'rgba(255,255,255,0.5)',
              border: '1px solid #e2e8f0',
              borderBottom: activeTab === tab.key ? '1px solid #fff' : '1px solid #e2e8f0',
              borderRadius: '6px 6px 0 0',
              color: activeTab === tab.key ? '#0f2050' : '#64748b',
              position: 'relative', bottom: -1,
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tabela ── */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0 6px 6px 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f2050' }}>
              {activeTab === 'hierarquia' ? 'Desempenho E-Commerce — Hierarquia Organizacional' : 'Desempenho E-Commerce — Grupos e Linhas de Produtos'}
            </span>
            <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', borderRadius: 4, padding: '2px 8px' }}>
              {activeTab === 'hierarquia'
                ? `${distritais.length} distritais · ${coordenadores.length} coords · ${filiais.length} filiais`
                : `${grupos.length} grupos`}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={th('left', 200)}>
                    {activeTab === 'hierarquia' ? 'Distrital / Coordenador / Filial' : 'Grupo / Linha'}
                  </th>
                  {(activeTab === 'hierarquia' ? COLS_HIER : COLS_CAT).map((c, i) => (
                    <th key={i} style={th('right')}>
                      {c.split('\n').map((l, j) => <div key={j} style={{ lineHeight: 1.3 }}>{l}</div>)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {Array.from({ length: activeTab === 'hierarquia' ? 9 : 8 }).map((_, j) => (
                        <td key={j} style={{ padding: 12 }}>
                          <div style={{ height: 13, borderRadius: 3, background: '#f1f5f9', opacity: 0.7 }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : activeTab === 'hierarquia' ? (
                  distritais.length === 0 ? (
                    <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                      Nenhum dado disponível. Carregue um arquivo Excel atualizado.
                    </td></tr>
                  ) : (
                    <HierTable
                      distritais={distritais}
                      coordenadores={coordenadores}
                      filiais={filiais}
                      labelAtualAno={labelAtualAno}
                    />
                  )
                ) : (
                  grupos.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Sem dados de categorias.</td></tr>
                  ) : (
                    <CatTable grupos={grupos} linhas={linhas} />
                  )
                )}
              </tbody>

              {/* Totais */}
              {!loading && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                    <td style={{ padding: '10px 12px 10px 16px', fontWeight: 800, color: '#0f2050', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      TOTAL GERAL
                    </td>
                    <td style={td(true)}>{fmtR(t.venda_jul26)}</td>
                    <td style={td()}>{fmtR(t.venda_jul25)}</td>
                    <td style={td()}>{fmtR(t.meta_total)}</td>
                    <td style={{ ...td(), minWidth: 130 }}><MetaBar pct={t.pct_meta_total} /></td>
                    <td style={{ ...td(), minWidth: 90 }}><Desvio venda={t.venda_jul26} meta={t.meta_total} /></td>
                    <td style={{ ...td(), textAlign: 'center' }}><Evol v={t.evol_yoy} /></td>
                    <td style={{ ...td(), textAlign: 'center' }}><Evol v={t.evol_mom} /></td>
                    {activeTab === 'hierarquia' && (
                      <td style={{ ...td(), minWidth: 110 }}>
                        <Part pct26={t.pct_ecomm_jul26} pct25={t.pct_ecomm_jul25} />
                      </td>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {!loading && (
            <div style={{ padding: '8px 16px', borderTop: '1px solid #f1f5f9', fontSize: 11, color: '#94a3b8', background: '#fafafa' }}>
              {activeTab === 'hierarquia'
                ? '💡 Clique no + ao lado do nome para expandir a hierarquia: Distrital → Coordenação → Filial'
                : '💡 Clique no + ao lado do grupo para ver as Linhas de Produto dentro de cada Grupo'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Estilos base ─────────────────────────────────────────────────────────────
const td = (bold) => ({
  padding: '9px 12px', textAlign: 'right', fontSize: 12,
  fontWeight: bold ? 700 : 400, color: bold ? '#0f2050' : '#475569',
  verticalAlign: 'middle', whiteSpace: 'nowrap',
});
const th = (align = 'right', minW) => ({
  padding: '9px 12px', textAlign: align, fontSize: 10,
  fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
  letterSpacing: '0.05em', whiteSpace: 'nowrap', minWidth: minW,
});
const btnS = {
  display: 'flex', alignItems: 'center', gap: 6,
  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
  color: '#fff', borderRadius: 6, padding: '5px 12px',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const chip = {
  fontSize: 11, fontWeight: 600,
  background: 'rgba(123,97,255,0.2)', border: '1px solid rgba(123,97,255,0.4)',
  color: '#c4b5fd', borderRadius: 4, padding: '2px 8px',
};
