import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Plus, Minus } from 'lucide-react';

export default function GeoMapPage({ filiais, labelAtual, labelAtualAno, labelAnt }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);
  const [mapMetric, setMapMetric] = useState('atingimento'); // atingimento, evolucao, crescimento, participacao
  const [expandedUFs, setExpandedUFs] = useState(new Set());

  // Formatação de valores
  const fmtR = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
  const fmtPct = (v) => `${(v || 0).toFixed(1).replace('.', ',')}%`;

  // Filtra apenas filiais com coordenadas válidas para o mapa
  const filiaisComCoords = useMemo(() => {
    return filiais.filter(f => f.coords && Array.isArray(f.coords) && f.coords.length === 2);
  }, [filiais]);

  // Alterna o colapso/expansão de um estado
  const toggleUF = (uf) => {
    setExpandedUFs(prev => {
      const next = new Set(prev);
      if (next.has(uf)) {
        next.delete(uf);
      } else {
        next.add(uf);
      }
      return next;
    });
  };

  // 1. Agregação Hierárquica por Estado (UF) e Cidade
  const dadosHierarquiaUF = useMemo(() => {
    const ufMap = {};
    filiais.forEach(f => {
      const uf = f.uf || 'N/I';
      const cidade = f.municipio || 'Não Informado';

      if (!ufMap[uf]) {
        ufMap[uf] = {
          uf,
          venda: 0,
          meta: 0,
          meta_parcial: 0,
          venda_anterior: 0,
          venda_mes_anterior: 0,
          be_atual: 0,
          be_anterior: 0,
          lojas: 0,
          cidades: {}
        };
      }

      ufMap[uf].venda += f.venda_jul26 || 0;
      ufMap[uf].meta += f.meta_total || 0;
      ufMap[uf].meta_parcial += f.meta_parcial || 0;
      ufMap[uf].venda_anterior += f.venda_jul25 || 0;
      ufMap[uf].venda_mes_anterior += f.venda_jun26 || 0;
      ufMap[uf].be_atual += f.base_emp_jul26 || 0;
      ufMap[uf].be_anterior += f.base_emp_jul25 || 0;
      ufMap[uf].lojas += 1;

      if (!ufMap[uf].cidades[cidade]) {
        ufMap[uf].cidades[cidade] = {
          cidade,
          uf,
          venda: 0,
          meta: 0,
          meta_parcial: 0,
          venda_anterior: 0,
          venda_mes_anterior: 0,
          be_atual: 0,
          be_anterior: 0,
          lojas: 0
        };
      }

      const c = ufMap[uf].cidades[cidade];
      c.venda += f.venda_jul26 || 0;
      c.meta += f.meta_total || 0;
      c.meta_parcial += f.meta_parcial || 0;
      c.venda_anterior += f.venda_jul25 || 0;
      c.venda_mes_anterior += f.venda_jun26 || 0;
      c.be_atual += f.base_emp_jul26 || 0;
      c.be_anterior += f.base_emp_jul25 || 0;
      c.lojas += 1;
    });

    return Object.values(ufMap).map(u => {
      const cidadesList = Object.values(u.cidades).map(c => {
        const desvio_parcial = c.meta_parcial ? ((c.venda / c.meta_parcial) - 1) * 100 : 0;
        return {
          ...c,
          desvio_parcial,
          pct_meta: c.meta ? (c.venda / c.meta) * 100 : 0,
          pct_meta_parcial: c.meta_parcial ? (c.venda / c.meta_parcial) * 100 : 0,
          evol_yoy: c.venda_anterior ? ((c.venda - c.venda_anterior) / c.venda_anterior) * 100 : 0,
          evol_mom: c.venda_mes_anterior ? ((c.venda - c.venda_mes_anterior) / c.venda_mes_anterior) * 100 : 0,
          part_digital: c.be_atual ? (c.venda / c.be_atual) * 100 : 0
        };
      }).sort((a, b) => b.venda - a.venda);

      const desvio_parcial = u.meta_parcial ? ((u.venda / u.meta_parcial) - 1) * 100 : 0;

      return {
        ...u,
        cidadesList,
        desvio_parcial,
        pct_meta: u.meta ? (u.venda / u.meta) * 100 : 0,
        pct_meta_parcial: u.meta_parcial ? (u.venda / u.meta_parcial) * 100 : 0,
        evol_yoy: u.venda_anterior ? ((u.venda - u.venda_anterior) / u.venda_anterior) * 100 : 0,
        evol_mom: u.venda_mes_anterior ? ((u.venda - u.venda_mes_anterior) / u.venda_mes_anterior) * 100 : 0,
        part_digital: u.be_atual ? (u.venda / u.be_atual) * 100 : 0
      };
    }).sort((a, b) => b.venda - a.venda);
  }, [filiais]);

  // Cidade options para o gráfico (Top 10 cidades por faturamento)
  const dadosPorCidadeGrafico = useMemo(() => {
    const list = [];
    dadosHierarquiaUF.forEach(u => {
      u.cidadesList.forEach(c => {
        list.push(c);
      });
    });
    return list.sort((a, b) => b.venda - a.venda).slice(0, 10);
  }, [dadosHierarquiaUF]);

  // 2. Dados dos Gráficos Dinâmicos baseados no Pilar Ativo (mapMetric)
  const chartDataUF = useMemo(() => {
    return dadosHierarquiaUF.map(u => {
      let value = 0;
      if (mapMetric === 'atingimento') value = u.desvio_parcial;
      else if (mapMetric === 'evolucao') value = u.evol_yoy;
      else if (mapMetric === 'crescimento') value = u.evol_mom;
      else if (mapMetric === 'participacao') value = u.part_digital;

      return {
        uf: u.uf,
        value: Number(value.toFixed(1))
      };
    });
  }, [dadosHierarquiaUF, mapMetric]);

  const chartDataCidade = useMemo(() => {
    return dadosPorCidadeGrafico.map(c => {
      let value = 0;
      if (mapMetric === 'atingimento') value = c.desvio_parcial;
      else if (mapMetric === 'evolucao') value = c.evol_yoy;
      else if (mapMetric === 'crescimento') value = c.evol_mom;
      else if (mapMetric === 'participacao') value = c.part_digital;

      return {
        cidade: c.cidade,
        value: Number(value.toFixed(1))
      };
    });
  }, [dadosPorCidadeGrafico, mapMetric]);

  // Determinar cor e descrição para o mapa
  const getMarkerProperties = useCallback((f) => {
    let color = '#94a3b8';
    let valueStr = '';
    let label = '';

    if (mapMetric === 'atingimento') {
      label = 'Desvio Meta Parcial';
      const desvio = f.meta_parcial ? ((f.venda_jul26 / f.meta_parcial) - 1) * 100 : 0;
      valueStr = (desvio >= 0 ? '+' : '') + fmtPct(desvio);
      if (desvio < -15) color = '#ef4444';      // Desvio pior que -15%
      else if (desvio < 0) color = '#f59e0b';     // Desvio negativo mas sob controle
      else color = '#10b981';                     // Meta batida ou desvio positivo
    } else if (mapMetric === 'evolucao') {
      label = 'Evolução YoY';
      const evol = f.evol_yoy || 0;
      valueStr = (evol >= 0 ? '+' : '') + fmtPct(evol);
      if (evol < 0) color = '#ef4444';
      else if (evol < 10) color = '#f59e0b';
      else color = '#10b981';
    } else if (mapMetric === 'crescimento') {
      label = 'Crescimento MoM';
      const mom = f.evol_mom || 0;
      valueStr = (mom >= 0 ? '+' : '') + fmtPct(mom);
      if (mom < 0) color = '#ef4444';
      else if (mom < 5) color = '#f59e0b';
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
  }, [mapMetric]);

  useEffect(() => {
    if (!window.L) return;

    if (!mapInstanceRef.current && mapRef.current) {
      // Centro do Sul do Brasil
      const map = window.L.map(mapRef.current, {
        center: [-28.5, -52.5],
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

    // Plotar circleMarkers no mapa. Eles têm tamanho fixo em PIXELS na tela,
    // o que faz com que eles fiquem pequenos e se separem visualmente quando o usuário dá zoom!
    filiaisComCoords.forEach(f => {
      const lat = f.coords[1];
      const lng = f.coords[0];

      if (isNaN(lat) || isNaN(lng)) return;

      const { color } = getMarkerProperties(f);
      const baseVenda = f.venda_jul26 || 0;
      
      // Raio dinâmico em pixels (Min: 6px, Max: 22px) baseado no faturamento
      const radius = Math.max(6, Math.min(22, Math.sqrt(baseVenda) * 0.022));
      const desvioParcial = f.meta_parcial ? ((f.venda_jul26 / f.meta_parcial) - 1) * 100 : 0;

      const marker = window.L.circleMarker([lat, lng], {
        radius: radius,
        color: '#ffffff',
        weight: 1.2,
        fillColor: color,
        fillOpacity: 0.85
      });

      // Detalha os 4 Pilares da Loja no Popup
      const popupContent = `
        <div style="font-family: 'Inter', sans-serif; font-size: 11px; color: #1e293b; padding: 6px; min-width: 220px; line-height: 1.4;">
          <h4 style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #0f2050; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
            ${f.nome}
          </h4>
          <div style="margin-bottom: 4px;"><strong>Local:</strong> ${f.municipio || '—'} (${f.uf || '—'})</div>
          <div style="margin-bottom: 4px;"><strong>Coordenador:</strong> ${f.coordenador || '—'}</div>
          <div style="margin-bottom: 8px; border-bottom: 1px dashed #f1f5f9; padding-bottom: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
            <div>
              <span style="color: #64748b; font-size: 9px; text-transform: uppercase;">Venda Digital</span><br/>
              <strong style="color: #7c3aed; font-size: 12px;">${fmtR(f.venda_jul26)}</strong>
            </div>
            <div>
              <span style="color: #64748b; font-size: 9px; text-transform: uppercase;">Meta Total</span><br/>
              <strong style="color: #1e293b; font-size: 12px;">${fmtR(f.meta_total)}</strong>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px solid #f8fafc; padding-bottom: 2px;">
            <span>Desvio Meta Parcial (Pilar 1):</span>
            <strong style="color: ${desvioParcial >= 0 ? '#10b981' : desvioParcial >= -15 ? '#f59e0b' : '#ef4444'}">
              ${desvioParcial >= 0 ? '+' : ''}${fmtPct(desvioParcial)}
            </strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px solid #f8fafc; padding-bottom: 2px;">
            <span>Ating. Meta Total:</span>
            <strong style="color: ${f.pct_meta_total >= 100 ? '#10b981' : f.pct_meta_total >= 85 ? '#f59e0b' : '#ef4444'}">${fmtPct(f.pct_meta_total)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px solid #f8fafc; padding-bottom: 2px;">
            <span>Evolução YoY (Pilar 2):</span>
            <strong style="color:${f.evol_yoy >= 0 ? '#10b981' : '#ef4444'}">${f.evol_yoy >= 0 ? '+' : ''}${fmtPct(f.evol_yoy)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px solid #f8fafc; padding-bottom: 2px;">
            <span>Crescimento MoM (Pilar 3):</span>
            <strong style="color:${f.evol_mom >= 0 ? '#10b981' : '#ef4444'}">${f.evol_mom >= 0 ? '+' : ''}${fmtPct(f.evol_mom)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Participação Digital (Pilar 4):</span>
            <strong style="color: #2563eb;">${fmtPct(f.pct_ecomm_jul26)}</strong>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      layerGroup.addLayer(marker);
    });

  }, [filiaisComCoords, getMarkerProperties]);

  const STATE_COLORS = {
    'RS': '#3b82f6',
    'SC': '#10b981',
    'PR': '#8b5cf6',
    'N/I': '#94a3b8'
  };

  // Nomes amigáveis para títulos de gráficos e tooltips baseados no pilar
  const infoFiltro = useMemo(() => {
    if (mapMetric === 'atingimento') {
      return { title: 'Desvio Meta Parcial (%)', label: 'Desvio' };
    } else if (mapMetric === 'evolucao') {
      return { title: 'Evolução YoY (%)', label: 'Evolução' };
    } else if (mapMetric === 'crescimento') {
      return { title: 'Crescimento MoM (%)', label: 'Crescimento' };
    } else {
      return { title: 'Participação Digital (%)', label: 'Participação' };
    }
  }, [mapMetric]);

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
              { key: 'atingimento', label: 'Desvio M. Parcial (P1)' },
              { key: 'evolucao', label: 'Evolução YoY (P2)' },
              { key: 'crescimento', label: 'Crescimento MoM (P3)' },
              { key: 'participacao', label: 'Part. Digital (P4)' },
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
                      <span>Meta Batida (&ge; 0% Desvio)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                      <span>Alerta (-15% a -0,1%)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                      <span>Queda (&lt; -15% Desvio)</span>
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
                {mapMetric === 'crescimento' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                      <span>Crescimento MoM (&ge; 5%)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                      <span>Estável (0% a 4.9%)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                      <span>Queda MoM (&lt; 0%)</span>
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
                Fidelidade Visual
              </h4>
              <span style={{ color: '#475569', lineHeight: 1.4, fontSize: 11 }}>
                Pontos mantêm tamanho consistente na tela e se separam conforme o zoom aumenta.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CARD 2: INDICADORES E GRÁFICOS DINÂMICOS POR ESTADO E CIDADE ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
        
        {/* Gráfico 1: Performance por Estado */}
        <div style={{ padding: '16px 20px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, color: '#0f2050', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            📊 {infoFiltro.title} por Estado
          </h4>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataUF} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="uf" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v) => [`${v}%`, infoFiltro.label]} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartDataUF.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATE_COLORS[entry.uf] || '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Top 10 Cidades no Pilar */}
        <div style={{ padding: '16px 20px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, color: '#0f2050', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            🏙️ Top 10 Municípios em {infoFiltro.title}
          </h4>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataCidade} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="cidade" tick={{ fontSize: 10 }} stroke="#64748b" width={90} />
                <Tooltip formatter={(v) => [`${v}%`, infoFiltro.label]} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ── CARD 3: TABELA HIERÁRQUICA DE PERFORMANCE POR ESTADO (UF) ── */}
      <div style={{ padding: '16px 20px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#0f2050', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            📋 Demonstrativo Consolidado por Unidade Federativa
          </h4>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            Clique no estado (<span style={{ fontWeight: 700, color: '#6366f1' }}>+</span>) para detalhar os indicadores por cidade
          </span>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: 700 }}>
                <th style={{ padding: '10px 12px' }}>Estado (UF) / Cidade</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Qtd. Filiais</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Venda E-comm</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Meta Total</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Desvio M. Parcial (P1)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Part. Digital (P4)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Evolução YoY (P2)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Crescimento MoM (P3)</th>
              </tr>
            </thead>
            <tbody>
              {dadosHierarquiaUF.map((u) => {
                const isExpanded = expandedUFs.has(u.uf);
                return (
                  <React.Fragment key={u.uf}>
                    {/* Linha Pai: Estado (UF) */}
                    <tr 
                      onClick={() => toggleUF(u.uf)}
                      style={{ 
                        borderBottom: '1px solid #e2e8f0', 
                        background: '#fff', 
                        cursor: 'pointer',
                        transition: 'background-color 0.15s'
                      }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ 
                          fontSize: 14, 
                          fontWeight: 700, 
                          width: 18, 
                          height: 18,
                          display: 'flex', 
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 4,
                          background: isExpanded ? 'rgba(99,102,241,0.1)' : 'rgba(100,116,139,0.06)',
                          color: isExpanded ? '#6366f1' : '#64748b',
                        }}>
                          {isExpanded ? <Minus size={10} strokeWidth={3} /> : <Plus size={10} strokeWidth={3} />}
                        </span>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATE_COLORS[u.uf] || '#94a3b8' }} />
                        {u.uf === 'RS' ? 'Rio Grande do Sul' : u.uf === 'SC' ? 'Santa Catarina' : u.uf === 'PR' ? 'Paraná' : 'Não Informado'} ({u.uf})
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>{u.lojas}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0f2050' }}>{fmtR(u.venda)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>{fmtR(u.meta)}</td>
                      
                      {/* Desvio Meta Parcial */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: u.desvio_parcial >= 0 ? '#10b981' : u.desvio_parcial >= -15 ? '#f59e0b' : '#ef4444' }}>
                        {u.desvio_parcial >= 0 ? '+' : ''}{fmtPct(u.desvio_parcial)}
                      </td>
                      
                      {/* Part. Digital */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: '#2563eb' }}>
                        {fmtPct(u.part_digital)}
                      </td>
                      
                      {/* Evolução YoY */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: u.evol_yoy >= 0 ? '#10b981' : '#ef4444' }}>
                        {u.evol_yoy >= 0 ? '+' : ''}{fmtPct(u.evol_yoy)}
                      </td>

                      {/* Crescimento MoM */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: u.evol_mom >= 0 ? '#10b981' : '#ef4444' }}>
                        {u.evol_mom >= 0 ? '+' : ''}{fmtPct(u.evol_mom)}
                      </td>
                    </tr>

                    {/* Linhas Filhas: Cidades do Estado */}
                    {isExpanded && u.cidadesList.map((c, idx) => (
                      <tr 
                        key={`${u.uf}-${c.cidade}-${idx}`} 
                        style={{ 
                          borderBottom: '1px solid #f1f5f9', 
                          background: '#f8fafc',
                        }}
                      >
                        <td style={{ padding: '8px 12px 8px 36px', fontWeight: 500, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: '#94a3b8', fontSize: 10 }}>↳</span> {c.cidade}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>{c.lojas}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>{fmtR(c.venda)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>{fmtR(c.meta)}</td>
                        
                        {/* Desvio Meta Parcial */}
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: c.desvio_parcial >= 0 ? '#10b981' : c.desvio_parcial >= -15 ? '#f59e0b' : '#ef4444' }}>
                          {c.desvio_parcial >= 0 ? '+' : ''}{fmtPct(c.desvio_parcial)}
                        </td>
                        
                        {/* Part. Digital */}
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500, color: '#3b82f6' }}>
                          {fmtPct(c.part_digital)}
                        </td>
                        
                        {/* Evolução YoY */}
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: c.evol_yoy >= 0 ? '#10b981' : '#ef4444' }}>
                          {c.evol_yoy >= 0 ? '+' : ''}{fmtPct(c.evol_yoy)}
                        </td>

                        {/* Crescimento MoM */}
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: c.evol_mom >= 0 ? '#10b981' : '#ef4444' }}>
                          {c.evol_mom >= 0 ? '+' : ''}{fmtPct(c.evol_mom)}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
