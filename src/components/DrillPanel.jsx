import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TrendingUp, TrendingDown, Upload, RefreshCw, ChevronDown, X, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import API from '../api';
import GeoMapPage from './GeoMapPage';

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
const fmtCurrency = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
const fmtCurrency1 = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v || 0);
const fmtInteger = v => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v || 0);

// ── Cores ───────────────────────────────────────────────────────────────────
const cEvol = v => v == null ? '#94a3b8' : v >= 0 ? '#059669' : '#dc2626';
const cMeta = v => {
  if (v == null) return '#94a3b8';
  if (v >= 90) return '#059669';
  if (v >= 60) return '#d97706';
  return '#dc2626';
};
const desvioAbs = (venda, meta) => (venda != null && meta != null) ? venda - meta : null;
const desvioPct = (venda, meta) => (venda != null && meta && meta !== 0) ? ((venda - meta) / meta) * 100 : null;

const renderCustomLabel = (props) => {
  const { x, y, width, value } = props;
  if (value === 0 || value == null) return null;
  const yOffset = value >= 0 ? -6 : 12;
  const color = value >= 0 ? '#059669' : '#dc2626';
  return (
    <text 
      x={x + width / 2} 
      y={y + yOffset} 
      fill={color} 
      textAnchor="middle" 
      style={{ fontSize: 9, fontWeight: 700 }}
    >
      {value > 0 ? '+' : ''}{fmtR(value)}
    </text>
  );
};

const renderCustomPctLabel = (props) => {
  const { x, y, width, value } = props;
  if (value == null) return null;
  const yOffset = value >= 0 ? -6 : 12;
  const color = value >= 0 ? '#059669' : '#dc2626';
  return (
    <text 
      x={x + width / 2} 
      y={y + yOffset} 
      fill={color} 
      textAnchor="middle" 
      style={{ fontSize: 9, fontWeight: 700 }}
    >
      {fmtEvol(value)}
    </text>
  );
};

