"""
build_dashboard_cintia.py — Compila o Dashboard Executivo da Diretoria C (Cíntia Silva)
Integrando o "Filtrinho de Data" oficial (MTD, Ontem D-1, 7 Dias, Semana, Custom)
com metas diarizadas completas (dias 1..30) e vendas do Qlik Cloud SaaS.

Funcionalidades:
1. Filtro de Data Oficial FSJ (MTD D-1 como padrão, Ontem D-1, 7 Dias, Semana Atual, Custom)
2. Toggle "Sem Figital" (Puro Online: Site, Site Tele Entrega, App, App Tele Entrega, iFood)
   vs "Com Figital" (Online + Loja Figital)
3. Filtros Dropdown de Grupo e Linha com cascata inteligente
4. Visão de Categorias com acordeão / drill-down in-place (clique no grupo abre suas linhas)
5. Formatação numérica brasileira oficial: 1.000 (sem casas decimais) para valores monetários
"""
import os
import sys
import json
import time

if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'): sys.stderr.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
INPUT_JSON = os.path.join(DATA_DIR, "dashboard_cintia_data.json")
OUTPUT_HTML = os.path.join(BASE_DIR, "index.html")

def build_html():
    t0 = time.time()
    print("=" * 70)
    print("  COMPILAÇÃO DO DASHBOARD EXECUTIVO — DIRETORIA CÍNTIA SILVA")
    print("=" * 70)

    if not os.path.exists(INPUT_JSON):
        raise FileNotFoundError(f"Arquivo não encontrado: {INPUT_JSON}. Execute consolidate_cintia_data.py primeiro.")

    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        dash_data = json.load(f)

    meta = dash_data.get("metadata", {})
    kpis = dash_data.get("kpis", {})
    max_dia = meta.get("max_dia", 15)
    max_dia_str = f"{max_dia:02d}"
    data_corte = meta.get("data_corte", f"{max_dia_str}/09/2026 (D-1 Fechado)")
    gerado_em = meta.get("gerado_em", time.strftime("%d/%m/%Y %H:%M:%S"))

    def py_format_brl(val):
        if val is None or val == "": return "R$ 0"
        n = int(round(float(val)))
        if n < 0:
            return "- R$ " + f"{abs(n):,}".replace(",", ".")
        return "R$ " + f"{n:,}".replace(",", ".")

    def py_format_gap(val):
        if val is None or val == "": return "R$ 0"
        n = int(round(float(val)))
        if n > 0:
            return "+ R$ " + f"{n:,}".replace(",", ".")
        elif n < 0:
            return "- R$ " + f"{abs(n):,}".replace(",", ".")
        return "R$ 0"

    raw_json_str = json.dumps(dash_data, ensure_ascii=False)

    html_content = f"""<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Diretoria C — Cíntia Silva | Acompanhamento Estratégico de Metas Digitais</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💊</text></svg>">
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>

  <style>
    /* ==========================================================================
       FARMÁCIAS SÃO JOÃO — APPLE HIG EXECUTIVE DESIGN SYSTEM
       ========================================================================== */
    :root {{
      --bg-canvas: #0A0D14;
      --surface: #121826;
      --surface-translucent: rgba(18, 24, 38, 0.85);
      --surface-hover: #1A2234;
      --surface-card: #151D2E;
      --surface-subtle: #0E1422;
      --border: rgba(255, 255, 255, 0.08);
      --border-subtle: rgba(255, 255, 255, 0.04);
      --border-hover: rgba(255, 255, 255, 0.18);
      --separator: rgba(255, 255, 255, 0.08);

      --text-primary: #F8FAFC;
      --text-secondary: #94A3B8;
      --text-tertiary: #64748B;
      --text-quaternary: #475569;

      --sj-blue: #0071E3;
      --sj-blue-hover: #0077ED;
      --sj-blue-soft: rgba(0, 113, 227, 0.15);
      --sj-blue-border: rgba(0, 113, 227, 0.35);

      --apple-green: #34C759;
      --apple-green-soft: rgba(52, 199, 89, 0.14);
      --apple-green-text: #30D158;
      --apple-green-border: rgba(52, 199, 89, 0.30);

      --apple-red: #FF453A;
      --apple-red-soft: rgba(255, 69, 58, 0.14);
      --apple-red-text: #FF453A;
      --apple-red-border: rgba(255, 69, 58, 0.30);

      --apple-orange: #FF9F0A;
      --apple-orange-soft: rgba(255, 159, 10, 0.14);
      --apple-orange-text: #FF9F0A;
      --apple-orange-border: rgba(255, 159, 10, 0.30);

      --apple-purple: #BF5AF2;
      --apple-purple-soft: rgba(191, 90, 242, 0.14);

      --radius-xs: 6px;
      --radius-sm: 10px;
      --radius-md: 14px;
      --radius-lg: 18px;
      --radius-xl: 24px;
      --radius-pill: 9999px;

      --shadow-sm: 0 2px 6px rgba(0, 0, 0, 0.25);
      --shadow-md: 0 6px 20px rgba(0, 0, 0, 0.35);
      --shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.50);

      --chart-grid: rgba(255, 255, 255, 0.06);
      --chart-tooltip-bg: rgba(15, 23, 42, 0.95);
    }}

    [data-theme="light"] {{
      --bg-canvas: #F8FAFC;
      --surface: #FFFFFF;
      --surface-translucent: rgba(255, 255, 255, 0.90);
      --surface-hover: #F1F5F9;
      --surface-card: #FFFFFF;
      --surface-subtle: #F8FAFC;
      --border: rgba(0, 0, 0, 0.08);
      --border-subtle: rgba(0, 0, 0, 0.04);
      --border-hover: rgba(0, 0, 0, 0.15);
      --separator: rgba(0, 0, 0, 0.08);

      --text-primary: #0F172A;
      --text-secondary: #475569;
      --text-tertiary: #94A3B8;
      --text-quaternary: #CBD5E1;

      --sj-blue: #0071E3;
      --sj-blue-hover: #0060C0;
      --sj-blue-soft: rgba(0, 113, 227, 0.08);
      --sj-blue-border: rgba(0, 113, 227, 0.25);

      --apple-green: #248A3D;
      --apple-green-soft: rgba(36, 138, 61, 0.10);
      --apple-green-text: #248A3D;
      --apple-green-border: rgba(36, 138, 61, 0.25);

      --apple-red: #D70015;
      --apple-red-soft: rgba(215, 0, 21, 0.10);
      --apple-red-text: #D70015;
      --apple-red-border: rgba(215, 0, 21, 0.25);

      --apple-orange: #C96500;
      --apple-orange-soft: rgba(201, 101, 0, 0.10);
      --apple-orange-text: #C96500;
      --apple-orange-border: rgba(201, 101, 0, 0.25);

      --apple-purple: #9836DC;
      --apple-purple-soft: rgba(152, 54, 220, 0.10);

      --shadow-sm: 0 2px 6px rgba(0, 0, 0, 0.04);
      --shadow-md: 0 6px 18px rgba(0, 0, 0, 0.07);
      --shadow-lg: 0 14px 32px rgba(0, 0, 0, 0.10);

      --chart-grid: rgba(0, 0, 0, 0.06);
      --chart-tooltip-bg: rgba(255, 255, 255, 0.98);
    }}

    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}

    body {{
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg-canvas);
      color: var(--text-primary);
      line-height: 1.45;
      -webkit-font-smoothing: antialiased;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }}

    /* Header Apple Style */
    .header {{
      background: var(--surface-translucent);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
      padding: 14px 28px;
      position: sticky;
      top: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }}

    .header-left {{
      display: flex;
      align-items: center;
      gap: 16px;
    }}

    .logo-badge {{
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: linear-gradient(135deg, #0071E3, #00C6FF);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: 0 4px 14px rgba(0, 113, 227, 0.4);
    }}

    .header-title-group h1 {{
      font-family: 'Outfit', sans-serif;
      font-size: 19px;
      font-weight: 700;
      letter-spacing: -0.3px;
      display: flex;
      align-items: center;
      gap: 8px;
    }}

    .header-title-group p {{
      font-size: 12px;
      color: var(--text-tertiary);
      font-weight: 500;
    }}

    .header-right {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}

    .status-pill {{
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 6px 12px;
      border-radius: var(--radius-pill);
      background: var(--surface-subtle);
      border: 1px solid var(--border);
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
    }}

    .status-dot {{
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--apple-green);
      box-shadow: 0 0 8px var(--apple-green);
      animation: pulse-dot 2s infinite;
    }}

    @keyframes pulse-dot {{
      0%, 100% {{ opacity: 1; transform: scale(1); }}
      50% {{ opacity: 0.5; transform: scale(0.85); }}
    }}

    .btn-icon {{
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: var(--surface-subtle);
      color: var(--text-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 16px;
    }}

    .btn-icon:hover {{
      background: var(--surface-hover);
      border-color: var(--border-hover);
      transform: translateY(-1px);
    }}

    /* Container */
    .container {{
      max-width: 1600px;
      width: 100%;
      margin: 0 auto;
      padding: 20px 24px 60px;
      flex: 1;
    }}

    /* ==========================================================================
       FILTRINHO DE DATA OFICIAL FSJ + TOGGLE FIGITAL + FILTROS GEOGRÁFICOS
       ========================================================================== */
    .date-filter-section {{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 16px 20px;
      margin-bottom: 20px;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }}

    .date-filter-row {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 14px;
    }}

    .date-filter-inputs-group {{
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }}

    .date-filter-title {{
      font-size: 12.5px;
      font-weight: 700;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 6px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }}

    .date-inputs-pair {{
      display: flex;
      align-items: center;
      gap: 8px;
    }}

    .date-input-wrap {{
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--surface-subtle);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 4px 10px;
    }}

    .date-input-wrap label {{
      font-size: 11px;
      font-weight: 600;
      color: var(--text-tertiary);
      text-transform: uppercase;
    }}

    .apple-date-input {{
      background: transparent;
      border: none;
      color: var(--text-primary);
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 600;
      outline: none;
      cursor: pointer;
    }}

    .apple-date-input::-webkit-calendar-picker-indicator {{
      filter: invert(0.6);
      cursor: pointer;
    }}

    .date-range-separator {{
      color: var(--text-tertiary);
      font-size: 12px;
      font-weight: 600;
    }}

    .date-presets-group {{
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }}

    .preset-pill {{
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 14px;
      border-radius: var(--radius-pill);
      font-size: 12px;
      font-weight: 600;
      background: var(--surface-subtle);
      color: var(--text-secondary);
      border: 1px solid var(--border);
      cursor: pointer;
      transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
    }}

    .preset-pill:hover {{
      background: var(--surface-hover);
      color: var(--text-primary);
      border-color: var(--sj-blue);
      transform: translateY(-1px);
    }}

    .preset-pill.active {{
      background: var(--sj-blue) !important;
      color: #FFFFFF !important;
      border-color: var(--sj-blue) !important;
      box-shadow: 0 2px 10px var(--sj-blue-soft);
    }}

    .date-period-badge {{
      font-size: 12px;
      font-weight: 600;
      padding: 5px 14px;
      border-radius: var(--radius-pill);
      background: rgba(0, 113, 227, 0.10);
      color: var(--sj-blue);
      border: 1px solid rgba(0, 113, 227, 0.25);
    }}

    /* Toggle Figital (Segmented Control Executivo Apple HIG) */
    .figital-control-group {{
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--surface-subtle);
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      padding: 3px 4px 3px 12px;
    }}

    .figital-control-label {{
      font-size: 11px;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }}

    .segmented-control {{
      display: inline-flex;
      background: rgba(0, 0, 0, 0.25);
      border-radius: var(--radius-pill);
      padding: 2px;
      gap: 2px;
    }}

    [data-theme="light"] .segmented-control {{
      background: rgba(0, 0, 0, 0.06);
    }}

    .segmented-btn {{
      padding: 5px 13px;
      border-radius: var(--radius-pill);
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      background: transparent;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      white-space: nowrap;
    }}

    .segmented-btn:hover {{
      color: var(--text-primary);
    }}

    .segmented-btn.active {{
      background: var(--sj-blue);
      color: #FFFFFF;
      box-shadow: 0 2px 10px rgba(0, 113, 227, 0.45);
      font-weight: 700;
    }}

    .segmented-btn .hint {{
      font-size: 10px;
      opacity: 0.82;
      font-weight: 500;
    }}

    /* Sub-bar de Filtros Geográficos e Categoria/Linha */
    .filter-secondary-row {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding-top: 10px;
      border-top: 1px dashed var(--separator);
    }}

    .filter-controls-group {{
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }}

    .filter-select-wrap {{
      display: flex;
      align-items: center;
      gap: 6px;
    }}

    .filter-select-wrap label {{
      font-size: 11.5px;
      font-weight: 600;
      color: var(--text-secondary);
    }}

    .apple-select {{
      background: var(--surface-subtle);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 6px 12px;
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 500;
      color: var(--text-primary);
      outline: none;
      cursor: pointer;
      min-width: 170px;
      transition: all 0.2s ease;
    }}

    .apple-select:hover {{
      border-color: var(--border-hover);
    }}

    .apple-select:focus {{
      border-color: var(--sj-blue);
      box-shadow: 0 0 0 2px var(--sj-blue-soft);
    }}

    .search-input-wrap {{
      position: relative;
      display: flex;
      align-items: center;
    }}

    .apple-search-input {{
      background: var(--surface-subtle);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 6px 12px 6px 30px;
      font-family: inherit;
      font-size: 12.5px;
      color: var(--text-primary);
      width: 220px;
      outline: none;
      transition: all 0.2s ease;
    }}

    .apple-search-input:focus {{
      border-color: var(--sj-blue);
      box-shadow: 0 0 0 2px var(--sj-blue-soft);
      width: 260px;
    }}

    .search-icon-inside {{
      position: absolute;
      left: 10px;
      font-size: 12px;
      color: var(--text-tertiary);
      pointer-events: none;
    }}

    .btn-reset-filters {{
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-tertiary);
      cursor: pointer;
      transition: all 0.15s ease;
    }}

    .btn-reset-filters:hover {{
      background: var(--surface-hover);
      color: var(--text-primary);
      border-color: var(--border-hover);
    }}

    .active-filter-banner {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 10px;
      padding: 8px 16px;
      background: rgba(0, 113, 227, 0.10);
      border: 1px solid rgba(0, 113, 227, 0.30);
      border-radius: 8px;
      font-size: 12px;
      color: var(--text-primary);
    }}

    .active-filter-banner-content {{
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }}

    .active-filter-badge-tag {{
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      font-size: 11px;
      font-weight: 700;
      background: rgba(0, 113, 227, 0.22);
      color: #64D2FF;
      border: 1px solid rgba(0, 113, 227, 0.40);
    }}

    .btn-clear-active-badge {{
      background: transparent;
      border: 1px solid rgba(255, 69, 58, 0.45);
      color: var(--apple-red-text);
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }}

    .btn-clear-active-badge:hover {{
      background: var(--apple-red-soft);
      border-color: var(--apple-red-border);
    }}

    /* Top KPI Cards */
    .kpi-grid {{
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }}

    @media (max-width: 1280px) {{
      .kpi-grid {{ grid-template-columns: repeat(3, 1fr); }}
    }}
    @media (max-width: 768px) {{
      .kpi-grid {{ grid-template-columns: 1fr; }}
    }}

    .kpi-card {{
      background: var(--surface-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 18px 20px;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }}

    .kpi-card:hover {{
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
      border-color: var(--border-hover);
    }}

    .kpi-card::before {{
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: var(--kpi-accent, var(--sj-blue));
    }}

    .kpi-header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }}

    .kpi-label {{
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}

    .kpi-value {{
      font-family: 'Outfit', sans-serif;
      font-size: 26px;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.5px;
      line-height: 1.15;
      margin-bottom: 6px;
    }}

    .kpi-subtext {{
      font-size: 12px;
      color: var(--text-tertiary);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }}

    /* Badges */
    .badge {{
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: var(--radius-pill);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.2px;
      line-height: 1;
    }}

    .badge-success {{
      background: var(--apple-green-soft);
      color: var(--apple-green-text);
      border: 1px solid var(--apple-green-border);
    }}

    .badge-danger {{
      background: var(--apple-red-soft);
      color: var(--apple-red-text);
      border: 1px solid var(--apple-red-border);
    }}

    .badge-warning {{
      background: var(--apple-orange-soft);
      color: var(--apple-orange-text);
      border: 1px solid var(--apple-orange-border);
    }}

    .text-success {{ color: var(--apple-green-text) !important; font-weight: 600; }}
    .text-danger {{ color: var(--apple-red-text) !important; font-weight: 600; }}
    .text-warning {{ color: var(--apple-orange-text) !important; font-weight: 600; }}

    /* Progress bar Apple style */
    .progress-bar-bg {{
      background: rgba(255, 255, 255, 0.08);
      border-radius: var(--radius-pill);
      height: 6px;
      overflow: hidden;
      width: 75px;
      display: inline-block;
      vertical-align: middle;
      margin-right: 8px;
    }}

    [data-theme="light"] .progress-bar-bg {{
      background: rgba(0, 0, 0, 0.08);
    }}

    .progress-bar-fill {{
      height: 100%;
      border-radius: var(--radius-pill);
      transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }}

    /* Tabs Navigation */
    .tab-nav {{
      display: flex;
      gap: 8px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 20px;
      overflow-x: auto;
      padding-bottom: 2px;
    }}

    .tab-btn {{
      padding: 10px 18px;
      border-radius: var(--radius-sm) var(--radius-sm) 0 0;
      font-family: inherit;
      font-size: 13.5px;
      font-weight: 600;
      color: var(--text-secondary);
      background: transparent;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      white-space: nowrap;
    }}

    .tab-btn:hover {{
      color: var(--text-primary);
      background: var(--surface-hover);
    }}

    .tab-btn.active {{
      color: var(--sj-blue);
      border-bottom-color: var(--sj-blue);
      background: var(--surface-subtle);
      font-weight: 700;
    }}

    .tab-counter {{
      font-size: 11px;
      padding: 2px 7px;
      border-radius: var(--radius-pill);
      background: var(--surface-hover);
      color: var(--text-tertiary);
    }}

    .tab-btn.active .tab-counter {{
      background: var(--sj-blue-soft);
      color: var(--sj-blue);
    }}

    /* Cards & Layout */
    .card {{
      background: var(--surface-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      margin-bottom: 20px;
    }}

    .card-header {{
      padding: 16px 22px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }}

    .card-title {{
      font-family: 'Outfit', sans-serif;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.2px;
    }}

    .card-subtitle {{
      font-size: 12px;
      color: var(--text-tertiary);
      margin-top: 2px;
    }}

    .charts-grid {{
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 18px;
    }}

    @media (max-width: 1024px) {{
      .charts-grid {{ grid-template-columns: 1fr; }}
    }}

    .chart-box {{
      padding: 18px 22px;
      height: 340px;
      position: relative;
    }}

    /* Tables */
    .table-container {{
      overflow-x: auto;
      max-height: 560px;
      position: relative;
    }}

    table {{
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 12.5px;
    }}

    thead th {{
      background: var(--surface-subtle);
      color: var(--text-secondary);
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 10;
      white-space: nowrap;
    }}

    thead th.sortable {{
      cursor: pointer;
      user-select: none;
      transition: background-color 0.15s ease, color 0.15s ease;
    }}

    thead th.sortable:hover {{
      background: var(--surface-hover);
      color: var(--sj-blue);
    }}

    thead th.sortable .sort-icon {{
      display: inline-block;
      margin-left: 5px;
      font-size: 10px;
      opacity: 0.45;
      vertical-align: middle;
      transition: opacity 0.15s ease, transform 0.15s ease;
    }}

    thead th.sortable:hover .sort-icon {{
      opacity: 0.9;
    }}

    thead th.sortable.sorted {{
      color: var(--sj-blue) !important;
      background: rgba(0, 113, 227, 0.08) !important;
      border-bottom: 2px solid var(--sj-blue) !important;
    }}

    thead th.sortable.sorted .sort-icon {{
      opacity: 1;
      font-weight: 800;
      color: var(--sj-blue);
    }}

    thead th.num, tbody td.num {{
      text-align: right;
    }}

    tbody tr {{
      border-bottom: 1px solid var(--border-subtle);
      transition: background-color 0.15s ease;
    }}

    tbody tr:hover {{
      background: var(--surface-hover);
    }}

    tbody td {{
      padding: 11px 14px;
      color: var(--text-primary);
      white-space: nowrap;
    }}

    /* Accordion / Drilldown de Linhas dentro de Grupos */
    .clickable-group-row {{
      cursor: pointer;
      user-select: none;
    }}

    .clickable-group-row:hover {{
      background: var(--surface-hover) !important;
    }}

    .expand-icon {{
      display: inline-block;
      font-size: 10px;
      color: var(--text-tertiary);
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      margin-right: 4px;
    }}

    .expand-icon.open {{
      transform: rotate(90deg);
      color: var(--sj-blue);
    }}

    .group-accordion-row {{
      background: var(--surface-subtle) !important;
    }}

    .group-accordion-row td {{
      padding: 0 !important;
      border-bottom: 2px solid var(--sj-blue-border) !important;
    }}

    .nested-accordion-container {{
      padding: 14px 20px 18px 26px;
      border-left: 3px solid var(--sj-blue);
      background: rgba(0, 113, 227, 0.03);
      max-height: 480px;
      overflow-y: auto;
    }}

    .nested-linhas-table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }}

    .nested-linhas-table thead th {{
      background: var(--surface-card);
      color: var(--text-secondary);
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 5;
    }}

    .nested-linhas-table tbody tr {{
      border-bottom: 1px solid var(--border-subtle);
    }}

    .nested-linhas-table tbody tr:hover {{
      background: var(--surface-hover);
    }}

    .nested-linhas-table tbody td {{
      padding: 8px 12px;
      color: var(--text-primary);
    }}

    /* Action buttons inside cards */
    .btn {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-weight: 600;
      background: var(--surface-subtle);
      border: 1px solid var(--border);
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.2s ease;
    }}

    .btn:hover {{
      background: var(--surface-hover);
      border-color: var(--border-hover);
    }}

    .btn-primary {{
      background: var(--sj-blue);
      border-color: var(--sj-blue);
      color: #FFF;
    }}

    .btn-primary:hover {{
      background: var(--sj-blue-hover);
    }}

    /* Footer */
    .footer {{
      margin-top: auto;
      border-top: 1px solid var(--border);
      padding: 18px 28px;
      background: var(--surface-subtle);
      font-size: 11.5px;
      color: var(--text-tertiary);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }}

    .hidden {{ display: none !important; }}
  </style>
</head>
<body>

  <!-- Header Executivo -->
  <header class="header">
    <div class="header-left">
      <div class="logo-badge">💊</div>
      <div class="header-title-group">
        <h1>Diretoria C — Cíntia Silva <span class="badge badge-success">SaaS Online</span></h1>
        <p>Acompanhamento Estratégico Diarizado dos Canais Digitais • Farmácias São João</p>
      </div>
    </div>
    <div class="header-right">
      <div class="status-pill">
        <div class="status-dot"></div>
        <span>Qlik Cloud • Corte: <strong id="headerCutDate">{data_corte}</strong></span>
      </div>
      <button class="btn-icon" onclick="toggleTheme()" title="Alternar Modo Claro / Escuro">🌓</button>
    </div>
  </header>

  <main class="container">

    <!-- ====================================================================
         SEÇÃO FILTRO DE DATA ("O NOSSO FILTRINHO DE DATA")
         ==================================================================== -->
    <section class="date-filter-section">
      <!-- Linha 1: Seletor de Período & Presets -->
      <div class="date-filter-row">
        <div class="date-filter-inputs-group">
          <span class="date-filter-title">📅 Período de Análise:</span>
          <div class="date-inputs-pair">
            <div class="date-input-wrap">
              <label for="filterDateIni">Início</label>
              <input type="date" id="filterDateIni" class="apple-date-input" min="2026-09-01" max="2026-09-{max_dia_str}" value="2026-09-01" onchange="onDateInputChange()">
            </div>
            <span class="date-range-separator">até</span>
            <div class="date-input-wrap">
              <label for="filterDateEnd">Fim</label>
              <input type="date" id="filterDateEnd" class="apple-date-input" min="2026-09-01" max="2026-09-{max_dia_str}" value="2026-09-{max_dia_str}" onchange="onDateInputChange()">
            </div>
          </div>
        </div>

        <div class="date-presets-group">
          <span class="preset-pill active" id="presetMtd" onclick="selectDatePreset('mtd')">⭐ Mês Acumulado (MTD D-1)</span>
          <span class="preset-pill" id="presetYesterday" onclick="selectDatePreset('yesterday')">⚡ Ontem (D-1)</span>
          <span class="preset-pill" id="preset7Days" onclick="selectDatePreset('7days')">📆 Últimos 7 Dias</span>
          <span class="preset-pill" id="presetThisWeek" onclick="selectDatePreset('this_week')">🗓️ Semana Atual</span>
        </div>

        <!-- Toggle Com / Sem Figital (Puro Online vs Total Digital) -->
        <div class="figital-control-group" title="Canais: Site, Site Tele Entrega, App, App Tele Entrega, iFood (+ Figital)">
          <span class="figital-control-label">Canal:</span>
          <div class="segmented-control">
            <button class="segmented-btn active" id="btnFigitalSem" onclick="setFigitalMode('sem')">
              🛒 Sem Figital <span class="hint">(Puro Online)</span>
            </button>
            <button class="segmented-btn" id="btnFigitalCom" onclick="setFigitalMode('com')">
              ⚡ Com Figital <span class="hint">(Online + Loja)</span>
            </button>
          </div>
        </div>

        <div class="date-period-badge" id="datePeriodInfo">
          <span>01 a {max_dia_str}/09/2026 ({max_dia} dias MTD D-1)</span>
        </div>
      </div>

      <!-- Linha 2: Filtros Geográficos, Categorias, Linha & Busca Rápida -->
      <div class="filter-secondary-row">
        <div class="filter-controls-group">
          <div class="filter-select-wrap">
            <label for="filterDistrital">🏢 Distrital:</label>
            <select id="filterDistrital" class="apple-select" onchange="onDistritalFilterChange()">
              <option value="all">Todas as Distritais (4)</option>
            </select>
          </div>

          <div class="filter-select-wrap">
            <label for="filterCoordenador">👔 Coordenador:</label>
            <select id="filterCoordenador" class="apple-select" onchange="onCoordenadorFilterChange()">
              <option value="all">Todos os Coordenadores (29)</option>
            </select>
          </div>

          <div class="filter-select-wrap">
            <label for="filterGrupo">📦 Grupo:</label>
            <select id="filterGrupo" class="apple-select" onchange="onGrupoFilterChange()">
              <option value="all">Todos os Grupos</option>
            </select>
          </div>

          <div class="filter-select-wrap">
            <label for="filterLinha">🏷️ Linha:</label>
            <select id="filterLinha" class="apple-select" onchange="onLinhaFilterChange()">
              <option value="all">Todas as Linhas</option>
            </select>
          </div>
        </div>

        <div class="filter-controls-group">
          <div class="search-input-wrap">
            <span class="search-icon-inside">🔍</span>
            <input type="text" id="filterSearch" class="apple-search-input" placeholder="Buscar loja, coordenador, produto..." oninput="onSearchInputChange()">
          </div>
          <button class="btn-reset-filters" onclick="resetFilters()" title="Limpar todos os filtros e retornar à visão geral">Limpar Filtros</button>
        </div>
      </div>

      <!-- Banner Informativo de Filtro Ativo -->
      <div id="activeFilterBanner" class="active-filter-banner" style="display: none;">
        <div class="active-filter-banner-content">
          <span>📍</span>
          <span style="color: var(--text-secondary);">Filtrando por:</span>
          <span class="active-filter-badge-tag" id="activeFilterTag">Distrital</span>
          <strong id="activeFilterText" style="color: var(--text-primary); font-size: 12.5px;">-</strong>
          <span id="activeFilterDetails" style="color: var(--text-tertiary); font-size: 11px;">-</span>
        </div>
        <button class="btn-clear-active-badge" onclick="resetFilters()">✕ Remover Filtro</button>
      </div>
    </section>

    <!-- ====================================================================
         TOP KPI CARDS (REATIVOS AO FILTRO DE DATA)
         ==================================================================== -->
    <section class="kpi-grid">
      <!-- 1. Meta do Mês -->
      <div class="kpi-card" style="--kpi-accent: #0071E3;">
        <div class="kpi-header">
          <span class="kpi-label" id="labelMetaMes">Meta do Mês (Set/26)</span>
          <span class="badge" style="background: rgba(0, 113, 227, 0.12); color: var(--sj-blue);">Oficial</span>
        </div>
        <div class="kpi-value" id="kpiMetaMes">{py_format_brl(kpis.get('meta_mes', 0))}</div>
        <div class="kpi-subtext" id="kpiMetaMesSub">Base Oficial Diarizada (30 Dias)</div>
      </div>

      <!-- 2. Meta do Período -->
      <div class="kpi-card" style="--kpi-accent: #5856D6;">
        <div class="kpi-header">
          <span class="kpi-label" id="labelMetaPeriodo">Meta do Período</span>
          <span class="badge" style="background: rgba(88, 86, 214, 0.12); color: #5856D6;" id="badgeMetaDias">{max_dia} Dias MTD</span>
        </div>
        <div class="kpi-value" id="kpiMetaPeriodo">{py_format_brl(kpis.get('meta_mtd', 0))}</div>
        <div class="kpi-subtext" id="subtextMetaPeriodo">Acumulado dias 01 a {max_dia_str}/09</div>
      </div>

      <!-- 3. Realizado Digital -->
      <div class="kpi-card" id="cardRealizadoDigital" style="--kpi-accent: #34C759;">
        <div class="kpi-header">
          <span class="kpi-label" id="labelVendaDigitalCard">Venda Digital (Sem Figital)</span>
          <span class="badge badge-warning" id="kpiAtingBadge">0.0%</span>
        </div>
        <div class="kpi-value" id="kpiVendaDigital">{py_format_brl(kpis.get('venda_sem_figital', 0))}</div>
        <div class="kpi-subtext" id="kpiGapSub">
          GAP: <span id="kpiGapVal">R$ 0</span> • <span id="subtextVendaDigitalCard" style="font-size: 11px; opacity: 0.85;">Site, Site Tele Entrega, App, App Tele Entrega, iFood</span>
        </div>
      </div>

      <!-- 4. Projeção de Fechamento -->
      <div class="kpi-card" style="--kpi-accent: #BF5AF2;">
        <div class="kpi-header">
          <span class="kpi-label">Projeção Fechamento Mês</span>
          <span class="badge" style="background: rgba(191, 90, 242, 0.12); color: #BF5AF2;" id="kpiAtingProjBadge">0.0% Meta</span>
        </div>
        <div class="kpi-value" id="kpiProjecao">{py_format_brl(kpis.get('projecao_fechamento', 0))}</div>
        <div class="kpi-subtext" id="kpiRitmoSub">Ritmo do período selecionado</div>
      </div>

      <!-- 5. Venda Total Lojas -->
      <div class="kpi-card" style="--kpi-accent: #30D158;">
        <div class="kpi-header">
          <span class="kpi-label">Venda Total Lojas</span>
          <span class="badge" style="background: rgba(48, 209, 88, 0.12); color: #30D158;" id="kpiShareBadge">Share 0.0%</span>
        </div>
        <div class="kpi-value" id="kpiVendaTotal">{py_format_brl(kpis.get('venda_total_lojas', 0))}</div>
        <div class="kpi-subtext" id="kpiLojasSub">Física + Digital • <strong id="kpiTotalLojasCount">{kpis.get('total_lojas', 0)}</strong> Lojas Ativas</div>
      </div>
    </section>

    <!-- Navigation Tabs -->
    <nav class="tab-nav">
      <button class="tab-btn active" onclick="switchTab('visao-geral')">
        📊 Visão Geral
      </button>
      <button class="tab-btn" onclick="switchTab('distritais')">
        🏢 Distritais <span class="tab-counter" id="badgeDistritaisCount">4</span>
      </button>
      <button class="tab-btn" onclick="switchTab('coordenadores')">
        👔 Coordenadores <span class="tab-counter" id="badgeCoordenadoresCount">29</span>
      </button>
      <button class="tab-btn" onclick="switchTab('filiais')">
        🏪 Filiais (Lojas) <span class="tab-counter" id="badgeFiliaisCount">590</span>
      </button>
      <button class="tab-btn" onclick="switchTab('categorias')">
        📦 Categorias & Grupos <span class="tab-counter" id="badgeCategoriasCount">8</span>
      </button>
      <button class="tab-btn" onclick="switchTab('linhas')">
        🏷️ Linhas de Produtos <span class="tab-counter" id="badgeLinhasCount">586</span>
      </button>
    </nav>

    <!-- Tab 1: Visão Geral -->
    <section id="tab-visao-geral" class="tab-content">
      <div class="charts-grid">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title" id="chartCurvaTitle">Performance Diária — Venda Realizada vs Meta do Dia</div>
              <div class="card-subtitle" id="chartCurvaSubtitle">Acompanhamento diário sem distorção acumulada • Verde: Superou Meta • Linha: Meta Diária</div>
            </div>
          </div>
          <div class="chart-box">
            <canvas id="chartCurvaDiaria"></canvas>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title" id="chartShareTitle">Participação das Distritais</div>
              <div class="card-subtitle" id="chartShareSubtitle">Share de Venda Digital no Período Selecionado</div>
            </div>
          </div>
          <div class="chart-box">
            <canvas id="chartShareDistritais"></canvas>
          </div>
        </div>
      </div>

      <!-- Resumo Distritais na Visão Geral -->
      <div class="card" style="margin-top: 16px;">
        <div class="card-header">
          <div class="card-title">Resumo por Distrital (Período Selecionado)</div>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th class="sortable" onclick="handleSortTable('distritaisOverview', 'nome')" data-table="distritaisOverview" data-col="nome">Distrital <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisOverview', 'meta_periodo')" data-table="distritaisOverview" data-col="meta_periodo">Meta Período <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisOverview', 'venda_digital')" data-table="distritaisOverview" data-col="venda_digital">Venda Digital <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('distritaisOverview', 'atingimento')" data-table="distritaisOverview" data-col="atingimento">Progresso <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisOverview', 'gap')" data-table="distritaisOverview" data-col="gap">GAP R$ (Desvio) <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisOverview', 'projecao')" data-table="distritaisOverview" data-col="projecao">Projeção Mês <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisOverview', 'venda_total')" data-table="distritaisOverview" data-col="venda_total">Venda Total <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisOverview', 'venda_fisica')" data-table="distritaisOverview" data-col="venda_fisica">Venda Física <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisOverview', 'share_digital')" data-table="distritaisOverview" data-col="share_digital">Share Atual <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisOverview', 'share_digital_ly')" data-table="distritaisOverview" data-col="share_digital_ly">Share LY <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisOverview', 'diff_pp_ly')" data-table="distritaisOverview" data-col="diff_pp_ly">Evol. P.P. <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisOverview', 'share_diretoria')" data-table="distritaisOverview" data-col="share_diretoria">% Share Dir. <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisOverview', 'lojas')" data-table="distritaisOverview" data-col="lojas">Lojas <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisOverview', 'media_loja')" data-table="distritaisOverview" data-col="media_loja">R$ / Loja <span class="sort-icon">⇅</span></th>
              </tr>
            </thead>
            <tbody id="tbodyDistritaisOverview"></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Tab 2: Distritais -->
    <section id="tab-distritais" class="tab-content hidden">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Ranking Oficial das Distritais — Diretoria Cíntia Silva</div>
          <button class="btn btn-sm" onclick="exportTableToCSV('tableDistritaisFull', 'distritais_diretoria_c.csv')">Exportar Tabela</button>
        </div>
        <div class="table-container">
          <table id="tableDistritaisFull">
            <thead>
              <tr>
                <th class="sortable" onclick="handleSortTable('distritaisFull', 'rank')" data-table="distritaisFull" data-col="rank">Ranking <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('distritaisFull', 'nome')" data-table="distritaisFull" data-col="nome">Distrital <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisFull', 'meta_mes')" data-table="distritaisFull" data-col="meta_mes">Meta Mês <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisFull', 'meta_periodo')" data-table="distritaisFull" data-col="meta_periodo">Meta Período <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisFull', 'venda_digital')" data-table="distritaisFull" data-col="venda_digital">Venda Digital <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('distritaisFull', 'atingimento')" data-table="distritaisFull" data-col="atingimento">Progresso <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisFull', 'gap')" data-table="distritaisFull" data-col="gap">GAP R$ (Desvio) <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisFull', 'projecao')" data-table="distritaisFull" data-col="projecao">Projeção Mês <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisFull', 'venda_total')" data-table="distritaisFull" data-col="venda_total">Venda Total <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisFull', 'venda_fisica')" data-table="distritaisFull" data-col="venda_fisica">Venda Física <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisFull', 'share_digital')" data-table="distritaisFull" data-col="share_digital">Share Atual <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisFull', 'share_digital_ly')" data-table="distritaisFull" data-col="share_digital_ly">Share LY <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisFull', 'diff_pp_ly')" data-table="distritaisFull" data-col="diff_pp_ly">Evol. P.P. <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisFull', 'share_diretoria')" data-table="distritaisFull" data-col="share_diretoria">% Share Dir. <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisFull', 'lojas')" data-table="distritaisFull" data-col="lojas">Lojas <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('distritaisFull', 'media_loja')" data-table="distritaisFull" data-col="media_loja">R$ / Loja <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('distritaisFull', 'status')" data-table="distritaisFull" data-col="status">Status <span class="sort-icon">⇅</span></th>
              </tr>
            </thead>
            <tbody id="tbodyDistritaisFull"></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Tab 3: Coordenadores -->
    <section id="tab-coordenadores" class="tab-content hidden">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Ranking dos Coordenadores (29)</div>
          <button class="btn btn-sm" onclick="exportTableToCSV('tableCoordenadoresFull', 'coordenadores_diretoria_c.csv')">Exportar Tabela</button>
        </div>
        <div class="table-container">
          <table id="tableCoordenadoresFull">
            <thead>
              <tr>
                <th class="sortable" onclick="handleSortTable('coordenadores', 'rank')" data-table="coordenadores" data-col="rank"># <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('coordenadores', 'nome')" data-table="coordenadores" data-col="nome">Coordenador <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('coordenadores', 'distrital')" data-table="coordenadores" data-col="distrital">Distrital <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('coordenadores', 'meta_mes')" data-table="coordenadores" data-col="meta_mes">Meta Mês <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('coordenadores', 'meta_periodo')" data-table="coordenadores" data-col="meta_periodo">Meta Período <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('coordenadores', 'venda_digital')" data-table="coordenadores" data-col="venda_digital">Venda Digital <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('coordenadores', 'atingimento')" data-table="coordenadores" data-col="atingimento">Atingimento <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('coordenadores', 'gap')" data-table="coordenadores" data-col="gap">GAP R$ (Desvio) <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('coordenadores', 'projecao')" data-table="coordenadores" data-col="projecao">Projeção Mês <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('coordenadores', 'venda_total')" data-table="coordenadores" data-col="venda_total">Venda Total <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('coordenadores', 'venda_fisica')" data-table="coordenadores" data-col="venda_fisica">Venda Física <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('coordenadores', 'share_digital')" data-table="coordenadores" data-col="share_digital">Share Atual <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('coordenadores', 'share_digital_ly')" data-table="coordenadores" data-col="share_digital_ly">Share LY <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('coordenadores', 'diff_pp_ly')" data-table="coordenadores" data-col="diff_pp_ly">Evol. P.P. <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('coordenadores', 'share_diretoria')" data-table="coordenadores" data-col="share_diretoria">% Share Dir. <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('coordenadores', 'lojas')" data-table="coordenadores" data-col="lojas">Lojas <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('coordenadores', 'media_loja')" data-table="coordenadores" data-col="media_loja">R$ / Loja <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('coordenadores', 'status')" data-table="coordenadores" data-col="status">Status <span class="sort-icon">⇅</span></th>
              </tr>
            </thead>
            <tbody id="tbodyCoordenadoresFull"></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Tab 4: Filiais (Lojas) -->
    <section id="tab-filiais" class="tab-content hidden">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Performance Individual das Filiais / Lojas</div>
            <div class="card-subtitle" id="filiaisHeaderSubtitle">Exibindo lojas ordenadas por faturamento digital</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm" onclick="toggleShowAllFiliais()" id="btnToggleFiliais">Ver Todas as Lojas</button>
            <button class="btn btn-sm" onclick="exportTableToCSV('tableFiliaisFull', 'filiais_diretoria_c.csv')">Exportar CSV</button>
          </div>
        </div>
        <div class="table-container">
          <table id="tableFiliaisFull">
            <thead>
              <tr>
                <th class="sortable" onclick="handleSortTable('filiais', 'rank')" data-table="filiais" data-col="rank"># <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('filiais', 'id_loja')" data-table="filiais" data-col="id_loja">ID <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('filiais', 'nome')" data-table="filiais" data-col="nome">Filial / Loja <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('filiais', 'distrital')" data-table="filiais" data-col="distrital">Distrital <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('filiais', 'coordenador')" data-table="filiais" data-col="coordenador">Coordenador <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('filiais', 'meta_mes')" data-table="filiais" data-col="meta_mes">Meta Mês <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('filiais', 'meta_periodo')" data-table="filiais" data-col="meta_periodo">Meta Período <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('filiais', 'venda_digital')" data-table="filiais" data-col="venda_digital">Venda Digital <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('filiais', 'atingimento')" data-table="filiais" data-col="atingimento">Atingimento <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('filiais', 'gap')" data-table="filiais" data-col="gap">GAP R$ (Desvio) <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('filiais', 'projecao')" data-table="filiais" data-col="projecao">Projeção Mês <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('filiais', 'venda_total')" data-table="filiais" data-col="venda_total">Venda Total <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('filiais', 'venda_fisica')" data-table="filiais" data-col="venda_fisica">Venda Física <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('filiais', 'share_digital')" data-table="filiais" data-col="share_digital">Share Atual <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('filiais', 'share_digital_ly')" data-table="filiais" data-col="share_digital_ly">Share LY <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('filiais', 'diff_pp_ly')" data-table="filiais" data-col="diff_pp_ly">Evol. P.P. <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('filiais', 'share_diretoria')" data-table="filiais" data-col="share_diretoria">% Share Dir. <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('filiais', 'status')" data-table="filiais" data-col="status">Status <span class="sort-icon">⇅</span></th>
              </tr>
            </thead>
            <tbody id="tbodyFiliaisFull"></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Tab 5: Categorias (Com Drill-down de Linhas) -->
    <section id="tab-categorias" class="tab-content hidden">
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 10px;">
          <div>
            <div class="card-title">Metas & Vendas por Categoria / Grupo de Produtos</div>
            <div class="card-subtitle" id="categoriasHeaderSubtitle">Clique em qualquer grupo para abrir e expandir suas linhas de produtos associadas</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm" onclick="toggleExpandAllGrupos()" id="btnExpandAllGrupos">📂 Expandir Todas as Linhas</button>
            <button class="btn btn-sm" onclick="exportTableToCSV('tableCategoriasFull', 'categorias_diretoria_c.csv')">Exportar Tabela</button>
          </div>
        </div>
        <div class="table-container">
          <table id="tableCategoriasFull">
            <thead>
              <tr>
                <th class="sortable" onclick="handleSortTable('categorias', 'grupo')" data-table="categorias" data-col="grupo">Grupo / Categoria (Clique para Abrir Linhas) <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('categorias', 'meta_mes')" data-table="categorias" data-col="meta_mes">Meta Mês <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('categorias', 'meta_periodo')" data-table="categorias" data-col="meta_periodo">Meta Período <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('categorias', 'venda_digital')" data-table="categorias" data-col="venda_digital" id="thCatVendaDigital">Venda Digital <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('categorias', 'atingimento')" data-table="categorias" data-col="atingimento">Atingimento <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('categorias', 'gap')" data-table="categorias" data-col="gap">GAP R$ (Desvio) <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('categorias', 'projecao')" data-table="categorias" data-col="projecao">Projeção Mês <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('categorias', 'venda_total')" data-table="categorias" data-col="venda_total">Venda Total <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('categorias', 'venda_fisica')" data-table="categorias" data-col="venda_fisica">Venda Física <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('categorias', 'share_digital')" data-table="categorias" data-col="share_digital">Share Atual <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('categorias', 'share_digital_ly')" data-table="categorias" data-col="share_digital_ly">Share LY <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('categorias', 'diff_pp_ly')" data-table="categorias" data-col="diff_pp_ly">Evol. P.P. <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('categorias', 'share_diretoria')" data-table="categorias" data-col="share_diretoria">% Share Dir. <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('categorias', 'total_linhas')" data-table="categorias" data-col="total_linhas">Linhas <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('categorias', 'status')" data-table="categorias" data-col="status">Status <span class="sort-icon">⇅</span></th>
              </tr>
            </thead>
            <tbody id="tbodyCategoriasFull"></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Tab 6: Linhas de Produtos -->
    <section id="tab-linhas" class="tab-content hidden">
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
          <div>
            <div class="card-title">Abertura Estratégica por Linhas de Produtos</div>
            <div class="card-subtitle" id="linhasHeaderSubtitle">Detalhamento analítico de metas e faturamento digital com filtro por categoria</div>
          </div>
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <div class="filter-select-wrap">
              <label for="filterLinhaGrupo">Categoria:</label>
              <select id="filterLinhaGrupo" class="apple-select" onchange="onLinhaGrupoTabChange()">
                <option value="all">Todas as Categorias</option>
              </select>
            </div>
            <div class="search-input-wrap">
              <span class="search-icon-inside">🔍</span>
              <input type="text" id="filterLinhaSearch" class="apple-search-input" placeholder="Buscar linha de produto..." oninput="onLinhaSearchTabChange()">
            </div>
            <button class="btn btn-sm" onclick="exportTableToCSV('tableLinhasFull', 'linhas_diretoria_c.csv')">Exportar CSV</button>
          </div>
        </div>
        <div class="table-container">
          <table id="tableLinhasFull">
            <thead>
              <tr>
                <th class="sortable" onclick="handleSortTable('linhas', 'rank')" data-table="linhas" data-col="rank"># <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('linhas', 'linha')" data-table="linhas" data-col="linha">Linha de Produto <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('linhas', 'grupo')" data-table="linhas" data-col="grupo">Categoria / Grupo <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('linhas', 'meta_mes')" data-table="linhas" data-col="meta_mes">Meta Mês <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('linhas', 'meta_periodo')" data-table="linhas" data-col="meta_periodo">Meta Período <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('linhas', 'venda_digital')" data-table="linhas" data-col="venda_digital" id="thLinhaVendaDigital">Venda Digital <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('linhas', 'atingimento')" data-table="linhas" data-col="atingimento">Progresso <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('linhas', 'gap')" data-table="linhas" data-col="gap">GAP R$ (Desvio) <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('linhas', 'projecao')" data-table="linhas" data-col="projecao">Projeção Mês <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('linhas', 'venda_total')" data-table="linhas" data-col="venda_total">Venda Total <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('linhas', 'venda_fisica')" data-table="linhas" data-col="venda_fisica">Venda Física <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('linhas', 'share_digital')" data-table="linhas" data-col="share_digital">Share Atual <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('linhas', 'share_digital_ly')" data-table="linhas" data-col="share_digital_ly">Share LY <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('linhas', 'diff_pp_ly')" data-table="linhas" data-col="diff_pp_ly">Evol. P.P. <span class="sort-icon">⇅</span></th>
                <th class="sortable num" onclick="handleSortTable('linhas', 'share_diretoria')" data-table="linhas" data-col="share_diretoria">% Share Dir. <span class="sort-icon">⇅</span></th>
                <th class="sortable" onclick="handleSortTable('linhas', 'status')" data-table="linhas" data-col="status">Status <span class="sort-icon">⇅</span></th>
              </tr>
            </thead>
            <tbody id="tbodyLinhasFull"></tbody>
          </table>
        </div>
        <div class="card-footer" id="linhasPaginationFooter" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-top: 1px solid var(--border); font-size: 12px; color: var(--text-secondary);">
          <span id="linhasCountInfo">Mostrando 1 - 50 de linhas</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn btn-sm" id="btnLinhasPrev" onclick="changeLinhasPage(-1)">← Anterior</button>
            <span id="linhasPageNum" style="font-weight: 600; padding: 0 4px;">Página 1</span>
            <button class="btn btn-sm" id="btnLinhasNext" onclick="changeLinhasPage(1)">Próximo →</button>
          </div>
        </div>
      </div>
    </section>

  </main>

  <footer class="footer">
    <div>
      <strong>Farmácias São João</strong> • Diretoria C (Cíntia Silva) • Dados oficiais extraídos via <em>Qlik Cloud SaaS</em>
    </div>
    <div>
      Atualizado em: <strong>{gerado_em}</strong> (Corte Oficial: {data_corte})
    </div>
  </footer>

  <!-- Embedded Complete Dataset -->
  <script>
    const DASH_DATA = {raw_json_str};

    // Vincula grupos e linhas de cada coordenador e distrital para filtros instantâneos
    (DASH_DATA.coordenadores || []).forEach(c => {{
      c.linhas = (c.grupos || []).flatMap(g => {{
        return (g.linhas || []).map(l => {{
          l._parentGrp = g;
          return l;
        }});
      }});
    }});
    (DASH_DATA.distritais || []).forEach(d => {{
      d.linhas = (d.grupos || []).flatMap(g => {{
        return (g.linhas || []).map(l => {{
          l._parentGrp = g;
          return l;
        }});
      }});
    }});
    (DASH_DATA.grupos || []).forEach(g => {{
      (g.linhas || []).forEach(l => {{
        l._parentGrp = g;
      }});
    }});
    (DASH_DATA.linhas || []).forEach(l => {{
      if (!l._parentGrp) {{
        const foundG = (DASH_DATA.grupos || []).find(g => g.grupo === l.grupo);
        if (foundG) l._parentGrp = foundG;
      }}
    }});

    let maxDia = DASH_DATA.metadata.max_dia || 15;
    let selectedDiaIni = 1; // Padrão MTD: 01 a 15
    let selectedDiaEnd = maxDia;
    let activeDatePreset = 'mtd';
    let activeFigitalMode = 'sem'; // 'sem' | 'com' (Puro Online por padrão, matching 13.791.880,49)
    let currentTab = 'visao-geral';
    let showAllFiliais = false;
    let linhasCurrentPage = 1;
    const LINHAS_PER_PAGE = 50;

    const expandedGrupos = new Set();
    let lastFilterType = 'none'; // 'none' | 'distrital' | 'coordenador' | 'grupo' | 'linha'

    let chartCurvaInstance = null;
    let chartShareInstance = null;

    // =========================================================================
    // FORMATAÇÃO OFICIAL FSJ (Inteiros com separador de milhar pt-BR, sem casas decimais)
    // =========================================================================
    function formatBRL(val) {{
      if (val === null || val === undefined || isNaN(val)) return 'R$ 0';
      const num = Math.round(Number(val));
      if (num < 0) {{
        return '- R$ ' + Math.abs(num).toLocaleString('pt-BR', {{ minimumFractionDigits: 0, maximumFractionDigits: 0 }});
      }}
      return 'R$ ' + num.toLocaleString('pt-BR', {{ minimumFractionDigits: 0, maximumFractionDigits: 0 }});
    }}

    function formatBRLGap(val) {{
      if (val === null || val === undefined || isNaN(val)) return 'R$ 0';
      const num = Math.round(Number(val));
      if (num > 0) {{
        return '+ R$ ' + num.toLocaleString('pt-BR', {{ minimumFractionDigits: 0, maximumFractionDigits: 0 }});
      }} else if (num < 0) {{
        return '- R$ ' + Math.abs(num).toLocaleString('pt-BR', {{ minimumFractionDigits: 0, maximumFractionDigits: 0 }});
      }}
      return 'R$ 0';
    }}

    function formatNumber(val) {{
      if (val === null || val === undefined || isNaN(val)) return '0';
      return Math.round(Number(val)).toLocaleString('pt-BR', {{ minimumFractionDigits: 0, maximumFractionDigits: 0 }});
    }}

    function formatPct(val) {{
      if (val === null || val === undefined || isNaN(val)) return '0,0%';
      return Number(val).toFixed(1).replace('.', ',') + '%';
    }}

    function formatDesvioPct(val) {{
      if (val === null || val === undefined || isNaN(val)) return '0,0%';
      const num = Number(val);
      const sign = num > 0 ? '+' : '';
      return sign + num.toFixed(1).replace('.', ',') + '%';
    }}

    function getStatusBadge(pct) {{
      if (pct >= 100) return '<span class="badge badge-success">' + formatPct(pct) + '</span>';
      if (pct >= 95) return '<span class="badge badge-warning">' + formatPct(pct) + '</span>';
      return '<span class="badge badge-danger">' + formatPct(pct) + '</span>';
    }}

    function getProgressBar(pct) {{
      const pClamped = Math.min(Math.max(pct, 0), 100);
      let color = 'var(--apple-green)';
      if (pct < 95) color = 'var(--apple-red)';
      else if (pct < 100) color = 'var(--apple-orange)';

      return `
        <div style="display: flex; align-items: center;">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${{pClamped}}%; background: ${{color}};"></div>
          </div>
          ${{getStatusBadge(pct)}}
        </div>
      `;
    }}

    function formatDiffPP(diff) {{
      if (diff === null || diff === undefined || isNaN(diff)) return '—';
      const sign = diff >= 0 ? '+' : '';
      const colorClass = diff >= 0 ? 'text-success' : 'text-danger';
      const bg = diff >= 0 ? 'var(--apple-green-soft)' : 'var(--apple-red-soft)';
      const border = diff >= 0 ? 'var(--apple-green-border)' : 'var(--apple-red-border)';
      return `<span class="badge" style="background: ${{bg}}; border: 1px solid ${{border}}; font-size: 10.5px;"><strong class="${{colorClass}}">${{sign}}${{diff.toFixed(1).replace('.', ',')}} p.p.</strong></span>`;
    }}

    function formatShareDir(share) {{
      if (share === null || share === undefined || isNaN(share)) return '0,0%';
      return `<span style="color: var(--sj-blue); font-weight: 600;">${{share.toFixed(1).replace('.', ',')}}%</span>`;
    }}

    // =========================================================================
    // SISTEMA DE ORDENAÇÃO INTERATIVA DE TABELAS (CLICK-TO-SORT)
    // =========================================================================
    let tableSort = {{
      distritaisOverview: {{ col: 'venda_digital', dir: 'desc' }},
      distritaisFull:     {{ col: 'venda_digital', dir: 'desc' }},
      coordenadores:      {{ col: 'venda_digital', dir: 'desc' }},
      filiais:            {{ col: 'venda_digital', dir: 'desc' }},
      categorias:         {{ col: 'venda_digital', dir: 'desc' }},
      linhas:             {{ col: 'venda_digital', dir: 'desc' }}
    }};

    function handleSortTable(tableKey, colKey) {{
      const cur = tableSort[tableKey] || {{ col: 'venda_digital', dir: 'desc' }};
      if (cur.col === colKey) {{
        cur.dir = (cur.dir === 'desc') ? 'asc' : 'desc';
      }} else {{
        cur.col = colKey;
        const isText = ['nome', 'distrital', 'coordenador', 'grupo', 'linha', 'id_loja', 'status'].includes(colKey);
        cur.dir = isText ? 'asc' : 'desc';
      }}
      tableSort[tableKey] = cur;
      updateSortHeaders(tableKey);
      if (tableKey === 'linhas') {{
        renderLinhasTable(false);
      }} else {{
        applyFilters();
      }}
    }}

    function updateSortHeaders(tableKey) {{
      const cur = tableSort[tableKey] || {{ col: 'venda_digital', dir: 'desc' }};
      const ths = document.querySelectorAll(`th[data-table="${{tableKey}}"]`);
      ths.forEach(th => {{
        const col = th.getAttribute('data-col');
        const iconSpan = th.querySelector('.sort-icon');
        if (col === cur.col) {{
          th.classList.add('sorted');
          if (iconSpan) iconSpan.textContent = (cur.dir === 'asc' ? ' ▲' : ' ▼');
        }} else {{
          th.classList.remove('sorted');
          if (iconSpan) iconSpan.textContent = ' ⇅';
        }}
      }});
    }}

    function updateAllSortHeaders() {{
      Object.keys(tableSort).forEach(k => updateSortHeaders(k));
    }}

    function sortItemList(list, colKey, dir) {{
      return [...list].sort((a, b) => {{
        let va = a[colKey];
        let vb = b[colKey];
        if (va === vb) return 0;
        if (va === null || va === undefined || (typeof va === 'number' && isNaN(va))) return 1;
        if (vb === null || vb === undefined || (typeof vb === 'number' && isNaN(vb))) return -1;
        if (typeof va === 'string') {{
          const cmp = va.localeCompare(vb, 'pt-BR', {{ sensitivity: 'base' }});
          return dir === 'asc' ? cmp : -cmp;
        }}
        return dir === 'asc' ? (va - vb) : (vb - va);
      }});
    }}

    // =========================================================================
    // TOGGLE FIGITAL (COM / SEM FIGITAL)
    // =========================================================================
    function setFigitalMode(mode) {{
      activeFigitalMode = mode;
      document.getElementById('btnFigitalCom')?.classList.toggle('active', mode === 'com');
      document.getElementById('btnFigitalSem')?.classList.toggle('active', mode === 'sem');

      const lblVenda = document.getElementById('labelVendaDigitalCard');
      if (lblVenda) {{
        lblVenda.textContent = mode === 'com' ? 'Venda Digital (Com Figital)' : 'Venda Digital (Sem Figital)';
      }}
      const subVenda = document.getElementById('subtextVendaDigitalCard');
      if (subVenda) {{
        subVenda.textContent = mode === 'com' 
          ? 'Site, Site Tele Entrega, App, App Tele Entrega, iFood + Figital' 
          : 'Site, Site Tele Entrega, App, App Tele Entrega, iFood';
      }}
      const thLinha = document.getElementById('thLinhaVendaDigital');
      if (thLinha) {{
        thLinha.textContent = mode === 'com' ? 'Venda Dig. (Com Figital)' : 'Venda Dig. (Sem Figital)';
      }}
      const thCat = document.getElementById('thCatVendaDigital');
      if (thCat) {{
        thCat.textContent = mode === 'com' ? 'Venda Dig. (Com Figital)' : 'Venda Dig. (Sem Figital)';
      }}

      recalcDashboard();
    }}

    // =========================================================================
    // CÁLCULO DINÂMICO DE MÉTRICAS PELO PERÍODO DE DIAS [selectedDiaIni .. selectedDiaEnd]
    // =========================================================================
    function getPeriodMetrics(item) {{
      if (!item) return {{
        meta_periodo: 0, venda_digital: 0, venda_total: 0, venda_fisica: 0,
        gap: 0, desvio: 0, atingimento: 0, share_digital: 0,
        venda_digital_ly: 0, venda_total_ly: 0, share_digital_ly: 0, diff_pp_ly: 0,
        projecao: 0, atingimento_proj: 0, meta_mes: 0
      }};

      const m_dias = item.metas_dias || [];
      const v_dias_dig = (activeFigitalMode === 'sem') 
        ? (item.vendas_dias_sem_figital || []) 
        : (item.vendas_dias_digital || []);
      const v_dias_tot = item.vendas_dias_total || [];

      // Arrays diários de 2025 (LY)
      const v_dias_dig_ly = (activeFigitalMode === 'sem')
        ? (item.vendas_dias_sem_figital_ly || item.vendas_dias_digital_ly || [])
        : (item.vendas_dias_digital_ly || []);
      const v_dias_tot_ly = item.vendas_dias_total_ly || [];

      let meta = 0.0;
      let venda_dig = 0.0;
      let venda_tot = 0.0;
      let venda_dig_ly = 0.0;
      let venda_tot_ly = 0.0;

      // Se o item tiver arrays diários explícitos (Grupos, Distritais, Coordenadores, Rede)
      if (v_dias_dig.length > 0 || m_dias.length > 0) {{
        for (let d = selectedDiaIni; d <= selectedDiaEnd; d++) {{
          if (d - 1 < m_dias.length) meta += (m_dias[d - 1] || 0.0);
        }}
        for (let d = selectedDiaIni; d <= selectedDiaEnd; d++) {{
          if (d - 1 < v_dias_dig.length) venda_dig += (v_dias_dig[d - 1] || 0.0);
          if (d - 1 < v_dias_tot.length) venda_tot += (v_dias_tot[d - 1] || 0.0);
        }}
        for (let d = selectedDiaIni; d <= selectedDiaEnd; d++) {{
          if (d - 1 < v_dias_dig_ly.length) venda_dig_ly += (v_dias_dig_ly[d - 1] || 0.0);
          if (d - 1 < v_dias_tot_ly.length) venda_tot_ly += (v_dias_tot_ly[d - 1] || 0.0);
        }}
      }} else if (item._parentGrp) {{
        // Linha compacta (escala proporcionalmente à curva diária do grupo pai)
        const parentGrp = item._parentGrp;
        const pMetrics = getPeriodMetrics(parentGrp);
        const pBaseSale = (activeFigitalMode === 'sem') 
          ? (parentGrp.venda_sem_figital || 1.0) 
          : (parentGrp.venda_digital || 1.0);
        const ratioSale = pBaseSale > 0 ? (pMetrics.venda_digital / pBaseSale) : 1.0;
        const ratioMeta = (parentGrp.meta_mtd > 0) ? (pMetrics.meta_periodo / parentGrp.meta_mtd) : 1.0;

        const v_base = (activeFigitalMode === 'sem') ? item.venda_sem_figital : item.venda_digital;
        venda_dig = (v_base || 0.0) * ratioSale;
        venda_tot = (item.venda_total || 0.0) * ratioSale;
        meta = (item.meta_mtd || 0.0) * ratioMeta;

        const pBaseSaleLy = (activeFigitalMode === 'sem')
          ? (parentGrp.venda_sem_figital_ly || parentGrp.venda_digital_ly || 1.0)
          : (parentGrp.venda_digital_ly || 1.0);
        const ratioSaleLy = pBaseSaleLy > 0 ? (pMetrics.venda_digital_ly / pBaseSaleLy) : 1.0;
        const v_base_ly = (activeFigitalMode === 'sem')
          ? (item.venda_sem_figital_ly || item.venda_digital_ly || 0.0)
          : (item.venda_digital_ly || 0.0);
        venda_dig_ly = (v_base_ly || 0.0) * ratioSaleLy;
        venda_tot_ly = (item.venda_total_ly || 0.0) * ratioSaleLy;
      }} else {{
        // Filiais ou fallback direto
        const v_base = (activeFigitalMode === 'sem') ? (item.venda_sem_figital || 0.0) : (item.venda_digital || 0.0);
        const v_base_ly = (activeFigitalMode === 'sem') ? (item.venda_sem_figital_ly || item.venda_digital_ly || 0.0) : (item.venda_digital_ly || 0.0);
        
        if (selectedDiaIni > 1 || selectedDiaEnd < 16) {{
          const totalMetrics = getPeriodMetrics(DASH_DATA.total || {{}});
          const ratioDig = (DASH_DATA.total && DASH_DATA.total.venda_digital > 0) ? (totalMetrics.venda_digital / DASH_DATA.total.venda_digital) : 1.0;
          const ratioTot = (DASH_DATA.total && DASH_DATA.total.venda_total > 0) ? (totalMetrics.venda_total / DASH_DATA.total.venda_total) : 1.0;
          const ratioDigLy = (DASH_DATA.total && DASH_DATA.total.venda_digital_ly > 0) ? (totalMetrics.venda_digital_ly / DASH_DATA.total.venda_digital_ly) : 1.0;
          const ratioTotLy = (DASH_DATA.total && DASH_DATA.total.venda_total_ly > 0) ? (totalMetrics.venda_total_ly / DASH_DATA.total.venda_total_ly) : 1.0;
          
          venda_dig = v_base * ratioDig;
          venda_tot = (item.venda_total || 0.0) * ratioTot;
          meta = (item.meta_mtd || 0.0) * ratioDig;
          venda_dig_ly = v_base_ly * ratioDigLy;
          venda_tot_ly = (item.venda_total_ly || 0.0) * ratioTotLy;
        }} else {{
          venda_dig = v_base;
          venda_tot = item.venda_total || 0.0;
          meta = item.meta_mtd || 0.0;
          venda_dig_ly = v_base_ly;
          venda_tot_ly = item.venda_total_ly || 0.0;
        }}
      }}

      meta = Math.round(meta);
      venda_dig = Math.round(venda_dig);
      venda_tot = Math.round(venda_tot);
      venda_dig_ly = Math.round(venda_dig_ly);
      venda_tot_ly = Math.round(venda_tot_ly);
      const venda_fis = Math.max(0, venda_tot - venda_dig);

      const gap = venda_dig - meta;
      const desvio = meta > 0 ? (((venda_dig / meta) - 1) * 100) : 0.0;
      const ating = meta > 0 ? ((venda_dig / meta) * 100) : (venda_dig > 0 ? 100.0 : 0.0);
      const share_dig = venda_tot > 0 ? ((venda_dig / venda_tot) * 100) : 0.0;
      const share_dig_ly = venda_tot_ly > 0 ? ((venda_dig_ly / venda_tot_ly) * 100) : (item.share_digital_ly || 0.0);
      const diff_pp = share_dig - share_dig_ly;

      const dias_sel = (selectedDiaEnd - selectedDiaIni + 1);
      const meta_mes = item.meta_mes || 0.0;
      const proj = dias_sel > 0 ? Math.round(venda_dig / dias_sel * 30) : 0.0;
      const ating_proj = meta_mes > 0 ? ((proj / meta_mes) * 100) : 0.0;

      return {{
        meta_periodo: meta,
        venda_digital: venda_dig,
        venda_total: venda_tot,
        venda_fisica: venda_fis,
        gap: gap,
        desvio: desvio,
        atingimento: ating,
        share_digital: share_dig,
        venda_digital_ly: venda_dig_ly,
        venda_total_ly: venda_tot_ly,
        share_digital_ly: share_dig_ly,
        diff_pp_ly: diff_pp,
        projecao: proj,
        atingimento_proj: ating_proj,
        meta_mes: meta_mes
      }};
    }}

    // =========================================================================
    // FILTRINHO DE DATA — EVENT HANDLERS & PRESETS
    // =========================================================================
    function updateDatePeriodBadge() {{
      const badge = document.getElementById('datePeriodInfo');
      if (!badge) return;
      const pad = (n) => String(n).padStart(2, '0');
      const diffDias = (selectedDiaEnd - selectedDiaIni + 1);

      if (selectedDiaIni === 1 && selectedDiaEnd === maxDia) {{
        badge.innerHTML = `<span>01 a ${{pad(maxDia)}}/09/2026 (${{maxDia}} dias MTD D-1)</span>`;
      }} else if (selectedDiaIni === selectedDiaEnd) {{
        const isOntem = (selectedDiaIni === maxDia);
        badge.innerHTML = `<span>${{pad(selectedDiaIni)}}/09/2026${{isOntem ? ' • Ontem (D-1)' : ''}} (1 dia)</span>`;
      }} else {{
        badge.innerHTML = `<span>${{pad(selectedDiaIni)}} a ${{pad(selectedDiaEnd)}}/09/2026 (${{diffDias}} dias)</span>`;
      }}

      const badgeMetaDias = document.getElementById('badgeMetaDias');
      if (badgeMetaDias) {{
        badgeMetaDias.textContent = diffDias === 1 ? '1 Dia' : `${{diffDias}} Dias`;
      }}
      const subtextMeta = document.getElementById('subtextMetaPeriodo');
      if (subtextMeta) {{
        subtextMeta.textContent = selectedDiaIni === selectedDiaEnd
          ? `Meta específica do dia ${{pad(selectedDiaIni)}}/09`
          : `Acumulado dias ${{pad(selectedDiaIni)}} a ${{pad(selectedDiaEnd)}}/09`;
      }}
    }}

    function updatePresetButtonsState() {{
      const presets = ['yesterday', 'mtd', '7days', 'this_week'];
      presets.forEach(p => {{
        let btnId = 'presetYesterday';
        if (p === 'mtd') btnId = 'presetMtd';
        if (p === '7days') btnId = 'preset7Days';
        if (p === 'this_week') btnId = 'presetThisWeek';
        const btn = document.getElementById(btnId);
        if (btn) {{
          btn.classList.toggle('active', p === activeDatePreset);
        }}
      }});
    }}

    function selectDatePreset(preset) {{
      activeDatePreset = preset;
      const pad = (n) => String(n).padStart(2, '0');

      if (preset === 'mtd') {{
        selectedDiaIni = 1;
        selectedDiaEnd = maxDia;
      }} else if (preset === 'yesterday') {{
        selectedDiaIni = maxDia;
        selectedDiaEnd = maxDia;
      }} else if (preset === '7days') {{
        selectedDiaIni = Math.max(1, maxDia - 6);
        selectedDiaEnd = maxDia;
      }} else if (preset === 'this_week') {{
        let segDia = 1;
        for (let d = maxDia; d >= 1; d--) {{
          const dt = new Date(2026, 8, d);
          if (dt.getDay() === 1) {{ segDia = d; break; }}
        }}
        selectedDiaIni = segDia;
        selectedDiaEnd = maxDia;
      }}

      const iniEl = document.getElementById('filterDateIni');
      const endEl = document.getElementById('filterDateEnd');
      if (iniEl) iniEl.value = `2026-09-${{pad(selectedDiaIni)}}`;
      if (endEl) endEl.value = `2026-09-${{pad(selectedDiaEnd)}}`;

      updateDatePeriodBadge();
      updatePresetButtonsState();
      recalcDashboard();
    }}

    function onDateInputChange() {{
      const iniEl = document.getElementById('filterDateIni');
      const endEl = document.getElementById('filterDateEnd');
      if (!iniEl || !endEl) return;

      const pad = (n) => String(n).padStart(2, '0');
      let iniVal = parseInt(iniEl.value.split('-')[2], 10) || 1;
      let endVal = parseInt(endEl.value.split('-')[2], 10) || maxDia;

      if (iniVal < 1) iniVal = 1;
      if (iniVal > maxDia) iniVal = maxDia;
      if (endVal < 1) endVal = 1;
      if (endVal > maxDia) endVal = maxDia;

      if (iniVal > endVal) {{
        endVal = iniVal;
      }}

      selectedDiaIni = iniVal;
      selectedDiaEnd = endVal;
      iniEl.value = `2026-09-${{pad(selectedDiaIni)}}`;
      endEl.value = `2026-09-${{pad(selectedDiaEnd)}}`;

      if (selectedDiaIni === 1 && selectedDiaEnd === maxDia) {{
        activeDatePreset = 'mtd';
      }} else if (selectedDiaIni === maxDia && selectedDiaEnd === maxDia) {{
        activeDatePreset = 'yesterday';
      }} else if (selectedDiaIni === Math.max(1, maxDia - 6) && selectedDiaEnd === maxDia) {{
        activeDatePreset = '7days';
      }} else {{
        activeDatePreset = 'custom';
      }}

      updateDatePeriodBadge();
      updatePresetButtonsState();
      recalcDashboard();
    }}

    // =========================================================================
    // DETERMINAÇÃO DO ITEM ALVO ATIVO (HIERARQUIA E PRIORIDADE DE FILTROS)
    // =========================================================================
    function getActiveTargetItem() {{
      const selDist = document.getElementById('filterDistrital')?.value || 'all';
      const selCoord = document.getElementById('filterCoordenador')?.value || 'all';
      const selGrupo = document.getElementById('filterGrupo')?.value || 'all';
      const selLinha = document.getElementById('filterLinha')?.value || 'all';

      // 1. Respeita a última categoria de filtro acionada pelo usuário
      if (lastFilterType === 'linha' && selLinha !== 'all') {{
        const found = (DASH_DATA.linhas || []).find(l => l.linha === selLinha);
        if (found) return {{ item: found, type: 'Linha', name: found.linha, parent: found.grupo, lojas: null }};
      }}
      if (lastFilterType === 'grupo' && selGrupo !== 'all') {{
        const found = (DASH_DATA.grupos || []).find(g => g.grupo === selGrupo);
        if (found) return {{ item: found, type: 'Grupo', name: found.grupo, parent: 'Diretoria C', lojas: null }};
      }}
      if (lastFilterType === 'coordenador' && selCoord !== 'all') {{
        const found = (DASH_DATA.coordenadores || []).find(c => c.nome === selCoord);
        if (found) return {{ item: found, type: 'Coordenador', name: found.nome, parent: found.distrital, lojas: found.lojas }};
      }}
      if (lastFilterType === 'distrital' && selDist !== 'all') {{
        const found = (DASH_DATA.distritais || []).find(d => d.nome === selDist);
        if (found) return {{ item: found, type: 'Distrital', name: found.nome, parent: 'Diretoria C', lojas: found.lojas }};
      }}

      // 2. Fallbacks sequenciais se lastFilterType foi resetado
      if (selLinha !== 'all') {{
        const found = (DASH_DATA.linhas || []).find(l => l.linha === selLinha);
        if (found) return {{ item: found, type: 'Linha', name: found.linha, parent: found.grupo, lojas: null }};
      }}
      if (selGrupo !== 'all') {{
        const found = (DASH_DATA.grupos || []).find(g => g.grupo === selGrupo);
        if (found) return {{ item: found, type: 'Grupo', name: found.grupo, parent: 'Diretoria C', lojas: null }};
      }}
      if (selCoord !== 'all') {{
        const found = (DASH_DATA.coordenadores || []).find(c => c.nome === selCoord);
        if (found) return {{ item: found, type: 'Coordenador', name: found.nome, parent: found.distrital, lojas: found.lojas }};
      }}
      if (selDist !== 'all') {{
        const found = (DASH_DATA.distritais || []).find(d => d.nome === selDist);
        if (found) return {{ item: found, type: 'Distrital', name: found.nome, parent: 'Diretoria C', lojas: found.lojas }};
      }}

      return {{ item: DASH_DATA.total, type: 'Diretoria', name: 'Diretoria Cíntia Silva', parent: 'Total', lojas: DASH_DATA.metadata.total_lojas || 590 }};
    }}

    function updateKpiFilterContext(activeTarget, search) {{
      const banner = document.getElementById('activeFilterBanner');
      const tagEl = document.getElementById('activeFilterTag');
      const textEl = document.getElementById('activeFilterText');
      const detailsEl = document.getElementById('activeFilterDetails');

      const isFiltered = (activeTarget.type !== 'Diretoria') || (search && search.length > 0);

      if (banner) {{
        if (isFiltered) {{
          banner.style.display = 'flex';
          if (tagEl) tagEl.textContent = activeTarget.type !== 'Diretoria' ? activeTarget.type : 'Busca';
          if (textEl) textEl.textContent = activeTarget.type !== 'Diretoria' ? activeTarget.name : `"${{search}}"`;
          if (detailsEl) {{
            let det = [];
            if (activeTarget.type === 'Distrital') det.push(`${{activeTarget.lojas}} Lojas Ativas`);
            if (activeTarget.type === 'Coordenador') det.push(`Distrital: ${{activeTarget.parent}} • ${{activeTarget.lojas}} Lojas`);
            if (activeTarget.type === 'Grupo') det.push(`${{activeTarget.item.total_linhas || 0}} Linhas`);
            if (activeTarget.type === 'Linha') det.push(`Categoria: ${{activeTarget.parent}}`);
            if (search && activeTarget.type !== 'Diretoria') det.push(`Busca: "${{search}}"`);
            detailsEl.textContent = det.length > 0 ? `(${{det.join(' • ')}})` : '';
          }}
        }} else {{
          banner.style.display = 'none';
        }}
      }}

      // Atualiza rótulo e subtítulo do Card 1 (Meta do Mês)
      const lblMetaMes = document.getElementById('labelMetaMes');
      const subMetaMes = document.getElementById('kpiMetaMesSub');
      if (lblMetaMes) {{
        lblMetaMes.textContent = activeTarget.type === 'Diretoria' ? 'Meta do Mês (Set/26)' : `Meta Mês • ${{activeTarget.name}}`;
      }}
      if (subMetaMes) {{
        subMetaMes.textContent = activeTarget.type === 'Diretoria' ? 'Base Oficial Diarizada (30 Dias) • Total' : `Base Oficial Diarizada • ${{activeTarget.type}}`;
      }}

      // Atualiza rótulo do Card 3 (Venda Digital)
      const lblVendaDig = document.getElementById('labelVendaDigitalCard');
      if (lblVendaDig) {{
        const figText = activeFigitalMode === 'sem' ? '(Sem Figital)' : '(Com Figital)';
        lblVendaDig.textContent = activeTarget.type === 'Diretoria' ? `Venda Digital ${{figText}}` : `Venda Digital • ${{activeTarget.name}}`;
      }}

      // Atualiza contador de lojas do Card 5 (Venda Total Lojas)
      const subLojas = document.getElementById('kpiLojasSub');
      if (subLojas) {{
        if (activeTarget.type === 'Grupo') {{
          subLojas.innerHTML = `Física + Digital • <strong>${{activeTarget.item.total_linhas || 0}}</strong> Linhas na Categoria`;
        }} else if (activeTarget.type === 'Linha') {{
          subLojas.innerHTML = `Física + Digital • Categoria <strong>${{activeTarget.parent}}</strong>`;
        }} else {{
          const numLojas = activeTarget.lojas || activeTarget.item.lojas || DASH_DATA.metadata.total_lojas || 590;
          subLojas.innerHTML = `Física + Digital • <strong id="kpiTotalLojasCount">${{numLojas}}</strong> Lojas Ativas`;
        }}
      }}
    }}

    // =========================================================================
    // RECALCULO COMPLETO DO DASHBOARD (KPIS + GRAFICOS + TABELAS)
    // =========================================================================
    function recalcDashboard() {{
      const search = (document.getElementById('filterSearch')?.value || '').toLowerCase().trim();
      const activeTarget = getActiveTargetItem();
      const targetItem = activeTarget.item;
      const totMetrics = getPeriodMetrics(targetItem);

      document.getElementById('kpiMetaMes').textContent = formatBRL(totMetrics.meta_mes);
      document.getElementById('kpiMetaPeriodo').textContent = formatBRL(totMetrics.meta_periodo);
      document.getElementById('kpiVendaDigital').textContent = formatBRL(totMetrics.venda_digital);
      document.getElementById('kpiProjecao').textContent = formatBRL(totMetrics.projecao);
      document.getElementById('kpiVendaTotal').textContent = formatBRL(totMetrics.venda_total);

      const atingBadge = document.getElementById('kpiAtingBadge');
      atingBadge.textContent = formatPct(totMetrics.atingimento);
      atingBadge.className = 'badge ' + (totMetrics.atingimento >= 100 ? 'badge-success' : (totMetrics.atingimento >= 95 ? 'badge-warning' : 'badge-danger'));

      const cardReal = document.getElementById('cardRealizadoDigital');
      cardReal.style.setProperty('--kpi-accent', totMetrics.atingimento >= 100 ? '#34C759' : (totMetrics.atingimento >= 95 ? '#FF9F0A' : '#FF453A'));

      const gapValEl = document.getElementById('kpiGapVal');
      gapValEl.textContent = formatBRLGap(totMetrics.gap) + ' (' + formatDesvioPct(totMetrics.desvio) + ')';
      gapValEl.className = totMetrics.gap >= 0 ? 'text-success' : 'text-danger';

      const atingProjBadge = document.getElementById('kpiAtingProjBadge');
      atingProjBadge.textContent = formatPct(totMetrics.atingimento_proj) + ' Meta';

      const shareBadge = document.getElementById('kpiShareBadge');
      shareBadge.textContent = 'Share ' + formatPct(totMetrics.share_digital);

      updateKpiFilterContext(activeTarget, search);
      renderCharts(activeTarget);
      applyFilters();
    }}

    function switchTab(tabId) {{
      currentTab = tabId;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

      const targetBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick')?.includes(tabId));
      if (targetBtn) targetBtn.classList.add('active');

      const targetContent = document.getElementById('tab-' + tabId);
      if (targetContent) targetContent.classList.remove('hidden');

      if (tabId === 'visao-geral') {{
        setTimeout(() => renderCharts(getActiveTargetItem()), 50);
      }}
    }}

    function toggleTheme() {{
      const html = document.documentElement;
      const current = html.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('fsj_cintia_theme', next);
      renderCharts(getActiveTargetItem());
    }}

    const savedTheme = localStorage.getItem('fsj_cintia_theme');
    if (savedTheme) {{
      document.documentElement.setAttribute('data-theme', savedTheme);
    }}

    // =========================================================================
    // FILTROS DROPDOWN (DISTRITAL, COORDENADOR, GRUPO, LINHA)
    // =========================================================================
    function initFilterDropdowns() {{
      // 1. Distritais
      const distSelect = document.getElementById('filterDistrital');
      if (distSelect) {{
        distSelect.innerHTML = '<option value="all">Todas as Distritais (4)</option>';
        DASH_DATA.distritais.forEach(d => {{
          const opt = document.createElement('option');
          opt.value = d.nome;
          opt.textContent = `${{d.nome}} (${{d.lojas}} lojas)`;
          distSelect.appendChild(opt);
        }});
      }}

      // 2. Coordenadores
      populateCoordenadoresDropdown('all', false);

      // 3. Grupos
      const grpSelect = document.getElementById('filterGrupo');
      const linhaGrpSelect = document.getElementById('filterLinhaGrupo');
      if (grpSelect) {{
        grpSelect.innerHTML = '<option value="all">Todos os Grupos</option>';
        DASH_DATA.grupos.forEach(g => {{
          const opt = document.createElement('option');
          opt.value = g.grupo;
          opt.textContent = `${{g.grupo}} (${{(g.linhas || []).length}} linhas)`;
          grpSelect.appendChild(opt);
        }});
      }}
      if (linhaGrpSelect) {{
        linhaGrpSelect.innerHTML = '<option value="all">Todas as Categorias</option>';
        DASH_DATA.grupos.forEach(g => {{
          const opt = document.createElement('option');
          opt.value = g.grupo;
          opt.textContent = `${{g.grupo}} (${{(g.linhas || []).length}} linhas)`;
          linhaGrpSelect.appendChild(opt);
        }});
      }}

      // 4. Linhas
      populateLinhasDropdown('all', false);
    }}

    function populateCoordenadoresDropdown(distFilter = 'all', keepSelected = false) {{
      const coordSelect = document.getElementById('filterCoordenador');
      if (!coordSelect) return;

      const previousVal = coordSelect.value;
      coordSelect.innerHTML = '';

      let coords = DASH_DATA.coordenadores || [];
      if (distFilter !== 'all') {{
        coords = coords.filter(c => c.distrital === distFilter);
      }}

      const defaultOpt = document.createElement('option');
      defaultOpt.value = 'all';
      defaultOpt.textContent = distFilter === 'all' 
        ? `Todos os Coordenadores (${{coords.length}})` 
        : `Todos os Coordenadores de ${{distFilter}} (${{coords.length}})`;
      coordSelect.appendChild(defaultOpt);

      coords.forEach(c => {{
        const opt = document.createElement('option');
        opt.value = c.nome;
        opt.textContent = distFilter === 'all' ? `${{c.nome}} (${{c.distrital}})` : c.nome;
        coordSelect.appendChild(opt);
      }});

      if (keepSelected && previousVal && coords.some(c => c.nome === previousVal)) {{
        coordSelect.value = previousVal;
      }} else {{
        coordSelect.value = 'all';
      }}
    }}

    function populateLinhasDropdown(grupoFilter = 'all', keepSelected = false) {{
      const linhaSelect = document.getElementById('filterLinha');
      if (!linhaSelect) return;

      const previousVal = linhaSelect.value;
      linhaSelect.innerHTML = '';

      const dist = document.getElementById('filterDistrital')?.value || 'all';
      const coord = document.getElementById('filterCoordenador')?.value || 'all';

      let targetSource = DASH_DATA;
      if (coord !== 'all') {{
        const foundC = (DASH_DATA.coordenadores || []).find(c => c.nome === coord);
        if (foundC && foundC.linhas && foundC.linhas.length > 0) targetSource = foundC;
      }} else if (dist !== 'all') {{
        const foundD = (DASH_DATA.distritais || []).find(d => d.nome === dist);
        if (foundD && foundD.linhas && foundD.linhas.length > 0) targetSource = foundD;
      }}

      let linhas = targetSource.linhas || [];
      if (grupoFilter !== 'all') {{
        linhas = linhas.filter(l => l.grupo === grupoFilter);
      }}

      const defaultOpt = document.createElement('option');
      defaultOpt.value = 'all';
      defaultOpt.textContent = grupoFilter === 'all' 
        ? `Todas as Linhas (${{linhas.length}})` 
        : `Todas as Linhas de ${{grupoFilter}} (${{linhas.length}})`;
      linhaSelect.appendChild(defaultOpt);

      linhas.forEach(l => {{
        const opt = document.createElement('option');
        opt.value = l.linha;
        opt.textContent = grupoFilter === 'all' ? `${{l.linha}} (${{l.grupo}})` : l.linha;
        linhaSelect.appendChild(opt);
      }});

      if (keepSelected && previousVal && linhas.some(l => l.linha === previousVal)) {{
        linhaSelect.value = previousVal;
      }} else {{
        linhaSelect.value = 'all';
      }}
    }}

    function onDistritalFilterChange() {{
      lastFilterType = 'distrital';
      const distVal = document.getElementById('filterDistrital')?.value || 'all';
      populateCoordenadoresDropdown(distVal, false);
      const grpVal = document.getElementById('filterGrupo')?.value || 'all';
      populateLinhasDropdown(grpVal, false);
      recalcDashboard();
    }}

    function onCoordenadorFilterChange() {{
      lastFilterType = 'coordenador';
      const coordVal = document.getElementById('filterCoordenador')?.value || 'all';
      if (coordVal !== 'all') {{
        const c = (DASH_DATA.coordenadores || []).find(x => x.nome === coordVal);
        if (c) {{
          const distSelect = document.getElementById('filterDistrital');
          if (distSelect && distSelect.value !== c.distrital) {{
            distSelect.value = c.distrital;
            populateCoordenadoresDropdown(c.distrital, true);
          }}
        }}
      }}
      const grpVal = document.getElementById('filterGrupo')?.value || 'all';
      populateLinhasDropdown(grpVal, false);
      recalcDashboard();
    }}

    function onGrupoFilterChange() {{
      lastFilterType = 'grupo';
      const grpVal = document.getElementById('filterGrupo')?.value || 'all';
      populateLinhasDropdown(grpVal, false);

      const tabLinhaGrp = document.getElementById('filterLinhaGrupo');
      if (tabLinhaGrp && tabLinhaGrp.value !== grpVal) {{
        tabLinhaGrp.value = grpVal;
      }}
      recalcDashboard();
    }}

    function onLinhaFilterChange() {{
      lastFilterType = 'linha';
      const linhaVal = document.getElementById('filterLinha')?.value || 'all';
      if (linhaVal !== 'all') {{
        const l = (DASH_DATA.linhas || []).find(x => x.linha === linhaVal);
        if (l) {{
          const grpSelect = document.getElementById('filterGrupo');
          if (grpSelect && grpSelect.value !== l.grupo) {{
            grpSelect.value = l.grupo;
            populateLinhasDropdown(l.grupo, true);
          }}
          const tabLinhaGrp = document.getElementById('filterLinhaGrupo');
          if (tabLinhaGrp && tabLinhaGrp.value !== l.grupo) {{
            tabLinhaGrp.value = l.grupo;
          }}
        }}
      }}
      recalcDashboard();
    }}

    function onSearchInputChange() {{
      const searchVal = document.getElementById('filterSearch')?.value || '';
      const tabLinhaSearch = document.getElementById('filterLinhaSearch');
      if (tabLinhaSearch && tabLinhaSearch.value !== searchVal) {{
        tabLinhaSearch.value = searchVal;
      }}
      recalcDashboard();
    }}

    function onLinhaGrupoTabChange() {{
      const grpVal = document.getElementById('filterLinhaGrupo')?.value || 'all';
      const mainGrp = document.getElementById('filterGrupo');
      if (mainGrp) {{
        mainGrp.value = grpVal;
        lastFilterType = 'grupo';
        populateLinhasDropdown(grpVal, false);
      }}
      recalcDashboard();
    }}

    function onLinhaSearchTabChange() {{
      const searchVal = document.getElementById('filterLinhaSearch')?.value || '';
      const mainSearch = document.getElementById('filterSearch');
      if (mainSearch) {{
        mainSearch.value = searchVal;
      }}
      recalcDashboard();
    }}

    function applyFilters() {{
      const dist = document.getElementById('filterDistrital')?.value || 'all';
      const coord = document.getElementById('filterCoordenador')?.value || 'all';
      const grp = document.getElementById('filterGrupo')?.value || 'all';
      const linha = document.getElementById('filterLinha')?.value || 'all';
      const search = (document.getElementById('filterSearch')?.value || '').toLowerCase().trim();

      renderAllTables(dist, coord, grp, linha, search);
    }}

    function resetFilters() {{
      lastFilterType = 'none';
      if (document.getElementById('filterDistrital')) document.getElementById('filterDistrital').value = 'all';
      if (document.getElementById('filterCoordenador')) populateCoordenadoresDropdown('all', false);
      if (document.getElementById('filterGrupo')) document.getElementById('filterGrupo').value = 'all';
      if (document.getElementById('filterLinhaGrupo')) document.getElementById('filterLinhaGrupo').value = 'all';
      if (document.getElementById('filterLinha')) populateLinhasDropdown('all', false);
      if (document.getElementById('filterSearch')) document.getElementById('filterSearch').value = '';
      if (document.getElementById('filterLinhaSearch')) document.getElementById('filterLinhaSearch').value = '';

      recalcDashboard();
    }}

    function toggleShowAllFiliais() {{
      showAllFiliais = !showAllFiliais;
      const btn = document.getElementById('btnToggleFiliais');
      if (btn) {{
        btn.textContent = showAllFiliais ? 'Mostrar Top 100 Lojas' : 'Ver Todas as Lojas';
      }}
      applyFilters();
    }}

    // =========================================================================
    // ACORDEÃO / DRILLDOWN DE LINHAS DENTRO DE GRUPOS
    // =========================================================================
    function toggleGroupAccordion(grupo) {{
      if (expandedGrupos.has(grupo)) {{
        expandedGrupos.delete(grupo);
      }} else {{
        expandedGrupos.add(grupo);
      }}
      applyFilters();
    }}

    function toggleExpandAllGrupos() {{
      const totalGrupos = (DASH_DATA.grupos || []).length;
      if (expandedGrupos.size >= totalGrupos) {{
        expandedGrupos.clear();
      }} else {{
        (DASH_DATA.grupos || []).forEach(g => expandedGrupos.add(g.grupo));
      }}
      const btn = document.getElementById('btnExpandAllGrupos');
      if (btn) {{
        btn.textContent = expandedGrupos.size >= totalGrupos 
          ? '📁 Recolher Todas as Linhas' 
          : '📂 Expandir Todas as Linhas';
      }}
      applyFilters();
    }}

    // =========================================================================
    // RENDERIZAÇÃO DAS TABELAS COM MÉTRICAS DINÂMICAS DO PERÍODO
    // =========================================================================
    function renderAllTables(filterDist = 'all', filterCoord = 'all', filterGrupoVal = 'all', filterLinhaVal = 'all', search = '') {{
      // Métricas consolidadas da Diretoria no período (para comparativos de share e peso na rede)
      const dirTot = getPeriodMetrics(DASH_DATA.total || {{}});
      const dirTotDigital = dirTot.venda_digital || 1.0;
      const dirMediaShare = dirTot.share_digital || 0.0;

      // 1. Distritais Overview & Full
      const tbodyDistOver = document.getElementById('tbodyDistritaisOverview');
      const tbodyDistFull = document.getElementById('tbodyDistritaisFull');
      tbodyDistOver.innerHTML = '';
      tbodyDistFull.innerHTML = '';

      let distList = DASH_DATA.distritais
        .filter(d => {{
          if (filterDist !== 'all' && d.nome !== filterDist) return false;
          if (search && !d.nome.toLowerCase().includes(search)) return false;
          return true;
        }})
        .map((d, origIdx) => {{
          const m = getPeriodMetrics(d);
          const share_diretoria = dirTotDigital > 0 ? ((m.venda_digital / dirTotDigital) * 100) : 0.0;
          const diff_share = m.share_digital - dirMediaShare;
          const media_loja = (d.lojas && d.lojas > 0) ? Math.round(m.venda_digital / d.lojas) : m.venda_digital;
          return {{
            rank: origIdx + 1,
            nome: d.nome,
            lojas: d.lojas,
            meta_mes: d.meta_mes,
            ...m,
            share_diretoria: share_diretoria,
            diff_share: diff_share,
            media_loja: media_loja
          }};
        }});

      const badgeDist = document.getElementById('badgeDistritaisCount');
      if (badgeDist) badgeDist.textContent = distList.length;

      // 1a. Distritais Overview
      let distOverviewList = sortItemList(distList, tableSort.distritaisOverview.col, tableSort.distritaisOverview.dir);
      distOverviewList.forEach((d) => {{
        const rowOver = `
          <tr>
            <td><strong>${{d.nome}}</strong></td>
            <td class="num">${{formatBRL(d.meta_periodo)}}</td>
            <td class="num" style="color: var(--sj-blue); font-weight: 700;">${{formatBRL(d.venda_digital)}}</td>
            <td>${{getProgressBar(d.atingimento)}}</td>
            <td class="num ${{d.gap >= 0 ? 'text-success' : 'text-danger'}}">${{formatBRLGap(d.gap)}} <span style="font-size: 10.5px; opacity: 0.85;">(${{formatDesvioPct(d.desvio)}})</span></td>
            <td class="num">${{formatBRL(d.projecao)}}</td>
            <td class="num">${{formatBRL(d.venda_total)}}</td>
            <td class="num" style="color: var(--text-secondary);">${{formatBRL(d.venda_fisica)}}</td>
            <td class="num"><strong>${{formatPct(d.share_digital)}}</strong></td>
            <td class="num" style="color: var(--text-secondary);">${{formatPct(d.share_digital_ly)}}</td>
            <td class="num">${{formatDiffPP(d.diff_pp_ly)}}</td>
            <td class="num">${{formatShareDir(d.share_diretoria)}}</td>
            <td class="num">${{d.lojas}}</td>
            <td class="num">${{formatBRL(d.media_loja)}}</td>
          </tr>
        `;
        tbodyDistOver.insertAdjacentHTML('beforeend', rowOver);
      }});

      // 1b. Distritais Full
      let distFullList = sortItemList(distList, tableSort.distritaisFull.col, tableSort.distritaisFull.dir);
      distFullList.forEach((d, idx) => {{
        const rowFull = `
          <tr>
            <td>#${{idx + 1}}</td>
            <td><strong>${{d.nome}}</strong></td>
            <td class="num">${{formatBRL(d.meta_mes)}}</td>
            <td class="num">${{formatBRL(d.meta_periodo)}}</td>
            <td class="num" style="color: var(--sj-blue); font-weight: 700;">${{formatBRL(d.venda_digital)}}</td>
            <td>${{getProgressBar(d.atingimento)}}</td>
            <td class="num ${{d.gap >= 0 ? 'text-success' : 'text-danger'}}">${{formatBRLGap(d.gap)}} <span style="font-size: 10.5px; opacity: 0.85;">(${{formatDesvioPct(d.desvio)}})</span></td>
            <td class="num">${{formatBRL(d.projecao)}}</td>
            <td class="num">${{formatBRL(d.venda_total)}}</td>
            <td class="num" style="color: var(--text-secondary);">${{formatBRL(d.venda_fisica)}}</td>
            <td class="num"><strong>${{formatPct(d.share_digital)}}</strong></td>
            <td class="num" style="color: var(--text-secondary);">${{formatPct(d.share_digital_ly)}}</td>
            <td class="num">${{formatDiffPP(d.diff_pp_ly)}}</td>
            <td class="num">${{formatShareDir(d.share_diretoria)}}</td>
            <td class="num">${{d.lojas}}</td>
            <td class="num">${{formatBRL(d.media_loja)}}</td>
            <td>${{getStatusBadge(d.atingimento)}}</td>
          </tr>
        `;
        tbodyDistFull.insertAdjacentHTML('beforeend', rowFull);
      }});

      // 2. Coordenadores Full
      const tbodyCoord = document.getElementById('tbodyCoordenadoresFull');
      tbodyCoord.innerHTML = '';
      let coordList = DASH_DATA.coordenadores
        .filter(c => {{
          if (filterDist !== 'all' && c.distrital !== filterDist) return false;
          if (filterCoord !== 'all' && c.nome !== filterCoord) return false;
          if (search && !c.nome.toLowerCase().includes(search)) return false;
          return true;
        }})
        .map((c, origIdx) => {{
          const m = getPeriodMetrics(c);
          const share_diretoria = dirTotDigital > 0 ? ((m.venda_digital / dirTotDigital) * 100) : 0.0;
          const diff_share = m.share_digital - dirMediaShare;
          const media_loja = (c.lojas && c.lojas > 0) ? Math.round(m.venda_digital / c.lojas) : m.venda_digital;
          return {{
            rank: origIdx + 1,
            nome: c.nome,
            distrital: c.distrital,
            lojas: c.lojas,
            meta_mes: c.meta_mes,
            ...m,
            share_diretoria: share_diretoria,
            diff_share: diff_share,
            media_loja: media_loja
          }};
        }});

      coordList = sortItemList(coordList, tableSort.coordenadores.col, tableSort.coordenadores.dir);
      document.getElementById('badgeCoordenadoresCount').textContent = coordList.length;

      coordList.forEach((c, idx) => {{
        const row = `
          <tr>
            <td>#${{idx + 1}}</td>
            <td><strong>${{c.nome}}</strong></td>
            <td><span class="badge" style="background: var(--surface-hover); color: var(--text-secondary);">${{c.distrital}}</span></td>
            <td class="num">${{formatBRL(c.meta_mes)}}</td>
            <td class="num">${{formatBRL(c.meta_periodo)}}</td>
            <td class="num" style="color: var(--sj-blue); font-weight: 700;">${{formatBRL(c.venda_digital)}}</td>
            <td>${{getProgressBar(c.atingimento)}}</td>
            <td class="num ${{c.gap >= 0 ? 'text-success' : 'text-danger'}}">${{formatBRLGap(c.gap)}} <span style="font-size: 10.5px; opacity: 0.85;">(${{formatDesvioPct(c.desvio)}})</span></td>
            <td class="num">${{formatBRL(c.projecao)}}</td>
            <td class="num">${{formatBRL(c.venda_total)}}</td>
            <td class="num" style="color: var(--text-secondary);">${{formatBRL(c.venda_fisica)}}</td>
            <td class="num"><strong>${{formatPct(c.share_digital)}}</strong></td>
            <td class="num" style="color: var(--text-secondary);">${{formatPct(c.share_digital_ly)}}</td>
            <td class="num">${{formatDiffPP(c.diff_pp_ly)}}</td>
            <td class="num">${{formatShareDir(c.share_diretoria)}}</td>
            <td class="num">${{c.lojas}}</td>
            <td class="num">${{formatBRL(c.media_loja)}}</td>
            <td>${{getStatusBadge(c.atingimento)}}</td>
          </tr>
        `;
        tbodyCoord.insertAdjacentHTML('beforeend', row);
      }});

      // 3. Filiais Full
      const tbodyFil = document.getElementById('tbodyFiliaisFull');
      tbodyFil.innerHTML = '';
      let filList = DASH_DATA.filiais
        .filter(f => {{
          if (filterDist !== 'all' && f.distrital !== filterDist) return false;
          if (filterCoord !== 'all' && f.coordenador !== filterCoord) return false;
          if (search) {{
            const target = (f.nome + ' ' + f.id_loja + ' ' + f.coordenador + ' ' + f.distrital).toLowerCase();
            if (!target.includes(search)) return false;
          }}
          return true;
        }})
        .map((f, origIdx) => {{
          const m = getPeriodMetrics(f);
          const share_diretoria = dirTotDigital > 0 ? ((m.venda_digital / dirTotDigital) * 100) : 0.0;
          const diff_share = m.share_digital - dirMediaShare;
          return {{
            rank: origIdx + 1,
            nome: f.nome,
            id_loja: f.id_loja,
            distrital: f.distrital,
            coordenador: f.coordenador,
            meta_mes: f.meta_mes,
            ...m,
            share_diretoria: share_diretoria,
            diff_share: diff_share
          }};
        }});

      filList = sortItemList(filList, tableSort.filiais.col, tableSort.filiais.dir);
      document.getElementById('badgeFiliaisCount').textContent = filList.length;

      const subHeader = document.getElementById('filiaisHeaderSubtitle');
      if (subHeader) {{
        subHeader.textContent = showAllFiliais 
        ? `Exibindo todas as ${{filList.length}} lojas encontradas` 
        : `Exibindo as primeiras ${{Math.min(filList.length, 100)}} de ${{filList.length}} lojas (clique em "Ver Todas as Lojas" para lista completa)`;
      }}

      const maxLimit = showAllFiliais ? filList.length : Math.min(filList.length, 100);
      for (let i = 0; i < maxLimit; i++) {{
        const f = filList[i];
        const row = `
          <tr>
            <td>#${{i + 1}}</td>
            <td><span class="badge" style="background: var(--surface-subtle); color: var(--text-tertiary);">${{f.id_loja || '-'}}</span></td>
            <td><strong>${{f.nome}}</strong></td>
            <td>${{f.distrital}}</td>
            <td>${{f.coordenador}}</td>
            <td class="num">${{formatBRL(f.meta_mes)}}</td>
            <td class="num">${{formatBRL(f.meta_periodo)}}</td>
            <td class="num" style="color: var(--sj-blue); font-weight: 700;">${{formatBRL(f.venda_digital)}}</td>
            <td>${{getProgressBar(f.atingimento)}}</td>
            <td class="num ${{f.gap >= 0 ? 'text-success' : 'text-danger'}}">${{formatBRLGap(f.gap)}} <span style="font-size: 10.5px; opacity: 0.85;">(${{formatDesvioPct(f.desvio)}})</span></td>
            <td class="num">${{formatBRL(f.projecao)}}</td>
            <td class="num">${{formatBRL(f.venda_total)}}</td>
            <td class="num" style="color: var(--text-secondary);">${{formatBRL(f.venda_fisica)}}</td>
            <td class="num"><strong>${{formatPct(f.share_digital)}}</strong></td>
            <td class="num" style="color: var(--text-secondary);">${{formatPct(f.share_digital_ly)}}</td>
            <td class="num">${{formatDiffPP(f.diff_pp_ly)}}</td>
            <td class="num">${{formatShareDir(f.share_diretoria)}}</td>
            <td>${{getStatusBadge(f.atingimento)}}</td>
          </tr>
        `;
        tbodyFil.insertAdjacentHTML('beforeend', row);
      }}

      // 4. Categorias / Grupos (com abertura / drilldown de linhas)
      const tbodyCat = document.getElementById('tbodyCategoriasFull');
      tbodyCat.innerHTML = '';

      let targetSourceCat = DASH_DATA;
      let contextCatLabel = 'Diretoria C (Consolidado)';
      if (filterCoord !== 'all') {{
        const foundC = (DASH_DATA.coordenadores || []).find(c => c.nome === filterCoord);
        if (foundC && foundC.grupos && foundC.grupos.length > 0) {{
          targetSourceCat = foundC;
          contextCatLabel = `Coordenador: ${{foundC.nome}} (${{foundC.distrital}})`;
        }}
      }} else if (filterDist !== 'all') {{
        const foundD = (DASH_DATA.distritais || []).find(d => d.nome === filterDist);
        if (foundD && foundD.grupos && foundD.grupos.length > 0) {{
          targetSourceCat = foundD;
          contextCatLabel = `Distrital: ${{foundD.nome}}`;
        }}
      }}

      const catSub = document.getElementById('categoriasHeaderSubtitle');
      if (catSub) {{
        catSub.textContent = `Acompanhamento detalhado por categoria • Filtrado por: ${{contextCatLabel}}`;
      }}

      let catList = (targetSourceCat.grupos || [])
        .filter(g => {{
          if (filterGrupoVal !== 'all' && g.grupo !== filterGrupoVal) return false;
          if (filterLinhaVal !== 'all') {{
            const hasLinha = (g.linhas || []).some(l => l.linha === filterLinhaVal);
            if (!hasLinha) return false;
          }}
          if (search) {{
            const matchGrp = g.grupo.toLowerCase().includes(search);
            const matchLinha = (g.linhas || []).some(l => l.linha.toLowerCase().includes(search));
            if (!matchGrp && !matchLinha) return false;
          }}
          return true;
        }})
        .map(g => {{
          const m = getPeriodMetrics(g);
          const share_diretoria = dirTotDigital > 0 ? ((m.venda_digital / dirTotDigital) * 100) : 0.0;
          const diff_share = m.share_digital - dirMediaShare;
          return {{
            grupo: g.grupo,
            meta_mes: g.meta_mes,
            linhas: g.linhas || [],
            total_linhas: (g.linhas || []).length,
            ...m,
            share_diretoria: share_diretoria,
            diff_share: diff_share
          }};
        }});

      // Se filtro de linha ou busca ativa, auto-expande os grupos correspondentes
      if (filterLinhaVal !== 'all' || (search && search.length > 0)) {{
        catList.forEach(g => expandedGrupos.add(g.grupo));
      }}

      catList = sortItemList(catList, tableSort.categorias.col, tableSort.categorias.dir);
      document.getElementById('badgeCategoriasCount').textContent = catList.length;

      catList.forEach((g) => {{
        const isExpanded = expandedGrupos.has(g.grupo);
        const totalLinhas = (g.linhas || []).length;
        
        const row = `
          <tr class="clickable-group-row" onclick="toggleGroupAccordion('${{g.grupo}}')">
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="expand-icon ${{isExpanded ? 'open' : ''}}">▶</span>
                <strong>${{g.grupo}}</strong>
                <span class="badge" style="background: var(--surface-subtle); color: var(--sj-blue); font-size: 11px;">${{totalLinhas}} Linhas</span>
              </div>
            </td>
            <td class="num">${{formatBRL(g.meta_mes)}}</td>
            <td class="num">${{formatBRL(g.meta_periodo)}}</td>
            <td class="num" style="color: var(--sj-blue); font-weight: 700;">${{formatBRL(g.venda_digital)}}</td>
            <td>${{getProgressBar(g.atingimento)}}</td>
            <td class="num ${{g.gap >= 0 ? 'text-success' : 'text-danger'}}">${{formatBRLGap(g.gap)}} <span style="font-size: 10.5px; opacity: 0.85;">(${{formatDesvioPct(g.desvio)}})</span></td>
            <td class="num">${{formatBRL(g.projecao)}}</td>
            <td class="num">${{formatBRL(g.venda_total)}}</td>
            <td class="num" style="color: var(--text-secondary);">${{formatBRL(g.venda_fisica)}}</td>
            <td class="num"><strong>${{formatPct(g.share_digital)}}</strong></td>
            <td class="num" style="color: var(--text-secondary);">${{formatPct(g.share_digital_ly)}}</td>
            <td class="num">${{formatDiffPP(g.diff_pp_ly)}}</td>
            <td class="num">${{formatShareDir(g.share_diretoria)}}</td>
            <td class="num">${{totalLinhas}}</td>
            <td>${{getStatusBadge(g.atingimento)}}</td>
          </tr>
        `;
        tbodyCat.insertAdjacentHTML('beforeend', row);

        if (isExpanded) {{
          let linhasDoGrupo = (g.linhas || []).map(l => {{
            const lm = getPeriodMetrics(l);
            const share_grupo = g.venda_digital > 0 ? ((lm.venda_digital / g.venda_digital) * 100) : 0.0;
            const share_diretoria = dirTotDigital > 0 ? ((lm.venda_digital / dirTotDigital) * 100) : 0.0;
            const diff_share = lm.share_digital - dirMediaShare;
            return {{
              linha: l.linha,
              grupo: l.grupo,
              meta_mes: l.meta_mes,
              ...lm,
              share_grupo: share_grupo,
              share_diretoria: share_diretoria,
              diff_share: diff_share
            }};
          }});

          if (filterLinhaVal !== 'all') {{
            linhasDoGrupo = linhasDoGrupo.filter(l => l.linha === filterLinhaVal);
          }}
          if (search) {{
            linhasDoGrupo = linhasDoGrupo.filter(l => l.linha.toLowerCase().includes(search));
          }}

          linhasDoGrupo.sort((a, b) => b.venda_digital - a.venda_digital);

          let nestedRows = '';
          linhasDoGrupo.forEach((l, lIdx) => {{
            nestedRows += `
              <tr>
                <td><span style="color: var(--text-tertiary); font-size: 11px; margin-right: 6px;">${{lIdx + 1}}.</span> <strong>${{l.linha}}</strong></td>
                <td class="num">${{formatBRL(l.meta_mes)}}</td>
                <td class="num">${{formatBRL(l.meta_periodo)}}</td>
                <td class="num" style="color: var(--sj-blue); font-weight: 600;">${{formatBRL(l.venda_digital)}}</td>
                <td>${{getProgressBar(l.atingimento)}}</td>
                <td class="num ${{l.gap >= 0 ? 'text-success' : 'text-danger'}}">${{formatBRLGap(l.gap)}} <span style="font-size: 10.5px; opacity: 0.85;">(${{formatDesvioPct(l.desvio)}})</span></td>
                <td class="num">${{formatBRL(l.projecao)}}</td>
                <td class="num">${{formatBRL(l.venda_total)}}</td>
                <td class="num" style="color: var(--text-secondary);">${{formatBRL(l.venda_fisica)}}</td>
                <td class="num"><strong>${{formatPct(l.share_digital)}}</strong></td>
                <td class="num" style="color: var(--text-secondary);">${{formatPct(l.share_digital_ly)}}</td>
                <td class="num">${{formatDiffPP(l.diff_pp_ly)}}</td>
                <td class="num">${{formatShareDir(l.share_grupo)}}</td>
                <td>${{getStatusBadge(l.atingimento)}}</td>
              </tr>
            `;
          }});

          if (linhasDoGrupo.length === 0) {{
            nestedRows = `<tr><td colspan="14" style="text-align: center; color: var(--text-tertiary); padding: 12px;">Nenhuma linha encontrada para este filtro</td></tr>`;
          }}

          const accordionRow = `
            <tr class="group-accordion-row">
              <td colspan="15">
                <div class="nested-accordion-container">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                    <div style="font-size: 12px; font-weight: 700; color: var(--sj-blue);">
                      📦 Linhas de ${{g.grupo}} (${{linhasDoGrupo.length}} de ${{totalLinhas}} linhas)
                    </div>
                    <div style="font-size: 11px; color: var(--text-tertiary);">
                      Total Venda Linhas: <strong>${{formatBRL(g.venda_digital)}}</strong> • Share na Diretoria: <strong>${{formatPct(g.share_diretoria)}}</strong>
                    </div>
                  </div>
                  <table class="nested-linhas-table">
                    <thead>
                      <tr>
                        <th>Linha de Produto</th>
                        <th class="num">Meta Mês</th>
                        <th class="num">Meta Período</th>
                        <th class="num">Venda Digital</th>
                        <th>Progresso</th>
                        <th class="num">GAP R$ (Desvio)</th>
                        <th class="num">Projeção Mês</th>
                        <th class="num">Venda Total</th>
                        <th class="num">Venda Física</th>
                        <th class="num">Share Atual</th>
                        <th class="num">Share LY</th>
                        <th class="num">Evol. P.P.</th>
                        <th class="num">% Share Grupo</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${{nestedRows}}
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          `;
          tbodyCat.insertAdjacentHTML('beforeend', accordionRow);
        }}
      }});

      // Atualiza visual dos cabeçalhos ordenados
      updateAllSortHeaders();

      // 5. Linhas de Produtos (Paginada)
      renderLinhasTable(false);
    }}

    // =========================================================================
    // RENDERIZAÇÃO DA TABELA DE LINHAS DE PRODUTOS (PAGINAÇÃO & FILTROS)
    // =========================================================================
    function renderLinhasTable(resetPage = false) {{
      if (resetPage) linhasCurrentPage = 1;

      let filterGrp = 'all';
      const topGrp = document.getElementById('filterGrupo')?.value || 'all';
      const tabGrp = document.getElementById('filterLinhaGrupo')?.value || 'all';
      if (topGrp !== 'all') filterGrp = topGrp;
      else if (tabGrp !== 'all') filterGrp = tabGrp;

      const selLinha = document.getElementById('filterLinha')?.value || 'all';
      const topSearch = (document.getElementById('filterSearch')?.value || '').toLowerCase().trim();
      const tabSearch = (document.getElementById('filterLinhaSearch')?.value || '').toLowerCase().trim();
      const search = topSearch || tabSearch || '';

      const tbody = document.getElementById('tbodyLinhasFull');
      if (!tbody) return;
      tbody.innerHTML = '';

      const dist = document.getElementById('filterDistrital')?.value || 'all';
      const coord = document.getElementById('filterCoordenador')?.value || 'all';

      let targetSourceLinhas = DASH_DATA;
      let contextLinhasLabel = 'Diretoria C (Consolidado)';
      if (coord !== 'all') {{
        const foundC = (DASH_DATA.coordenadores || []).find(c => c.nome === coord);
        if (foundC && foundC.linhas && foundC.linhas.length > 0) {{
          targetSourceLinhas = foundC;
          contextLinhasLabel = `Coordenador: ${{foundC.nome}}`;
        }}
      }} else if (dist !== 'all') {{
        const foundD = (DASH_DATA.distritais || []).find(d => d.nome === dist);
        if (foundD && foundD.linhas && foundD.linhas.length > 0) {{
          targetSourceLinhas = foundD;
          contextLinhasLabel = `Distrital: ${{foundD.nome}}`;
        }}
      }}

      const linSub = document.getElementById('linhasHeaderSubtitle');
      if (linSub) {{
        linSub.textContent = `Detalhamento analítico de metas e faturamento digital • Filtrado por: ${{contextLinhasLabel}}`;
      }}

      // Métricas consolidadas da Diretoria no período
      const dirTot = getPeriodMetrics(DASH_DATA.total || {{}});
      const dirTotDigital = dirTot.venda_digital || 1.0;
      const dirMediaShare = dirTot.share_digital || 0.0;

      let list = (targetSourceLinhas.linhas || [])
        .filter(l => {{
          if (filterGrp !== 'all' && l.grupo !== filterGrp) return false;
          if (selLinha !== 'all' && l.linha !== selLinha) return false;
          if (search) {{
            const target = (l.linha + ' ' + l.grupo).toLowerCase();
            if (!target.includes(search)) return false;
          }}
          return true;
        }})
        .map((l, origIdx) => {{
          const m = getPeriodMetrics(l);
          const share_diretoria = dirTotDigital > 0 ? ((m.venda_digital / dirTotDigital) * 100) : 0.0;
          const diff_share = m.share_digital - dirMediaShare;
          return {{
            rank: origIdx + 1,
            linha: l.linha,
            grupo: l.grupo,
            meta_mes: l.meta_mes,
            ...m,
            share_diretoria: share_diretoria,
            diff_share: diff_share
          }};
        }});

      list = sortItemList(list, tableSort.linhas.col, tableSort.linhas.dir);

      const badgeCount = document.getElementById('badgeLinhasCount');
      if (badgeCount) badgeCount.textContent = list.length;

      const totalItems = list.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / LINHAS_PER_PAGE));
      if (linhasCurrentPage > totalPages) linhasCurrentPage = totalPages;
      if (linhasCurrentPage < 1) linhasCurrentPage = 1;

      const startIdx = (linhasCurrentPage - 1) * LINHAS_PER_PAGE;
      const endIdx = Math.min(startIdx + LINHAS_PER_PAGE, totalItems);

      const countInfo = document.getElementById('linhasCountInfo');
      if (countInfo) {{
        countInfo.textContent = totalItems === 0 
          ? 'Nenhuma linha encontrada' 
          : `Mostrando ${{startIdx + 1}} - ${{endIdx}} de ${{totalItems}} linhas`;
      }}

      const pageNumEl = document.getElementById('linhasPageNum');
      if (pageNumEl) pageNumEl.textContent = `Página ${{linhasCurrentPage}} de ${{totalPages}}`;

      const btnPrev = document.getElementById('btnLinhasPrev');
      if (btnPrev) btnPrev.disabled = (linhasCurrentPage <= 1);

      const btnNext = document.getElementById('btnLinhasNext');
      if (btnNext) btnNext.disabled = (linhasCurrentPage >= totalPages);

      const pageRows = list.slice(startIdx, endIdx);
      pageRows.forEach((l, idx) => {{
        const globalRank = startIdx + idx + 1;
        const row = `
          <tr>
            <td>#${{globalRank}}</td>
            <td><strong>${{l.linha}}</strong></td>
            <td><span class="badge" style="background: var(--surface-subtle); color: var(--text-secondary);">${{l.grupo}}</span></td>
            <td class="num">${{formatBRL(l.meta_mes)}}</td>
            <td class="num">${{formatBRL(l.meta_periodo)}}</td>
            <td class="num" style="color: var(--sj-blue); font-weight: 700;">${{formatBRL(l.venda_digital)}}</td>
            <td>${{getProgressBar(l.atingimento)}}</td>
            <td class="num ${{l.gap >= 0 ? 'text-success' : 'text-danger'}}">${{formatBRLGap(l.gap)}} <span style="font-size: 10.5px; opacity: 0.85;">(${{formatDesvioPct(l.desvio)}})</span></td>
            <td class="num">${{formatBRL(l.projecao)}}</td>
            <td class="num">${{formatBRL(l.venda_total)}}</td>
            <td class="num" style="color: var(--text-secondary);">${{formatBRL(l.venda_fisica)}}</td>
            <td class="num"><strong>${{formatPct(l.share_digital)}}</strong></td>
            <td class="num" style="color: var(--text-secondary);">${{formatPct(l.share_digital_ly)}}</td>
            <td class="num">${{formatDiffPP(l.diff_pp_ly)}}</td>
            <td class="num">${{formatShareDir(l.share_diretoria)}}</td>
            <td>${{getStatusBadge(l.atingimento)}}</td>
          </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
      }});

      updateSortHeaders('linhas');
    }}

    function changeLinhasPage(delta) {{
      linhasCurrentPage += delta;
      renderLinhasTable(false);
    }}

    // =========================================================================
    // RENDERIZAÇÃO DOS GRÁFICOS CHART.JS
    // =========================================================================
    function renderCharts(activeTarget) {{
      const target = (activeTarget && activeTarget.item) ? activeTarget.item : (getActiveTargetItem().item || DASH_DATA.total);
      const targetName = (activeTarget && activeTarget.name) ? activeTarget.name : 'Diretoria Cíntia Silva';
      const targetType = (activeTarget && activeTarget.type) ? activeTarget.type : 'Diretoria';

      const isDark = (document.documentElement.getAttribute('data-theme') !== 'light');
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
      const textColor = isDark ? '#94A3B8' : '#64748B';

      // 1. Curva Diária
      const ctxCurva = document.getElementById('chartCurvaDiaria');
      if (ctxCurva) {{
        if (chartCurvaInstance) chartCurvaInstance.destroy();

        const labels = (DASH_DATA.curva_diaria || []).map(d => d.data);
        const metasDiarias = target.metas_dias || (DASH_DATA.curva_diaria || []).map(d => d.meta_dia);
        
        const vDias = (activeFigitalMode === 'sem') 
          ? (target.vendas_dias_sem_figital || []) 
          : (target.vendas_dias_digital || []);

        const vendasDiarias = metasDiarias.map((_, idx) => {{
          const d = idx + 1;
          if (d > maxDia) return null;
          return (idx < vDias.length && vDias[idx] !== undefined) ? vDias[idx] : 0;
        }});

        const chartSub = document.getElementById('chartCurvaSubtitle');
        if (chartSub) {{
          chartSub.textContent = `Visualizando: ${{targetName}} • Verde: Superou Meta Diária • Linha Laranja: Meta Diarizada`;
        }}

        chartCurvaInstance = new Chart(ctxCurva, {{
          data: {{
            labels: labels,
            datasets: [
              {{
                type: 'line',
                label: 'Meta Diária Diarizada',
                data: metasDiarias,
                borderColor: '#FF9F0A',
                backgroundColor: 'rgba(255, 159, 10, 0.12)',
                borderWidth: 2.5,
                borderDash: [5, 4],
                pointRadius: 3.5,
                pointHoverRadius: 6,
                pointBackgroundColor: '#FF9F0A',
                pointBorderColor: '#FFFFFF',
                pointBorderWidth: 1.5,
                tension: 0.25,
                fill: false,
                order: 1
              }},
              {{
                type: 'bar',
                label: activeFigitalMode === 'sem' ? `Realizado Digital Sem Figital (${{targetName}})` : `Realizado Digital Com Figital (${{targetName}})`,
                data: vendasDiarias,
                backgroundColor: (ctx) => {{
                  const idx = ctx.dataIndex;
                  const d = idx + 1;
                  const val = vendasDiarias[idx];
                  const meta = metasDiarias[idx];
                  if (val === null || val === undefined) return 'transparent';
                  const inRange = (d >= selectedDiaIni && d <= selectedDiaEnd);
                  const superou = val >= meta;
                  if (superou) {{
                    return inRange ? 'rgba(52, 199, 89, 0.88)' : 'rgba(52, 199, 89, 0.35)';
                  }} else {{
                    return inRange ? 'rgba(0, 113, 227, 0.88)' : 'rgba(0, 113, 227, 0.35)';
                  }}
                }},
                borderColor: (ctx) => {{
                  const idx = ctx.dataIndex;
                  const val = vendasDiarias[idx];
                  const meta = metasDiarias[idx];
                  if (val === null || val === undefined) return 'transparent';
                  return val >= meta ? '#30D158' : '#0071E3';
                }},
                borderWidth: 1.5,
                borderRadius: 5,
                order: 2
              }}
            ]
          }},
          options: {{
            responsive: true,
            maintainAspectRatio: false,
            interaction: {{ mode: 'index', intersect: false }},
            plugins: {{
              legend: {{
                position: 'top',
                labels: {{
                  color: textColor,
                  font: {{ family: 'Inter', weight: '500', size: 11 }},
                  usePointStyle: true
                }}
              }},
              tooltip: {{
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
                titleColor: isDark ? '#F8FAFC' : '#0F172A',
                bodyColor: isDark ? '#CBD5E1' : '#334155',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
                borderWidth: 1,
                padding: 12,
                boxPadding: 6,
                callbacks: {{
                  title: (items) => {{
                    if (!items.length) return '';
                    const d = items[0].dataIndex + 1;
                    return '📅 ' + String(d).padStart(2, '0') + '/09/2026';
                  }},
                  label: (ctx) => {{
                    const idx = ctx.dataIndex;
                    const val = ctx.raw;
                    if (val === null || val === undefined) return null;
                    if (ctx.dataset.type === 'line') {{
                      return '🎯 Meta do Dia: ' + formatBRL(val);
                    }} else {{
                      const meta = metasDiarias[idx];
                      const pct = meta > 0 ? ((val / meta) * 100).toFixed(1).replace('.', ',') + '%' : '0,0%';
                      const desvioPct = meta > 0 ? (((val / meta) - 1) * 100) : 0;
                      const desvioStr = (desvioPct >= 0 ? '+' : '') + desvioPct.toFixed(1).replace('.', ',') + '%';
                      const gap = val - meta;
                      const gapStr = (gap >= 0 ? '+ ' : '- ') + formatBRL(Math.abs(gap));
                      return [
                        '🛒 ' + ctx.dataset.label + ': ' + formatBRL(val),
                        '🎯 Meta do Dia: ' + formatBRL(meta),
                        '📈 Desvio da Meta: ' + desvioStr + ' (' + gapStr + ' • ' + pct + ' ating.)'
                      ];
                    }}
                  }}
                }}
              }}
            }},
            scales: {{
              x: {{
                grid: {{ color: gridColor }},
                ticks: {{ color: textColor, font: {{ size: 10 }} }}
              }},
              y: {{
                type: 'linear',
                position: 'left',
                grid: {{ color: gridColor }},
                ticks: {{
                  color: textColor,
                  font: {{ size: 10 }},
                  callback: (v) => 'R$ ' + (v / 1000).toLocaleString('pt-BR') + 'k'
                }}
              }}
            }}
          }}
        }});
      }}

      // 2. Share Donut Chart
      const ctxShare = document.getElementById('chartShareDistritais');
      if (ctxShare) {{
        if (chartShareInstance) chartShareInstance.destroy();

        let labels = [];
        let values = [];
        const colors = ['#0071E3', '#34C759', '#FF9F0A', '#BF5AF2', '#5856D6', '#FF2D55', '#64D2FF', '#FFD60A'];

        const titleEl = document.getElementById('chartShareTitle');
        const subEl = document.getElementById('chartShareSubtitle');

        if (targetType === 'Distrital') {{
          if (titleEl) titleEl.textContent = `Participação dos Coordenadores — ${{targetName}}`;
          if (subEl) subEl.textContent = 'Share de Venda Digital no Período Selecionado';
          const coords = (DASH_DATA.coordenadores || []).filter(c => c.distrital === targetName);
          const mList = coords.map(c => ({{ nome: c.nome, venda: getPeriodMetrics(c).venda_digital }})).sort((a,b) => b.venda - a.venda);
          labels = mList.map(x => x.nome);
          values = mList.map(x => x.venda);
        }} else if (targetType === 'Grupo') {{
          if (titleEl) titleEl.textContent = `Top Linhas — ${{targetName}}`;
          if (subEl) subEl.textContent = 'Share de Venda Digital das Principais Linhas';
          const lList = (target.linhas || []).map(l => ({{ nome: l.linha, venda: getPeriodMetrics(l).venda_digital }})).sort((a,b) => b.venda - a.venda);
          const top7 = lList.slice(0, 7);
          const rest = lList.slice(7);
          const restSum = rest.reduce((acc, x) => acc + x.venda, 0);
          labels = top7.map(x => x.nome);
          values = top7.map(x => x.venda);
          if (restSum > 0) {{
            labels.push('Outras Linhas');
            values.push(restSum);
          }}
        }} else {{
          if (titleEl) titleEl.textContent = 'Participação das Distritais';
          if (subEl) subEl.textContent = 'Share de Venda Digital no Período Selecionado';
          const distMetrics = DASH_DATA.distritais.map(d => ({{
            nome: d.nome,
            venda: getPeriodMetrics(d).venda_digital
          }}));
          labels = distMetrics.map(d => d.nome);
          values = distMetrics.map(d => d.venda);
        }}

        chartShareInstance = new Chart(ctxShare, {{
          type: 'doughnut',
          data: {{
            labels: labels,
            datasets: [{{
              data: values,
              backgroundColor: colors.slice(0, labels.length),
              borderWidth: 0,
              hoverOffset: 6
            }}]
          }},
          options: {{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {{
              legend: {{
                position: 'bottom',
                labels: {{ color: textColor, font: {{ family: 'Inter', weight: '500', size: 11 }} }}
              }},
              tooltip: {{
                callbacks: {{
                  label: (ctx) => {{
                    const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? (ctx.raw / total * 100).toFixed(1) : 0;
                    return ctx.label + ': ' + formatBRL(ctx.raw) + ' (' + pct + '%)';
                  }}
                }}
              }}
            }},
            cutout: '68%'
          }}
        }});
      }}
    }}

    // Exportação CSV
    function exportTableToCSV(tableId, filename) {{
      const table = document.getElementById(tableId);
      if (!table) return;

      let csv = [];
      const rows = table.querySelectorAll("tr");
      for (let i = 0; i < rows.length; i++) {{
        const row = [];
        const cols = rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length; j++) {{
          let text = cols[j].innerText.replace(/(\\r\\n|\\n|\\r)/gm, "").trim();
          text = text.replace(/"/g, '""');
          row.push('"' + text + '"');
        }}
        csv.push(row.join(";"));
      }}

      const csvFile = new Blob(["\\uFEFF" + csv.join("\\n")], {{ type: "text/csv;charset=utf-8;" }});
      const downloadLink = document.createElement("a");
      downloadLink.download = filename;
      downloadLink.href = window.URL.createObjectURL(csvFile);
      downloadLink.style.display = "none";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }}

    // Inicialização ao carregar
    window.addEventListener('DOMContentLoaded', () => {{
      initFilterDropdowns();
      updateDatePeriodBadge();
      updatePresetButtonsState();
      recalcDashboard();
    }});
  </script>
</body>
</html>
"""

    with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
        f.write(html_content)

    sz_kb = os.path.getsize(OUTPUT_HTML) / 1024
    print(f"✅ Dashboard compilado com sucesso em {time.time()-t0:.2f}s!")
    print(f"   📁 Salvo em: {OUTPUT_HTML} ({sz_kb:.1f} KB)")

build = build_html

if __name__ == "__main__":
    build_html()
