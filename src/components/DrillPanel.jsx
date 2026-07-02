import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Upload, RefreshCw } from 'lucide-react';
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
  const s = v >= 0 ? '+' : '';
  return `${s}${Number(v).toFixed(1).replace('.', ',')}%`;
};

// ── Cores ───────────────────────────────────────────────────────────────────
const cEvol  = v => v == null ? '#64748b' : v >= 0 ? '#059669' : '#dc2626';
const cMeta  = v => {
  if (v == null) return '#64748b';
  if (v >= 90) return '#059669';
  if (v >= 60) return '#d97706';
  return '#dc2626';
};
// Desvio = venda - meta (absoluto e relativo)
const desvioAbs = (venda, meta) => (venda != null && meta != null) ? venda - meta : null;
const desvioPct = (venda, meta) => (meta && meta !== 0) ? ((venda - meta) / meta) * 100 : null;

// ── KPI Card — estilo bloco Qlik ────────────────────────────────────────────
function KpiBlock({ label, value, evol, evolLabel, highlight }) {
  const ec = cEvol(evol);
  return (
    <div style={{
      flex: 1, minWidth: 140,
      padding: '16px 18px',
      borderRight: '1px solid #e2e8f0',
      background: highlight ? '#0f2050' : '#fff',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: highlight ? 'rgba(255,255,255,0.6)' : '#64748b' }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: highlight ? '#fff' : '#0f2050' }}>
          {value}
        </span>
        {evol != null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: highlight ? (ec === '#059669' ? '#6ee7b7' : '#fca5a5') : ec }}>
            {fmtEvol(evol)}
            {evolLabel && <span style={{ fontWeight: 400, fontSize: 10, color: highlight ? 'rgba(255,255,255,0.4)' : '#94a3b8', marginLeft: 3 }}>{evolLabel}</span>}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Barra de meta ───────────────────────────────────────────────────────────
