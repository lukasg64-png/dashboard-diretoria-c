import os
import sys
if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

html_path = os.path.abspath('index.html').replace('\\', '/')
print('Audit testing filters on:', html_path)

test_results = []

def record(test_name, passed, detail=''):
    test_results.append((test_name, passed, detail))
    status = '✅ PASS' if passed else '❌ FAIL'
    print(f"{status}: {test_name} — {detail}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    
    page_errors = []
    page.on('pageerror', lambda err: page_errors.append(str(err)))
    page.goto(f'file:///{html_path}')
    page.wait_for_timeout(1500)

    record("Carregamento Inicial sem Erros JS", len(page_errors) == 0, f"Erros: {page_errors}")

    # =========================================================================
    # TESTE 1: FILTRO POR DISTRITAL (Rodrigo Ferreira)
    # =========================================================================
    print("\n--- TESTE 1: FILTRO DISTRITAL (Rodrigo Ferreira) ---")
    page.select_option('#filterDistrital', 'Rodrigo Ferreira')
    page.wait_for_timeout(500)

    # 1.1 Banner
    banner_text = page.locator('#activeFilterBanner').inner_text()
    banner_visible = page.locator('#activeFilterBanner').is_visible()
    record("Banner de Filtro Ativo Exibido", banner_visible and 'Rodrigo Ferreira' in banner_text, banner_text.replace('\n', ' '))

    # 1.2 Top KPIs
    kpi_meta = page.locator('#kpiMetaMes').inner_text()
    kpi_venda = page.locator('#kpiVendaDigital').inner_text()
    record("Top KPIs Atualizados para Distrital", '10.227.188' in kpi_meta and '6.058.066' in kpi_venda, f"Meta: {kpi_meta} | Venda: {kpi_venda}")

    # 1.3 Dropdown Coordenadores filtrado
    coord_options = page.locator('#filterCoordenador option').all_text_contents()
    has_alyne = any('Alyne Kobayashi' in opt for opt in coord_options)
    record("Dropdown Coordenadores em Cascata", len(coord_options) == 9 and has_alyne, f"Total opções: {len(coord_options)}")

    # 1.4 Tab Distritais
    page.click('button:has-text("Distritais")')
    page.wait_for_timeout(300)
    dist_rows = page.locator('#tbodyDistritaisFull tr').count()
    record("Tabela Distritais filtrada para 1 distrital", dist_rows == 1, f"Linhas exibidas: {dist_rows}")

    # 1.5 Tab Coordenadores
    page.click('button:has-text("Coordenadores")')
    page.wait_for_timeout(300)
    coord_rows = page.locator('#tbodyCoordenadoresFull tr').count()
    coord_badge = page.locator('#badgeCoordenadoresCount').inner_text()
    record("Tabela Coordenadores filtrada por Distrital", coord_rows == 8 and coord_badge == '8', f"Linhas: {coord_rows} | Badge: {coord_badge}")

    # 1.6 Tab Filiais
    page.click('button:has-text("Filiais")')
    page.wait_for_timeout(300)
    fil_badge = page.locator('#badgeFiliaisCount').inner_text()
    record("Tabela Filiais filtrada por Distrital", fil_badge == '157', f"Lojas encontradas: {fil_badge}")

    # 1.7 Tab Categorias
    page.click('button:has-text("Categorias")')
    page.wait_for_timeout(300)
    cat_sub = page.locator('#categoriasHeaderSubtitle').inner_text()
    cat_first_venda = page.locator('#tbodyCategoriasFull tr.clickable-group-row').first.locator('td').nth(3).inner_text()
    record("Tabela Categorias contextualizada para Distrital", 'Distrital: Rodrigo Ferreira' in cat_sub, f"Subtítulo: {cat_sub} | Venda Cat 1: {cat_first_venda}")

    # 1.8 Tab Linhas
    page.click('button:has-text("Linhas de Produtos")')
    page.wait_for_timeout(300)
    lin_sub = page.locator('#linhasHeaderSubtitle').inner_text()
    record("Tabela Linhas contextualizada para Distrital", 'Distrital: Rodrigo Ferreira' in lin_sub, f"Subtítulo: {lin_sub}")

    # =========================================================================
    # TESTE 2: FILTRO POR COORDENADOR (Alyne Kobayashi)
    # =========================================================================
    print("\n--- TESTE 2: FILTRO COORDENADOR (Alyne Kobayashi) ---")
    page.select_option('#filterCoordenador', 'Alyne Kobayashi')
    page.wait_for_timeout(500)

    # 2.1 Top KPIs
    kpi_meta_coord = page.locator('#kpiMetaMes').inner_text()
    kpi_venda_coord = page.locator('#kpiVendaDigital').inner_text()
    record("Top KPIs Atualizados para Coordenador", '1.621.579' in kpi_meta_coord and '957.415' in kpi_venda_coord, f"Meta: {kpi_meta_coord} | Venda: {kpi_venda_coord}")

    # 2.2 Tab Coordenadores
    page.click('button:has-text("Coordenadores")')
    page.wait_for_timeout(300)
    coord_c_rows = page.locator('#tbodyCoordenadoresFull tr').count()
    record("Tabela Coordenadores filtrada para 1 coordenador", coord_c_rows == 1, f"Linhas: {coord_c_rows}")

    # 2.3 Tab Filiais
    page.click('button:has-text("Filiais")')
    page.wait_for_timeout(300)
    fil_c_badge = page.locator('#badgeFiliaisCount').inner_text()
    record("Tabela Filiais filtrada para lojas do Coordenador", fil_c_badge == '19', f"Lojas de Alyne: {fil_c_badge}")

    # 2.4 Tab Categorias
    page.click('button:has-text("Categorias")')
    page.wait_for_timeout(300)
    cat_c_sub = page.locator('#categoriasHeaderSubtitle').inner_text()
    record("Tabela Categorias contextualizada para Coordenador", 'Coordenador: Alyne Kobayashi' in cat_c_sub, f"Subtítulo: {cat_c_sub}")

    # =========================================================================
    # TESTE 3: RESETAR FILTROS
    # =========================================================================
    print("\n--- TESTE 3: RESETAR FILTROS ---")
    page.locator('.btn-clear-active-badge').click()
    page.wait_for_timeout(500)

    kpi_meta_reset = page.locator('#kpiMetaMes').inner_text()
    dist_sel = page.locator('#filterDistrital').input_value()
    coord_sel = page.locator('#filterCoordenador').input_value()
    banner_hidden = not page.locator('#activeFilterBanner').is_visible()
    record("Reset de Filtros restaura totais da Diretoria C", '25.180.000' in kpi_meta_reset and dist_sel == 'all' and coord_sel == 'all' and banner_hidden, f"Meta: {kpi_meta_reset} | Dist: {dist_sel} | Coord: {coord_sel}")

    # =========================================================================
    # TESTE 4: FILTRO POR GRUPO (Medicamentos)
    # =========================================================================
    print("\n--- TESTE 4: FILTRO POR GRUPO (Medicamentos) ---")
    page.select_option('#filterGrupo', 'Medicamentos')
    page.wait_for_timeout(500)

    # 4.1 Top KPIs
    kpi_meta_grp = page.locator('#kpiMetaMes').inner_text()
    kpi_venda_grp = page.locator('#kpiVendaDigital').inner_text()
    record("Top KPIs Atualizados para Grupo", '13.418.415' in kpi_meta_grp and '7.328.266' in kpi_venda_grp, f"Meta: {kpi_meta_grp} | Venda: {kpi_venda_grp}")

    # 4.2 Dropdown Linhas filtrado para Medicamentos
    linhas_opts = page.locator('#filterLinha option').all_text_contents()
    record("Dropdown Linhas em Cascata do Grupo", len(linhas_opts) > 100 and 'Medicamentos' in linhas_opts[0], f"Total linhas no dropdown: {len(linhas_opts)} | Top: {linhas_opts[0]}")

    # 4.3 Tab Categorias
    page.click('button:has-text("Categorias")')
    page.wait_for_timeout(300)
    cat_grp_rows = page.locator('#tbodyCategoriasFull tr.clickable-group-row').count()
    record("Tabela Categorias filtrada para 1 grupo", cat_grp_rows == 1, f"Categorias visíveis: {cat_grp_rows}")

    # 4.4 Tab Linhas
    page.click('button:has-text("Linhas de Produtos")')
    page.wait_for_timeout(300)
    lin_grp_count = page.locator('#badgeLinhasCount').inner_text()
    tab_lin_grp_val = page.locator('#filterLinhaGrupo').input_value()
    record("Tabela Linhas sincronizada com Grupo selecionado", lin_grp_count == '203' and tab_lin_grp_val == 'Medicamentos', f"Linhas: {lin_grp_count} | Tab Grupo: {tab_lin_grp_val}")

    # =========================================================================
    # TESTE 5: FILTRO POR LINHA (ANTIDIABETICOS)
    # =========================================================================
    print("\n--- TESTE 5: FILTRO POR LINHA (ANTIDIABETICOS) ---")
    page.select_option('#filterLinha', 'ANTIDIABETICOS')
    page.wait_for_timeout(500)

    # 5.1 Top KPIs
    kpi_meta_lin = page.locator('#kpiMetaMes').inner_text()
    kpi_venda_lin = page.locator('#kpiVendaDigital').inner_text()
    record("Top KPIs Atualizados para Linha", '4.963.355' in kpi_meta_lin and '2.560.228' in kpi_venda_lin, f"Meta: {kpi_meta_lin} | Venda: {kpi_venda_lin}")

    # 5.2 Tab Linhas
    page.click('button:has-text("Linhas de Produtos")')
    page.wait_for_timeout(300)
    lin_count = page.locator('#badgeLinhasCount').inner_text()
    lin_first_name = page.locator('#tbodyLinhasFull tr').first.locator('td').nth(1).inner_text()
    record("Tabela Linhas filtrada para 1 linha específica", lin_count == '1' and lin_first_name == 'ANTIDIABETICOS', f"Linhas: {lin_count} | Nome: {lin_first_name}")

    # 5.3 Tab Categorias com Acordeão Auto-Expandido
    page.click('button:has-text("Categorias")')
    page.wait_for_timeout(300)
    accordion_visible = page.locator('.nested-linhas-table').is_visible()
    record("Acordeão Auto-Expandido na Categoria Pai", accordion_visible, f"Tabela aninhada visível: {accordion_visible}")

    # =========================================================================
    # TESTE 6: RESET E TESTE DE BUSCA TEXTUAL (Passo Fundo)
    # =========================================================================
    print("\n--- TESTE 6: BUSCA RÁPIDA (Passo Fundo) ---")
    page.locator('.btn-clear-active-badge').click()
    page.wait_for_timeout(400)
    page.fill('#filterSearch', 'Passo Fundo')
    page.wait_for_timeout(500)

    page.click('button:has-text("Filiais")')
    page.wait_for_timeout(300)
    fil_search_count = page.locator('#badgeFiliaisCount').inner_text()
    fil_first_store = page.locator('#tbodyFiliaisFull tr').first.locator('td').nth(2).inner_text()
    has_pf = ('pf' in fil_first_store.lower()) or ('passo fundo' in fil_first_store.lower())
    record("Busca Rápida filtra lojas por cidade/termo", int(fil_search_count) > 0 and has_pf, f"Lojas Passo Fundo: {fil_search_count} | 1ª: {fil_first_store}")

    # =========================================================================
    # TESTE 7: FILTROS DE DATA PRESET E CÁLCULOS DINÂMICOS
    # =========================================================================
    print("\n--- TESTE 7: PRESETS DE DATA ---")
    page.fill('#filterSearch', '')
    page.wait_for_timeout(400)

    # 7.1 Ontem D-1
    page.click('#presetYesterday')
    page.wait_for_timeout(500)
    date_info = page.locator('#datePeriodInfo').inner_text()
    kpi_meta_d1 = page.locator('#kpiMetaPeriodo').inner_text()
    kpi_venda_d1 = page.locator('#kpiVendaDigital').inner_text()
    is_d1_ok = ('16/09/2026' in date_info) and ('1 dia' in date_info)
    record("Preset Ontem D-1 calcula período exato de 1 dia", is_d1_ok, f"Badge: {date_info} | Meta D-1: {kpi_meta_d1} | Venda D-1: {kpi_venda_d1}")

    # 7.2 7 Dias
    page.click('#preset7Days')
    page.wait_for_timeout(500)
    date_7d = page.locator('#datePeriodInfo').inner_text()
    record("Preset 7 Dias calcula últimos 7 dias", '7 dias' in date_7d, f"Badge: {date_7d}")

    # 7.3 MTD
    page.click('#presetMtd')
    page.wait_for_timeout(500)
    date_mtd = page.locator('#datePeriodInfo').inner_text()
    record("Preset MTD restaura acumulado 01 a 16", '01 a 16/09/2026' in date_mtd, f"Badge: {date_mtd}")

    # =========================================================================
    # TESTE 8: TOGGLE FIGITAL (Sem Figital vs Com Figital)
    # =========================================================================
    print("\n--- TESTE 8: TOGGLE FIGITAL ---")
    # Sem Figital
    page.click('#btnFigitalSem')
    page.wait_for_timeout(400)
    venda_sem = page.locator('#kpiVendaDigital').inner_text()

    # Com Figital
    page.click('#btnFigitalCom')
    page.wait_for_timeout(400)
    venda_com = page.locator('#kpiVendaDigital').inner_text()
    card_lbl = page.locator('#labelVendaDigitalCard').inner_text()
    record("Toggle Figital altera faturamento e rótulos", venda_com != venda_sem and 'com figital' in card_lbl.lower(), f"Sem: {venda_sem} | Com: {venda_com} | Rótulo: {card_lbl}")

    # =========================================================================
    # TESTE 9: MULTI-FILTRO DISTRITAL + GRUPO (Rodrigo Ferreira + Medicamentos)
    # =========================================================================
    page.evaluate("resetFilters()")
    page.wait_for_timeout(400)
    page.select_option('#filterDistrital', 'Rodrigo Ferreira')
    page.wait_for_timeout(300)
    page.select_option('#filterGrupo', 'Medicamentos')
    page.wait_for_timeout(500)

    # 9.1 Banner combinado
    banner_text_comb = page.locator('#activeFilterBanner').inner_text()
    record("Banner Combinado Distrital + Grupo Exibido", 'Rodrigo Ferreira' in banner_text_comb and 'Medicamentos' in banner_text_comb, banner_text_comb.replace('\n', ' '))

    # 9.2 Top KPIs para Rodrigo + Medicamentos
    kpi_meta_comb = page.locator('#kpiMetaMes').inner_text()
    kpi_venda_comb = page.locator('#kpiVendaDigital').inner_text()
    record("Top KPIs calculam exatamente Rodrigo + Medicamentos", '5.247.990' in kpi_meta_comb and '3.018.172' in kpi_venda_comb, f"Meta: {kpi_meta_comb} | Venda: {kpi_venda_comb}")

    # 9.3 Tabela Distritais com valores de Medicamentos
    page.click('button:has-text("Distritais")')
    page.wait_for_timeout(300)
    dist_comb_venda = page.locator('#tbodyDistritaisFull tr').first.locator('td').nth(4).inner_text()
    record("Tabela Distritais reflete faturamento de Medicamentos", '3.018.172' in dist_comb_venda, f"Venda Distrital 1: {dist_comb_venda}")

    # =========================================================================
    # TESTE 10: MULTI-FILTRO COORDENADOR + GRUPO (Alyne Kobayashi + Medicamentos)
    # =========================================================================
    print("\n--- TESTE 10: MULTI-FILTRO COORDENADOR + GRUPO ---")
    page.select_option('#filterCoordenador', 'Alyne Kobayashi')
    page.wait_for_timeout(500)

    kpi_meta_coord_grp = page.locator('#kpiMetaMes').inner_text()
    kpi_venda_coord_grp = page.locator('#kpiVendaDigital').inner_text()
    record("Top KPIs calculam exatamente Alyne + Medicamentos", '940.104' in kpi_meta_coord_grp and '518.585' in kpi_venda_coord_grp, f"Meta: {kpi_meta_coord_grp} | Venda: {kpi_venda_coord_grp}")

    # =========================================================================
    # TESTE 11: MULTI-FILTRO COORDENADOR + LINHA (Alyne + ANTIDIABETICOS)
    # =========================================================================
    print("\n--- TESTE 11: MULTI-FILTRO COORDENADOR + LINHA ---")
    page.select_option('#filterLinha', 'ANTIDIABETICOS')
    page.wait_for_timeout(500)

    kpi_meta_coord_lin = page.locator('#kpiMetaMes').inner_text()
    kpi_venda_coord_lin = page.locator('#kpiVendaDigital').inner_text()
    record("Top KPIs calculam exatamente Alyne + ANTIDIABETICOS", '217.966' in kpi_meta_coord_lin and ('129.367' in kpi_venda_coord_lin or '129.368' in kpi_venda_coord_lin), f"Meta: {kpi_meta_coord_lin} | Venda: {kpi_venda_coord_lin}")

    # =========================================================================
    # TESTE 12: TAB 6 (LINHAS DE PRODUTOS) ESCOPO POR COORDENADOR
    # =========================================================================
    print("\n--- TESTE 12: TAB 6 ESCOPO POR COORDENADOR ---")
    page.click('button:has-text("Linhas de Produtos")')
    page.wait_for_timeout(400)
    lin_sub_coord = page.locator('#linhasHeaderSubtitle').inner_text()
    badge_lin_count = page.locator('#badgeLinhasCount').inner_text()
    first_lin_meta = page.locator('#tbodyLinhasFull tr').first.locator('td').nth(3).inner_text()
    first_lin_sale = page.locator('#tbodyLinhasFull tr').first.locator('td').nth(5).inner_text()
    record("Tab 6 Linhas contextualizada para Alyne Kobayashi", 'Alyne Kobayashi' in lin_sub_coord and badge_lin_count == '1' and ('129.367' in first_lin_sale or '129.368' in first_lin_sale), f"Sub: {lin_sub_coord} | Linhas: {badge_lin_count} | Meta: {first_lin_meta} | Venda: {first_lin_sale}")

    # Reset final
    page.evaluate("resetFilters()")
    page.wait_for_timeout(400)

    browser.close()

print("\n" + "=" * 70)
print(f"RESUMO FINAL DA AUDITORIA DE FILTROS: {sum(1 for _, p, _ in test_results if p)}/{len(test_results)} TESTES APROVADOS")
print("=" * 70)
