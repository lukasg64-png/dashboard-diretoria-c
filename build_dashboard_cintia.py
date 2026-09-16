"""
build_dashboard_cintia.py — Compila o Dashboard Executivo da Diretoria C (Cíntia Silva)
Integrando o "Filtrinho de Data" oficial (MTD, Ontem D-1, 7 Dias, Semana, Custom)
com metas diarizadas completas (dias 1..30) e vendas do Qlik Cloud SaaS.
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
    max_dia = meta.get("max_dia", 16)
    max_dia_str = f"{max_dia:02d}"
    data_corte = meta.get("data_corte", f"{max_dia_str}/09/2026")
    gerado_em = meta.get("gerado_em", time.strftime("%d/%m/%Y %H:%M:%S"))

    raw_json_str = json.dumps(dash_data, ensure_ascii=False)

    html_content = f"""<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Diretoria C — Cíntia Silva | Acompanhamento Estratégico de Metas Digitais</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📊</text></svg>">
  
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
      --apple-green-soft: rgba(52, 199, 89, 0.12);
      --apple-green-text: #248A3D;
      --apple-green-border: rgba(52, 199, 89, 0.25);

      --apple-red: #D70015;
      --apple-red-soft: rgba(255, 69, 58, 0.10);
      --apple-red-text: #D70015;
      --apple-red-border: rgba(255, 69, 58, 0.25);

      --apple-orange: #C96700;
      --apple-orange-soft: rgba(255, 159, 10, 0.12);
      --apple-orange-text: #C96700;
      --apple-orange-border: rgba(255, 159, 10, 0.25);

      --apple-purple: #8944AB;
      --apple-purple-soft: rgba(191, 90, 242, 0.10);

      --shadow-sm: 0 2px 6px rgba(0, 0, 0, 0.04);
      --shadow-md: 0 6px 20px rgba(0, 0, 0, 0.06);
      --shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.08);

      --chart-grid: rgba(0, 0, 0, 0.06);
      --chart-tooltip-bg: rgba(255, 255, 255, 0.98);
    }}

    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }}

    body {{
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
      background: var(--bg-canvas);
      color: var(--text-primary);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      line-height: 1.45;
      transition: background-color 0.3s ease, color 0.3s ease;
    }}

    /* Header Apple Style */
    .header {{
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--surface-translucent);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
      padding: 14px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }}

    .header-left {{
      display: flex;
      align-items: center;
      gap: 14px;
    }}

    .logo-badge {{
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      background: linear-gradient(135deg, #0071E3, #004B99);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: #FFF;
      box-shadow: 0 4px 12px rgba(0, 113, 227, 0.35);
    }}

    .header-title-group h1 {{
      font-family: 'Outfit', sans-serif;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.4px;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }}

    .header-title-group p {{
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 1px;
    }}

    .header-right {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}

    .status-pill {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: var(--radius-pill);
      font-size: 11.5px;
      font-weight: 600;
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text-secondary);
    }}

    .status-dot {{
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--apple-green);
      box-shadow: 0 0 8px var(--apple-green);
      animation: pulseDot 2s infinite ease-in-out;
    }}

    @keyframes pulseDot {{
      0%, 100% {{ opacity: 1; transform: scale(1); }}
      50% {{ opacity: 0.4; transform: scale(0.85); }}
    }}

    .btn-icon {{
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm);
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 15px;
      transition: all 0.2s ease;
    }}

    .btn-icon:hover {{
      background: var(--surface-hover);
      border-color: var(--border-hover);
      transform: translateY(-1px);
    }}

    /* Main Container */
    .container {{
      max-width: 1560px;
      width: 100%;
      margin: 0 auto;
      padding: 20px 28px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }}

    /* ==========================================================================
       FILTRO DE PERÍODO / DATA DIARIZADA ("O NOSSO FILTRINHO DE DATA")
       ========================================================================== */
    .date-filter-section {{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 14px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: var(--shadow-sm);
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
      gap: 12px;
      flex-wrap: wrap;
    }}

    .date-filter-title {{
      font-size: 13px;
      font-weight: 700;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 6px;
    }}

    .date-inputs-pair {{
      display: flex;
      align-items: center;
      gap: 8px;
    }}

    .date-input-wrap {{
      display: flex;
      flex-direction: column;
      gap: 2px;
    }}

    .date-input-wrap label {{
      font-size: 10px;
      font-weight: 700;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}

    .apple-date-input {{
      background: var(--surface-subtle);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 6px 12px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      outline: none;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    }}

    .apple-date-input:hover {{
      border-color: var(--sj-blue);
    }}

    .apple-date-input:focus {{
      border-color: var(--sj-blue);
      box-shadow: 0 0 0 3px var(--sj-blue-soft);
    }}

    .date-range-separator {{
      font-size: 12px;
      color: var(--text-tertiary);
      font-weight: 600;
      margin-top: 14px;
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

    /* Sub-bar de Filtros Geográficos e Busca */
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
      width: 240px;
      outline: none;
      transition: all 0.2s ease;
    }}

    .apple-search-input:focus {{
      border-color: var(--sj-blue);
      box-shadow: 0 0 0 2px var(--sj-blue-soft);
      width: 280px;
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
      font-size: 11.5px;
      font-weight: 600;
      background: var(--surface-subtle);
      color: var(--text-secondary);
      border: 1px solid var(--border);
      cursor: pointer;
      transition: all 0.15s ease;
    }}

    .btn-reset-filters:hover {{
      background: var(--surface-hover);
      color: var(--apple-red-text);
      border-color: var(--apple-red-border);
    }}

    /* ==========================================================================
       KPI CARDS GRID
       ========================================================================== */
    .kpi-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }}

    .kpi-card {{
      background: var(--surface-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 18px 22px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
      box-shadow: var(--shadow-sm);
      transition: transform 0.2s ease, border-color 0.2s ease;
    }}

    .kpi-card:hover {{
      transform: translateY(-2px);
      border-color: var(--border-hover);
    }}

    .kpi-card::before {{
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--kpi-accent, var(--sj-blue));
    }}

    .kpi-header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
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
      font-weight: 800;
      letter-spacing: -0.6px;
      color: var(--text-primary);
      margin-bottom: 6px;
    }}

    .kpi-subtext {{
      font-size: 12px;
      color: var(--text-secondary);
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
    }}

    .badge-success {{
      background: var(--apple-green-soft);
      color: var(--apple-green-text);
      border: 1px solid var(--apple-green-border);
    }}

    .badge-warning {{
      background: var(--apple-orange-soft);
      color: var(--apple-orange-text);
      border: 1px solid var(--apple-orange-border);
    }}

    .badge-danger {{
      background: var(--apple-red-soft);
      color: var(--apple-red-text);
      border: 1px solid var(--apple-red-border);
    }}

    .text-success {{ color: var(--apple-green-text) !important; font-weight: 700; }}
    .text-danger  {{ color: var(--apple-red-text) !important; font-weight: 700; }}
    .text-warning {{ color: var(--apple-orange-text) !important; font-weight: 700; }}

    /* Progress bar */
    .progress-bar-bg {{
      flex: 1;
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      overflow: hidden;
      margin-right: 8px;
      min-width: 60px;
    }}

    [data-theme="light"] .progress-bar-bg {{
      background: rgba(0, 0, 0, 0.08);
    }}

    .progress-bar-fill {{
      height: 100%;
      border-radius: 4px;
      transition: width 0.4s ease;
    }}

    /* Navigation Tabs */
    .tab-nav {{
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 4px;
      overflow-x: auto;
      scrollbar-width: none;
    }}

    .tab-nav::-webkit-scrollbar {{ display: none; }}

    .tab-btn {{
      padding: 9px 18px;
      border-radius: var(--radius-md) var(--radius-md) 0 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      background: transparent;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
      white-space: nowrap;
      position: relative;
    }}

    .tab-btn:hover {{
      color: var(--text-primary);
      background: var(--surface-hover);
    }}

    .tab-btn.active {{
      color: var(--sj-blue);
      font-weight: 700;
    }}

    .tab-btn.active::after {{
      content: '';
      position: absolute;
      bottom: -4px;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--sj-blue);
      border-radius: 3px 3px 0 0;
    }}

    .tab-counter {{
      font-size: 10.5px;
      padding: 2px 7px;
      border-radius: var(--radius-pill);
      background: var(--surface-subtle);
      border: 1px solid var(--border);
      color: var(--text-tertiary);
    }}

    .tab-btn.active .tab-counter {{
      background: var(--sj-blue-soft);
      border-color: var(--sj-blue-border);
      color: var(--sj-blue);
    }}

    /* Card Box */
    .card {{
      background: var(--surface-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }}

    .card-header {{
      padding: 16px 22px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }}

    .card-title {{
      font-family: 'Outfit', sans-serif;
      font-size: 16px;
      font-weight: 700;
      color: var(--text-primary);
    }}

    .card-subtitle {{
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 2px;
    }}

    /* Charts Grid */
    .charts-grid {{
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 16px;
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
      max-height: 540px;
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
          <span class="preset-pill active" id="presetMtd" onclick="selectDatePreset('mtd')">⭐ Mês Acumulado (MTD)</span>
          <span class="preset-pill" id="presetYesterday" onclick="selectDatePreset('yesterday')">⚡ Ontem (D-1)</span>
          <span class="preset-pill" id="preset7Days" onclick="selectDatePreset('7days')">📆 Últimos 7 Dias</span>
          <span class="preset-pill" id="presetThisWeek" onclick="selectDatePreset('this_week')">🗓️ Semana Atual</span>
        </div>

        <div class="date-period-badge" id="datePeriodInfo">
          <span>01 a {max_dia_str}/09/2026 ({max_dia} dias MTD)</span>
        </div>
      </div>

      <!-- Linha 2: Filtros Geográficos & Busca Rápida -->
      <div class="filter-secondary-row">
        <div class="filter-controls-group">
          <div class="filter-select-wrap">
            <label for="filterDistrital">🏢 Distrital:</label>
            <select id="filterDistrital" class="apple-select" onchange="applyFilters()">
              <option value="all">Todas as Distritais (4)</option>
            </select>
          </div>

          <div class="filter-select-wrap">
            <label for="filterCoordenador">👔 Coordenador:</label>
            <select id="filterCoordenador" class="apple-select" onchange="applyFilters()">
              <option value="all">Todos os Coordenadores (29)</option>
            </select>
          </div>
        </div>

        <div class="filter-controls-group">
          <div class="search-input-wrap">
            <span class="search-icon-inside">🔍</span>
            <input type="text" id="filterSearch" class="apple-search-input" placeholder="Buscar loja, cidade ou número..." oninput="applyFilters()">
          </div>
          <button class="btn-reset-filters" onclick="resetFilters()">Limpar Filtros</button>
        </div>
      </div>
    </section>

    <!-- ====================================================================
         TOP KPI CARDS (REATIVOS AO FILTRO DE DATA)
         ==================================================================== -->
    <section class="kpi-grid">
      <!-- 1. Meta do Mês -->
      <div class="kpi-card" style="--kpi-accent: #0071E3;">
        <div class="kpi-header">
          <span class="kpi-label">Meta do Mês (Set/26)</span>
          <span class="badge" style="background: rgba(0, 113, 227, 0.12); color: var(--sj-blue);">Oficial</span>
        </div>
        <div class="kpi-value" id="kpiMetaMes">R$ {kpis.get('meta_mes', 0):,.2f}</div>
        <div class="kpi-subtext">Base Oficial Diarizada (30 Dias)</div>
      </div>

      <!-- 2. Meta do Período -->
      <div class="kpi-card" style="--kpi-accent: #5856D6;">
        <div class="kpi-header">
          <span class="kpi-label" id="labelMetaPeriodo">Meta do Período</span>
          <span class="badge" style="background: rgba(88, 86, 214, 0.12); color: #5856D6;" id="badgeMetaDias">{max_dia} Dias</span>
        </div>
        <div class="kpi-value" id="kpiMetaPeriodo">R$ {kpis.get('meta_mtd', 0):,.2f}</div>
        <div class="kpi-subtext" id="subtextMetaPeriodo">Acumulado dias 01 a {max_dia_str}/09</div>
      </div>

      <!-- 3. Realizado Digital -->
      <div class="kpi-card" id="cardRealizadoDigital" style="--kpi-accent: #34C759;">
        <div class="kpi-header">
          <span class="kpi-label">Venda Digital Realizada</span>
          <span class="badge badge-warning" id="kpiAtingBadge">0.0%</span>
        </div>
        <div class="kpi-value" id="kpiVendaDigital">R$ {kpis.get('venda_digital', 0):,.2f}</div>
        <div class="kpi-subtext" id="kpiGapSub">
          GAP R$: <span id="kpiGapVal">R$ 0,00</span>
        </div>
      </div>

      <!-- 4. Projeção de Fechamento -->
      <div class="kpi-card" style="--kpi-accent: #BF5AF2;">
        <div class="kpi-header">
          <span class="kpi-label">Projeção Fechamento Mês</span>
          <span class="badge" style="background: rgba(191, 90, 242, 0.12); color: #BF5AF2;" id="kpiAtingProjBadge">0.0% Meta</span>
        </div>
        <div class="kpi-value" id="kpiProjecao">R$ {kpis.get('projecao_fechamento', 0):,.2f}</div>
        <div class="kpi-subtext" id="kpiRitmoSub">Ritmo do período selecionado</div>
      </div>

      <!-- 5. Venda Total Lojas -->
      <div class="kpi-card" style="--kpi-accent: #30D158;">
        <div class="kpi-header">
          <span class="kpi-label">Venda Total Lojas</span>
          <span class="badge" style="background: rgba(48, 209, 88, 0.12); color: #30D158;" id="kpiShareBadge">Share 0.0%</span>
        </div>
        <div class="kpi-value" id="kpiVendaTotal">R$ {kpis.get('venda_total_lojas', 0):,.2f}</div>
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
        🏪 Filiais (Lojas) <span class="tab-counter" id="badgeFiliaisCount">593</span>
      </button>
      <button class="tab-btn" onclick="switchTab('categorias')">
        📦 Categorias & Grupos <span class="tab-counter" id="badgeCategoriasCount">7</span>
      </button>
    </nav>

    <!-- Tab 1: Visão Geral -->
    <section id="tab-visao-geral" class="tab-content">
      <div class="charts-grid">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Curva Diária — Realizado Digital vs Meta Diarizada</div>
              <div class="card-subtitle">Evolução diária de vendas (R$) de 01 a 30 de Setembro • Destaque do Período Ativo</div>
            </div>
          </div>
          <div class="chart-box">
            <canvas id="chartCurvaDiaria"></canvas>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Participação das Distritais</div>
              <div class="card-subtitle">Share de Venda Digital no Período Selecionado</div>
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
                <th>Distrital</th>
                <th class="num">Meta Período</th>
                <th class="num">Venda Digital</th>
                <th>Atingimento</th>
                <th class="num">GAP R$</th>
                <th class="num">Projeção Mês</th>
                <th class="num">Venda Total</th>
                <th class="num">Share Dig.</th>
                <th class="num">Lojas</th>
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
                <th>Ranking</th>
                <th>Distrital</th>
                <th class="num">Meta Mês</th>
                <th class="num">Meta Período</th>
                <th class="num">Venda Digital</th>
                <th>Progresso</th>
                <th class="num">GAP R$</th>
                <th class="num">Projeção Mês</th>
                <th class="num">Venda Total</th>
                <th class="num">Share Digital</th>
                <th class="num">Lojas</th>
                <th>Status</th>
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
                <th>#</th>
                <th>Coordenador</th>
                <th>Distrital</th>
                <th class="num">Meta Mês</th>
                <th class="num">Meta Período</th>
                <th class="num">Venda Digital</th>
                <th>Atingimento</th>
                <th class="num">GAP R$</th>
                <th class="num">Projeção Mês</th>
                <th class="num">Venda Total</th>
                <th class="num">Share Dig.</th>
                <th class="num">Lojas</th>
                <th>Status</th>
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
                <th>#</th>
                <th>ID</th>
                <th>Filial / Loja</th>
                <th>Distrital</th>
                <th>Coordenador</th>
                <th class="num">Meta Mês</th>
                <th class="num">Meta Período</th>
                <th class="num">Venda Digital</th>
                <th>Atingimento</th>
                <th class="num">GAP R$</th>
                <th class="num">Venda Total</th>
                <th class="num">Share Dig.</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="tbodyFiliaisFull"></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Tab 5: Categorias -->
    <section id="tab-categorias" class="tab-content hidden">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Metas & Vendas por Categoria / Grupo de Produtos</div>
          <button class="btn btn-sm" onclick="exportTableToCSV('tableCategoriasFull', 'categorias_diretoria_c.csv')">Exportar Tabela</button>
        </div>
        <div class="table-container">
          <table id="tableCategoriasFull">
            <thead>
              <tr>
                <th>Grupo / Categoria</th>
                <th class="num">Meta Mês</th>
                <th class="num">Meta Período</th>
                <th class="num">Venda Digital</th>
                <th>Atingimento</th>
                <th class="num">GAP R$</th>
                <th class="num">Projeção Mês</th>
                <th class="num">Venda Total</th>
                <th class="num">Share Digital</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="tbodyCategoriasFull"></tbody>
          </table>
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

    let maxDia = DASH_DATA.metadata.max_dia || 16;
    let selectedDiaIni = 1;
    let selectedDiaEnd = maxDia;
    let activeDatePreset = 'mtd';
    let currentTab = 'visao-geral';
    let showAllFiliais = false;

    let chartCurvaInstance = null;
    let chartShareInstance = null;

    function formatBRL(val) {{
      if (val === null || val === undefined || isNaN(val)) return 'R$ 0,00';
      return 'R$ ' + Number(val).toLocaleString('pt-BR', {{ minimumFractionDigits: 2, maximumFractionDigits: 2 }});
    }}

    function formatPct(val) {{
      if (val === null || val === undefined || isNaN(val)) return '0,0%';
      return Number(val).toFixed(1).replace('.', ',') + '%';
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

    // =========================================================================
    // CÁLCULO DINÂMICO DE MÉTRICAS PELO PERÍODO DE DIAS [selectedDiaIni .. selectedDiaEnd]
    // =========================================================================
    function getPeriodMetrics(item) {{
      const m_dias = item.metas_dias || [];
      const v_dias_dig = item.vendas_dias_digital || [];
      const v_dias_tot = item.vendas_dias_total || [];

      let meta = 0.0;
      for (let d = selectedDiaIni; d <= selectedDiaEnd; d++) {{
        if (d - 1 < m_dias.length) meta += (m_dias[d - 1] || 0.0);
      }}

      let venda_dig = 0.0;
      let venda_tot = 0.0;
      for (let d = selectedDiaIni; d <= selectedDiaEnd; d++) {{
        if (d - 1 < v_dias_dig.length) venda_dig += (v_dias_dig[d - 1] || 0.0);
        if (d - 1 < v_dias_tot.length) venda_tot += (v_dias_tot[d - 1] || 0.0);
      }}

      meta = Math.round(meta * 100) / 100;
      venda_dig = Math.round(venda_dig * 100) / 100;
      venda_tot = Math.round(venda_tot * 100) / 100;
      const venda_fis = Math.round((venda_tot - venda_dig) * 100) / 100;

      const gap = Math.round((venda_dig - meta) * 100) / 100;
      const ating = meta > 0 ? ((venda_dig / meta) * 100) : (venda_dig > 0 ? 100.0 : 0.0);
      const share_dig = venda_tot > 0 ? ((venda_dig / venda_tot) * 100) : 0.0;

      const dias_sel = (selectedDiaEnd - selectedDiaIni + 1);
      const meta_mes = item.meta_mes || 0.0;
      const proj = dias_sel > 0 ? Math.round((venda_dig / dias_sel * 30) * 100) / 100 : 0.0;
      const ating_proj = meta_mes > 0 ? ((proj / meta_mes) * 100) : 0.0;

      return {{
        meta_periodo: meta,
        venda_digital: venda_dig,
        venda_total: venda_tot,
        venda_fisica: venda_fis,
        gap: gap,
        atingimento: ating,
        share_digital: share_dig,
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
        badge.innerHTML = `<span>01 a ${{pad(maxDia)}}/09/2026 (${{maxDia}} dias MTD)</span>`;
      }} else if (selectedDiaIni === selectedDiaEnd) {{
        const isOntem = (selectedDiaIni === Math.max(1, maxDia - 1));
        badge.innerHTML = `<span>${{pad(selectedDiaIni)}}/09/2026${{isOntem ? ' • Ontem (D-1)' : ''}} (1 dia)</span>`;
      }} else {{
        badge.innerHTML = `<span>${{pad(selectedDiaIni)}} a ${{pad(selectedDiaEnd)}}/09/2026 (${{diffDias}} dias)</span>`;
      }}

      // Atualiza também badge de dias no card de meta
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
      const presets = ['mtd', 'yesterday', '7days', 'this_week'];
      presets.forEach(p => {{
        let btnId = 'presetMtd';
        if (p === 'yesterday') btnId = 'presetYesterday';
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
        // D-1 Fechado
        const dOntem = Math.max(1, maxDia - 1);
        selectedDiaIni = dOntem;
        selectedDiaEnd = dOntem;
      }} else if (preset === '7days') {{
        selectedDiaIni = Math.max(1, maxDia - 6);
        selectedDiaEnd = maxDia;
      }} else if (preset === 'this_week') {{
        // Segunda-feira mais recente até maxDia
        // Em setembro/2026: 01=Ter, 07=Seg, 14=Seg
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
      }} else if (selectedDiaIni === Math.max(1, maxDia - 1) && selectedDiaEnd === Math.max(1, maxDia - 1)) {{
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
    // RECALCULO COMPLETO DO DASHBOARD (KPIS + GRAFICOS + TABELAS)
    // =========================================================================
    function recalcDashboard() {{
      // 1. Recalcula Top KPIs
      const totMetrics = getPeriodMetrics(DASH_DATA.total);

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
      gapValEl.textContent = formatBRL(totMetrics.gap);
      gapValEl.className = totMetrics.gap >= 0 ? 'text-success' : 'text-danger';

      const atingProjBadge = document.getElementById('kpiAtingProjBadge');
      atingProjBadge.textContent = formatPct(totMetrics.atingimento_proj) + ' Meta';

      const shareBadge = document.getElementById('kpiShareBadge');
      shareBadge.textContent = 'Share ' + formatPct(totMetrics.share_digital);

      // 2. Atualiza Gráficos
      renderCharts();

      // 3. Aplica Filtros e Atualiza Tabelas
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
        setTimeout(renderCharts, 50);
      }}
    }}

    function toggleTheme() {{
      const html = document.documentElement;
      const current = html.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('fsj_cintia_theme', next);
      renderCharts();
    }}

    const savedTheme = localStorage.getItem('fsj_cintia_theme');
    if (savedTheme) {{
      document.documentElement.setAttribute('data-theme', savedTheme);
    }}

    function initFilterDropdowns() {{
      const distSelect = document.getElementById('filterDistrital');
      const coordSelect = document.getElementById('filterCoordenador');

      DASH_DATA.distritais.forEach(d => {{
        const opt = document.createElement('option');
        opt.value = d.nome;
        opt.textContent = d.nome;
        distSelect.appendChild(opt);
      }});

      DASH_DATA.coordenadores.forEach(c => {{
        const opt = document.createElement('option');
        opt.value = c.nome;
        opt.textContent = c.nome + ' (' + c.distrital + ')';
        coordSelect.appendChild(opt);
      }});
    }}

    function applyFilters() {{
      const selDist = document.getElementById('filterDistrital').value;
      const selCoord = document.getElementById('filterCoordenador').value;
      const search = document.getElementById('filterSearch').value.toLowerCase().trim();

      renderAllTables(selDist, selCoord, search);
    }}

    function resetFilters() {{
      document.getElementById('filterDistrital').value = 'all';
      document.getElementById('filterCoordenador').value = 'all';
      document.getElementById('filterSearch').value = '';
      applyFilters();
    }}

    function toggleShowAllFiliais() {{
      showAllFiliais = !showAllFiliais;
      const btn = document.getElementById('btnToggleFiliais');
      if (btn) btn.textContent = showAllFiliais ? 'Limitar a 100 Lojas' : 'Ver Todas as Lojas';
      applyFilters();
    }}

    // =========================================================================
    // RENDERIZAÇÃO DAS TABELAS COM MÉTRICAS DINÂMICAS DO PERÍODO
    // =========================================================================
    function renderAllTables(filterDist = 'all', filterCoord = 'all', search = '') {{
      // 1. Distritais Overview & Full
      const tbodyDistOver = document.getElementById('tbodyDistritaisOverview');
      const tbodyDistFull = document.getElementById('tbodyDistritaisFull');
      tbodyDistOver.innerHTML = '';
      tbodyDistFull.innerHTML = '';

      let distList = DASH_DATA.distritais
        .filter(d => filterDist === 'all' || d.nome === filterDist)
        .map(d => {{
          const m = getPeriodMetrics(d);
          return {{
            nome: d.nome,
            lojas: d.lojas,
            meta_mes: d.meta_mes,
            ...m
          }};
        }});

      distList.sort((a, b) => b.venda_digital - a.venda_digital);

      distList.forEach((d, idx) => {{
        const rowOver = `
          <tr>
            <td><strong>${{d.nome}}</strong></td>
            <td class="num">${{formatBRL(d.meta_periodo)}}</td>
            <td class="num" style="color: var(--sj-blue); font-weight: 600;">${{formatBRL(d.venda_digital)}}</td>
            <td>${{getProgressBar(d.atingimento)}}</td>
            <td class="num ${{d.gap >= 0 ? 'text-success' : 'text-danger'}}">${{formatBRL(d.gap)}}</td>
            <td class="num">${{formatBRL(d.projecao)}}</td>
            <td class="num">${{formatBRL(d.venda_total)}}</td>
            <td class="num"><strong>${{formatPct(d.share_digital)}}</strong></td>
            <td class="num">${{d.lojas}}</td>
          </tr>
        `;
        tbodyDistOver.insertAdjacentHTML('beforeend', rowOver);

        const rowFull = `
          <tr>
            <td><strong>#${{idx + 1}}</strong></td>
            <td><strong>${{d.nome}}</strong></td>
            <td class="num">${{formatBRL(d.meta_mes)}}</td>
            <td class="num">${{formatBRL(d.meta_periodo)}}</td>
            <td class="num" style="color: var(--sj-blue); font-weight: 700;">${{formatBRL(d.venda_digital)}}</td>
            <td>${{getProgressBar(d.atingimento)}}</td>
            <td class="num ${{d.gap >= 0 ? 'text-success' : 'text-danger'}}">${{formatBRL(d.gap)}}</td>
            <td class="num">${{formatBRL(d.projecao)}} (${{formatPct(d.atingimento_proj)}})</td>
            <td class="num">${{formatBRL(d.venda_total)}}</td>
            <td class="num"><strong>${{formatPct(d.share_digital)}}</strong></td>
            <td class="num">${{d.lojas}}</td>
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
          if (search && !c.nome.toLowerCase().includes(search) && !c.distrital.toLowerCase().includes(search)) return false;
          return true;
        }})
        .map(c => {{
          const m = getPeriodMetrics(c);
          return {{
            nome: c.nome,
            distrital: c.distrital,
            lojas: c.lojas,
            meta_mes: c.meta_mes,
            ...m
          }};
        }});

      coordList.sort((a, b) => b.venda_digital - a.venda_digital);
      document.getElementById('badgeCoordenadoresCount').textContent = coordList.length;

      coordList.forEach((c, idx) => {{
        const row = `
          <tr>
            <td>#${{idx + 1}}</td>
            <td><strong>${{c.nome}}</strong></td>
            <td><span class="badge" style="background: var(--surface-hover); color: var(--text-secondary);">${{c.distrital}}</span></td>
            <td class="num">${{formatBRL(c.meta_mes)}}</td>
            <td class="num">${{formatBRL(c.meta_periodo)}}</td>
            <td class="num" style="color: var(--sj-blue); font-weight: 600;">${{formatBRL(c.venda_digital)}}</td>
            <td>${{getProgressBar(c.atingimento)}}</td>
            <td class="num ${{c.gap >= 0 ? 'text-success' : 'text-danger'}}">${{formatBRL(c.gap)}}</td>
            <td class="num">${{formatBRL(c.projecao)}}</td>
            <td class="num">${{formatBRL(c.venda_total)}}</td>
            <td class="num">${{formatPct(c.share_digital)}}</td>
            <td class="num">${{c.lojas}}</td>
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
        .map(f => {{
          const m = getPeriodMetrics(f);
          return {{
            nome: f.nome,
            id_loja: f.id_loja,
            distrital: f.distrital,
            coordenador: f.coordenador,
            meta_mes: f.meta_mes,
            ...m
          }};
        }});

      filList.sort((a, b) => b.venda_digital - a.venda_digital);
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
            <td class="num" style="color: var(--sj-blue); font-weight: 600;">${{formatBRL(f.venda_digital)}}</td>
            <td>${{getProgressBar(f.atingimento)}}</td>
            <td class="num ${{f.gap >= 0 ? 'text-success' : 'text-danger'}}">${{formatBRL(f.gap)}}</td>
            <td class="num">${{formatBRL(f.venda_total)}}</td>
            <td class="num">${{formatPct(f.share_digital)}}</td>
            <td>${{getStatusBadge(f.atingimento)}}</td>
          </tr>
        `;
        tbodyFil.insertAdjacentHTML('beforeend', row);
      }}

      // 4. Categorias / Grupos
      const tbodyCat = document.getElementById('tbodyCategoriasFull');
      tbodyCat.innerHTML = '';
      let catList = DASH_DATA.grupos.map(g => {{
        const m = getPeriodMetrics(g);
        return {{
          grupo: g.grupo,
          meta_mes: g.meta_mes,
          ...m
        }};
      }});

      catList.sort((a, b) => b.venda_digital - a.venda_digital);
      catList.forEach(g => {{
        const row = `
          <tr>
            <td><strong>${{g.grupo}}</strong></td>
            <td class="num">${{formatBRL(g.meta_mes)}}</td>
            <td class="num">${{formatBRL(g.meta_periodo)}}</td>
            <td class="num" style="color: var(--sj-blue); font-weight: 600;">${{formatBRL(g.venda_digital)}}</td>
            <td>${{getProgressBar(g.atingimento)}}</td>
            <td class="num ${{g.gap >= 0 ? 'text-success' : 'text-danger'}}">${{formatBRL(g.gap)}}</td>
            <td class="num">${{formatBRL(g.projecao)}}</td>
            <td class="num">${{formatBRL(g.venda_total)}}</td>
            <td class="num"><strong>${{formatPct(g.share_digital)}}</strong></td>
            <td>${{getStatusBadge(g.atingimento)}}</td>
          </tr>
        `;
        tbodyCat.insertAdjacentHTML('beforeend', row);
      }});
    }}

    // =========================================================================
    // RENDERIZAÇÃO DOS GRÁFICOS (COM DESTAQUE DO PERÍODO SELECIONADO)
    // =========================================================================
    function renderCharts() {{
      const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
      const textColor = isDark ? '#94A3B8' : '#475569';
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

      // 1. Chart Curva Diária
      const ctxCurva = document.getElementById('chartCurvaDiaria')?.getContext('2d');
      if (ctxCurva) {{
        if (chartCurvaInstance) chartCurvaInstance.destroy();

        const labels = DASH_DATA.curva_diaria.map(d => d.data);
        const metaValues = DASH_DATA.curva_diaria.map(d => d.meta_dia);
        const realValues = DASH_DATA.curva_diaria.map(d => d.realizado_digital);

        // Pontos de destaque baseados no período selecionado
        const pointRadii = DASH_DATA.curva_diaria.map(d => (d.dia >= selectedDiaIni && d.dia <= selectedDiaEnd) ? 6 : 2);
        const pointColors = DASH_DATA.curva_diaria.map(d => (d.dia >= selectedDiaIni && d.dia <= selectedDiaEnd) ? '#34C759' : '#0071E3');

        chartCurvaInstance = new Chart(ctxCurva, {{
          type: 'line',
          data: {{
            labels: labels,
            datasets: [
              {{
                label: 'Realizado Digital (R$)',
                data: realValues,
                borderColor: '#0071E3',
                backgroundColor: 'rgba(0, 113, 227, 0.12)',
                borderWidth: 3,
                tension: 0.35,
                fill: true,
                pointRadius: pointRadii,
                pointBackgroundColor: pointColors,
                pointBorderColor: '#FFFFFF',
                pointBorderWidth: 1
              }},
              {{
                label: 'Meta Diarizada (R$)',
                data: metaValues,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.35)',
                borderWidth: 2,
                borderDash: [5, 5],
                tension: 0.1,
                fill: false,
                pointRadius: 0
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
                labels: {{ color: textColor, font: {{ family: 'Inter', weight: '600', size: 11 }} }}
              }},
              tooltip: {{
                callbacks: {{
                  label: (ctx) => ctx.dataset.label + ': ' + formatBRL(ctx.raw)
                }}
              }}
            }},
            scales: {{
              x: {{
                grid: {{ color: gridColor }},
                ticks: {{ color: textColor, font: {{ size: 11 }} }}
              }},
              y: {{
                grid: {{ color: gridColor }},
                ticks: {{
                  color: textColor,
                  font: {{ size: 11 }},
                  callback: (val) => 'R$ ' + (val / 1000).toFixed(0) + 'k'
                }}
              }}
            }}
          }}
        }});
      }}

      // 2. Chart Share Distritais (Calculado com base no período selecionado)
      const ctxShare = document.getElementById('chartShareDistritais')?.getContext('2d');
      if (ctxShare) {{
        if (chartShareInstance) chartShareInstance.destroy();

        const distMetrics = DASH_DATA.distritais.map(d => {{
          const m = getPeriodMetrics(d);
          return {{ nome: d.nome, venda_digital: m.venda_digital }};
        }});

        const labels = distMetrics.map(d => d.nome);
        const values = distMetrics.map(d => d.venda_digital);
        const colors = ['#0071E3', '#34C759', '#FF9F0A', '#BF5AF2'];

        chartShareInstance = new Chart(ctxShare, {{
          type: 'doughnut',
          data: {{
            labels: labels,
            datasets: [{{
              data: values,
              backgroundColor: colors,
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

if __name__ == "__main__":
    build_html()
