"""
consolidate_cintia_data.py — Cruza os dados do QLIK CLOUD com as METAS DIARIZADAS do Excel
Gera data/dashboard_cintia_data.json com diarização completa (metas_dias 1..30 e vendas_dias 1..16)
para permitir filtragem de datas interativa (MTD, D-1, 7 Dias, Custom).
"""
import os
import sys
import time
import json
import re
import unicodedata

if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'): sys.stderr.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
METAS_JSON = os.path.join(DATA_DIR, "metas_cintia.json")
VENDAS_JSON = os.path.join(DATA_DIR, "vendas_qlik_cintia.json")
OUTPUT_JSON = os.path.join(DATA_DIR, "dashboard_cintia_data.json")

ABBREVIATION_MAP = {
    'sto': 'santo',
    'sta': 'santa',
    's': 'sao',
    'sn': 'santo',
    'st': 'santo',
    'dioni': 'dionisio',
    'cnel': 'coronel',
    'cel': 'coronel',
    'fco': 'francisco',
    'franc': 'francisco',
    'gal': 'galeria',
    'hosp': 'hospital',
    'louren': 'lourenco',
    'terez': 'terezinha',
    'ant': 'antonio',
    'dr': 'doutor',
    'av': 'avenida',
    'gen': 'general',
    'v': 'vila',
    'vl': 'vila',
    'pt': 'ponto',
    'pto': 'porto',
    'distr': 'distrito',
    'pres': 'presidente',
}

CITY_MAP = {
    'venancio': 'venancio aires',
    'rosario': 'rosario do sul',
    'julio castilhos': 'julio de castilhos',
    'sao pedro sul': 'sao pedro do sul',
    'herval doeste': 'herval d oeste',
    'santo antonio missoes': 'santo antonio das missoes',
    'encruzilhada sul': 'encruzilhada do sul',
    'sao lourenco do sul': 'sao lourenco do sul',
    'sao louren': 'sao lourenco',
    'sao fran paula': 'sao francisco de paula',
    'sao francisco paula': 'sao francisco de paula',
    'santa vitoria palmar': 'santa vitoria do palmar',
    'santana livramento': 'santana do livramento',
    'bela vista paraiso': 'bela vista do paraiso',
    'quedas iguacu': 'quedas do iguacu',
    'sao miguel iguacu': 'sao miguel do iguacu',
    'sao miguel oeste': 'sao miguel do oeste',
    'santa terezinha itaipu': 'santa terezinha de itaipu',
}

EXACT_STORE_MAPPING = {
    # PR specific
    'nova londrina 1': 'Nova Londrina',
    'sarandi 1 pr': 'Sarandi 1 - PR',
    'sarandi 2 pr': 'Sarandi 2 - PR',
    'sarandi 1 rs': 'Sarandi 1',
    'sarandi 2 rs': 'Sarandi 2',
    'sarandi 3 rs': 'Sarandi 3',
    'palmeira 1 pr': 'Palmeira - PR',
    'tapejara 1 pr': 'Tapejara - PR',
    'colorado 1 pr': 'Colorado - PR',
    'colorado pr': 'Colorado - PR',
    # Special stores
    'pf shopping bella': 'PF - Shopping',
    'pf uruguai 02': 'PF - Uruguai 2',
    'pf uruguai 2': 'PF - Uruguai 2',
    'pf modelo': 'PF - Loja Modelo',
    'pf general netto 1': 'PF - General Neto',
    'sao louren do sul 1': 'Sao Lourenco 1',
    'sao louren do sul 2': 'Sao Lourenco 2',
    'sao louren do sul 3': 'Sao Lourenco 3',
    'sao louren oeste 1': 'São Lourenço do Oeste',
    'cruzeiro oeste 1': 'Cruzeiro do Oeste',
    'eng beltrao 1': 'Engenheiro Beltrão',
    'sta terez de itaipu 1': 'Sta Terezinha do Itaipu',
    'mal candido rondon 1': 'Marechal Candido Rondon 1',
    'sto ant missoes 1': 'Santo Antonio das Missoes',
    'santo antonio missoes': 'Santo Antonio das Missoes',
}
EXPLICIT_MAP = EXACT_STORE_MAPPING

COORD_MAPPING = {
    'eunice dos santos trainee': 'fernanda charneski trainee',
    'eunice dos santos': 'fernanda charneski trainee'
}

def norm_str(s):
    if not s:
        return ""
    s = str(s).strip()
    s = unicodedata.normalize("NFD", s)
    s = re.sub(r"[\u0300-\u036f]", "", s)
    s = re.sub(r"\s+", " ", s)
    return s.lower().strip()

