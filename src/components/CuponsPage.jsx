import React, { useState, useEffect, useMemo } from 'react';
import { Tag, TrendingUp, DollarSign, ShoppingBag, Calendar, User, Shield, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import API from '../api';

const fmtCurrency = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
const fmtInteger = v => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v || 0);

export default function CuponsPage() {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncState, setSyncState] = useState(null);

  // Filtros selecionados
  const [fPeriod, setFPeriod] = useState(7); // default 7 dias
  const [fDist, setFDist] = useState('all');
  const [fCoord, setFCoord] = useState('all');
  const [fFilial, setFFilial] = useState('all');
  const [fCoupon, setFCoupon] = useState('');
  
  // Paginação da tabela
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.getCoupons();
      if (res.status === 'success') {
        setRawData(res.data || []);
        setSyncState(res.sync || null);
      } else {
        throw new Error(res.error || 'Falha ao buscar cupons');
      }
    } catch (err) {
      console.error('[CuponsPage] Erro ao carregar:', err);
      setError(err.message || 'Erro ao carregar os cupons.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtrar os dados pelo Período em dias primeiro
  const dataByPeriod = useMemo(() => {
    if (rawData.length === 0) return [];
    
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - fPeriod);
    const limitDateStr = limitDate.toISOString().slice(0, 10);
    
    return rawData.filter(item => item.date >= limitDateStr);
  }, [rawData, fPeriod]);

  // Opções dinâmicas dos dropdowns com base no período filtrado
  const filterOptions = useMemo(() => {
    const dists = new Set();
    const coords = new Set();
    const filiais = new Set();

    dataByPeriod.forEach(item => {
      if (item.distrital && item.distrital !== 'Outros') dists.add(item.distrital);
      if (item.coordenador && item.coordenador !== 'Outros') coords.add(item.coordenador);
      if (item.store && item.store !== 'Outros/Site') filiais.add(item.store);
    });

    return {
      distritais: Array.from(dists).sort(),
      coordenadores: Array.from(coords).sort(),
      filiais: Array.from(filiais).sort()
    };
  }, [dataByPeriod]);

  // Aplicar filtros de Distrital, Coordenador, Filial e Busca de Cupom
  const filteredData = useMemo(() => {
    let result = dataByPeriod;

    if (fDist !== 'all') {
      result = result.filter(item => item.distrital === fDist);
    }
    if (fCoord !== 'all') {
      result = result.filter(item => item.coordenador === fCoord);
    }
    if (fFilial !== 'all') {
      result = result.filter(item => item.store === fFilial);
    }
    if (fCoupon.trim()) {
      const query = fCoupon.toLowerCase().trim();
      result = result.filter(item => item.coupon.toLowerCase().includes(query));
    }

    return result;
  }, [dataByPeriod, fDist, fCoord, fFilial, fCoupon]);

  // Resetar paginação ao filtrar
  useEffect(() => {
    setPage(0);
  }, [fDist, fCoord, fFilial, fCoupon, fPeriod]);

  // Cálculo de KPIs
  const kpi = useMemo(() => {
    let totalUses = filteredData.length;
    let totalRevenue = filteredData.reduce((sum, item) => sum + (item.value || 0), 0);
    let avgTicket = totalUses > 0 ? totalRevenue / totalUses : 0;

    return { totalUses, totalRevenue, avgTicket };
  }, [filteredData]);

  // Agrupamento para Gráfico Temporal (Uso Diário)
  const timeChartData = useMemo(() => {
    const groups = {};
    filteredData.forEach(item => {
      const date = item.date;
      if (!groups[date]) {
        groups[date] = { date, 'Cupons': 0, 'Valor': 0 };
      }
      groups[date]['Cupons']++;
      groups[date]['Valor'] += item.value || 0;
    });

    return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredData]);

  // Agrupamento para Gráfico de Top 10 Cupons
  const topCouponsData = useMemo(() => {
    const counts = {};
    filteredData.forEach(item => {
      const c = item.coupon;
      counts[c] = (counts[c] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([coupon, uses]) => ({ coupon, uses }))
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 10);
  }, [filteredData]);

  // Tabela paginada
  const paginatedData = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, page]);

  const maxPages = Math.ceil(filteredData.length / rowsPerPage);

  if (loading && rawData.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '24px 0', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: '#7c3aed' }} />
        <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>Carregando dados de cupons da VTEX...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* Barra de Filtros */}
      <div style={{
        background: '#0f2050',
        borderRadius: 8,
        padding: '16px 20px',
        color: '#fff',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        alignItems: 'flex-end',
        boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
      }}>
        
        {/* Período */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Período</label>
          <select 
            value={fPeriod} 
            onChange={e => setFPeriod(Number(e.target.value))}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', borderRadius: 6, padding: '6px 12px',
              fontSize: 12, outline: 'none', cursor: 'pointer', minWidth: 120
            }}
          >
            <option value={7} style={{ background: '#1e293b' }}>Últimos 7 dias</option>
            <option value={10} style={{ background: '#1e293b' }}>Últimos 10 dias</option>
            <option value={15} style={{ background: '#1e293b' }}>Últimos 15 dias</option>
          </select>
        </div>

        {/* Distrital */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Distrital</label>
          <select 
            value={fDist} 
            onChange={e => { setFDist(e.target.value); setFCoord('all'); setFFilial('all'); }}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', borderRadius: 6, padding: '6px 12px',
              fontSize: 12, outline: 'none', cursor: 'pointer', minWidth: 150, maxWidth: 200
            }}
          >
            <option value="all" style={{ background: '#1e293b' }}>Todos</option>
            {filterOptions.distritais.map(d => (
              <option key={d} value={d} style={{ background: '#1e293b' }}>{d}</option>
            ))}
          </select>
        </div>

        {/* Coordenador */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Coordenação</label>
          <select 
            value={fCoord} 
            onChange={e => { setFCoord(e.target.value); setFFilial('all'); }}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', borderRadius: 6, padding: '6px 12px',
              fontSize: 12, outline: 'none', cursor: 'pointer', minWidth: 150, maxWidth: 200
            }}
          >
            <option value="all" style={{ background: '#1e293b' }}>Todos</option>
            {filterOptions.coordenadores.map(c => (
              <option key={c} value={c} style={{ background: '#1e293b' }}>{c}</option>
            ))}
          </select>
        </div>

        {/* Filial */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Filial</label>
          <select 
            value={fFilial} 
            onChange={e => setFFilial(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', borderRadius: 6, padding: '6px 12px',
              fontSize: 12, outline: 'none', cursor: 'pointer', minWidth: 180, maxWidth: 220
            }}
          >
            <option value="all" style={{ background: '#1e293b' }}>Todos</option>
            {filterOptions.filiais.map(f => (
              <option key={f} value={f} style={{ background: '#1e293b' }}>{f}</option>
            ))}
          </select>
        </div>

        {/* Buscar Cupom */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 150 }}>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Buscar Cupom</label>
          <input 
            type="text" 
            placeholder="Ex: CINTIA10..." 
            value={fCoupon} 
            onChange={e => setFCoupon(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', borderRadius: 6, padding: '6px 12px',
              fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Botão de Atualizar */}
        <button 
          onClick={loadData} 
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
            color: '#fff', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 600
          }}
        >
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Sync Status Banner */}
      {syncState && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          padding: '8px 16px',
          fontSize: 11,
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>
            ⏰ <strong>Sync VTEX:</strong> {syncState.isSyncing ? `Sincronizando em segundo plano (${syncState.progressPercent}%)` : 'Atualizado'}
          </span>
          {syncState.lastSyncTime && (
            <span>
              Último sync completo: {new Date(syncState.lastSyncTime).toLocaleString('pt-BR')}
            </span>
          )}
        </div>
      )}

      {/* Erro */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13 }}>
          ⚠️ {error} · <button onClick={loadData} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}>Tentar novamente</button>
        </div>
      )}

      {/* KPIs Grid */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        
        {/* KPI 1 */}
        <div style={{
          flex: 1, minWidth: 220, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
          padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
        }}>
          <div style={{ background: '#f5f3ff', color: '#7c3aed', padding: 10, borderRadius: 6 }}>
            <Tag size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Cupons Usados</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#0f2050', marginTop: 4 }}>{fmtInteger(kpi.totalUses)}</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div style={{
          flex: 1, minWidth: 220, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
          padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
        }}>
          <div style={{ background: '#ecfdf5', color: '#10b981', padding: 10, borderRadius: 6 }}>
            <DollarSign size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Faturamento Gerado</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#0f2050', marginTop: 4 }}>{fmtCurrency(kpi.totalRevenue)}</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div style={{
          flex: 1, minWidth: 220, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
          padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
        }}>
          <div style={{ background: '#eff6ff', color: '#3b82f6', padding: 10, borderRadius: 6 }}>
            <ShoppingBag size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Ticket Médio Cupom</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#0f2050', marginTop: 4 }}>{fmtCurrency(kpi.avgTicket)}</span>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      {filteredData.length > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          
          {/* Gráfico 1: Uso Diário */}
          <div style={{
            flex: 2, minWidth: 400, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
            padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
          }}>
            <h4 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, color: '#0f2050', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              📈 Histórico de Uso Diário (Cupons & Valor)
            </h4>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeChartData}>
                  <defs>
                    <linearGradient id="colorUses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    fontWeight={600}
                    tickFormatter={v => v.split('-').slice(1).reverse().join('/')} 
                  />
                  <YAxis stroke="#94a3b8" fontSize={10} fontWeight={600} />
                  <Tooltip 
                    contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: 'none', borderRadius: 6, fontSize: 11, color: '#fff' }}
                    labelFormatter={label => `Data: ${label.split('-').reverse().join('/')}`}
                    formatter={(value, name) => {
                      if (name === 'Valor') return [fmtCurrency(value), 'Faturamento'];
                      return [fmtInteger(value), 'Cupons Usados'];
                    }}
                  />
                  <Area type="monotone" dataKey="Cupons" name="Cupons" stroke="#7c3aed" strokeWidth={2} fillOpacity={1} fill="url(#colorUses)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico 2: Top Cupons */}
          <div style={{
            flex: 1, minWidth: 280, background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
            padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
          }}>
            <h4 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, color: '#0f2050', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              🔥 Top 10 Cupons Mais Utilizados
            </h4>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCouponsData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={9} fontWeight={600} hide />
                  <YAxis dataKey="coupon" type="category" stroke="#0f2050" fontSize={10} fontWeight={700} width={80} />
                  <Tooltip 
                    contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: 'none', borderRadius: 6, fontSize: 11, color: '#fff' }}
                    formatter={value => [fmtInteger(value), 'Utilizações']}
                  />
                  <Bar dataKey="uses" name="Uso" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Tabela de Dados Detalhados */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden'
      }}>
        
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f2050' }}>Relatório Detalhado de Utilizações</span>
          <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', borderRadius: 4, padding: '3px 8px', fontWeight: 600 }}>
            {filteredData.length} registros
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: 700 }}>
                <th style={{ ...thStyle, textAlign: 'left' }}>Data</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Código do Cupom</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Loja (Seller)</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Coordenador</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Distrital</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Valor da Compra</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                    Nenhuma utilização de cupom encontrada para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...tdStyle, color: '#0f2050', fontWeight: 600 }}>{item.date ? item.date.split('-').reverse().join('/') : '—'}</td>
                    <td style={tdStyle}><span style={badgeStyle}>{item.coupon}</span></td>
                    <td style={{ ...tdStyle, color: '#1e3a8a', fontWeight: 600 }}>{item.store}</td>
                    <td style={tdStyle}>{item.coordenador}</td>
                    <td style={tdStyle}>{item.distrital}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#047857' }}>{fmtCurrency(item.value)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {maxPages > 1 && (
          <div style={{
            padding: '12px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>Página <strong>{page + 1}</strong> de <strong>{maxPages}</strong></span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                disabled={page === 0} 
                onClick={() => setPage(p => p - 1)}
                style={{
                  padding: '4px 10px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1',
                  background: '#fff', color: page === 0 ? '#94a3b8' : '#475569',
                  cursor: page === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                Anterior
              </button>
              <button 
                disabled={page >= maxPages - 1} 
                onClick={() => setPage(p => p + 1)}
                style={{
                  padding: '4px 10px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1',
                  background: '#fff', color: page >= maxPages - 1 ? '#94a3b8' : '#475569',
                  cursor: page >= maxPages - 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Próximo
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// Estilos de suporte local
const thStyle = {
  padding: '10px 12px', fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b',
};

const tdStyle = {
  padding: '10px 12px', color: '#475569', fontSize: 12,
  verticalAlign: 'middle'
};

const badgeStyle = {
  background: '#f5f3ff', border: '1px solid #c4b5fd', color: '#7c3aed',
  fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 6px',
};