function MetaBar({ pct }) {
  const c = cMeta(pct);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 100 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct || 0, 100)}%`, background: c, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: c, minWidth: 42, textAlign: 'right' }}>{fmtPct(pct)}</span>
    </div>
  );
}

// ── Célula de Evolução ──────────────────────────────────────────────────────
function Evol({ v }) {
  if (v == null) return <span style={{ color: '#94a3b8' }}>—</span>;
  const color = cEvol(v);
  const Icon = v >= 0 ? TrendingUp : TrendingDown;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color, fontWeight: 700, fontSize: 12 }}>
      <Icon size={11} />
      {fmtEvol(v)}
    </span>
  );
}

// ── Célula de Desvio da Meta ────────────────────────────────────────────────
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

// ── Linha da Hierarquia ─────────────────────────────────────────────────────
function HRow({ row, depth, expanded, hasChildren, onToggle, labelAtual, labelAtualAno }) {
  const pct = row.pct_meta_total;
  const bgRow = depth === 0
    ? 'rgba(15,32,80,0.04)'
    : depth === 1 ? 'rgba(15,32,80,0.015)'
    : 'transparent';

  const part26 = row.pct_ecomm_jul26;
  const part25 = row.pct_ecomm_jul25;
  const partEvol = (part26 != null && part25 != null) ? part26 - part25 : null;

  return (
    <tr
      style={{ borderBottom: '1px solid #e9eef4', background: bgRow, transition: 'background 0.1s' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.05)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = bgRow; }}
    >
      {/* ── Nome ── */}
      <td style={{ padding: '9px 12px 9px 0', paddingLeft: 12 + depth * 22, whiteSpace: 'nowrap', minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {hasChildren ? (
            <button
              onClick={onToggle}
              style={{
                width: 18, height: 18, borderRadius: 3,
                border: `1px solid ${depth === 0 ? '#1e3a8a' : '#94a3b8'}`,
                background: expanded ? '#1e3a8a' : '#fff',
                color: expanded ? '#fff' : '#1e3a8a',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, lineHeight: 1, flexShrink: 0,
              }}
            >
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

      {/* ── Venda E-comm Atual ── */}
      <td style={td(true)}>{fmtR(row.venda_jul26)}</td>

      {/* ── Venda Ano Anterior ── */}
      <td style={td()}>{fmtR(row.venda_jul25)}</td>

      {/* ── Meta ── */}
      <td style={td()}>{fmtR(row.meta_total)}</td>

      {/* ── % Meta + barra ── */}
      <td style={{ ...td(), minWidth: 130 }}><MetaBar pct={pct} /></td>

      {/* ── Desvio da Meta ── */}
      <td style={{ ...td(), minWidth: 90 }}>
        <Desvio venda={row.venda_jul26} meta={row.meta_total} />
      </td>

      {/* ── Crescimento YoY ── */}
      <td style={{ ...td(), textAlign: 'center' }}>
        <Evol v={row.evol_yoy} />
      </td>

      {/* ── Evolução MoM ── */}
      <td style={{ ...td(), textAlign: 'center' }}>
        <Evol v={row.evol_mom} />
      </td>

      {/* ── Participação Digital ── */}
      <td style={{ ...td(), minWidth: 110 }}>
        {part26 != null ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: '#7c3aed' }}>{fmtPct(part26)}</span>
            {partEvol != null && (
              <span style={{ fontSize: 10, color: cEvol(partEvol) }}>
                {fmtEvol(partEvol)} p.p. vs {labelAtualAno}
              </span>
            )}
          </div>
        ) : <span style={{ color: '#94a3b8' }}>—</span>}
      </td>
    </tr>
  );
}

// ── Tabela com hierarquia inline ─────────────────────────────────────────────
function HierTable({ distritais, coordenadores, filiais, labelAtual, labelAtualAno }) {
  const [openDist, setOpenDist] = useState(new Set());
  const [openCoord, setOpenCoord] = useState(new Set());

  const tog = (set, setSet, key) => {
    setSet(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  const sorted = [...distritais].sort((a, b) => (b.venda_jul26 || 0) - (a.venda_jul26 || 0));
  const rows = [];

  sorted.forEach(dist => {
    const isDistOpen = openDist.has(dist.nome);
    const coords = coordenadores
      .filter(c => c.distrital === dist.nome)
      .sort((a, b) => (b.venda_jul26 || 0) - (a.venda_jul26 || 0));

    rows.push(
      <HRow key={`d-${dist.nome}`} row={dist} depth={0} expanded={isDistOpen}
        hasChildren={coords.length > 0} onToggle={() => tog(openDist, setOpenDist, dist.nome)}
        labelAtual={labelAtual} labelAtualAno={labelAtualAno} />
    );

    if (isDistOpen) {
      coords.forEach(coord => {
        const isCoordOpen = openCoord.has(coord.nome);
        const fils = filiais
          .filter(f => f.coordenador === coord.nome)
          .sort((a, b) => (b.venda_jul26 || 0) - (a.venda_jul26 || 0));

        rows.push(
          <HRow key={`c-${coord.nome}`} row={coord} depth={1} expanded={isCoordOpen}
            hasChildren={fils.length > 0} onToggle={() => tog(openCoord, setOpenCoord, coord.nome)}
            labelAtual={labelAtual} labelAtualAno={labelAtualAno} />
        );

        if (isCoordOpen) {
          fils.forEach(fil => {
            rows.push(
              <HRow key={`f-${fil.nome}`} row={fil} depth={2} expanded={false}
                hasChildren={false} onToggle={null}
                labelAtual={labelAtual} labelAtualAno={labelAtualAno} />
            );
          });
        }
      });
    }
  });

  return <>{rows}</>;
}

// ── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function DrillPanel({ onUpload }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('hierarquia');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await API.getMetas({ distrital: 'all', coordenador: 'all', filial: 'all' });
      setData(res.data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const t = data?.filtered_total || data?.total || {};
  const labelAtual     = data?.label_mes_atual || 'Jul/26';
  const labelAtualAno  = labelAtual.replace(/(\d{2})$/, m => String(Number(m) - 1).padStart(2, '0'));
  const labelAnt       = data?.label_mes_ant || 'Jun/26';

  const distritais     = data?.distritoriais || [];
  const coordenadores  = data?.coordenadores || [];
  const filiais        = data?.filiais || [];
  const grupos         = data?.grupos || [];

  const tDesvio = desvioAbs(t.venda_jul26, t.meta_total);
  const tPart26 = t.pct_ecomm_jul26;
  const tPart25 = t.pct_ecomm_jul25;
  const tPartEvol = (tPart26 != null && tPart25 != null) ? tPart26 - tPart25 : null;

  const COLS = [
    { label: `Venda E-comm\n${labelAtual}`, tip: `Venda ${labelAtual}` },
    { label: `Venda\n${labelAtualAno}`, tip: `Venda ${labelAtualAno}` },
    { label: 'Meta', tip: 'Meta Total' },
    { label: '% Meta', tip: 'Percentual da meta atingida' },
    { label: 'Desvio da Meta', tip: 'Venda − Meta (absoluto e %)' },
    { label: `Crescimento YoY\nvs ${labelAtualAno}`, tip: `Crescimento vs ${labelAtualAno}` },
    { label: `Evolução MoM\nvs ${labelAnt}`, tip: `Crescimento vs ${labelAnt}` },
    { label: 'Part. Digital', tip: 'Participação do E-commerce na Rede' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Topbar ── */}
      <div style={{
        background: '#0f2050', color: '#fff', height: 48,
        padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 10px rgba(0,0,0,0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 6, background: '#e91e8c',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px'
          }}>SJ</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Dashboard E-Commerce — Diretoria C</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
              {data?.arquivo || 'base Dashboard.xlsx'} · {labelAtual}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onUpload && (
            <button onClick={onUpload} style={btnStyle('#fff', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.3)')}>
              <Upload size={13} /> Atualizar Excel
            </button>
          )}
          <button onClick={load} title="Recarregar" style={btnStyle('#fff', 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.25)', true)}>
            <RefreshCw size={13} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      <div style={{ padding: '18px 24px', maxWidth: 1700, margin: '0 auto' }}>

        {/* ── Grid de KPIs — inspirado no Qlik ── */}
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          
          {/* Subtítulo da data */}
          <div style={{ padding: '8px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, color: '#64748b', textAlign: 'right' }}>
            Período: <strong style={{ color: '#0f2050' }}>{labelAtual}</strong>
            &nbsp;·&nbsp; Comparativo: <strong style={{ color: '#64748b' }}>{labelAtualAno}</strong>
            &nbsp;·&nbsp; Mês anterior: <strong style={{ color: '#64748b' }}>{labelAnt}</strong>
          </div>

          {/* Linha 1: Vendas */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
            <KpiBlock
              label={`Venda E-commerce — ${labelAtual}`}
              value={loading ? '...' : fmtR(t.venda_jul26)}
              evol={t.evol_yoy}
              evolLabel={`vs ${labelAtualAno}`}
            />
            <KpiBlock
              label={`Venda Ano Anterior — ${labelAtualAno}`}
              value={loading ? '...' : fmtR(t.venda_jul25)}
            />
            <KpiBlock
              label={`Mês Anterior — ${labelAnt}`}
              value={loading ? '...' : fmtR(t.venda_jun26)}
              evol={t.evol_mom}
              evolLabel="MoM"
            />
            <KpiBlock
              label="% Participação Digital"
              value={loading ? '...' : fmtPct(tPart26)}
              evol={tPartEvol}
              evolLabel={`p.p. vs ${labelAtualAno}`}
            />
            <KpiBlock
              label="% Meta Atingida"
              value={loading ? '...' : fmtPct(t.pct_meta_total)}
              highlight
            />
          </div>

          {/* Linha 2: Meta e Desvios */}
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <KpiBlock
              label="Meta Total"
              value={loading ? '...' : fmtR(t.meta_total)}
            />
            <KpiBlock
              label="Meta Parcial"
              value={loading ? '...' : fmtR(t.meta_parcial)}
            />
            <KpiBlock
              label="Desvio da Meta (R$)"
              value={loading ? '...' : (tDesvio != null ? (tDesvio >= 0 ? '+' : '') + fmtR(tDesvio) : '—')}
              evol={desvioPct(t.venda_jul26, t.meta_total)}
            />
            <KpiBlock
              label={`Crescimento YoY`}
              value={loading ? '...' : fmtEvol(t.evol_yoy)}
              evol={t.evol_yoy}
              evolLabel={`vs ${labelAtualAno}`}
            />
            <KpiBlock
              label={`Evolução MoM`}
              value={loading ? '...' : fmtEvol(t.evol_mom)}
              evol={t.evol_mom}
              evolLabel={`vs ${labelAnt}`}
            />
          </div>
        </div>

        {/* ── Erro ── */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', color: '#dc2626', marginBottom: 14, fontSize: 13 }}>
            Erro: {error} · <button onClick={load} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Tentar novamente</button>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 0 }}>
          {[
            { key: 'hierarquia', label: 'Hierarquia — Distrital · Coord. · Filial' },
            { key: 'categorias', label: 'Grupos / Categorias' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: '8px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: activeTab === tab.key ? '#fff' : 'rgba(255,255,255,0.5)',
              border: '1px solid #e2e8f0', borderBottom: activeTab === tab.key ? '1px solid #fff' : '1px solid #e2e8f0',
              borderRadius: '6px 6px 0 0', color: activeTab === tab.key ? '#0f2050' : '#64748b',
              position: 'relative', bottom: -1,
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tabela ── */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0 6px 6px 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>

          {/* Cabeçalho da tabela */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f2050' }}>
              {activeTab === 'hierarquia' ? 'Desempenho E-Commerce — Hierarquia Organizacional' : 'Desempenho E-Commerce — Grupos e Categorias'}
            </span>
            <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', borderRadius: 4, padding: '2px 8px' }}>
              {activeTab === 'hierarquia'
                ? `${distritais.length} distritais · ${coordenadores.length} coordenadores · ${filiais.length} filiais`
                : `${grupos.length} categorias`}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={th('left', 200)}>
                    {activeTab === 'hierarquia' ? 'Distrital / Coordenador / Filial' : 'Categoria'}
                  </th>
                  {COLS.map((c, i) => (
                    <th key={i} style={th('right')} title={c.tip}>
                      {c.label.split('\n').map((l, j) => <div key={j} style={{ lineHeight: 1.3 }}>{l}</div>)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {Array.from({ length: 9 }).map((_, j) => (
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
                      labelAtual={labelAtual}
                      labelAtualAno={labelAtualAno}
                    />
                  )
                ) : (
                  grupos.length === 0 ? (
                    <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Sem dados de categorias.</td></tr>
                  ) : (
                    [...grupos]
                      .sort((a, b) => (b.venda_jul26 || 0) - (a.venda_jul26 || 0))
                      .map((g, i) => {
                        const part26 = g.pct_ecomm_jul26;
                        const part25 = g.pct_ecomm_jul25;
                        const partEvol = (part26 != null && part25 != null) ? part26 - part25 : null;
                        return (
                          <tr key={g.nome + i}
                            style={{ borderBottom: '1px solid #f1f5f9' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.04)'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}
                          >
                            <td style={{ padding: '9px 12px 9px 16px', fontWeight: 600, color: '#0f2050', whiteSpace: 'nowrap' }}>{g.nome}</td>
                            <td style={td(true)}>{fmtR(g.venda_jul26)}</td>
                            <td style={td()}>{fmtR(g.venda_jul25)}</td>
                            <td style={td()}>{fmtR(g.meta_total)}</td>
                            <td style={{ ...td(), minWidth: 130 }}><MetaBar pct={g.pct_meta_total} /></td>
                            <td style={{ ...td(), minWidth: 90 }}><Desvio venda={g.venda_jul26} meta={g.meta_total} /></td>
                            <td style={{ ...td(), textAlign: 'center' }}><Evol v={g.evol_yoy} /></td>
                            <td style={{ ...td(), textAlign: 'center' }}><span style={{ color: '#94a3b8' }}>—</span></td>
                            <td style={{ ...td(), minWidth: 110 }}>
                              {part26 != null ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  <span style={{ fontWeight: 700, fontSize: 12, color: '#7c3aed' }}>{fmtPct(part26)}</span>
                                  {partEvol != null && <span style={{ fontSize: 10, color: cEvol(partEvol) }}>{fmtEvol(partEvol)} p.p.</span>}
                                </div>
                              ) : <span style={{ color: '#94a3b8' }}>—</span>}
                            </td>
                          </tr>
                        );
                      })
                  )
                )}
              </tbody>

              {/* Linha de totais */}
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
                    <td style={{ ...td(), minWidth: 110 }}>
                      {tPart26 != null ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span style={{ fontWeight: 700, fontSize: 12, color: '#7c3aed' }}>{fmtPct(tPart26)}</span>
                          {tPartEvol != null && <span style={{ fontSize: 10, color: cEvol(tPartEvol) }}>{fmtEvol(tPartEvol)} p.p.</span>}
                        </div>
                      ) : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {!loading && activeTab === 'hierarquia' && (
            <div style={{ padding: '8px 16px', borderTop: '1px solid #f1f5f9', fontSize: 11, color: '#94a3b8', background: '#fafafa' }}>
              💡 Use o botão <strong>+</strong> à esquerda do nome para expandir a hierarquia (Distrital → Coordenação → Filial)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers de estilo ────────────────────────────────────────────────────────
const td = (bold) => ({
  padding: '9px 12px',
  textAlign: 'right',
  fontSize: 12,
  fontWeight: bold ? 700 : 400,
  color: bold ? '#0f2050' : '#475569',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
});

const th = (align = 'right', minW) => ({
  padding: '9px 12px',
  textAlign: align,
  fontSize: 10,
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
  minWidth: minW,
});

const btnStyle = (color, bg, border, iconOnly) => ({
  display: 'flex', alignItems: 'center', gap: iconOnly ? 0 : 6,
  background: bg, border: `1px solid ${border}`,
  color, borderRadius: 6, padding: iconOnly ? '5px 8px' : '5px 12px',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
});