const renderCustomPartLabel = (props) => {
  const { x, y, width, value } = props;
  if (value == null) return null;
  const payload = props.payload;
  const diff = payload ? payload.diff_pp : null;
  const diffStr = diff != null ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1).replace('.', ',')} pp` : '';
  const diffColor = diff > 0 ? '#059669' : diff < 0 ? '#dc2626' : '#64748b';

  return (
    <g>
      <text 
        x={x + width / 2} 
        y={y - 12} 
        fill="#0f2050" 
        textAnchor="middle" 
        style={{ fontSize: 8, fontWeight: 700 }}
      >
        {Number(value).toFixed(1).replace('.', ',')}%
      </text>
      {diff != null && (
        <text 
          x={x + width / 2} 
          y={y - 2} 
          fill={diffColor} 
          textAnchor="middle" 
          style={{ fontSize: 8, fontWeight: 700 }}
        >
          {diffStr}
        </text>
      )}
    </g>
  );
};

// ── KPI Block ───────────────────────────────────────────────────────────────
function KpiBlock({ label, value, evol, evolLabel, sub, highlight }) {
  const ec = cEvol(evol);
  return (
    <div style={{
      flex: 1, minWidth: 160,
      padding: '14px 18px',
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
      {sub && (
        <span style={{ fontSize: 10, color: highlight ? 'rgba(255,255,255,0.45)' : '#94a3b8', marginTop: 2 }}>
          {sub}
        </span>
      )}
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
      <span style={{ fontSize: 11, fontWeight: 700, color: '#334155', minWidth: 44, textAlign: 'right' }}>{fmtPct(pct)}</span>
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
function Desvio({ venda, meta, badge }) {
  const abs = desvioAbs(venda, meta);
  const pct = desvioPct(venda, meta);
  if (abs == null) return <span style={{ color: '#94a3b8' }}>—</span>;
  const isPositive = abs >= 0;
  const color = isPositive ? '#047857' : '#b91c1c';
  const bg = isPositive ? '#ecfdf5' : '#fef2f2';
  const border = isPositive ? '1px solid #d1fae5' : '1px solid #fee2e2';

  if (badge) {
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <div style={{
          background: bg, border: border, color: color,
          borderRadius: 12, padding: '3px 8px', fontSize: 11, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', minWidth: 64, justifyContent: 'center'
        }}>
          {isPositive ? '+' : ''}{fmtR(abs)}
        </div>
        <span style={{ fontSize: 9, color: isPositive ? '#059669' : '#dc2626', marginTop: 2, marginRight: 4, fontWeight: 600 }}>
          {fmtEvol(pct)}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontWeight: 700, fontSize: 12, color: isPositive ? '#059669' : '#dc2626' }}>{isPositive ? '+' : ''}{fmtR(abs)}</span>
      <span style={{ fontSize: 10, color: isPositive ? '#059669' : '#dc2626' }}>{fmtEvol(pct)}</span>
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
// ── Dropdown de Filtro (Pesquisável & Multi-seleção) ──────────────────────
function FilterSelect({ label, value, options, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) setSearch('');
  }, [isOpen]);

  const selectedValues = useMemo(() => {
    if (!value || value === 'all') return [];
    return value.split(',');
  }, [value]);

  const handleToggleOption = (opt) => {
    if (opt === 'all') {
      onChange('all');
    } else {
      let nextSelected;
      if (selectedValues.includes(opt)) {
        nextSelected = selectedValues.filter(x => x !== opt);
      } else {
        nextSelected = [...selectedValues, opt];
      }
      onChange(nextSelected.length === 0 ? 'all' : nextSelected.join(','));
    }
  };

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter(o => String(o).toLowerCase().includes(lower));
  }, [options, search]);

  const displayValue = useMemo(() => {
    if (selectedValues.length === 0) return 'Todos';
    if (selectedValues.length === 1) return selectedValues[0];
    return `${selectedValues.length} selecionados`;
  }, [selectedValues]);

  const isOptionSelected = (opt) => {
    if (opt === 'all') return selectedValues.length === 0;
    return selectedValues.includes(opt);
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 3, position: 'relative' }}>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)' }}>
        {label}
      </span>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          type="button"
          style={{
            background: value !== 'all' ? 'rgba(123,97,255,0.25)' : 'rgba(255,255,255,0.08)',
            border: value !== 'all' ? '1px solid rgba(123,97,255,0.6)' : '1px solid rgba(255,255,255,0.2)',
            color: '#fff', borderRadius: 6, padding: '5px 28px 5px 10px',
            fontSize: 12, fontWeight: value !== 'all' ? 700 : 400,
            cursor: disabled ? 'not-allowed' : 'pointer',
            textAlign: 'left', minWidth: 160, maxWidth: 200,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            opacity: disabled ? 0.4 : 1, display: 'block', width: '100%',
            outline: 'none',
          }}
        >
          {displayValue}
        </button>
        <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.5)',
          zIndex: 1000, width: 250, padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
          animation: 'fadeIn 0.1s ease-out',
        }}>
          <input
            type="text"
            placeholder="Pesquisar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '6px 10px', fontSize: 12,
              background: '#0f172a', border: '1px solid #475569', borderRadius: 4,
              color: '#fff', outline: 'none', boxSizing: 'border-box'
            }}
          />
          <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 4 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
              borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#fff',
              background: isOptionSelected('all') ? 'rgba(123,97,255,0.15)' : 'transparent',
              transition: 'background 0.1s ease'
            }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = isOptionSelected('all') ? 'rgba(123,97,255,0.15)' : 'transparent'}>
              <input
                type="checkbox"
                checked={isOptionSelected('all')}
                onChange={() => handleToggleOption('all')}
                style={{ cursor: 'pointer', width: 14, height: 14 }}
              />
              <span>Todos</span>
            </label>
            {filteredOptions.map(o => (
              <label key={o} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
                borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#fff',
                background: isOptionSelected(o) ? 'rgba(123,97,255,0.2)' : 'transparent',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                transition: 'background 0.1s ease'
              }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = isOptionSelected(o) ? 'rgba(123,97,255,0.2)' : 'transparent'}>
                <input
                  type="checkbox"
                  checked={isOptionSelected(o)}
                  onChange={() => handleToggleOption(o)}
                  style={{ cursor: 'pointer', width: 14, height: 14 }}
                />
                <span title={o} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{o}</span>
              </label>
            ))}
            {filteredOptions.length === 0 && (
              <span style={{ fontSize: 11, color: '#64748b', padding: '8px 10px', textAlign: 'center' }}>Nenhum resultado</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Linha da hierarquia principal ───────────────────────────────────────────
function HRow({ row, depth, expanded, hasChildren, onToggle, labelAtualAno, viewMode, getMetrics }) {
  const bgRow = depth === 0 ? 'rgba(15,32,80,0.04)' : depth === 1 ? 'rgba(15,32,80,0.015)' : 'transparent';
  const m = getMetrics(row);
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
      {viewMode === 'venda' ? (
        <>
          <td style={td()}>{fmtR(row.meta_total)}</td>
          <td style={{ ...td(), minWidth: 130 }}><MetaBar pct={row.pct_meta_total} /></td>
          <td style={td(true)}>{fmtR(row.venda_jul26)}</td>
          <td style={td()}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: '#334155' }}>{fmtR(row.meta_parcial)}</span>
              <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 500 }}>parcial</span>
            </div>
          </td>
          <td style={{ ...td(), minWidth: 90 }}><Desvio venda={row.venda_jul26} meta={row.meta_parcial} badge /></td>
          <td style={td()}>{fmtR(row.venda_jul25)}</td>
          <td style={{ ...td(), textAlign: 'center' }}><Evol v={row.evol_yoy} /></td>
          <td style={{ ...td(), textAlign: 'center' }}><Evol v={row.evol_mom} /></td>
          <td style={{ ...td(), minWidth: 110 }}>
            <Part pct26={row.pct_ecomm_jul26} pct25={row.pct_ecomm_jul25} labelAno={labelAtualAno} />
          </td>
        </>
      ) : (
        <>
          <td style={td(true)}>{m.fmt(m.val26)}</td>
          <td style={td()}>{m.fmt(m.val25)}</td>
          <td style={{ ...td(), textAlign: 'center' }}><Evol v={m.yoy} /></td>
          <td style={td()}>{m.fmt(m.valJun)}</td>
          <td style={{ ...td(), textAlign: 'center' }}><Evol v={m.mom} /></td>
        </>
      )}
    </tr>
  );
}

// ── Linha de Grupo/Linha (aba Categorias) ───────────────────────────────────
function CatRow({ row, depth, expanded, hasChildren, onToggle, labelAtualAno, viewMode, getMetrics }) {
  const bgRow = depth === 0 ? 'rgba(15,32,80,0.04)' : 'transparent';
  const m = getMetrics(row);
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
      {viewMode === 'venda' ? (
        <>
          <td style={td()}>{fmtR(row.meta_total)}</td>
          <td style={{ ...td(), minWidth: 130 }}><MetaBar pct={row.pct_meta_total} /></td>
          <td style={td(true)}>{fmtR(row.venda_jul26)}</td>
          <td style={td()}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: '#334155' }}>{fmtR(row.meta_parcial)}</span>
              <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 500 }}>parcial</span>
            </div>
          </td>
          <td style={{ ...td(), minWidth: 90 }}><Desvio venda={row.venda_jul26} meta={row.meta_parcial} badge /></td>
          <td style={td()}>{fmtR(row.venda_jul25)}</td>
          <td style={{ ...td(), textAlign: 'center' }}><Evol v={row.evol_yoy} /></td>
          <td style={{ ...td(), textAlign: 'center' }}><Evol v={row.evol_mom} /></td>
        </>
      ) : (
        <>
          <td style={td(true)}>{m.fmt(m.val26)}</td>
          <td style={td()}>{m.fmt(m.val25)}</td>
          <td style={{ ...td(), textAlign: 'center' }}><Evol v={m.yoy} /></td>
          <td style={td()}>{m.fmt(m.valJun)}</td>
          <td style={{ ...td(), textAlign: 'center' }}><Evol v={m.mom} /></td>
        </>
      )}
    </tr>
  );
}

// ── Tabela Hierárquica ──────────────────────────────────────────────────────
function HierTable({ distritais, coordenadores, filiais, labelAtualAno, searchTerm, viewMode, getMetrics }) {
  const [openDist, setOpenDist] = useState(new Set());
  const [openCoord, setOpenCoord] = useState(new Set());
  const tog = (set, setSet, key) =>
    setSet(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const matches = (name) => !searchTerm || name.toLowerCase().includes(searchTerm.toLowerCase());

  // Auto-expandir se houver termo de busca correspondente aos filhos
  useEffect(() => {
    if (searchTerm) {
      const distsToOpen = new Set();
      const coordsToOpen = new Set();
      
      distritais.forEach(d => {
        const cs = coordenadores.filter(c => c.distrital === d.nome);
        cs.forEach(c => {
          const fs = filiais.filter(f => f.coordenador === c.nome);
          const anyFilMatch = fs.some(f => matches(f.nome));
          if (anyFilMatch || matches(c.nome)) {
            distsToOpen.add(d.nome);
          }
          if (anyFilMatch) {
            coordsToOpen.add(c.nome);
          }
        });
      });
      
      setOpenDist(distsToOpen);
      setOpenCoord(coordsToOpen);
    }
  }, [searchTerm, distritais, coordenadores, filiais]);

  const getValForSorting = (item) => {
    if (viewMode === 'venda') return item.venda_jul26 || 0;
    if (viewMode === 'cup') return item.cupons_jul26 || 0;
    return item.cupons_jul26 ? item.venda_jul26 / item.cupons_jul26 : 0;
  };

  const sorted = [...distritais]
    .filter(d => {
      if (matches(d.nome)) return true;
      const cs = coordenadores.filter(c => c.distrital === d.nome);
      return cs.some(c => matches(c.nome) || filiais.filter(f => f.coordenador === c.nome).some(f => matches(f.nome)));
    })
    .sort((a, b) => getValForSorting(b) - getValForSorting(a));

  const rows = [];

  sorted.forEach(dist => {
    const isDistOpen = openDist.has(dist.nome);
    const coords = coordenadores
      .filter(c => c.distrital === dist.nome)
      .filter(c => {
        if (matches(c.nome) || matches(dist.nome)) return true;
        const fils = filiais.filter(f => f.coordenador === c.nome);
        return fils.some(f => matches(f.nome));
      })
      .sort((a, b) => getValForSorting(b) - getValForSorting(a));

    rows.push(
      <HRow key={`d-${dist.nome}`} row={dist} depth={0} expanded={isDistOpen}
        hasChildren={coords.length > 0} onToggle={() => tog(openDist, setOpenDist, dist.nome)}
        labelAtualAno={labelAtualAno} viewMode={viewMode} getMetrics={getMetrics} />
    );

    if (isDistOpen) {
      coords.forEach(coord => {
        const isCoordOpen = openCoord.has(coord.nome);
        const fils = filiais
          .filter(f => f.coordenador === coord.nome)
          .filter(f => matches(f.nome) || matches(coord.nome) || matches(dist.nome))
          .sort((a, b) => getValForSorting(b) - getValForSorting(a));

        rows.push(
          <HRow key={`c-${coord.nome}`} row={coord} depth={1} expanded={isCoordOpen}
            hasChildren={fils.length > 0} onToggle={() => tog(openCoord, setOpenCoord, coord.nome)}
            labelAtualAno={labelAtualAno} viewMode={viewMode} getMetrics={getMetrics} />
        );

        if (isCoordOpen) {
          fils.forEach(fil =>
            rows.push(
              <HRow key={`f-${fil.nome}`} row={fil} depth={2} expanded={false}
                hasChildren={false} onToggle={null} labelAtualAno={labelAtualAno} viewMode={viewMode} getMetrics={getMetrics} />
            )
          );
        }
      });
    }
  });

  return <>{rows}</>;
}

// ── Tabela Grupos → Linhas ──────────────────────────────────────────────────
function CatTable({ grupos, linhas, labelAtualAno, searchTerm, viewMode, getMetrics }) {
  const [openGrupo, setOpenGrupo] = useState(new Set());
  const tog = key =>
    setOpenGrupo(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const matches = (name) => !searchTerm || name.toLowerCase().includes(searchTerm.toLowerCase());

  // Auto-expandir se houver correspondência de busca nos filhos
  useEffect(() => {
    if (searchTerm) {
      const gruposToOpen = new Set();
      grupos.forEach(g => {
        const ls = linhas.filter(l => l.grupo === g.nome);
        if (ls.some(l => matches(l.nome))) {
          gruposToOpen.add(g.nome);
        }
      });
      setOpenGrupo(gruposToOpen);
    }
  }, [searchTerm, grupos, linhas]);

  const getValForSorting = (item) => {
    if (viewMode === 'venda') return item.venda_jul26 || 0;
    if (viewMode === 'cup') return item.cupons_jul26 || 0;
    return item.cupons_jul26 ? item.venda_jul26 / item.cupons_jul26 : 0;
  };

  const sortedGrupos = [...grupos]
    .filter(g => {
      if (matches(g.nome)) return true;
      const ls = linhas.filter(l => l.grupo === g.nome);
      return ls.some(l => matches(l.nome));
    })
    .sort((a, b) => getValForSorting(b) - getValForSorting(a));

  const rows = [];

  sortedGrupos.forEach(grupo => {
    const isOpen = openGrupo.has(grupo.nome);
    const grupoLinhas = linhas
      .filter(l => l.grupo === grupo.nomeOriginal || l.grupo === grupo.nome)
      .filter(l => matches(l.nome) || matches(grupo.nome))
      .sort((a, b) => getValForSorting(b) - getValForSorting(a));

    rows.push(
      <CatRow key={`g-${grupo.nome}`} row={grupo} depth={0} expanded={isOpen}
        hasChildren={grupoLinhas.length > 0} onToggle={() => tog(grupo.nome)}
        labelAtualAno={labelAtualAno} viewMode={viewMode} getMetrics={getMetrics} />
    );

    if (isOpen) {
      grupoLinhas.forEach(linha =>
        rows.push(
          <CatRow key={`l-${grupo.nome}-${linha.nome}`} row={linha} depth={1}
            expanded={false} hasChildren={false} onToggle={null}
            labelAtualAno={labelAtualAno} viewMode={viewMode} getMetrics={getMetrics} />
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
  const [apiOptions, setApiOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [noData, setNoData] = useState(false); // true quando servidor não tem planilha carregada
  const [activeTab, setActiveTab] = useState('hierarquia');
  const [showChart, setShowChart] = useState(true);
  const [chartMetric, setChartMetric] = useState('desvio');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [viewMode, setViewMode] = useState('venda'); // venda, cup, tm

  const getMetrics = useCallback((item) => {
    if (!item) return { val26: 0, val25: 0, valJun: 0, yoy: 0, mom: 0, fmt: (v) => '0' };
    
    if (viewMode === 'venda') {
      return {
        val26: item.venda_jul26 || 0,
        val25: item.venda_jul25 || 0,
        valJun: item.venda_jun26 || 0,
        yoy: item.evol_yoy || 0,
        mom: item.evol_mom || 0,
        fmt: fmtCurrency
      };
    } else if (viewMode === 'cup') {
      const c26 = item.cupons_jul26 || 0;
      const c25 = item.cupons_jul25 || 0;
      const cJun = item.cupons_jun26 || 0;
      return {
        val26: c26,
        val25: c25,
        valJun: cJun,
        yoy: c25 ? ((c26 - c25) / c25) * 100 : 0,
        mom: cJun ? ((c26 - cJun) / cJun) * 100 : 0,
        fmt: fmtInteger
      };
    } else {
      const v26 = item.venda_jul26 || 0;
      const c26 = item.cupons_jul26 || 0;
      const v25 = item.venda_jul25 || 0;
      const c25 = item.cupons_jul25 || 0;
      const vJun = item.venda_jun26 || 0;
      const cJun = item.cupons_jun26 || 0;

      const tm26 = c26 ? v26 / c26 : 0;
      const tm25 = c25 ? v25 / c25 : 0;
      const tmJun = cJun ? vJun / cJun : 0;

      return {
        val26: tm26,
        val25: tm25,
        valJun: tmJun,
        yoy: tm25 ? ((tm26 - tm25) / tm25) * 100 : 0,
        mom: tmJun ? ((tm26 - tmJun) / tmJun) * 100 : 0,
        fmt: fmtCurrency1
      };
    }
  }, [viewMode]);

  const chartMetricOptions = useMemo(() => {
    if (viewMode === 'venda') {
      return [
        { key: 'desvio', label: 'Desvio (R$)' },
        { key: 'venda_meta', label: 'Venda vs Meta' },
        { key: 'participacao', label: 'Part. Digital (%)' },
        { key: 'evolucao', label: 'Evolução YoY (%)' },
        { key: 'crescimento', label: 'Crescimento MoM (%)' },
      ];
    } else {
      const valLabel = viewMode === 'cup' ? 'Total Cupons' : 'Ticket Médio (R$)';
      return [
        { key: 'valor', label: valLabel },
        { key: 'evolucao', label: 'Evolução YoY (%)' },
        { key: 'crescimento', label: 'Crescimento MoM (%)' },
      ];
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'venda') {
      if (chartMetric !== 'evolucao' && chartMetric !== 'crescimento' && chartMetric !== 'valor') {
        setChartMetric('valor');
      }
    } else {
      if (chartMetric === 'valor') {
        setChartMetric('desvio');
      }
    }
  }, [viewMode, chartMetric]);

  // Filtros
  const [fDist, setFDist] = useState('all');
  const [fCoord, setFCoord] = useState('all');
  const [fFilial, setFFilial] = useState('all');
  const [fGrupo, setFGrupo] = useState('all');
  const [fLinha, setFLinha] = useState('all');
  const [fUF, setFUF] = useState('all');
  const [fCidade, setFCidade] = useState('all');

  const hasFilter = fDist !== 'all' || fCoord !== 'all' || fFilial !== 'all' || fGrupo !== 'all' || fLinha !== 'all' || fUF !== 'all' || fCidade !== 'all';
  const activeFiltersCount = [fDist, fCoord, fFilial, fGrupo, fLinha, fUF, fCidade].filter(f => f !== 'all').length;

  const filters = { 
    distrital: fDist, 
    coordenador: fCoord, 
    filial: fFilial, 
    grupo: fGrupo, 
    linha: fLinha,
    uf: fUF,
    cidade: fCidade
  };

  const handleCidadeChange = useCallback((v) => {
    setFCidade(v);
    if (v !== 'all' && apiOptions?.filiais) {
      const vSingle = v.split(',')[0];
      const filialMatch = apiOptions.filiais.find(f => f.municipio === vSingle);
      if (filialMatch && filialMatch.uf) {
        setFUF(filialMatch.uf);
      }
    }
  }, [apiOptions]);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setNoData(false);
    try {
      // Sempre busca sem filtro para ter as opções de dropdown
      const resAll = await API.getMetas({ 
        distrital: 'all', coordenador: 'all', filial: 'all', grupo: 'all', linha: 'all',
        uf: 'all', cidade: 'all'
      });
      
      // Checar se o servidor ainda não tem planilha
      if (resAll.status === 'no_data') {
        setNoData(true);
        setLoading(false);
        return;
      }

      setRawFull(resAll.data);
      setApiOptions(resAll.options);

      // Se tem filtro, busca com filtro
      if (hasFilter) {
        const res = await API.getMetas(filters);
        setData(res.data);
      } else {
        setData(resAll.data);
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [fDist, fCoord, fFilial, fGrupo, fLinha, fUF, fCidade]);

  useEffect(() => { load(); }, [load]);

  // Opções dos dropdowns (sempre do dado completo)
  const distOptions = useMemo(() => {
    let list = rawFull?.distritoriais || [];
    if (fUF !== 'all' && apiOptions?.filiais) {
      const ufsSelected = fUF.split(',');
      const filiaisUf = apiOptions.filiais.filter(f => ufsSelected.includes(f.uf));
      const coordsUf = new Set(filiaisUf.map(f => f.coordenador));
      const distsUf = new Set((apiOptions.coordenadores || [])
        .filter(c => coordsUf.has(c.nome))
        .map(c => c.distrital));
      list = list.filter(d => distsUf.has(d.nome));
    }
    return [...new Set(list.map(d => d.nome))].sort();
  }, [rawFull, fUF, apiOptions]);

  const coordOptions = useMemo(() => {
    let list = rawFull?.coordenadores || [];
    if (fDist !== 'all') {
      const distsSelected = fDist.split(',');
      list = list.filter(c => distsSelected.includes(c.distrital));
    }
    if (fUF !== 'all' && apiOptions?.filiais) {
      const ufsSelected = fUF.split(',');
      const filiaisUf = apiOptions.filiais.filter(f => ufsSelected.includes(f.uf));
      const coordsUf = new Set(filiaisUf.map(f => f.coordenador));
      list = list.filter(c => coordsUf.has(c.nome));
    }
    return [...new Set(list.map(c => c.nome))].sort();
  }, [rawFull, fDist, fUF, apiOptions]);

  const filialOptions = useMemo(() => {
    let list = rawFull?.filiais || [];
    const allCoords = rawFull?.coordenadores || [];
    
    if (fCoord !== 'all') {
      const coordsSelected = fCoord.split(',');
      list = list.filter(f => coordsSelected.includes(f.coordenador));
    } else if (fDist !== 'all') {
      const distsSelected = fDist.split(',');
      const coordsInDist = new Set(allCoords.filter(c => distsSelected.includes(c.distrital)).map(c => c.nome));
      list = list.filter(f => coordsInDist.has(f.coordenador));
    }
    
    if (fUF !== 'all' && apiOptions?.filiais) {
      const ufsMap = new Map(apiOptions.filiais.map(f => [f.nome, f.uf]));
      const ufsSelected = fUF.split(',');
      list = list.filter(f => ufsSelected.includes(ufsMap.get(f.nome)));
    }
    if (fCidade !== 'all' && apiOptions?.filiais) {
      const cidadesMap = new Map(apiOptions.filiais.map(f => [f.nome, f.municipio]));
      const cidadesSelected = fCidade.split(',');
      list = list.filter(f => cidadesSelected.includes(cidadesMap.get(f.nome)));
    }
    
    return [...new Set(list.map(f => f.nome))].sort();
  }, [rawFull, fDist, fCoord, fUF, fCidade, apiOptions]);

  const ufOptions = useMemo(() => apiOptions?.ufs || [], [apiOptions]);

  const cidadeOptions = useMemo(() => {
    if (!apiOptions?.cidades) return [];
    if (fUF === 'all') return apiOptions.cidades;
    const filiaisUf = apiOptions.filiais || [];
    const ufsSelected = fUF.split(',');
    const matchingCities = filiaisUf
      .filter(f => ufsSelected.includes(f.uf))
      .map(f => f.municipio)
      .filter(Boolean);
    return [...new Set(matchingCities)].sort();
  }, [apiOptions, fUF]);

  const grupoOptions = useMemo(() =>
    [...new Set((rawFull?.grupos || []).map(g => g.nome))].sort(), [rawFull]);

  const linhaOptions = useMemo(() => {
    const allLinhas = rawFull?.linhas || [];
    const gruposSelected = fGrupo.split(',');
    return [...new Set(allLinhas
      .filter(l => fGrupo === 'all' || gruposSelected.includes(l.grupo))
      .map(l => l.nome))].sort();
  }, [rawFull, fGrupo]);

  const t = data?.filtered_total || data?.total || {};
  const labelAtual    = data?.label_mes_atual || 'Jul/26';
  const labelAtualAno = labelAtual.replace(/(\d{2})$/, m => String(Number(m) - 1).padStart(2, '0'));
  const labelAnt      = data?.label_mes_ant || 'Jun/26';

  const distritais    = data?.distritoriais || [];
  const coordenadores = data?.coordenadores || [];
  const filiais       = data?.filiais || [];
  const grupos        = data?.grupos || [];
  const linhas        = data?.linhas || [];

  const chartItems = useMemo(() => {
    let rawList = [];
    if (activeTab === 'hierarquia') {
      if (fDist === 'all') {
        rawList = distritais;
      } else if (fCoord === 'all') {
        const distsSelected = fDist.split(',');
        rawList = coordenadores.filter(c => distsSelected.includes(c.distrital));
      } else {
        const coordsSelected = fCoord.split(',');
        rawList = filiais.filter(f => coordsSelected.includes(f.coordenador));
      }
    } else if (activeTab === 'mapa') {
      if (fUF === 'all') {
        // Agrupa filiais por UF
        const ufMap = {};
        filiais.forEach(f => {
          const uf = f.uf || 'N/I';
          if (!ufMap[uf]) {
            ufMap[uf] = { nome: uf, mt: 0, mp: 0, venda_jul26: 0, venda_jul25: 0, venda_jun26: 0, base_emp_jul26: 0, base_emp_jul25: 0, cupons_jul26: 0, cupons_jul25: 0, cupons_jun26: 0 };
          }
          const u = ufMap[uf];
          u.mt += f.meta_total || 0;
          u.mp += f.meta_parcial || 0;
          u.venda_jul26 += f.venda_jul26 || 0;
          u.venda_jul25 += f.venda_jul25 || 0;
          u.venda_jun26 += f.venda_jun26 || 0;
          u.base_emp_jul26 += f.base_emp_jul26 || 0;
          u.base_emp_jul25 += f.base_emp_jul25 || 0;
          u.cupons_jul26 += f.cupons_jul26 || 0;
          u.cupons_jul25 += f.cupons_jul25 || 0;
          u.cupons_jun26 += f.cupons_jun26 || 0;
        });
        rawList = Object.values(ufMap).map(u => ({
          nome: u.nome,
          ...u,
          pct_ecomm_jul26: u.base_emp_jul26 ? (u.venda_jul26 / u.base_emp_jul26) * 100 : 0,
          pct_ecomm_jul25: u.base_emp_jul25 ? (u.venda_jul25 / u.base_emp_jul25) * 100 : 0,
          evol_yoy: u.venda_jul25 ? ((u.venda_jul26 - u.venda_jul25) / u.venda_jul25) * 100 : 0,
          evol_mom: u.venda_jun26 ? ((u.venda_jul26 - u.venda_jun26) / u.venda_jun26) * 100 : 0
        }));
      } else if (fCidade === 'all') {
        // Agrupa filiais por cidade no UF ativo
        const cidMap = {};
        const ufsSelected = fUF.split(',');
        const filiaisUf = filiais.filter(f => ufsSelected.includes(f.uf));
        filiaisUf.forEach(f => {
          const cid = f.municipio || 'Não Informado';
          if (!cidMap[cid]) {
            cidMap[cid] = { nome: cid, mt: 0, mp: 0, venda_jul26: 0, venda_jul25: 0, venda_jun26: 0, base_emp_jul26: 0, base_emp_jul25: 0, cupons_jul26: 0, cupons_jul25: 0, cupons_jun26: 0 };
          }
          const c = cidMap[cid];
          c.mt += f.meta_total || 0;
          c.mp += f.meta_parcial || 0;
          c.venda_jul26 += f.venda_jul26 || 0;
          c.venda_jul25 += f.venda_jul25 || 0;
          c.venda_jun26 += f.venda_jun26 || 0;
          c.base_emp_jul26 += f.base_emp_jul26 || 0;
          c.base_emp_jul25 += f.base_emp_jul25 || 0;
          c.cupons_jul26 += f.cupons_jul26 || 0;
          c.cupons_jul25 += f.cupons_jul25 || 0;
          c.cupons_jun26 += f.cupons_jun26 || 0;
        });
        rawList = Object.values(cidMap).map(c => ({
          nome: c.nome,
          ...c,
          pct_ecomm_jul26: c.base_emp_jul26 ? (c.venda_jul26 / c.base_emp_jul26) * 100 : 0,
          pct_ecomm_jul25: c.base_emp_jul25 ? (c.venda_jul25 / c.base_emp_jul25) * 100 : 0,
          evol_yoy: c.venda_jul25 ? ((c.venda_jul26 - c.venda_jul25) / c.venda_jul25) * 100 : 0,
          evol_mom: c.venda_jun26 ? ((c.venda_jul26 - c.venda_jun26) / c.venda_jun26) * 100 : 0
        }));
      } else {
        // Mostra filiais individuais na cidade ativa
        const ufsSelected = fUF.split(',');
        const cidadesSelected = fCidade.split(',');
        rawList = filiais.filter(f => ufsSelected.includes(f.uf) && cidadesSelected.includes(f.municipio));
      }
    } else {
      if (fGrupo === 'all') {
        rawList = grupos;
      } else {
        const gruposSelected = fGrupo.split(',');
        rawList = linhas.filter(l => gruposSelected.includes(l.grupo));
      }
    }

    const items = rawList.map(item => {
      const m = getMetrics(item);
      const part26 = item.pct_ecomm_jul26 != null ? item.pct_ecomm_jul26 : 0;
      const part25 = item.pct_ecomm_jul25 != null ? item.pct_ecomm_jul25 : 0;
      const diffPP = (item.pct_ecomm_jul26 != null && item.pct_ecomm_jul25 != null) ? (item.pct_ecomm_jul26 - item.pct_ecomm_jul25) : 0;
      return {
        name: item.nome.length > 18 ? item.nome.substring(0, 16) + '…' : item.nome,
        nomeOriginal: item.nome,
        venda: m.val26,
        venda_ant: m.val25,
        meta: item.meta_parcial || 0,
        desvio: viewMode === 'venda' ? desvioAbs(m.val26, item.meta_parcial) || 0 : 0,
        participacao: part26,
        participacao_ant: part25,
        diff_pp: diffPP,
        evol_yoy: m.yoy,
        evol_mom: m.mom
      };
    });

    return items
      .sort((a, b) => b.venda - a.venda)
      .slice(0, 15);
  }, [activeTab, distritais, coordenadores, filiais, grupos, linhas, fDist, fCoord, fGrupo, fUF, fCidade, getMetrics, viewMode]);

  const handleChartClick = useCallback((state) => {
    if (!state || !state.activePayload || state.activePayload.length === 0) return;
    const clickedItem = state.activePayload[0].payload;
    const nome = clickedItem.nomeOriginal;

    if (activeTab === 'hierarquia') {
      if (fDist === 'all') {
        setFDist(nome);
        setFCoord('all');
        setFFilial('all');
      } else if (fCoord === 'all') {
        setFCoord(nome);
        setFFilial('all');
      } else if (fFilial === 'all') {
        setFFilial(nome);
      }
    } else if (activeTab === 'mapa') {
      if (fUF === 'all') {
        setFUF(nome);
        setFCidade('all');
        setFFilial('all');
      } else if (fCidade === 'all') {
        setFCidade(nome);
        setFFilial('all');
      } else if (fFilial === 'all') {
        setFFilial(nome);
      }
    } else {
      if (fGrupo === 'all') {
        setFGrupo(nome);
        setFLinha('all');
      } else if (fLinha === 'all') {
        setFLinha(nome);
      }
    }
  }, [activeTab, fDist, fCoord, fFilial, fGrupo, fLinha, fUF, fCidade]);

  const tDesvio   = desvioAbs(t.venda_jul26, t.meta_parcial);
  const tPartEvol = (t.pct_ecomm_jul26 != null && t.pct_ecomm_jul25 != null) ? t.pct_ecomm_jul26 - t.pct_ecomm_jul25 : null;

  const kpiBlocks = useMemo(() => {
    if (loading || !t) {
      return [
        { label: 'Carregando...', value: '...' },
        { label: 'Carregando...', value: '...' },
        { label: 'Carregando...', value: '...' },
        { label: 'Carregando...', value: '...' }
      ];
    }

    const fmtCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
    const fmtInteger = (v) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v || 0);

    if (viewMode === 'venda') {
      const tDesvioVal = desvioAbs(t.venda_jul26, t.meta_parcial);
      return [
        {
          label: 'Venda E-commerce',
          value: fmtR(t.venda_jul26),
          evol: t.evol_yoy,
          evolLabel: 'YoY',
          sub: `Mês Ant.: ${fmtR(t.venda_jun26)} (${fmtEvol(t.evol_mom)} MoM)`
        },
        {
          label: 'Meta Total',
          value: fmtR(t.meta_total),
          sub: `Atingido: ${fmtPct(t.pct_meta_total)}`
        },
        {
          label: 'Desvio Meta Parcial',
          value: tDesvioVal != null ? (tDesvioVal >= 0 ? '+' : '') + fmtR(tDesvioVal) : '—',
          evol: desvioPct(t.venda_jul26, t.meta_parcial),
          evolLabel: 'desvio',
          sub: `Meta Parcial: ${fmtR(t.meta_parcial)}`,
          highlight: true
        },
        {
          label: 'Participação Digital',
          value: fmtPct(t.pct_ecomm_jul26),
          evol: tPartEvol,
          evolLabel: 'p.p. YoY',
          sub: `Ano Anterior: ${fmtPct(t.pct_ecomm_jul25)}`
        }
      ];
    } else if (viewMode === 'cup') {
      const c26 = t.cupons_jul26 || 0;
      const c25 = t.cupons_jul25 || 0;
      const cJun = t.cupons_jun26 || 0;

      const yoy = c25 ? ((c26 - c25) / c25) * 100 : 0;
      const mom = cJun ? ((c26 - cJun) / cJun) * 100 : 0;

      const diffYoY = c26 - c25;
      const diffMoM = c26 - cJun;

      return [
        {
          label: 'Total Cupons',
          value: fmtInteger(c26),
          evol: yoy,
          evolLabel: 'YoY',
          sub: `Mês Ant.: ${fmtInteger(cJun)} (${fmtEvol(mom)} MoM)`
        },
        {
          label: 'Cupons Ano Anterior',
          value: fmtInteger(c25),
          sub: `Período: ${labelAtualAno}`
        },
        {
          label: 'Crescimento YoY (Qtd)',
          value: (diffYoY >= 0 ? '+' : '') + fmtInteger(diffYoY),
          sub: `Diferença vs ${labelAtualAno}`,
          highlight: true
        },
        {
          label: 'Crescimento MoM (Qtd)',
          value: (diffMoM >= 0 ? '+' : '') + fmtInteger(diffMoM),
          sub: `Diferença vs ${labelAnt}`
        }
      ];
    } else {
      // viewMode === 'tm'
      const v26 = t.venda_jul26 || 0;
      const c26 = t.cupons_jul26 || 0;
      const v25 = t.venda_jul25 || 0;
      const c25 = t.cupons_jul25 || 0;
      const vJun = t.venda_jun26 || 0;
      const cJun = t.cupons_jun26 || 0;

      const tm26 = c26 ? v26 / c26 : 0;
      const tm25 = c25 ? v25 / c25 : 0;
      const tmJun = cJun ? vJun / cJun : 0;

      const yoy = tm25 ? ((tm26 - tm25) / tm25) * 100 : 0;
      const mom = tmJun ? ((tm26 - tmJun) / tmJun) * 100 : 0;

      const diffYoY = tm26 - tm25;
      const diffMoM = tm26 - tmJun;

      return [
        {
          label: 'Ticket Médio',
          value: fmtCurrency1(tm26),
          evol: yoy,
          evolLabel: 'YoY',
          sub: `Mês Ant.: ${fmtCurrency1(tmJun)} (${fmtEvol(mom)} MoM)`
        },
        {
          label: 'T. Médio Ano Anterior',
          value: fmtCurrency1(tm25),
          sub: `Período: ${labelAtualAno}`
        },
        {
          label: 'Crescimento YoY (R$)',
          value: (diffYoY >= 0 ? '+' : '') + fmtCurrency1(diffYoY),
          sub: `Diferença vs ${labelAtualAno}`,
          highlight: true
        },
        {
          label: 'Crescimento MoM (R$)',
          value: (diffMoM >= 0 ? '+' : '') + fmtCurrency1(diffMoM),
          sub: `Diferença vs ${labelAnt}`
        }
      ];
    }
  }, [loading, t, viewMode, labelAtualAno, labelAnt, tPartEvol]);

  const COLS_HIER = [
    'Meta Total',
    '% Meta Total',
    `Venda E-comm\n${labelAtual}`,
    `Meta Parcial\n${labelAtual}`,
    'Desvio da Meta',
    `Venda\n${labelAtualAno}`,
    `Evolução\nYoY vs ${labelAtualAno}`,
    `Crescimento\nMoM vs ${labelAnt}`,
    'Part. Digital',
  ];

  const COLS_CAT = [
    'Meta Total',
    '% Meta Total',
    `Venda E-comm\n${labelAtual}`,
    `Meta Parcial\n${labelAtual}`,
    'Desvio da Meta',
    `Venda\n${labelAtualAno}`,
    `Evolução\nYoY vs ${labelAtualAno}`,
    `Crescimento\nMoM vs ${labelAnt}`,
    'Part. Digital',
  ];

  const activeCols = useMemo(() => {
    if (viewMode === 'venda') {
      return activeTab === 'hierarquia' ? COLS_HIER : COLS_CAT;
    }
    const label = viewMode === 'cup' ? 'Cupons' : 'T. Médio';
    return [
      `${label}\n${labelAtual}`,
      `${label}\n${labelAtualAno}`,
      `Evolução\nYoY vs ${labelAtualAno}`,
      `${label}\n${labelAnt}`,
      `Crescimento\nMoM vs ${labelAnt}`
    ];
  }, [viewMode, activeTab, labelAtual, labelAtualAno, labelAnt]);

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Topbar ── */}
      <div style={{
        background: '#0f2050', color: '#fff', padding: '0 24px',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
      }}>
        {/* Linha 1: título e botões */}
        <div style={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '6px 0' }}>
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
          
          {/* Seletor de Perspectiva */}
          <div style={{ 
            display: 'flex', 
            gap: 4, 
            alignItems: 'center', 
            background: 'rgba(255,255,255,0.06)', 
            padding: 3, 
            borderRadius: 8, 
            border: '1px solid rgba(255,255,255,0.1)' 
          }}>
            {[
              { key: 'venda', label: '💰 Faturamento' },
              { key: 'cup', label: '🎟️ Cupons' },
              { key: 'tm', label: '🎫 Ticket Médio' }
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setViewMode(item.key)}
                style={{
                  background: viewMode === item.key ? 'rgba(123,97,255,0.3)' : 'transparent',
                  border: 'none',
                  color: viewMode === item.key ? '#fff' : 'rgba(255,255,255,0.6)',
                  borderRadius: 6,
                  padding: '5px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button 
              onClick={() => setShowFilters(!showFilters)} 
              title={showFilters ? "Esconder Filtros" : "Mostrar Filtros"} 
              style={{ 
                ...btnS, 
                background: showFilters ? 'rgba(123,97,255,0.25)' : 'rgba(255,255,255,0.1)', 
                borderColor: showFilters ? 'rgba(123,97,255,0.5)' : 'rgba(255,255,255,0.2)',
                color: showFilters ? '#c4b5fd' : '#fff'
              }}
            >
              <Filter size={13} /> {showFilters ? 'Esconder Filtros' : 'Filtros'} {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
            </button>
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
        {showFilters && (
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
            <FilterSelect
              label="UF"
              value={fUF}
              options={ufOptions}
              onChange={v => { setFUF(v); setFCidade('all'); }}
            />
            <FilterSelect
              label="Cidade"
              value={fCidade}
              options={cidadeOptions}
              disabled={cidadeOptions.length === 0}
              onChange={handleCidadeChange}
            />
            <FilterSelect
              label="Grupo"
              value={fGrupo}
              options={grupoOptions}
              onChange={v => { setFGrupo(v); setFLinha('all'); }}
            />
            <FilterSelect
              label="Linha"
              value={fLinha}
              options={linhaOptions}
              disabled={linhaOptions.length === 0}
              onChange={v => setFLinha(v)}
            />
            {hasFilter && (
              <button
                onClick={() => { setFDist('all'); setFCoord('all'); setFFilial('all'); setFGrupo('all'); setFLinha('all'); setFUF('all'); setFCidade('all'); }}
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
                {fUF !== 'all' && <span style={chip}>{fUF}</span>}
                {fCidade !== 'all' && <span style={chip}>{fCidade}</span>}
                {fGrupo !== 'all' && <span style={chip}>{fGrupo}</span>}
                {fLinha !== 'all' && <span style={chip}>{fLinha}</span>}
              </div>
            )}
          </div>
        )}
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
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {kpiBlocks.map((b, idx) => (
              <KpiBlock 
                key={idx}
                label={b.label} 
                value={b.value} 
                evol={b.evol} 
                evolLabel={b.evolLabel}
                sub={b.sub}
                highlight={b.highlight} 
              />
            ))}
          </div>
        </div>

        {/* ── Erro ── */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', marginBottom: 12, fontSize: 13 }}>
            Erro: {error} · <button onClick={load} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Tentar novamente</button>
          </div>
        )}

        {/* ── Sem Dados — Aguardando Upload ── */}
        {noData && !loading && (
          <div style={{
            background: '#fff', borderRadius: 12, border: '2px dashed #cbd5e1',
            padding: '60px 32px', marginBottom: 16, textAlign: 'center',
            animation: 'fadeIn 0.3s ease-out',
          }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📂</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f2050', margin: '0 0 8px' }}>
              Nenhuma planilha carregada
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
              O servidor ainda não possui dados reais. Faça o upload da planilha 
              <strong> BASE DASHBOARD</strong> pelo botão abaixo para começar a usar o dashboard.
            </p>
            <button
              onClick={onUpload}
              style={{
                background: '#e91e8c', color: '#fff', border: 'none',
                borderRadius: 8, padding: '12px 28px', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 12px rgba(233,30,140,0.3)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseOver={e => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 16px rgba(233,30,140,0.4)'; }}
              onMouseOut={e => { e.target.style.transform = 'none'; e.target.style.boxShadow = '0 4px 12px rgba(233,30,140,0.3)'; }}
            >
              <Upload size={16} /> Fazer Upload da Planilha
            </button>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 20 }}>
              💡 Arquivo esperado: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>base Dashboard.xlsx</code> com aba <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>BASE DASHBOARD</code>
            </p>
          </div>
        )}


        {showChart && !loading && chartItems.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '16px 20px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#0f2050', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span>📊 Análise Gráfica — {activeTab === 'hierarquia' ? 'Estrutura Organizacional' : 'Categorias & Linhas'} (Top 15 por {viewMode === 'venda' ? 'Venda' : viewMode === 'cup' ? 'Cupons' : 'Ticket Médio'})</span>
                {chartMetric === 'valor' && (
                  <span style={{ fontSize: 9, fontWeight: 500, color: '#64748b', textTransform: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
                    <span><span style={{ color: '#7c3aed', marginRight: 3 }}>●</span>{labelAtual}</span>
                    <span><span style={{ color: '#94a3b8', marginRight: 3 }}>●</span>{labelAtualAno}</span>
                  </span>
                )}
                {chartMetric === 'venda_meta' && (
                  <span style={{ fontSize: 9, fontWeight: 500, color: '#64748b', textTransform: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
                    <span><span style={{ color: '#7c3aed', marginRight: 3 }}>●</span>Venda E-comm</span>
                    <span><span style={{ color: '#94a3b8', marginRight: 3 }}>●</span>Meta Parcial</span>
                  </span>
                )}
              </h4>
              
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Seletor de Métrica */}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', background: '#f1f5f9', padding: 2, borderRadius: 6 }}>
                  <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 2, borderRadius: 6 }}>
                    {chartMetricOptions.map(m => (
                      <button
                        key={m.key}
                        onClick={() => setChartMetric(m.key)}
                        style={{
                          background: chartMetric === m.key ? '#fff' : 'transparent',
                          border: 'none',
                          color: chartMetric === m.key ? '#0f2050' : '#64748b',
                          borderRadius: 4,
                          padding: '4px 10px',
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: chartMetric === m.key ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                          transition: 'all 0.15s',
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
 
                <button 
                  onClick={() => setShowChart(false)} 
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}
                >
                  <X size={12} /> Ocultar Gráfico
                </button>
              </div>
            </div>
            {chartMetric === 'venda_meta' && (
              <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#7c3aed', display: 'inline-block' }} /> Venda E-comm ({labelAtual})
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#94a3b8', display: 'inline-block' }} /> Meta Parcial
                </span>
              </div>
            )}
            {chartMetric === 'participacao' && (
              <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#0ea5e9', display: 'inline-block' }} /> Part. Digital ({labelAtual})
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#94a3b8', display: 'inline-block' }} /> Part. Digital Ano Ant. ({labelAtualAno})
                </span>
              </div>
            )}
            {chartMetric === 'evolucao' && (
              <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }} /> Crescimento YoY
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> Queda YoY
                </span>
              </div>
            )}
            {chartMetric === 'crescimento' && (
              <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }} /> Crescimento MoM
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> Queda MoM
                </span>
              </div>
            )}
            <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ width: '100%', minWidth: 640, height: 210 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartItems} margin={{ top: 32, right: 10, left: 10, bottom: 5 }} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#64748b" interval={0} tickLine={false} />
                    <YAxis tick={{ fontSize: 9 }} stroke="#64748b" tickFormatter={v => {
                      if (chartMetric === 'participacao' || chartMetric === 'evolucao' || chartMetric === 'crescimento') return `${v.toFixed(0)}%`;
                      if (viewMode === 'cup') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v);
                      return fmtR(v);
                    }} tickLine={false} />
                    <Tooltip 
                      formatter={(value, name, props) => {
                        if (name === 'participacao' || name === 'Part. Digital Atual') {
                          const diff = props?.payload?.diff_pp;
                          const diffTxt = diff != null ? ` (${diff >= 0 ? '+' : ''}${diff.toFixed(1).replace('.', ',')} pp vs ano ant.)` : '';
                          return [`${Number(value).toFixed(1).replace('.', ',')}%${diffTxt}`, `Part. Digital (${labelAtual})`];
                        }
                        if (name === 'participacao_ant' || name === 'Part. Digital Ano Ant.') {
                          return [`${Number(value).toFixed(1).replace('.', ',')}%`, `Part. Digital Ano Ant. (${labelAtualAno})`];
                        }
                        if (name === 'venda' || name === 'Venda E-commerce') {
                          if (viewMode === 'cup') {
                            return [new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value), `Cupons (${labelAtual})`];
                          } else if (viewMode === 'tm') {
                            return [fmtCurrency1(value), `Ticket Médio (${labelAtual})`];
                          }
                          return [fmtR(value), `Venda E-comm (${labelAtual})`];
                        }
                        if (name === 'venda_ant') {
                           if (viewMode === 'cup') {
                             return [new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value), `Cupons Anterior (${labelAtualAno})`];
                           } else if (viewMode === 'tm') {
                             return [fmtCurrency1(value), `Ticket Médio Anterior (${labelAtualAno})`];
                           }
                           return [fmtR(value), `Venda E-comm Anterior (${labelAtualAno})`];
                         }
                        if (name === 'meta' || name === 'Meta Parcial') return [fmtR(value), 'Meta Parcial'];
                        if (name === 'evol_yoy') return [fmtEvol(value), `Evolução YoY (${labelAtualAno})`];
                        if (name === 'evol_mom') return [fmtEvol(value), `Crescimento MoM (${labelAnt})`];
                        return [fmtR(value), 'Desvio da Meta Parcial'];
                      }}
                      contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: 'none', borderRadius: 6, fontSize: 10, color: '#fff' }}
                      labelStyle={{ color: '#94a3b8', fontWeight: 700 }}
                    />
                    
                    {chartMetric === 'desvio' && (
                      <Bar dataKey="desvio" radius={[4, 4, 0, 0]}>
                        {chartItems.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.desvio >= 0 ? '#10b981' : '#ef4444'} />
                        ))}
                        <LabelList content={renderCustomLabel} />
                      </Bar>
                    )}
 
                    {chartMetric === 'valor' && (
                      <Bar dataKey="venda" name="venda" fill="#7c3aed" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="venda" position="top" formatter={v => {
                          if (viewMode === 'cup') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v);
                          if (viewMode === 'tm') return fmtCurrency1(v);
                          return fmtR(v);
                        }} style={{ fontSize: 8, fill: '#475569', fontWeight: 600 }} />
                      </Bar>
                    )}
                    {chartMetric === 'valor' && (
                      <Bar dataKey="venda_ant" name="venda_ant" fill="#94a3b8" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="venda_ant" position="top" formatter={v => {
                          if (viewMode === 'cup') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v);
                          if (viewMode === 'tm') return fmtCurrency1(v);
                          return fmtR(v);
                        }} style={{ fontSize: 8, fill: '#64748b', fontWeight: 600 }} />
                      </Bar>
                    )}
 
                    {chartMetric === 'venda_meta' && (
                      <Bar dataKey="venda" name="venda" fill="#7c3aed" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="venda" position="top" formatter={v => fmtR(v)} style={{ fontSize: 8, fill: '#475569', fontWeight: 600 }} />
                      </Bar>
                    )}
                    {chartMetric === 'venda_meta' && (
                      <Bar dataKey="meta" name="meta" fill="#94a3b8" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="meta" position="top" formatter={v => fmtR(v)} style={{ fontSize: 8, fill: '#475569', fontWeight: 600 }} />
                      </Bar>
                    )}
 
                    {chartMetric === 'participacao' && (
                      <Bar dataKey="participacao" name="participacao" fill="#0ea5e9" radius={[4, 4, 0, 0]}>
                        <LabelList content={renderCustomPartLabel} />
                      </Bar>
                    )}
                    {chartMetric === 'participacao' && (
                      <Bar dataKey="participacao_ant" name="participacao_ant" fill="#94a3b8" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="participacao_ant" position="top" formatter={v => `${Number(v).toFixed(1).replace('.', ',')}%`} style={{ fontSize: 8, fill: '#64748b', fontWeight: 600 }} />
                      </Bar>
                    )}
 
                    {chartMetric === 'evolucao' && (
                      <Bar dataKey="evol_yoy" radius={[4, 4, 0, 0]}>
                        {chartItems.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.evol_yoy >= 0 ? '#10b981' : '#ef4444'} />
                        ))}
                        <LabelList content={renderCustomPctLabel} />
                      </Bar>
                    )}
 
                    {chartMetric === 'crescimento' && (
                      <Bar dataKey="evol_mom" radius={[4, 4, 0, 0]}>
                        {chartItems.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.evol_mom >= 0 ? '#10b981' : '#ef4444'} />
                        ))}
                        <LabelList content={renderCustomPctLabel} />
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 4, fontWeight: 500 }}>
              💡 Dica: clique em qualquer barra do gráfico para aplicar o filtro correspondente.
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 0 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { key: 'hierarquia', label: 'Hierarquia — Distrital · Coord. · Filial' },
              { key: 'categorias', label: 'Grupos / Categorias → Linhas' },
              { key: 'mapa', label: '🗺️ Mapa de Vendas & Metas' },
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
          {!showChart && (
            <button 
              onClick={() => setShowChart(true)} 
              style={{
                background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px 6px 0 0',
                padding: '6px 12px', fontSize: 11, fontWeight: 600, color: '#475569',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                position: 'relative', bottom: -1, borderBottom: 'none'
              }}
            >
              📊 Mostrar Gráfico de Desvio
            </button>
          )}
        </div>

        {/* ── Conteúdo das Tabs ── */}
        {activeTab === 'mapa' ? (
          !loading && (
            <GeoMapPage 
              filiais={filiais}
              labelAtual={labelAtual}
              labelAtualAno={labelAtualAno}
              labelAnt={labelAnt}
              onSelectFiliais={setFFilial}
              selectedFiliais={fFilial}
              viewMode={viewMode}
            />
          )
        ) : (
          /* ── Tabela ── */
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0 6px 6px 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f2050' }}>
                {activeTab === 'hierarquia' ? 'Desempenho E-Commerce — Hierarquia Organizacional' : 'Desempenho E-Commerce — Grupos e Linhas de Produtos'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    padding: '4px 10px', fontSize: 11, border: '1px solid #cbd5e1', borderRadius: 6,
                    outline: 'none', width: 140, background: '#fff', color: '#1e293b',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)', transition: 'border-color 0.15s'
                  }}
                />
                <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', borderRadius: 4, padding: '3px 8px', fontWeight: 600 }}>
                  {activeTab === 'hierarquia'
                    ? `${distritais.length} distritais`
                    : `${grupos.length} grupos`}
                </span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={th('left', 200)}>
                      {activeTab === 'hierarquia' ? 'Distrital / Coordenador / Filial' : 'Grupo / Linha'}
                    </th>
                    {activeCols.map((c, i) => (
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
                        {Array.from({ length: 1 + activeCols.length }).map((_, j) => (
                          <td key={j} style={{ padding: 12 }}>
                            <div style={{ height: 13, borderRadius: 3, background: '#f1f5f9', opacity: 0.7 }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : activeTab === 'hierarquia' ? (
                    distritais.length === 0 ? (
                      <tr><td colSpan={1 + activeCols.length} style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                        Nenhum dado disponível. Carregue um arquivo Excel atualizado.
                      </td></tr>
                    ) : (
                      <HierTable
                        distritais={distritais}
                        coordenadores={coordenadores}
                        filiais={filiais}
                        labelAtualAno={labelAtualAno}
                        searchTerm={searchTerm}
                        viewMode={viewMode}
                        getMetrics={getMetrics}
                      />
                    )
                  ) : (
                    grupos.length === 0 ? (
                      <tr><td colSpan={1 + activeCols.length} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Sem dados de categorias.</td></tr>
                    ) : (
                      <CatTable 
                        grupos={grupos} 
                        linhas={linhas} 
                        labelAtualAno={labelAtualAno} 
                        searchTerm={searchTerm} 
                        viewMode={viewMode}
                        getMetrics={getMetrics}
                      />
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
                      {viewMode === 'venda' ? (
                        <>
                          <td style={td()}>{fmtR(t.meta_total)}</td>
                          <td style={{ ...td(), minWidth: 130 }}><MetaBar pct={t.pct_meta_total} /></td>
                          <td style={td(true)}>{fmtR(t.venda_jul26)}</td>
                          <td style={td()}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <span style={{ fontWeight: 700, fontSize: 12, color: '#334155' }}>{fmtR(t.meta_parcial)}</span>
                              <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 500 }}>parcial</span>
                            </div>
                          </td>
                          <td style={{ ...td(), minWidth: 90 }}><Desvio venda={t.venda_jul26} meta={t.meta_parcial} /></td>
                          <td style={td()}>{fmtR(t.venda_jul25)}</td>
                          <td style={{ ...td(), textAlign: 'center' }}><Evol v={t.evol_yoy} /></td>
                          <td style={{ ...td(), textAlign: 'center' }}><Evol v={t.evol_mom} /></td>
                          <td style={{ ...td(), minWidth: 110 }}>
                            <Part pct26={t.pct_ecomm_jul26} pct25={t.pct_ecomm_jul25} />
                          </td>
                        </>
                      ) : (() => {
                        const m = getMetrics(t);
                        return (
                          <>
                            <td style={td(true)}>{m.fmt(m.val26)}</td>
                            <td style={td()}>{m.fmt(m.val25)}</td>
                            <td style={{ ...td(), textAlign: 'center' }}><Evol v={m.yoy} /></td>
                            <td style={td()}>{m.fmt(m.valJun)}</td>
                            <td style={{ ...td(), textAlign: 'center' }}><Evol v={m.mom} /></td>
                          </>
                        );
                      })()}
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
        )}
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
