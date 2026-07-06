import React, { useEffect, useRef, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { MapPin, TrendingUp, TrendingDown, Target, DollarSign, Globe } from 'lucide-react';

export default function GeoMapPage({ filiais, labelAtual, labelAtualAno, labelAnt }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);
  const [mapMetric, setMapMetric] = useState('atingimento'); // atingimento, evolucao, participacao

  // Formatação de valores
  const fmtR = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
  const fmtPct = (v) => `${(v || 0).toFixed(1).replace('.', ',')}%`;

  // Filtra apenas filiais com coordenadas válidas para o mapa
  const filiaisComCoords = useMemo(() => {
    return filiais.filter(f => f.coords && Array.isArray(f.coords) && f.coords.length === 2);
  }, [filiais]);

  // 1. Agregação por Estado (UF)
  const dadosPorUF = useMemo(() => {
    const ufMap = {};
    filiais.forEach(f => {
      const uf = f.uf || 'N/I';
      if (!ufMap[uf]) {
        ufMap[uf] = { uf, venda: 0, meta: 0, venda_anterior: 0, be_atual: 0, be_anterior: 0, lojas: 0 };
      }
      ufMap[uf].venda += f.venda_jul26 || 0;
      ufMap[uf].meta += f.meta_total || 0;
      ufMap[uf].venda_anterior += f.venda_jul25 || 0;
      ufMap[uf].be_atual += f.base_emp_jul26 || 0;
      ufMap[uf].be_anterior += f.base_emp_jul25 || 0;
      ufMap[uf].lojas += 1;
    });

    return Object.values(ufMap).map(u => ({
      ...u,
      pct_meta: u.meta ? (u.venda / u.meta) * 100 : 0,
      evol_yoy: u.venda_anterior ? ((u.venda - u.venda_anterior) / u.venda_anterior) * 100 : 0,
      part_digital: u.be_atual ? (u.venda / u.be_atual) * 100 : 0
    })).sort((a, b) => b.venda - a.venda);
  }, [filiais]);

  // 2. Agregação por Cidade (Top 10)
  const dadosPorCidade = useMemo(() => {
    const cidMap = {};
    filiais.forEach(f => {
      const cidade = f.municipio || 'Não Informado';
      const uf = f.uf || '';
      const key = `${cidade} - ${uf}`;
      if (!cidMap[key]) {
        cidMap[key] = { key, cidade, uf, venda: 0, meta: 0, lojas: 0 };
      }
      cidMap[key].venda += f.venda_jul26 || 0;
      cidMap[key].meta += f.meta_total || 0;
      cidMap[key].lojas += 1;
    });

    return Object.values(cidMap)
      .map(c => ({
        ...c,
        pct_meta: c.meta ? (c.venda / c.meta) * 100 : 0
      }))
      .sort((a, b) => b.venda - a.venda)
      .slice(0, 10);
  }, [filiais]);

  // Determinar cor e descrição para o mapa
  const getMarkerProperties = (f) => {
    let color = '#94a3b8';
    let valueStr = '';
    let label = '';

    if (mapMetric === 'atingimento') {
      label = 'Ating. Meta Parcial';
      const pct = f.pct_meta_parcial || 0;
      valueStr = fmtPct(pct);
      if (pct < 85) color = '#ef4444';
      else if (pct < 100) color = '#f59e0b';
      else color = '#10b981';
    } else if (mapMetric === 'evolucao') {
      label = 'Evolução YoY';
      const evol = f.evol_yoy || 0;
      valueStr = (evol >= 0 ? '+' : '') + fmtPct(evol);
      if (evol < 0) color = '#ef4444';
      else if (evol < 10) color = '#f59e0b';
      else color = '#10b981';
    } else if (mapMetric === 'participacao') {
      label = 'Participação Digital';
      const part = f.pct_ecomm_jul26 || 0;
      valueStr = fmtPct(part);
      if (part < 6) color = '#ef4444';
      else if (part < 12) color = '#f59e0b';
      else color = '#10b981';
    }

    return { color, valueStr, label };
  };

  useEffect(() => {
    if (!window.L) return;

    if (!mapInstanceRef.current && mapRef.current) {
      // Centro do Sul do Brasil
      const map = window.L.map(mapRef.current, {
        center: [-29.0, -53.0],
        zoom: 6,
        minZoom: 4,
        maxZoom: 16
      });

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      mapInstanceRef.current = map;
      layerGroupRef.current = window.L.layerGroup().addTo(map);
    }

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;

    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // Plotar círculos para cada filial no mapa
    filiaisComCoords.forEach(f => {
      const lat = f.coords[1];
      const lng = f.coords[0];

      if (isNaN(lat) || isNaN(lng)) return;

      const { color, valueStr, label } = getMarkerProperties(f);
      const baseVenda = f.venda_jul26 || 0;
      const radius = Math.max(800, Math.min(25000, Math.sqrt(baseVenda) * 65));

      const circle = window.L.circle([lat, lng], {
        color: color,
        fillColor: color,
        fillOpacity: 0.6,
        radius: radius,
        weight: 1.5
      });

      const popupContent = `
        <div style="font-family: 'Inter', sans-serif; font-size: 11px; color: #1e293b; padding: 4px; min-width: 180px;">
          <h4 style="margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #0f2050; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            ${f.nome}
          </h4>
          <div style="margin-bottom: 3px;"><strong>Local:</strong> ${f.municipio || '—'} (${f.uf || '—'})</div>
          <div style="margin-bottom: 3px;"><strong>Coordenador:</strong> ${f.coordenador || '—'}</div>
          <div style="margin-bottom: 6px; border-bottom: 1px dashed #f1f5f9; padding-bottom: 4px;">
            <strong>Venda Digital:</strong> <span style="font-weight: 700; color: #7c3aed;">${fmtR(f.venda_jul26)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Ating. Meta Parcial:</span>
            <span style="font-weight:700;">${fmtPct(f.pct_meta_parcial)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Evolução YoY:</span>
            <span style="font-weight:700; color:${f.evol_yoy >= 0 ? '#10b981' : '#ef4444'}">${f.evol_yoy >= 0 ? '+' : ''}${fmtPct(f.evol_yoy)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Part. Digital:</span>
            <span style="font-weight:700;">${fmtPct(f.pct_ecomm_jul26)}</span>
          </div>
        </div>
      `;

      circle.bindPopup(popupContent);
      layerGroup.addLayer(circle);
    });

  }, [filiaisComCoords, mapMetric]);

  // Cores personalizadas para os gráficos de Estados
  const STATE_COLORS = {
    'RS': '#3b82f6',
    'SC': '#10b981',
    'PR': '#8b5cf6',
    'N/I': '#94a3b8'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* ── CARD 1: MAPA PRINCIPAL COM LEGENDA ── */}
      <div style={{ padding: '16px 20px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f2050', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              🗺️ Análise de Geolocalização por Lojas
            </h3>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              Visualizando <strong>{filiaisComCoords.length}</strong> filiais com coordenadas de um total de {filiais.length}.
            </span>
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center', background: '#f1f5f9', padding: 3, borderRadius: 8 }}>
            {[
              { key: 'atingimento', label: 'Meta Parcial (%)' },
              { key: 'evolucao', label: 'Evolução YoY (%)' },
              { key: 'participacao', label: 'Part. Digital (%)' },
            ].map(m => (
              <button
                key={m.key}
                onClick={() => setMapMetric(m.key)}
                style={{
                  background: mapMetric === m.key ? '#fff' : 'transparent',
                  border: 'none',
                  color: mapMetric === m.key ? '#0f2050' : '#64748b',
                  borderRadius: 6,
                  padding: '6px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: mapMetric === m.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16, minHeight: 460 }}>
          <div 
            ref={mapRef} 
            style={{ 
              height: '100%', 
              minHeight: 450, 
              width: '100%', 
              borderRadius: 8, 
              border: '1px solid #cbd5e1',
              zIndex: 1
            }} 
          />

          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <h4 style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Filtro Visual Ativo
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {mapMetric === 'atingimento' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                      <span>Meta Batida (&ge; 100%)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                      <span>Alerta (85% a 99%)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                      <span>Insuficiente (&lt; 85%)</span>
                    </div>
                  </>
                )}
                {mapMetric === 'evolucao' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                      <span>Crescimento (&ge; 10%)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                      <span>Estável (0% a 9%)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                      <span>Queda YoY (&lt; 0%)</span>
                    </div>
                  </>
                )}
                {mapMetric === 'participacao' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                      <span>Part. Alta (&ge; 12%)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                      <span>Média (6% a 11%)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                      <span>Baixa Part. (&lt; 6%)</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Volume E-comm
              </h4>
              <span style={{ color: '#475569', lineHeight: 1.4, fontSize: 11 }}>
                Tamanho da bolha corresponde à **venda digital** atual. Lojas com maior faturamento formam círculos maiores no mapa.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CARD 2: INDICADORES E GRÁFICOS POR ESTADO E CIDADE ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
        
        {/* Gráfico 1: Venda por Estado */}
        <div style={{ padding: '16px 20px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, color: '#0f2050', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            📊 Venda E-commerce por Estado (UF)
          </h4>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosPorUF} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="uf" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={v => fmtR(v)} />
                <Tooltip formatter={(v) => [fmtR(v), 'Venda']} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                <Bar dataKey="venda" radius={[4, 4, 0, 0]}>
                  {dadosPorUF.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATE_COLORS[entry.uf] || '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Top 10 Cidades */}
        <div style={{ padding: '16px 20px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, color: '#0f2050', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            🏙️ Top 10 Municípios em Faturamento Digital
          </h4>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosPorCidade} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={v => fmtR(v)} />
                <YAxis type="category" dataKey="cidade" tick={{ fontSize: 10 }} stroke="#64748b" width={90} />
                <Tooltip formatter={(v) => [fmtR(v), 'Venda']} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                <Bar dataKey="venda" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ── CARD 3: TABELA DE PERFORMANCE POR ESTADO (UF) ── */}
      <div style={{ padding: '16px 20px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#0f2050', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          📋 Demonstrativo Consolidado por Unidade Federativa
        </h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: 700 }}>
                <th style={{ padding: '10px 12px' }}>Estado (UF)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Qtd. Filiais</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Venda E-comm</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Meta</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>% Atingimento</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Part. Digital</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Evolução YoY</th>
              </tr>
            </thead>
            <tbody>
              {dadosPorUF.map((u, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', hover: { background: '#f8fafc' } }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATE_COLORS[u.uf] || '#94a3b8' }} />
                    {u.uf === 'RS' ? 'Rio Grande do Sul' : u.uf === 'SC' ? 'Santa Catarina' : u.uf === 'PR' ? 'Paraná' : 'Não Informado'} ({u.uf})
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>{u.lojas}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0f2050' }}>{fmtR(u.venda)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>{fmtR(u.meta)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: u.pct_meta >= 100 ? '#10b981' : u.pct_meta >= 85 ? '#f59e0b' : '#ef4444' }}>
                    {fmtPct(u.pct_meta)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: 'var(--accent)' }}>
                    {fmtPct(u.part_digital)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: u.evol_yoy >= 0 ? '#10b981' : '#ef4444' }}>
                    {u.evol_yoy >= 0 ? '+' : ''}{fmtPct(u.evol_yoy)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