def normalize_name(s, keep_state=True):
    if not s:
        return ""
    s = unicodedata.normalize("NFD", str(s))
    s = re.sub(r"[\u0300-\u036f]", "", s).lower()
    s = re.sub(r"([a-z])(\d)", r"\1 \2", s)
    s = re.sub(r"[^\w\s-]", " ", s)
    if not keep_state:
        s = re.sub(r"\s+(rs|pr|sc)$", "", s)
        s = re.sub(r"\s+(rs|pr|sc)\s+(\d)", r" \2", s)
    s = re.sub(r"(?<!\A)\b(nova|novo|stock|shop|shopping|merc|mercado|gal|galeria|hosp|hospital|nv|nov|1nov)\b", "", s)
    s = re.sub(r"\s*-\s*", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    words = s.split()
    expanded = [ABBREVIATION_MAP.get(w, w) for w in words]
    res = " ".join(expanded)
    m_num = re.match(r"^(.+?)\s+(\d+)$", res)
    if m_num:
        base = m_num.group(1).strip()
        num = m_num.group(2)
        if base in CITY_MAP:
            res = f"{CITY_MAP[base]} {num}"
    else:
        if res in CITY_MAP:
            res = CITY_MAP[res]
    return re.sub(r"\s+", " ", res).strip()

def clean_group_name(g):
    if not g:
        return ""
    return re.sub(r"\(\d+\)$", "", str(g)).strip()

def get_status(pct):
    if pct >= 100.0:
        return "success"
    elif pct >= 95.0:
        return "warning"
    else:
        return "danger"

def consolidate():
    t0 = time.time()
    print("=" * 70)
    print("  CONSOLIDAÇÃO DE DADOS — DIRETORIA CÍNTIA SILVA (QLIK + METAS)")
    print("=" * 70)

    if not os.path.exists(METAS_JSON):
        raise FileNotFoundError(f"Arquivo não encontrado: {METAS_JSON}. Execute load_metas_cintia.py primeiro.")
    if not os.path.exists(VENDAS_JSON):
        raise FileNotFoundError(f"Arquivo não encontrado: {VENDAS_JSON}. Execute extract_qlik_cintia.py primeiro.")

    with open(METAS_JSON, "r", encoding="utf-8") as f:
        metas_data = json.load(f)
    with open(VENDAS_JSON, "r", encoding="utf-8") as f:
        vendas_data = json.load(f)

    raw_max_dia = vendas_data["metadata"].get("max_dia", 15)
    # REGRA OFICIAL FSJ: D-1 Fechado (até dia 15 de Setembro)
    max_dia = raw_max_dia
    max_date = f"{max_dia:02d}/09/2026 (D-1 Fechado)"
    total_dias_mes = metas_data["metadata"].get("dias_totais", 30)

    print(f"Data de corte Oficial (D-1 Fechado): {max_date} (Dia {max_dia} de {total_dias_mes})")

    # 1. TOTAL GERAL (DIRETORIA C)
    total_metas_dias = [round(m, 2) for m in metas_data["total"]["metas_dias"]]
    meta_mes = round(metas_data["total"]["meta_mes"], 2)
    meta_mtd = round(sum(total_metas_dias[:max_dia]), 2)

    daily_sales = vendas_data.get("daily", [])
    daily_sales_by_day = {d.get("dia"): d for d in daily_sales}
    
    total_vendas_dias_digital = []
    total_vendas_dias_figital = []
    total_vendas_dias_sem_figital = []
    total_vendas_dias_total = []
    total_vendas_dias_fisica = []
    for d_idx in range(1, max_dia + 1):
        s_dia = daily_sales_by_day.get(d_idx, {})
        v_dig = round(s_dia.get("venda_digital", 0.0), 2)
        v_fig = round(s_dia.get("venda_figital", 0.0), 2)
        v_sem_fig = round(s_dia.get("venda_sem_figital", max(0.0, v_dig - v_fig)), 2)
        total_vendas_dias_digital.append(v_dig)
        total_vendas_dias_figital.append(v_fig)
        total_vendas_dias_sem_figital.append(v_sem_fig)
        total_vendas_dias_total.append(round(s_dia.get("venda", 0.0), 2))
        total_vendas_dias_fisica.append(round(s_dia.get("venda_fisica", 0.0), 2))

    venda_digital_realizada = round(sum(total_vendas_dias_digital), 2)
    venda_figital_realizada = round(sum(total_vendas_dias_figital), 2)
    venda_sem_figital_realizada = round(sum(total_vendas_dias_sem_figital), 2)
    venda_total_realizada = round(sum(total_vendas_dias_total), 2)
    venda_fisica_realizada = round(sum(total_vendas_dias_fisica), 2)

    gap_digital = round(venda_digital_realizada - meta_mtd, 2)
    atingimento_mtd = round((venda_digital_realizada / meta_mtd * 100) if meta_mtd > 0 else 0.0, 2)
    desvio_mtd = round(((venda_digital_realizada / meta_mtd - 1) * 100) if meta_mtd > 0 else 0.0, 2)
    desvio_sem_figital = round(((venda_sem_figital_realizada / meta_mtd - 1) * 100) if meta_mtd > 0 else 0.0, 2)

    projecao_fechamento = round((venda_digital_realizada / max_dia * total_dias_mes) if max_dia > 0 else 0.0, 2)
    atingimento_proj = round((projecao_fechamento / meta_mes * 100) if meta_mes > 0 else 0.0, 2)
    share_digital = round((venda_digital_realizada / venda_total_realizada * 100) if venda_total_realizada > 0 else 0.0, 2)

    # 1b. DADOS HISTÓRICOS 2025 (LY - LAST YEAR)
    total_vendas_dias_sem_figital_ly = [0.0] * max_dia
    total_vendas_dias_figital_ly = [0.0] * max_dia
    total_vendas_dias_digital_ly = [0.0] * max_dia
    total_vendas_dias_total_ly = [0.0] * max_dia

    daily_ly_by_day = {d.get("dia"): d for d in vendas_data.get("daily_ly", [])}
    for d_idx in range(1, max_dia + 1):
        s_dia = daily_ly_by_day.get(d_idx, {})
        sem = round(s_dia.get("venda_sem_figital", 0.0), 2)
        fig = round(s_dia.get("venda_figital", 0.0), 2)
        tot = round(s_dia.get("venda_total", 0.0), 2)
        total_vendas_dias_sem_figital_ly[d_idx - 1] = sem
        total_vendas_dias_figital_ly[d_idx - 1] = fig
        total_vendas_dias_digital_ly[d_idx - 1] = round(sem + fig, 2)
        total_vendas_dias_total_ly[d_idx - 1] = tot

    venda_digital_ly = round(sum(total_vendas_dias_digital_ly), 2)
    venda_sem_figital_ly = round(sum(total_vendas_dias_sem_figital_ly), 2)
    venda_figital_ly = round(sum(total_vendas_dias_figital_ly), 2)
    venda_total_ly = round(sum(total_vendas_dias_total_ly), 2)
    share_digital_ly = round((venda_digital_ly / venda_total_ly * 100) if venda_total_ly > 0 else 0.0, 2)
    diff_pp_ly = round(share_digital - share_digital_ly, 2)

    # Mapas de LY para enriquecimento das entidades
    dist_ly_map = {}
    for r in vendas_data.get("distritais_ly", []):
        d = r.get("distrital")
        dia = r.get("dia")
        if not d or not dia or dia > max_dia: continue
        if d not in dist_ly_map:
            dist_ly_map[d] = {
                "sem_fig": [0.0] * max_dia,
                "fig": [0.0] * max_dia,
                "dig": [0.0] * max_dia,
                "tot": [0.0] * max_dia
            }
        idx = dia - 1
        sem = round(r.get("venda_sem_figital", 0.0), 2)
        fig = round(r.get("venda_figital", 0.0), 2)
        tot = round(r.get("venda_total", 0.0), 2)
        dist_ly_map[d]["sem_fig"][idx] = sem
        dist_ly_map[d]["fig"][idx] = fig
        dist_ly_map[d]["dig"][idx] = round(sem + fig, 2)
        dist_ly_map[d]["tot"][idx] = tot

    coord_ly_map = {}
    for r in vendas_data.get("coordenadores_ly", []):
        c = r.get("coordenador")
        dia = r.get("dia")
        if not c or not dia or dia > max_dia: continue
        c_norm = norm_str(c)
        if c_norm in COORD_MAPPING:
            c = "Eunice dos Santos Trainee"
        if c not in coord_ly_map:
            coord_ly_map[c] = {
                "sem_fig": [0.0] * max_dia,
                "fig": [0.0] * max_dia,
                "dig": [0.0] * max_dia,
                "tot": [0.0] * max_dia
            }
        idx = dia - 1
        sem = round(r.get("venda_sem_figital", 0.0), 2)
        fig = round(r.get("venda_figital", 0.0), 2)
        tot = round(r.get("venda_total", 0.0), 2)
        coord_ly_map[c]["sem_fig"][idx] += sem
        coord_ly_map[c]["fig"][idx] += fig
        coord_ly_map[c]["dig"][idx] += round(sem + fig, 2)
        coord_ly_map[c]["tot"][idx] += tot

    grp_ly_map = {}
    for r in vendas_data.get("grupos_ly", []):
        g = norm_str(clean_group_name(r.get("grupo")))
        dia = r.get("dia")
        if not g or not dia or dia > max_dia: continue
        if g not in grp_ly_map:
            grp_ly_map[g] = {
                "sem_fig": [0.0] * max_dia,
                "fig": [0.0] * max_dia,
                "dig": [0.0] * max_dia,
                "tot": [0.0] * max_dia
            }
        idx = dia - 1
        sem = round(r.get("venda_sem_figital", 0.0), 2)
        fig = round(r.get("venda_figital", 0.0), 2)
        tot = round(r.get("venda_total", 0.0), 2)
        grp_ly_map[g]["sem_fig"][idx] += sem
        grp_ly_map[g]["fig"][idx] += fig
        grp_ly_map[g]["dig"][idx] += round(sem + fig, 2)
        grp_ly_map[g]["tot"][idx] += tot

    filiais_ly_map = {}
    for r in vendas_data.get("filiais_ly", []):
        fid = str(r.get("filial_id", "")).strip()
        if fid:
            sem = round(r.get("venda_sem_figital", 0.0), 2)
            fig = round(r.get("venda_figital", 0.0), 2)
            tot = round(r.get("venda_total", 0.0), 2)
            filiais_ly_map[fid] = {
                "venda_sem_figital_ly": sem,
                "venda_figital_ly": fig,
                "venda_digital_ly": round(sem + fig, 2),
                "venda_total_ly": tot
            }

    linhas_ly_map = {}
    for r in vendas_data.get("linhas_ly", []):
        k = (norm_str(clean_group_name(r.get("grupo"))), norm_str(r.get("linha")))
        sem = round(r.get("venda_sem_figital", 0.0), 2)
        fig = round(r.get("venda_figital", 0.0), 2)
        tot = round(r.get("venda_total", 0.0), 2)
        linhas_ly_map[k] = {
            "venda_sem_figital_ly": sem,
            "venda_figital_ly": fig,
            "venda_digital_ly": round(sem + fig, 2),
            "venda_total_ly": tot
        }

    # 2. CURVA DIÁRIA
    curva_diaria = []
    acum_meta = 0.0
    acum_real_dig = 0.0
    acum_real_sem_fig = 0.0
    acum_real_tot = 0.0

    for dia_idx in range(1, total_dias_mes + 1):
        m_dia = total_metas_dias[dia_idx - 1] if dia_idx <= len(total_metas_dias) else 0.0
        acum_meta += m_dia

        s_dia = daily_sales_by_day.get(dia_idx)
        tem_venda = dia_idx <= max_dia and s_dia is not None

        v_dig = s_dia.get("venda_digital", 0.0) if tem_venda else None
        v_fig = s_dia.get("venda_figital", 0.0) if tem_venda else None
        v_sem_fig = s_dia.get("venda_sem_figital", max(0.0, (v_dig or 0.0) - (v_fig or 0.0))) if tem_venda else None
        v_tot = s_dia.get("venda", 0.0) if tem_venda else None
        v_fis = s_dia.get("venda_fisica", 0.0) if tem_venda else None

        if tem_venda:
            acum_real_dig += v_dig
            acum_real_sem_fig += v_sem_fig
            acum_real_tot += v_tot
            desvio_pct = ((v_dig / m_dia - 1) * 100) if m_dia > 0 else 0.0
            desvio_sem_fig_pct = ((v_sem_fig / m_dia - 1) * 100) if (m_dia > 0 and v_sem_fig is not None) else 0.0
        else:
            desvio_pct = None
            desvio_sem_fig_pct = None

        curva_diaria.append({
            "dia": dia_idx,
            "data": f"{dia_idx:02d}/09",
            "meta_dia": round(m_dia, 2),
            "realizado_digital": round(v_dig, 2) if v_dig is not None else None,
            "realizado_figital": round(v_fig, 2) if v_fig is not None else None,
            "realizado_sem_figital": round(v_sem_fig, 2) if v_sem_fig is not None else None,
            "realizado_total": round(v_tot, 2) if v_tot is not None else None,
            "realizado_fisico": round(v_fis, 2) if v_fis is not None else None,
            "desvio_dia_pct": round(desvio_pct, 2) if desvio_pct is not None else None,
            "desvio_sem_fig_pct": round(desvio_sem_fig_pct, 2) if desvio_sem_fig_pct is not None else None,
            "acum_meta": round(acum_meta, 2),
            "acum_realizado": round(acum_real_dig, 2) if tem_venda else None,
            "acum_realizado_sem_figital": round(acum_real_sem_fig, 2) if tem_venda else None
        })

    # 3. MAPEAMENTO DE FILIAIS (ROBUSTO COM CANONICALIZAÇÃO)
    metas_fil = metas_data.get("filiais", {})
    qlik_filiais = vendas_data.get("filiais", [])

    # Cria índice do Excel normalizado (com e sem estado)
    excel_lookup = {}
    for ef_name in metas_fil.keys():
        norm_keep = normalize_name(ef_name, keep_state=True)
        norm_nokeep = normalize_name(ef_name, keep_state=False)
        excel_lookup[norm_keep] = ef_name
        excel_lookup[norm_nokeep] = ef_name

    filiais_list = []
    used_excel_stores = set()

    for qf in qlik_filiais:
        raw_name = qf.get("filial", "")
        raw_norm = normalize_name(raw_name, keep_state=True)
        id_loja = str(qf.get("filial_id") or qf.get("idLoja", ""))
        clean_raw = unicodedata.normalize("NFD", raw_name).encode("ascii", "ignore").decode("utf-8").lower().strip()
        clean_raw = re.sub(r"\s+", " ", clean_raw)

        # 1. Verifica mapping explícito
        target_name = EXPLICIT_MAP.get(clean_raw) or EXPLICIT_MAP.get(raw_norm)

        # 2. Busca com estado
        if not target_name:
            target_name = excel_lookup.get(raw_norm)

        # 3. Busca sem estado
        if not target_name:
            raw_norm_nostate = normalize_name(raw_name, keep_state=False)
            target_name = excel_lookup.get(raw_norm_nostate)
            if not target_name and raw_norm_nostate.endswith(' 1'):
                target_name = excel_lookup.get(raw_norm_nostate[:-2].strip())
            if not target_name and not re.search(r'\b\d+\b', raw_norm_nostate):
                target_name = excel_lookup.get(raw_norm_nostate + ' 1')

        # Evita colisão duplicada no mesmo target
        if target_name in used_excel_stores:
            target_name = None

        f_meta = metas_fil.get(target_name) if target_name else None
        if target_name:
            used_excel_stores.add(target_name)

        m_mes = f_meta.get("meta_mes", 0.0) if f_meta else 0.0
        m_dias = [round(x, 2) for x in f_meta.get("metas_dias", [0.0]*30)] if f_meta else [0.0]*30
        m_mtd = sum(m_dias[:max_dia])

        dias_dig = qf.get("dias_digital", [0.0]*max_dia)[:max_dia]
        dias_fig = qf.get("dias_figital", [0.0]*max_dia)[:max_dia]
        dias_sem_fig = qf.get("dias_sem_figital", [0.0]*max_dia)[:max_dia]
        dias_tot = qf.get("dias_total", [0.0]*max_dia)[:max_dia]

        v_dig = sum(dias_dig)
        v_fig = sum(dias_fig)
        v_sem_fig = sum(dias_sem_fig)
        v_tot = sum(dias_tot)
        v_fis = v_tot - v_dig

        ating = (v_dig / m_mtd * 100) if m_mtd > 0 else (100.0 if v_dig > 0 else 0.0)
        gap = v_dig - m_mtd
        proj = (v_dig / max_dia * total_dias_mes) if max_dia > 0 else 0.0
        ating_proj = (proj / m_mes * 100) if m_mes > 0 else (100.0 if proj > 0 else 0.0)
        share_dig = (v_dig / v_tot * 100) if v_tot > 0 else 0.0

        distrital_val = (f_meta.get("distrital") if f_meta else None) or qf.get("distrital", "")
        coordenador_val = (f_meta.get("coordenador") if f_meta else None) or qf.get("coordenador", "")

        f_ly = filiais_ly_map.get(id_loja, {})
        v_sem_ly = f_ly.get("venda_sem_figital_ly", 0.0)
        v_fig_ly = f_ly.get("venda_figital_ly", 0.0)
        v_dig_ly = f_ly.get("venda_digital_ly", 0.0)
        v_tot_ly = f_ly.get("venda_total_ly", 0.0)
        sh_dig_ly = round((v_dig_ly / v_tot_ly * 100) if v_tot_ly > 0 else 0.0, 2)
        diff_pp_fil = round(share_dig - sh_dig_ly, 2)

        filiais_list.append({
            "nome": target_name or raw_name,
            "nome_qlik": raw_name,
            "id_loja": id_loja,
            "distrital": distrital_val,
            "coordenador": coordenador_val,
            "meta_mes": round(m_mes, 2),
            "metas_dias": m_dias,
            "vendas_dias_digital": [round(x, 2) for x in dias_dig],
            "vendas_dias_figital": [round(x, 2) for x in dias_fig],
            "vendas_dias_sem_figital": [round(x, 2) for x in dias_sem_fig],
            "vendas_dias_total": [round(x, 2) for x in dias_tot],
            "meta_mtd": round(m_mtd, 2),
            "venda_digital": round(v_dig, 2),
            "venda_figital": round(v_fig, 2),
            "venda_sem_figital": round(v_sem_fig, 2),
            "venda_total": round(v_tot, 2),
            "venda_fisica": round(v_fis, 2),
            "venda_sem_figital_ly": round(v_sem_ly, 2),
            "venda_figital_ly": round(v_fig_ly, 2),
            "venda_digital_ly": round(v_dig_ly, 2),
            "venda_total_ly": round(v_tot_ly, 2),
            "share_digital_ly": sh_dig_ly,
            "diff_pp_ly": diff_pp_fil,
            "atingimento_mtd": round(ating, 2),
            "gap": round(gap, 2),
            "projecao": round(proj, 2),
            "atingimento_proj": round(ating_proj, 2),
            "share_digital": round(share_dig, 2),
            "status": get_status(ating)
        })

    # Adiciona filiais do Excel que eventualmente não tiveram venda no Qlik (ex: lojas em reforma)
    for ef_name, ef_meta in metas_fil.items():
        if ef_name not in used_excel_stores:
            m_mes = ef_meta.get("meta_mes", 0.0)
            m_dias = [round(x, 2) for x in ef_meta.get("metas_dias", [0.0]*30)]
            m_mtd = sum(m_dias[:max_dia])
            filiais_list.append({
                "nome": ef_name,
                "nome_qlik": ef_name,
                "id_loja": "",
                "distrital": ef_meta.get("distrital", ""),
                "coordenador": ef_meta.get("coordenador", ""),
                "meta_mes": round(m_mes, 2),
                "metas_dias": m_dias,
                "vendas_dias_digital": [0.0]*max_dia,
                "vendas_dias_figital": [0.0]*max_dia,
                "vendas_dias_sem_figital": [0.0]*max_dia,
                "vendas_dias_total": [0.0]*max_dia,
                "meta_mtd": round(m_mtd, 2),
                "venda_digital": 0.0,
                "venda_figital": 0.0,
                "venda_sem_figital": 0.0,
                "venda_total": 0.0,
                "venda_fisica": 0.0,
                "venda_sem_figital_ly": 0.0,
                "venda_figital_ly": 0.0,
                "venda_digital_ly": 0.0,
                "venda_total_ly": 0.0,
                "share_digital_ly": 0.0,
                "diff_pp_ly": 0.0,
                "atingimento_mtd": 0.0,
                "gap": round(-m_mtd, 2),
                "projecao": 0.0,
                "atingimento_proj": 0.0,
                "share_digital": 0.0,
                "status": "danger"
            })

    filiais_list.sort(key=lambda x: x["venda_digital"], reverse=True)

    # 4. CONSOLIDAÇÃO DISTRITAIS (AGREGAÇÃO DIÁRIA DIRETA DAS FILIAIS)
    dist_map = {}
    for f in filiais_list:
        d = f["distrital"] or "Outros"
        if d not in dist_map:
            dist_map[d] = {
                "nome": d,
                "meta_mes": 0.0,
                "metas_dias": [0.0] * 30,
                "vendas_dias_digital": [0.0] * max_dia,
                "vendas_dias_figital": [0.0] * max_dia,
                "vendas_dias_sem_figital": [0.0] * max_dia,
                "vendas_dias_total": [0.0] * max_dia,
                "lojas": 0,
                "coordenadores": set()
            }
        dist_map[d]["meta_mes"] += f["meta_mes"]
        dist_map[d]["lojas"] += 1
        if f["coordenador"]:
            dist_map[d]["coordenadores"].add(f["coordenador"])
        for i in range(30):
            dist_map[d]["metas_dias"][i] += f["metas_dias"][i]
        for i in range(max_dia):
            dist_map[d]["vendas_dias_digital"][i] += f["vendas_dias_digital"][i]
            dist_map[d]["vendas_dias_figital"][i] += f["vendas_dias_figital"][i]
            dist_map[d]["vendas_dias_sem_figital"][i] += f["vendas_dias_sem_figital"][i]
            dist_map[d]["vendas_dias_total"][i] += f["vendas_dias_total"][i]

    distritais_list = []
    for d_name, d_data in dist_map.items():
        m_mes = round(d_data["meta_mes"], 2)
        m_dias = [round(x, 2) for x in d_data["metas_dias"]]
        m_mtd = round(sum(m_dias[:max_dia]), 2)
        
        v_dias_dig = [round(x, 2) for x in d_data["vendas_dias_digital"]]
        v_dias_fig = [round(x, 2) for x in d_data["vendas_dias_figital"]]
        v_dias_sem_fig = [round(x, 2) for x in d_data["vendas_dias_sem_figital"]]
        v_dias_tot = [round(x, 2) for x in d_data["vendas_dias_total"]]
        v_dig = round(sum(v_dias_dig), 2)
        v_fig = round(sum(v_dias_fig), 2)
        v_sem_fig = round(sum(v_dias_sem_fig), 2)
        v_tot = round(sum(v_dias_tot), 2)
        v_fis = round(v_tot - v_dig, 2)

        ating = round((v_dig / m_mtd * 100) if m_mtd > 0 else 0.0, 2)
        gap = round(v_dig - m_mtd, 2)
        proj = round((v_dig / max_dia * total_dias_mes) if max_dia > 0 else 0.0, 2)
        ating_proj = round((proj / m_mes * 100) if m_mes > 0 else 0.0, 2)
        share_dig = round((v_dig / v_tot * 100) if v_tot > 0 else 0.0, 2)
        share_dir = round((v_dig / venda_digital_realizada * 100) if venda_digital_realizada > 0 else 0.0, 2)

        d_ly = dist_ly_map.get(d_name, {})
        dias_sem_ly = d_ly.get("sem_fig", [0.0]*max_dia)
        dias_fig_ly = d_ly.get("fig", [0.0]*max_dia)
        dias_dig_ly = d_ly.get("dig", [0.0]*max_dia)
        dias_tot_ly = d_ly.get("tot", [0.0]*max_dia)
        v_dig_ly = round(sum(dias_dig_ly), 2)
        v_sem_ly = round(sum(dias_sem_ly), 2)
        v_tot_ly = round(sum(dias_tot_ly), 2)
        sh_dig_ly = round((v_dig_ly / v_tot_ly * 100) if v_tot_ly > 0 else 0.0, 2)
        diff_pp_dist = round(share_dig - sh_dig_ly, 2)

        distritais_list.append({
            "nome": d_name,
            "meta_mes": m_mes,
            "metas_dias": m_dias,
            "vendas_dias_digital": v_dias_dig,
            "vendas_dias_figital": v_dias_fig,
            "vendas_dias_sem_figital": v_dias_sem_fig,
            "vendas_dias_total": v_dias_tot,
            "vendas_dias_digital_ly": dias_dig_ly,
            "vendas_dias_figital_ly": dias_fig_ly,
            "vendas_dias_sem_figital_ly": dias_sem_ly,
            "vendas_dias_total_ly": dias_tot_ly,
            "meta_mtd": m_mtd,
            "venda_digital": v_dig,
            "venda_figital": v_fig,
            "venda_sem_figital": v_sem_fig,
            "venda_total": v_tot,
            "venda_fisica": v_fis,
            "venda_digital_ly": v_dig_ly,
            "venda_sem_figital_ly": v_sem_ly,
            "venda_total_ly": v_tot_ly,
            "share_digital_ly": sh_dig_ly,
            "diff_pp_ly": diff_pp_dist,
            "atingimento_mtd": ating,
            "gap": gap,
            "projecao": proj,
            "atingimento_proj": ating_proj,
            "share_digital": share_dig,
            "share_diretoria": share_dir,
            "lojas": d_data["lojas"],
            "coordenadores_count": len(d_data["coordenadores"]),
            "status": get_status(ating)
        })

    distritais_list.sort(key=lambda x: x["atingimento_mtd"], reverse=True)

    # 5. CONSOLIDAÇÃO COORDENADORES (AGREGAÇÃO DIÁRIA DIRETA DAS FILIAIS)
    coord_map = {}
    for f in filiais_list:
        c = f["coordenador"] or "Outros"
        # Normalização do Coordenador (ex: Eunice / Fernanda)
        c_norm = norm_str(c)
        if c_norm in COORD_MAPPING:
            c = "Eunice dos Santos Trainee"

        if c not in coord_map:
            coord_map[c] = {
                "nome": c,
                "distrital": f["distrital"],
                "meta_mes": 0.0,
                "metas_dias": [0.0] * 30,
                "vendas_dias_digital": [0.0] * max_dia,
                "vendas_dias_figital": [0.0] * max_dia,
                "vendas_dias_sem_figital": [0.0] * max_dia,
                "vendas_dias_total": [0.0] * max_dia,
                "lojas": 0
            }
        coord_map[c]["meta_mes"] += f["meta_mes"]
        coord_map[c]["lojas"] += 1
        if not coord_map[c]["distrital"]:
            coord_map[c]["distrital"] = f["distrital"]
        for i in range(30):
            coord_map[c]["metas_dias"][i] += f["metas_dias"][i]
        for i in range(max_dia):
            coord_map[c]["vendas_dias_digital"][i] += f["vendas_dias_digital"][i]
            coord_map[c]["vendas_dias_figital"][i] += f["vendas_dias_figital"][i]
            coord_map[c]["vendas_dias_sem_figital"][i] += f["vendas_dias_sem_figital"][i]
            coord_map[c]["vendas_dias_total"][i] += f["vendas_dias_total"][i]

    coordenadores_list = []
    for c_name, c_data in coord_map.items():
        m_mes = round(c_data["meta_mes"], 2)
        m_dias = [round(x, 2) for x in c_data["metas_dias"]]
        m_mtd = round(sum(m_dias[:max_dia]), 2)

        v_dias_dig = [round(x, 2) for x in c_data["vendas_dias_digital"]]
        v_dias_fig = [round(x, 2) for x in c_data["vendas_dias_figital"]]
        v_dias_sem_fig = [round(x, 2) for x in c_data["vendas_dias_sem_figital"]]
        v_dias_tot = [round(x, 2) for x in c_data["vendas_dias_total"]]
        v_dig = round(sum(v_dias_dig), 2)
        v_fig = round(sum(v_dias_fig), 2)
        v_sem_fig = round(sum(v_dias_sem_fig), 2)
        v_tot = round(sum(v_dias_tot), 2)
        v_fis = round(v_tot - v_dig, 2)

        ating = round((v_dig / m_mtd * 100) if m_mtd > 0 else 0.0, 2)
        gap = round(v_dig - m_mtd, 2)
        proj = round((v_dig / max_dia * total_dias_mes) if max_dia > 0 else 0.0, 2)
        ating_proj = round((proj / m_mes * 100) if m_mes > 0 else 0.0, 2)
        share_dig = round((v_dig / v_tot * 100) if v_tot > 0 else 0.0, 2)

        c_ly = coord_ly_map.get(c_name, {})
        dias_sem_ly = c_ly.get("sem_fig", [0.0]*max_dia)
        dias_fig_ly = c_ly.get("fig", [0.0]*max_dia)
        dias_dig_ly = c_ly.get("dig", [0.0]*max_dia)
        dias_tot_ly = c_ly.get("tot", [0.0]*max_dia)
        v_dig_ly = round(sum(dias_dig_ly), 2)
        v_sem_ly = round(sum(dias_sem_ly), 2)
        v_tot_ly = round(sum(dias_tot_ly), 2)
        sh_dig_ly = round((v_dig_ly / v_tot_ly * 100) if v_tot_ly > 0 else 0.0, 2)
        diff_pp_coord = round(share_dig - sh_dig_ly, 2)

        coordenadores_list.append({
            "nome": c_name,
            "distrital": c_data["distrital"],
            "meta_mes": m_mes,
            "metas_dias": m_dias,
            "vendas_dias_digital": v_dias_dig,
            "vendas_dias_figital": v_dias_fig,
            "vendas_dias_sem_figital": v_dias_sem_fig,
            "vendas_dias_total": v_dias_tot,
            "vendas_dias_digital_ly": dias_dig_ly,
            "vendas_dias_figital_ly": dias_fig_ly,
            "vendas_dias_sem_figital_ly": dias_sem_ly,
            "vendas_dias_total_ly": dias_tot_ly,
            "meta_mtd": m_mtd,
            "venda_digital": v_dig,
            "venda_figital": v_fig,
            "venda_sem_figital": v_sem_fig,
            "venda_total": v_tot,
            "venda_fisica": v_fis,
            "venda_digital_ly": v_dig_ly,
            "venda_sem_figital_ly": v_sem_ly,
            "venda_total_ly": v_tot_ly,
            "share_digital_ly": sh_dig_ly,
            "diff_pp_ly": diff_pp_coord,
            "atingimento_mtd": ating,
            "gap": gap,
            "projecao": proj,
            "atingimento_proj": ating_proj,
            "share_digital": share_dig,
            "lojas": c_data["lojas"],
            "status": get_status(ating)
        })

    coordenadores_list.sort(key=lambda x: x["atingimento_mtd"], reverse=True)

    # 6. CONSOLIDAÇÃO GRUPOS (CATEGORIAS)
    metas_grp = metas_data.get("grupos", {})
    # 6. CONSOLIDAÇÃO LINHAS DE PRODUTOS (ABERTURA ANALÍTICA COMPLETA)
    qlik_linhas_map = {}
    for l in vendas_data.get("linhas", []):
        nl = norm_str(l.get("linha"))
        qlik_linhas_map[nl] = l

    linhas_list = []
    for g_raw_name, g_meta in metas_grp.items():
        g_clean = clean_group_name(g_raw_name)
        linhas_dict = g_meta.get("linhas", {})
        for l_raw_name, l_meta in linhas_dict.items():
            nl = norm_str(l_raw_name)
            ql = qlik_linhas_map.get(nl, {})

            m_mes = round(l_meta.get("meta_mes", 0.0), 2)
            m_dias = [round(x, 2) for x in l_meta.get("metas_dias", [0.0]*30)]
            m_mtd = round(sum(m_dias[:max_dia]), 2)

            dias_sem_fig = ql.get("dias_sem_figital", [0.0]*max_dia)[:max_dia]
            dias_fig = ql.get("dias_figital", [0.0]*max_dia)[:max_dia]
            dias_dig = [round(s + f, 2) for s, f in zip(dias_sem_fig, dias_fig)] if dias_sem_fig else ql.get("dias_digital", [0.0]*max_dia)[:max_dia]
            dias_tot = ql.get("dias_total", [0.0]*max_dia)[:max_dia]

            v_sem_fig = round(sum(dias_sem_fig) if dias_sem_fig else ql.get("venda_sem_figital", 0.0), 2)
            v_fig = round(sum(dias_fig) if dias_fig else ql.get("venda_figital", 0.0), 2)
            v_dig = round(v_sem_fig + v_fig, 2)
            v_tot = round(sum(dias_tot) if dias_tot else ql.get("venda", 0.0), 2)
            v_fis = round(max(0.0, v_tot - v_dig), 2)

            ating = round((v_dig / m_mtd * 100) if m_mtd > 0 else (100.0 if v_dig > 0 else 0.0), 2)
            gap = round(v_dig - m_mtd, 2)
            proj = round((v_dig / max_dia * total_dias_mes) if max_dia > 0 else 0.0, 2)
            ating_proj = round((proj / m_mes * 100) if m_mes > 0 else (100.0 if proj > 0 else 0.0), 2)
            share_dig = round((v_dig / v_tot * 100) if v_tot > 0 else 0.0, 2)

            lin_ly = linhas_ly_map.get((norm_str(clean_group_name(g_clean)), norm_str(l_raw_name)), {})
            v_sem_ly = lin_ly.get("venda_sem_figital_ly", 0.0)
            v_fig_ly = lin_ly.get("venda_figital_ly", 0.0)
            v_dig_ly = lin_ly.get("venda_digital_ly", 0.0)
            v_tot_ly = lin_ly.get("venda_total_ly", 0.0)
            sh_dig_ly = round((v_dig_ly / v_tot_ly * 100) if v_tot_ly > 0 else 0.0, 2)
            diff_pp_lin = round(share_dig - sh_dig_ly, 2)

            linhas_list.append({
                "grupo": g_clean,
                "linha": l_raw_name,
                "meta_mes": m_mes,
                "metas_dias": m_dias,
                "vendas_dias_digital": [round(x, 2) for x in dias_dig],
                "vendas_dias_figital": [round(x, 2) for x in dias_fig],
                "vendas_dias_sem_figital": [round(x, 2) for x in dias_sem_fig],
                "vendas_dias_total": [round(x, 2) for x in dias_tot],
                "meta_mtd": m_mtd,
                "venda_digital": v_dig,
                "venda_figital": v_fig,
                "venda_sem_figital": v_sem_fig,
                "venda_total": v_tot,
                "venda_fisica": v_fis,
                "venda_sem_figital_ly": round(v_sem_ly, 2),
                "venda_figital_ly": round(v_fig_ly, 2),
                "venda_digital_ly": round(v_dig_ly, 2),
                "venda_total_ly": round(v_tot_ly, 2),
                "share_digital_ly": sh_dig_ly,
                "diff_pp_ly": diff_pp_lin,
                "atingimento_mtd": ating,
                "gap": gap,
                "projecao": proj,
                "atingimento_proj": ating_proj,
                "share_digital": share_dig,
                "status": get_status(ating)
            })

    linhas_list.sort(key=lambda x: x["venda_sem_figital"], reverse=True)

    # Agrupa linhas por grupo para exibição direta (drill-down / acordeão)
    linhas_por_grupo_cons = {}
    for l in linhas_list:
        grp = l["grupo"]
        if grp not in linhas_por_grupo_cons:
            linhas_por_grupo_cons[grp] = []
        linhas_por_grupo_cons[grp].append(l)

    # 7. CONSOLIDAÇÃO GRUPOS (CATEGORIAS COM LINHAS ANINHADAS)
    metas_grp = metas_data.get("grupos", {})
    qlik_grupos = vendas_data.get("grupos", [])
    vendas_grp = {norm_str(clean_group_name(g.get("grupo"))): g for g in qlik_grupos}

    grupos_list = []
    for g_raw_name, g_meta in metas_grp.items():
        g_clean = clean_group_name(g_raw_name)
        g_norm = norm_str(g_clean)
        v_info = vendas_grp.get(g_norm, {})

        m_mes = round(g_meta.get("meta_mes", 0.0), 2)
        m_dias = [round(x, 2) for x in g_meta.get("metas_dias", [0.0]*30)]
        m_mtd = round(sum(m_dias[:max_dia]), 2)

        linhas_deste_grupo = linhas_por_grupo_cons.get(g_clean, [])

        dias_sem_fig = v_info.get("dias_sem_figital", [0.0]*max_dia)[:max_dia]
        dias_fig = v_info.get("dias_figital", [0.0]*max_dia)[:max_dia]
        dias_dig = [round(s + f, 2) for s, f in zip(dias_sem_fig, dias_fig)] if dias_sem_fig else v_info.get("dias_digital", [0.0]*max_dia)[:max_dia]
        dias_tot = v_info.get("dias_total", [0.0]*max_dia)[:max_dia]

        # Fallback de segurança: se o Qlik grupo direto não tiver dados diários, agrega das linhas deste grupo
        if not dias_sem_fig or sum(dias_sem_fig) == 0:
            dias_sem_fig = [0.0] * max_dia
            dias_fig = [0.0] * max_dia
            dias_dig = [0.0] * max_dia
            dias_tot = [0.0] * max_dia
            for l in linhas_deste_grupo:
                l_sem = l.get("vendas_dias_sem_figital", [])
                l_fig = l.get("vendas_dias_figital", [])
                l_dig = l.get("vendas_dias_digital", [])
                l_tot = l.get("vendas_dias_total", [])
                for i in range(min(max_dia, len(l_sem))):
                    dias_sem_fig[i] += l_sem[i]
                for i in range(min(max_dia, len(l_fig))):
                    dias_fig[i] += l_fig[i]
                for i in range(min(max_dia, len(l_dig))):
                    dias_dig[i] += l_dig[i]
                for i in range(min(max_dia, len(l_tot))):
                    dias_tot[i] += l_tot[i]

        v_sem_fig = round(sum(dias_sem_fig) if dias_sem_fig else v_info.get("venda_sem_figital", 0.0), 2)
        v_fig = round(sum(dias_fig) if dias_fig else v_info.get("venda_figital", 0.0), 2)
        v_dig = round(v_sem_fig + v_fig, 2)
        v_tot = round(sum(dias_tot) if dias_tot else v_info.get("venda", 0.0), 2)
        v_fis = round(max(0.0, v_tot - v_dig), 2)

        ating = round((v_dig / m_mtd * 100) if m_mtd > 0 else 0.0, 2)
        desvio = round(((v_dig / m_mtd - 1) * 100) if m_mtd > 0 else 0.0, 2)
        desvio_sem_fig = round(((v_sem_fig / m_mtd - 1) * 100) if m_mtd > 0 else 0.0, 2)
        gap = round(v_dig - m_mtd, 2)
        proj = round((v_dig / max_dia * total_dias_mes) if max_dia > 0 else 0.0, 2)
        ating_proj = round((proj / m_mes * 100) if m_mes > 0 else 0.0, 2)
        share_dig = round((v_dig / v_tot * 100) if v_tot > 0 else 0.0, 2)

        g_ly = grp_ly_map.get(norm_str(clean_group_name(g_clean)), {})
        dias_sem_ly = g_ly.get("sem_fig", [0.0]*max_dia)
        dias_fig_ly = g_ly.get("fig", [0.0]*max_dia)
        dias_dig_ly = g_ly.get("dig", [0.0]*max_dia)
        dias_tot_ly = g_ly.get("tot", [0.0]*max_dia)
        v_dig_ly = round(sum(dias_dig_ly), 2)
        v_sem_ly = round(sum(dias_sem_ly), 2)
        v_tot_ly = round(sum(dias_tot_ly), 2)
        sh_dig_ly = round((v_dig_ly / v_tot_ly * 100) if v_tot_ly > 0 else 0.0, 2)
        diff_pp_grp = round(share_dig - sh_dig_ly, 2)

        grupos_list.append({
            "grupo": g_clean,
            "meta_mes": m_mes,
            "metas_dias": m_dias,
            "vendas_dias_digital": [round(x, 2) for x in dias_dig],
            "vendas_dias_figital": [round(x, 2) for x in dias_fig],
            "vendas_dias_sem_figital": [round(x, 2) for x in dias_sem_fig],
            "vendas_dias_total": [round(x, 2) for x in dias_tot],
            "vendas_dias_digital_ly": dias_dig_ly,
            "vendas_dias_figital_ly": dias_fig_ly,
            "vendas_dias_sem_figital_ly": dias_sem_ly,
            "vendas_dias_total_ly": dias_tot_ly,
            "meta_mtd": m_mtd,
            "venda_digital": v_dig,
            "venda_figital": v_fig,
            "venda_sem_figital": v_sem_fig,
            "venda_total": v_tot,
            "venda_fisica": v_fis,
            "venda_digital_ly": v_dig_ly,
            "venda_sem_figital_ly": v_sem_ly,
            "venda_total_ly": v_tot_ly,
            "share_digital_ly": sh_dig_ly,
            "diff_pp_ly": diff_pp_grp,
            "atingimento_mtd": ating,
            "desvio_mtd": desvio,
            "desvio_sem_figital": desvio_sem_fig,
            "gap": gap,
            "projecao": proj,
            "atingimento_proj": ating_proj,
            "share_digital": share_dig,
            "status": get_status(ating),
            "total_linhas": len(linhas_deste_grupo),
            "linhas": linhas_deste_grupo
        })

    grupos_list.sort(key=lambda x: x["venda_sem_figital"], reverse=True)

    # 8. ENRIQUECIMENTO DE GRUPOS E LINHAS POR COORDENADOR E DISTRITAL
    # Permite que os filtros de Distrital e Coordenador recalculem dinamicamente
    # a tabela de Categorias/Grupos (Tab 5) e Linhas de Produtos (Tab 6).
    cgd = vendas_data.get("coordenadores_grupos_dia", [])
    cl = vendas_data.get("coordenadores_linhas", [])
    c_metas = metas_data.get("coordenadores", {})

    cgd_map = {}
    for r in cgd:
        c_mapped = COORD_MAPPING.get(norm_str(r.get("coordenador")), norm_str(r.get("coordenador")))
        g_norm = norm_str(clean_group_name(r.get("grupo")))
        dia = int(r.get("dia", 1))
        key = (c_mapped, g_norm, dia)
        if key not in cgd_map:
            cgd_map[key] = {'sem_fig': 0.0, 'fig': 0.0, 'tot': 0.0}
        cgd_map[key]['sem_fig'] += float(r.get("venda_sem_figital") or 0.0)
        cgd_map[key]['fig'] += float(r.get("venda_figital") or 0.0)
        cgd_map[key]['tot'] += float(r.get("venda_total") or 0.0)

    cl_map = {}
    for r in cl:
        c_mapped = COORD_MAPPING.get(norm_str(r.get("coordenador")), norm_str(r.get("coordenador")))
        g_norm = norm_str(clean_group_name(r.get("grupo")))
        l_norm = norm_str(r.get("linha"))
        key = (c_mapped, g_norm, l_norm)
        if key not in cl_map:
            cl_map[key] = {'sem_fig': 0.0, 'fig': 0.0, 'tot': 0.0}
        cl_map[key]['sem_fig'] += float(r.get("venda_sem_figital") or 0.0)
        cl_map[key]['fig'] += float(r.get("venda_figital") or 0.0)
        cl_map[key]['tot'] += float(r.get("venda_total") or 0.0)

    for c in coordenadores_list:
        c_name = c["nome"]
        c_norm = COORD_MAPPING.get(norm_str(c_name), norm_str(c_name))
        c_meta = None
        for mk, mv in c_metas.items():
            if COORD_MAPPING.get(norm_str(mk), norm_str(mk)) == c_norm:
                c_meta = mv
                break

        c_grupos = []
        if c_meta:
            for g_raw, g_data in c_meta.get("grupos", {}).items():
                g_clean = clean_group_name(g_raw)
                g_norm = norm_str(g_clean)

                m_mes = round(g_data.get("meta_mes", 0.0), 2)
                m_dias = [round(x, 2) for x in g_data.get("metas_dias", [0.0]*30)]
                m_mtd = round(sum(m_dias[:max_dia]), 2)

                dias_sem_fig = [round(cgd_map.get((c_norm, g_norm, d), {}).get('sem_fig', 0.0), 2) for d in range(1, max_dia + 1)]
                dias_fig = [round(cgd_map.get((c_norm, g_norm, d), {}).get('fig', 0.0), 2) for d in range(1, max_dia + 1)]
                dias_tot = [round(cgd_map.get((c_norm, g_norm, d), {}).get('tot', 0.0), 2) for d in range(1, max_dia + 1)]
                dias_dig = [round(s + f, 2) for s, f in zip(dias_sem_fig, dias_fig)]

                v_sem_fig = round(sum(dias_sem_fig), 2)
                v_fig = round(sum(dias_fig), 2)
                v_dig = round(sum(dias_dig), 2)
                v_tot = round(sum(dias_tot), 2)
                v_fis = round(max(0.0, v_tot - v_dig), 2)

                ating = round((v_dig / m_mtd * 100) if m_mtd > 0 else 0.0, 2)
                desvio = round(((v_dig / m_mtd - 1) * 100) if m_mtd > 0 else 0.0, 2)
                desvio_sem_fig = round(((v_sem_fig / m_mtd - 1) * 100) if m_mtd > 0 else 0.0, 2)
                gap = round(v_dig - m_mtd, 2)
                proj = round((v_dig / max_dia * total_dias_mes) if max_dia > 0 else 0.0, 2)
                ating_proj = round((proj / m_mes * 100) if m_mes > 0 else 0.0, 2)
                share_dig = round((v_dig / v_tot * 100) if v_tot > 0 else 0.0, 2)

                linhas_deste_grupo = []
                for l_raw, l_data in g_data.get("linhas", {}).items():
                    l_norm = norm_str(l_raw)
                    lm_mes = round(l_data.get("meta_mes", 0.0), 2)
                    lm_dias = [round(x, 2) for x in l_data.get("metas_dias", [0.0]*30)]
                    lm_mtd = round(sum(lm_dias[:max_dia]), 2)

                    ql = cl_map.get((c_norm, g_norm, l_norm), {})
                    lv_sem = round(ql.get('sem_fig', 0.0), 2)
                    lv_fig = round(ql.get('fig', 0.0), 2)
                    lv_dig = round(lv_sem + lv_fig, 2)
                    lv_tot = round(ql.get('tot', 0.0), 2)
                    lv_fis = round(max(0.0, lv_tot - lv_dig), 2)

                    if lm_mes == 0 and lv_tot == 0 and lv_dig == 0:
                        continue

                    lin_ly = linhas_ly_map.get((norm_str(clean_group_name(g_clean)), norm_str(l_raw)), {})
                    lv_sem_ly = lin_ly.get("venda_sem_figital_ly", 0.0)
                    lv_fig_ly = lin_ly.get("venda_figital_ly", 0.0)
                    lv_dig_ly = lin_ly.get("venda_digital_ly", 0.0)
                    lv_tot_ly = lin_ly.get("venda_total_ly", 0.0)
                    l_sh_dig_ly = round((lv_dig_ly / lv_tot_ly * 100) if lv_tot_ly > 0 else 0.0, 2)
                    l_diff_pp = round(((lv_dig / lv_tot * 100) if lv_tot > 0 else 0.0) - l_sh_dig_ly, 2)

                    linha_obj = {
                        "linha": l_raw,
                        "grupo": g_clean,
                        "meta_mes": lm_mes,
                        "meta_mtd": lm_mtd,
                        "venda_sem_figital": lv_sem,
                        "venda_figital": lv_fig,
                        "venda_digital": lv_dig,
                        "venda_total": lv_tot,
                        "venda_fisica": lv_fis,
                        "venda_sem_figital_ly": lv_sem_ly,
                        "venda_figital_ly": lv_fig_ly,
                        "venda_digital_ly": lv_dig_ly,
                        "venda_total_ly": lv_tot_ly,
                        "share_digital_ly": l_sh_dig_ly,
                        "diff_pp_ly": l_diff_pp
                    }
                    linhas_deste_grupo.append(linha_obj)

                linhas_deste_grupo.sort(key=lambda x: x["venda_sem_figital"], reverse=True)

                g_ly = grp_ly_map.get(norm_str(clean_group_name(g_clean)), {})
                g_dias_sem_ly = g_ly.get("sem_fig", [0.0]*max_dia)
                g_dias_fig_ly = g_ly.get("fig", [0.0]*max_dia)
                g_dias_dig_ly = g_ly.get("dig", [0.0]*max_dia)
                g_dias_tot_ly = g_ly.get("tot", [0.0]*max_dia)
                gv_dig_ly = round(sum(g_dias_dig_ly), 2)
                gv_sem_ly = round(sum(g_dias_sem_ly), 2)
                gv_tot_ly = round(sum(g_dias_tot_ly), 2)
                g_sh_dig_ly = round((gv_dig_ly / gv_tot_ly * 100) if gv_tot_ly > 0 else 0.0, 2)
                g_diff_pp = round(share_dig - g_sh_dig_ly, 2)

                grp_obj = {
                    "grupo": g_clean,
                    "meta_mes": m_mes,
                    "metas_dias": m_dias,
                    "vendas_dias_digital": dias_dig,
                    "vendas_dias_figital": dias_fig,
                    "vendas_dias_sem_figital": dias_sem_fig,
                    "vendas_dias_total": dias_tot,
                    "vendas_dias_digital_ly": g_dias_dig_ly,
                    "vendas_dias_figital_ly": g_dias_fig_ly,
                    "vendas_dias_sem_figital_ly": g_dias_sem_ly,
                    "vendas_dias_total_ly": g_dias_tot_ly,
                    "meta_mtd": m_mtd,
                    "venda_digital": v_dig,
                    "venda_figital": v_fig,
                    "venda_sem_figital": v_sem_fig,
                    "venda_total": v_tot,
                    "venda_fisica": v_fis,
                    "venda_digital_ly": gv_dig_ly,
                    "venda_sem_figital_ly": gv_sem_ly,
                    "venda_total_ly": gv_tot_ly,
                    "share_digital_ly": g_sh_dig_ly,
                    "diff_pp_ly": g_diff_pp,
                    "atingimento_mtd": ating,
                    "desvio_mtd": desvio,
                    "desvio_sem_figital": desvio_sem_fig,
                    "gap": gap,
                    "projecao": proj,
                    "atingimento_proj": ating_proj,
                    "share_digital": share_dig,
                    "status": get_status(ating),
                    "total_linhas": len(linhas_deste_grupo),
                    "linhas": linhas_deste_grupo
                }
                c_grupos.append(grp_obj)

        c_grupos.sort(key=lambda x: x["venda_sem_figital"], reverse=True)
        c["grupos"] = c_grupos

    # Agrega grupos e linhas para distritais a partir de seus coordenadores
    for d in distritais_list:
        d_coords = [c for c in coordenadores_list if c["distrital"] == d["nome"]]
        d_grp_map = {}
        for c in d_coords:
            for g in c.get("grupos", []):
                gn = g["grupo"]
                if gn not in d_grp_map:
                    d_grp_map[gn] = {
                        "grupo": gn,
                        "meta_mes": 0.0,
                        "metas_dias": [0.0]*30,
                        "vendas_dias_digital": [0.0]*max_dia,
                        "vendas_dias_figital": [0.0]*max_dia,
                        "vendas_dias_sem_figital": [0.0]*max_dia,
                        "vendas_dias_total": [0.0]*max_dia,
                        "linhas_dict": {}
                    }
                d_grp_map[gn]["meta_mes"] += g["meta_mes"]
                for i in range(30): d_grp_map[gn]["metas_dias"][i] += g["metas_dias"][i]
                for i in range(max_dia):
                    d_grp_map[gn]["vendas_dias_digital"][i] += g["vendas_dias_digital"][i]
                    d_grp_map[gn]["vendas_dias_figital"][i] += g["vendas_dias_figital"][i]
                    d_grp_map[gn]["vendas_dias_sem_figital"][i] += g["vendas_dias_sem_figital"][i]
                    d_grp_map[gn]["vendas_dias_total"][i] += g["vendas_dias_total"][i]

                for l in g.get("linhas", []):
                    ln = l["linha"]
                    if ln not in d_grp_map[gn]["linhas_dict"]:
                        d_grp_map[gn]["linhas_dict"][ln] = {
                            "linha": ln,
                            "grupo": gn,
                            "meta_mes": 0.0,
                            "meta_mtd": 0.0,
                            "venda_sem_figital": 0.0,
                            "venda_figital": 0.0,
                            "venda_digital": 0.0,
                            "venda_total": 0.0,
                            "venda_fisica": 0.0
                        }
                    ld = d_grp_map[gn]["linhas_dict"][ln]
                    ld["meta_mes"] += l["meta_mes"]
                    ld["meta_mtd"] += l["meta_mtd"]
                    ld["venda_sem_figital"] += l["venda_sem_figital"]
                    ld["venda_figital"] += l["venda_figital"]
                    ld["venda_digital"] += l["venda_digital"]
                    ld["venda_total"] += l["venda_total"]
                    ld["venda_fisica"] += l["venda_fisica"]

        d_grupos = []
        for gn, gd in d_grp_map.items():
            m_mes = round(gd["meta_mes"], 2)
            m_dias = [round(x, 2) for x in gd["metas_dias"]]
            m_mtd = round(sum(m_dias[:max_dia]), 2)
            dias_dig = [round(x, 2) for x in gd["vendas_dias_digital"]]
            dias_fig = [round(x, 2) for x in gd["vendas_dias_figital"]]
            dias_sem = [round(x, 2) for x in gd["vendas_dias_sem_figital"]]
            dias_tot = [round(x, 2) for x in gd["vendas_dias_total"]]
            v_dig = round(sum(dias_dig), 2)
            v_fig = round(sum(dias_fig), 2)
            v_sem = round(sum(dias_sem), 2)
            v_tot = round(sum(dias_tot), 2)
            v_fis = round(max(0.0, v_tot - v_dig), 2)

            ating = round((v_dig / m_mtd * 100) if m_mtd > 0 else 0.0, 2)
            desvio = round(((v_dig / m_mtd - 1) * 100) if m_mtd > 0 else 0.0, 2)
            desvio_sem = round(((v_sem / m_mtd - 1) * 100) if m_mtd > 0 else 0.0, 2)
            gap = round(v_dig - m_mtd, 2)
            proj = round((v_dig / max_dia * total_dias_mes) if max_dia > 0 else 0.0, 2)
            ating_proj = round((proj / m_mes * 100) if m_mes > 0 else 0.0, 2)
            share_dig = round((v_dig / v_tot * 100) if v_tot > 0 else 0.0, 2)

            linhas_deste_grupo = []
            for ln, ld in gd["linhas_dict"].items():
                lin_ly = linhas_ly_map.get((norm_str(clean_group_name(gn)), norm_str(ln)), {})
                lv_sem_ly = lin_ly.get("venda_sem_figital_ly", 0.0)
                lv_fig_ly = lin_ly.get("venda_figital_ly", 0.0)
                lv_dig_ly = lin_ly.get("venda_digital_ly", 0.0)
                lv_tot_ly = lin_ly.get("venda_total_ly", 0.0)
                l_sh_dig_ly = round((lv_dig_ly / lv_tot_ly * 100) if lv_tot_ly > 0 else 0.0, 2)
                l_diff_pp = round(((ld["venda_digital"] / ld["venda_total"] * 100) if ld["venda_total"] > 0 else 0.0) - l_sh_dig_ly, 2)

                linhas_deste_grupo.append({
                    "linha": ln,
                    "grupo": gn,
                    "meta_mes": round(ld["meta_mes"], 2),
                    "meta_mtd": round(ld["meta_mtd"], 2),
                    "venda_sem_figital": round(ld["venda_sem_figital"], 2),
                    "venda_figital": round(ld["venda_figital"], 2),
                    "venda_digital": round(ld["venda_digital"], 2),
                    "venda_total": round(ld["venda_total"], 2),
                    "venda_fisica": round(ld["venda_fisica"], 2),
                    "venda_sem_figital_ly": lv_sem_ly,
                    "venda_figital_ly": lv_fig_ly,
                    "venda_digital_ly": lv_dig_ly,
                    "venda_total_ly": lv_tot_ly,
                    "share_digital_ly": l_sh_dig_ly,
                    "diff_pp_ly": l_diff_pp
                })
            linhas_deste_grupo.sort(key=lambda x: x["venda_sem_figital"], reverse=True)

            g_ly = grp_ly_map.get(norm_str(clean_group_name(gn)), {})
            g_dias_sem_ly = g_ly.get("sem_fig", [0.0]*max_dia)
            g_dias_fig_ly = g_ly.get("fig", [0.0]*max_dia)
            g_dias_dig_ly = g_ly.get("dig", [0.0]*max_dia)
            g_dias_tot_ly = g_ly.get("tot", [0.0]*max_dia)
            gv_dig_ly = round(sum(g_dias_dig_ly), 2)
            gv_sem_ly = round(sum(g_dias_sem_ly), 2)
            gv_tot_ly = round(sum(g_dias_tot_ly), 2)
            g_sh_dig_ly = round((gv_dig_ly / gv_tot_ly * 100) if gv_tot_ly > 0 else 0.0, 2)
            g_diff_pp = round(share_dig - g_sh_dig_ly, 2)

            d_grupos.append({
                "grupo": gn,
                "meta_mes": m_mes,
                "metas_dias": m_dias,
                "vendas_dias_digital": dias_dig,
                "vendas_dias_figital": dias_fig,
                "vendas_dias_sem_figital": dias_sem,
                "vendas_dias_total": dias_tot,
                "vendas_dias_digital_ly": g_dias_dig_ly,
                "vendas_dias_figital_ly": g_dias_fig_ly,
                "vendas_dias_sem_figital_ly": g_dias_sem_ly,
                "vendas_dias_total_ly": g_dias_tot_ly,
                "meta_mtd": m_mtd,
                "venda_digital": v_dig,
                "venda_figital": v_fig,
                "venda_sem_figital": v_sem,
                "venda_total": v_tot,
                "venda_fisica": v_fis,
                "venda_digital_ly": gv_dig_ly,
                "venda_sem_figital_ly": gv_sem_ly,
                "venda_total_ly": gv_tot_ly,
                "share_digital_ly": g_sh_dig_ly,
                "diff_pp_ly": g_diff_pp,
                "atingimento_mtd": ating,
                "desvio_mtd": desvio,
                "desvio_sem_figital": desvio_sem,
                "gap": gap,
                "projecao": proj,
                "atingimento_proj": ating_proj,
                "share_digital": share_dig,
                "status": get_status(ating),
                "total_linhas": len(linhas_deste_grupo),
                "linhas": linhas_deste_grupo
            })
        d_grupos.sort(key=lambda x: x["venda_sem_figital"], reverse=True)
        d["grupos"] = d_grupos

    # Payload Final
    dashboard_data = {
        "metadata": {
            "gerado_em": time.strftime("%d/%m/%Y %H:%M:%S"),
            "data_corte": max_date,
            "max_dia": max_dia,
            "dias_totais": total_dias_mes,
            "diretor": "Cintia Silva",
            "diretoria": "C"
        },
        "kpis": {
            "meta_mes": meta_mes,
            "meta_mtd": meta_mtd,
            "venda_digital": venda_digital_realizada,
            "venda_figital": venda_figital_realizada,
            "venda_sem_figital": venda_sem_figital_realizada,
            "venda_total_lojas": venda_total_realizada,
            "venda_fisica": venda_fisica_realizada,
            "venda_digital_ly": venda_digital_ly,
            "venda_sem_figital_ly": venda_sem_figital_ly,
            "venda_figital_ly": venda_figital_ly,
            "venda_total_ly": venda_total_ly,
            "share_digital_ly": share_digital_ly,
            "diff_pp_ly": diff_pp_ly,
            "atingimento_mtd": atingimento_mtd,
            "desvio_mtd": desvio_mtd,
            "desvio_sem_figital": desvio_sem_figital,
            "gap": gap_digital,
            "projecao_fechamento": projecao_fechamento,
            "atingimento_proj": atingimento_proj,
            "share_digital": share_digital,
            "total_lojas": len(filiais_list),
            "total_coordenadores": len(coordenadores_list),
            "total_distritais": len(distritais_list),
            "total_linhas": len(linhas_list),
            "status": get_status(atingimento_mtd)
        },
        "total": {
            "meta_mes": meta_mes,
            "metas_dias": total_metas_dias,
            "vendas_dias_digital": total_vendas_dias_digital,
            "vendas_dias_figital": total_vendas_dias_figital,
            "vendas_dias_sem_figital": total_vendas_dias_sem_figital,
            "vendas_dias_total": total_vendas_dias_total,
            "vendas_dias_fisica": total_vendas_dias_fisica,
            "vendas_dias_digital_ly": total_vendas_dias_digital_ly,
            "vendas_dias_figital_ly": total_vendas_dias_figital_ly,
            "vendas_dias_sem_figital_ly": total_vendas_dias_sem_figital_ly,
            "vendas_dias_total_ly": total_vendas_dias_total_ly,
            "venda_digital": venda_digital_realizada,
            "venda_sem_figital": venda_sem_figital_realizada,
            "venda_figital": venda_figital_realizada,
            "venda_total": venda_total_realizada,
            "venda_fisica": venda_fisica_realizada,
            "share_digital": share_digital,
            "meta_mtd": meta_mtd,
            "venda_digital_ly": venda_digital_ly,
            "venda_sem_figital_ly": venda_sem_figital_ly,
            "venda_figital_ly": venda_figital_ly,
            "venda_total_ly": venda_total_ly,
            "share_digital_ly": share_digital_ly,
            "diff_pp_ly": diff_pp_ly
        },
        "curva_diaria": curva_diaria,
        "distritais": distritais_list,
        "coordenadores": coordenadores_list,
        "filiais": filiais_list,
        "grupos": grupos_list,
        "linhas": linhas_list
    }

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(dashboard_data, f, ensure_ascii=False, indent=2)

    sz_kb = os.path.getsize(OUTPUT_JSON) / 1024
    print(f"✅ Consolidação concluída em {time.time()-t0:.2f}s!")
    print(f"   💰 Venda Digital: R$ {venda_digital_realizada:,.2f} | Meta MTD: R$ {meta_mtd:,.2f} ({atingimento_mtd:.1f}%)")
    print(f"   📱 Figital: R$ {venda_figital_realizada:,.2f} | Sem Figital: R$ {venda_sem_figital_realizada:,.2f}")
    print(f"   📊 Meta Mês: R$ {meta_mes:,.2f} | GAP: R$ {gap_digital:,.2f}")
    print(f"   🏢 {len(distritais_list)} Distritais | {len(coordenadores_list)} Coordenadores | {len(filiais_list)} Filiais | {len(linhas_list)} Linhas")
    print(f"   📁 Salvo em: {OUTPUT_JSON} ({sz_kb:.1f} KB)")

if __name__ == "__main__":
    consolidate()
