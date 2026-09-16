"""
extract_qlik_cintia.py — Extração de dados da Diretoria C (Cíntia Silva) do QLIK CLOUD SaaS
Conecta via WebSocket QIX Engine API ao App Acompanhamento Vendas (bd585cf0-316d-4173-aef1-81f9daa9125c).
Extrai vendas de Setembro/2026:
1. Diário Geral da Diretoria C (venda líquida, física, digital e qtd)
2. Distritais (4 distritais)
3. Coordenadores (29 coordenadores)
4. Filiais (~587 lojas)
5. Filiais x Dia
6. Grupos (8 grupos)
7. Grupos x Linhas (~500 linhas de produtos)
"""
import os
import sys
import time
import json
import asyncio

if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'): sys.stderr.reconfigure(encoding='utf-8')

from playwright.async_api import async_playwright

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

OUTPUT_JSON = os.path.join(DATA_DIR, "vendas_qlik_cintia.json")

QLIK_CLOUD_HOST = "fsj.us.qlikcloud.com"
APP_ID = "bd585cf0-316d-4173-aef1-81f9daa9125c"  # Acompanhamento Vendas
HOME_URL = f"https://{QLIK_CLOUD_HOST}/analytics/home"

STORAGE_STATE_PATHS = [
    os.path.join(DATA_DIR, "qlik_cloud_storage_state.json"),
    os.path.join(BASE_DIR, "..", "Acompanhamento Categorias Digital", "data", "qlik_cloud_storage_state.json"),
    os.path.join(BASE_DIR, "..", "Acompanhamento Online Canais Digitais", "data", "qlik_cloud_storage_state.json")
]

USERNAME = "lucas.alves6"
PASSWORD = "Eloise2025*"

def find_storage_state():
    for p in STORAGE_STATE_PATHS:
        if os.path.exists(p):
            return p
    return None

async def extract_qlik():
    t0 = time.time()
    print("=" * 70)
    print("  EXTRAÇÃO QLIK CLOUD SAAS — DIRETORIA CÍNTIA SILVA")
    print("=" * 70)

    storage_state_file = find_storage_state()
    print(f"Sessão Qlik Cloud: {storage_state_file if storage_state_file else 'Nova sessão necessária'}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx_args = {"ignore_https_errors": True, "viewport": {"width": 1280, "height": 800}}
        if storage_state_file:
            ctx_args["storage_state"] = storage_state_file

        context = await browser.new_context(**ctx_args)
        page = await context.new_page()

        print("1/3 Acessando Qlik Cloud Hub...", flush=True)
        try:
            await page.goto(HOME_URL, timeout=60000)
            await page.wait_for_timeout(3000)
        except Exception as e:
            print(f"Erro ao carregar Hub: {e}", flush=True)

        # Verifica se precisa de login (Keycloak SSO)
        if "idp.farmaciassaojoao.com.br" in page.url or "login" in page.url.lower():
            print("Detectada tela de autenticação Keycloak SSO. Realizando login...", flush=True)
            try:
                await page.fill('input#username, input[name="username"]', USERNAME)
                await page.fill('input#password, input[name="password"]', PASSWORD)
                await page.click('input#kc-login, button[type="submit"]')
                await page.wait_for_load_state("networkidle", timeout=45000)
                target_state = os.path.join(DATA_DIR, "qlik_cloud_storage_state.json")
                await context.storage_state(path=target_state)
                print(f"✅ Sessão salva em: {target_state}", flush=True)
            except Exception as login_err:
                print(f"Falha no login: {login_err}")

        print("2/3 Obtendo token CSRF e abrindo conexão WebSocket QIX...", flush=True)
        csrf_token = await page.evaluate("""async () => {
            const r = await fetch('/api/v1/csrf-token');
            return r.headers.get('qlik-csrf-token');
        }""")

        if not csrf_token:
            raise RuntimeError("Não foi possível obter o token CSRF do Qlik Cloud.")

        print(f"CSRF Token obtido ({csrf_token[:10]}...). Executando extração dos hipercubos...", flush=True)

        script = """async ({appId, token}) => {
            return new Promise((resolve, reject) => {
                const wsUrl = `wss://${window.location.host}/app/${encodeURIComponent(appId)}?qlik-csrf-token=${token}`;
                const ws = new WebSocket(wsUrl);
                let msgId = 1;
                const pending = {};

                function send(method, handle, params) {
                    return new Promise((res, rej) => {
                        const mid = msgId++;
                        pending[mid] = { res, rej };
                        ws.send(JSON.stringify({ jsonrpc: '2.0', id: mid, method, handle, params }));
                    });
                }

                ws.onmessage = (e) => {
                    const m = JSON.parse(e.data);
                    if (m.id && pending[m.id]) {
                        const { res, rej } = pending[m.id];
                        delete pending[m.id];
                        if (m.error) rej(m.error); else res(m);
                    }
                };

                async function fetchAllDataPages(handle, totalRows, totalCols) {
                    const pageSize = Math.floor(9500 / totalCols);
                    let currentTop = 0;
                    const allRows = [];
                    while (currentTop < totalRows) {
                        const fetchHeight = Math.min(pageSize, totalRows - currentTop);
                        const page = [{
                            qTop: currentTop,
                            qLeft: 0,
                            qHeight: fetchHeight,
                            qWidth: totalCols
                        }];
                        const res = await send("GetHyperCubeData", handle, ["/qHyperCubeDef", page]);
                        const matrix = res.result.qDataPages[0]?.qMatrix || [];
                        for (const row of matrix) {
                            allRows.push(row.map(c => (c.qNum !== 'NaN' && typeof c.qNum === 'number') ? c.qNum : c.qText));
                        }
                        currentTop += fetchHeight;
                        if (matrix.length === 0) break;
                    }
                    return allRows;
                }

                ws.onopen = async () => {
                    try {
                        const op = await send("OpenDoc", -1, [appId]);
                        const doc = op.result.qReturn.qHandle;

                        const setFilter = "Diretor={'Cintia Silva'}, [Ano-Mês Venda]={'2026-09'}";

                        // 0. Max Date da Venda
                        const evalMaxDate = await send("Evaluate", doc, ["Date(Max([Data Venda]), 'DD/MM/YYYY')"]);

                        // 1. Vendas Diárias Geral Diretoria C (dias 1 ao 16)
                        const cDaily = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_daily' },
                            qHyperCubeDef: {
                                qDimensions: [
                                    { qDef: { qFieldDefs: ['Dia Venda'] } },
                                    { qDef: { qFieldDefs: ['Data Venda'] } }
                                ],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setFilter}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda' } },
                                    { qDef: { qDef: `Sum({<${setFilter}>} [Quantidade])`, qLabel: 'qtd' } },
                                    { qDef: { qDef: `Sum({<${setFilter}, [Venda Digital?]={'S', 'Sim', 'SIM'}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda_digital' } },
                                    { qDef: { qDef: `Sum({<${setFilter}, [Venda Digital?]={'N', 'Não', 'Nao', 'NAO'}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda_fisica' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 35, qWidth: 6 }],
                                qSuppressZero: true
                            }
                        }]);
                        const lDaily = await send("GetLayout", cDaily.result.qReturn.qHandle, []);
                        const daily = (lDaily.result.qLayout.qHyperCube.qDataPages[0]?.qMatrix || []).map(r => ({
                            dia: parseInt(r[0].qText),
                            data: r[1].qText,
                            venda: r[2].qNum || 0,
                            qtd: r[3].qNum || 0,
                            venda_digital: r[4].qNum || 0,
                            venda_fisica: r[5].qNum || 0
                        })).sort((a, b) => a.dia - b.dia);

                        const maxDia = daily.length > 0 ? Math.max(...daily.map(d => d.dia)) : 16;

                        // 2. Distritais
                        const cDist = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_dist' },
                            qHyperCubeDef: {
                                qDimensions: [{ qDef: { qFieldDefs: ['Distrital'] } }],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setFilter}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda' } },
                                    { qDef: { qDef: `Sum({<${setFilter}>} [Quantidade])`, qLabel: 'qtd' } },
                                    { qDef: { qDef: `Count(DISTINCT {<${setFilter}>} [ID Loja])`, qLabel: 'lojas' } },
                                    { qDef: { qDef: `Sum({<${setFilter}, [Venda Digital?]={'S', 'Sim', 'SIM'}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda_digital' } },
                                    { qDef: { qDef: `Sum({<${setFilter}, [Venda Digital?]={'N', 'Não', 'Nao', 'NAO'}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda_fisica' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 20, qWidth: 6 }],
                                qSuppressZero: true
                            }
                        }]);
                        const lDist = await send("GetLayout", cDist.result.qReturn.qHandle, []);
                        const distritais = (lDist.result.qLayout.qHyperCube.qDataPages[0]?.qMatrix || []).map(r => ({
                            distrital: r[0].qText,
                            venda: r[1].qNum || 0,
                            qtd: r[2].qNum || 0,
                            lojas: r[3].qNum || 0,
                            venda_digital: r[4].qNum || 0,
                            venda_fisica: r[5].qNum || 0
                        }));

                        // 3. Coordenadores
                        const cCoord = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_coord' },
                            qHyperCubeDef: {
                                qDimensions: [
                                    { qDef: { qFieldDefs: ['Distrital'] } },
                                    { qDef: { qFieldDefs: ['Coordenador'] } }
                                ],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setFilter}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda' } },
                                    { qDef: { qDef: `Sum({<${setFilter}>} [Quantidade])`, qLabel: 'qtd' } },
                                    { qDef: { qDef: `Count(DISTINCT {<${setFilter}>} [ID Loja])`, qLabel: 'lojas' } },
                                    { qDef: { qDef: `Sum({<${setFilter}, [Venda Digital?]={'S', 'Sim', 'SIM'}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda_digital' } },
                                    { qDef: { qDef: `Sum({<${setFilter}, [Venda Digital?]={'N', 'Não', 'Nao', 'NAO'}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda_fisica' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 50, qWidth: 7 }],
                                qSuppressZero: true
                            }
                        }]);
                        const lCoord = await send("GetLayout", cCoord.result.qReturn.qHandle, []);
                        const coordenadores = (lCoord.result.qLayout.qHyperCube.qDataPages[0]?.qMatrix || []).map(r => ({
                            distrital: r[0].qText,
                            coordenador: r[1].qText,
                            venda: r[2].qNum || 0,
                            qtd: r[3].qNum || 0,
                            lojas: r[4].qNum || 0,
                            venda_digital: r[5].qNum || 0,
                            venda_fisica: r[6].qNum || 0
                        }));

                        // 4. Filiais (Lojas)
                        const cFilial = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_filiais' },
                            qHyperCubeDef: {
                                qDimensions: [
                                    { qDef: { qFieldDefs: ['Distrital'] } },
                                    { qDef: { qFieldDefs: ['Coordenador'] } },
                                    { qDef: { qFieldDefs: ['Nome Filial'] } },
                                    { qDef: { qFieldDefs: ['ID Loja'] } }
                                ],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setFilter}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda' } },
                                    { qDef: { qDef: `Sum({<${setFilter}>} [Quantidade])`, qLabel: 'qtd' } },
                                    { qDef: { qDef: `Sum({<${setFilter}, [Venda Digital?]={'S', 'Sim', 'SIM'}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda_digital' } },
                                    { qDef: { qDef: `Sum({<${setFilter}, [Venda Digital?]={'N', 'Não', 'Nao', 'NAO'}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda_fisica' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 500, qWidth: 8 }],
                                qSuppressZero: true
                            }
                        }]);
                        const hFilial = cFilial.result.qReturn.qHandle;
                        const lFilial = await send("GetLayout", hFilial, []);
                        const totalFiliaisRows = lFilial.result.qLayout.qHyperCube.qSize.qcy;
                        const filiaisMatrix = await fetchAllDataPages(hFilial, totalFiliaisRows, 8);
                        const filiais = filiaisMatrix.map(r => ({
                            distrital: r[0],
                            coordenador: r[1],
                            filial: r[2],
                            idLoja: r[3],
                            venda: typeof r[4] === 'number' ? r[4] : 0,
                            qtd: typeof r[5] === 'number' ? r[5] : 0,
                            venda_digital: typeof r[6] === 'number' ? r[6] : 0,
                            venda_fisica: typeof r[7] === 'number' ? r[7] : 0
                        }));

                        // 5. Grupos (Categorias Macro)
                        const cGrupos = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_grupos' },
                            qHyperCubeDef: {
                                qDimensions: [{ qDef: { qFieldDefs: ['Grupo'] } }],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setFilter}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda' } },
                                    { qDef: { qDef: `Sum({<${setFilter}>} [Quantidade])`, qLabel: 'qtd' } },
                                    { qDef: { qDef: `Sum({<${setFilter}, [Venda Digital?]={'S', 'Sim', 'SIM'}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda_digital' } },
                                    { qDef: { qDef: `Sum({<${setFilter}, [Venda Digital?]={'N', 'Não', 'Nao', 'NAO'}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda_fisica' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 30, qWidth: 5 }],
                                qSuppressZero: true
                            }
                        }]);
                        const lGrupos = await send("GetLayout", cGrupos.result.qReturn.qHandle, []);
                        const grupos = (lGrupos.result.qLayout.qHyperCube.qDataPages[0]?.qMatrix || []).map(r => ({
                            grupo: r[0].qText,
                            venda: r[1].qNum || 0,
                            qtd: r[2].qNum || 0,
                            venda_digital: r[3].qNum || 0,
                            venda_fisica: r[4].qNum || 0
                        }));

                        // 6. Grupos x Linhas
                        const cLinhas = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_linhas' },
                            qHyperCubeDef: {
                                qDimensions: [
                                    { qDef: { qFieldDefs: ['Grupo'] } },
                                    { qDef: { qFieldDefs: ['Linha'] } }
                                ],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setFilter}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda' } },
                                    { qDef: { qDef: `Sum({<${setFilter}>} [Quantidade])`, qLabel: 'qtd' } },
                                    { qDef: { qDef: `Sum({<${setFilter}, [Venda Digital?]={'S', 'Sim', 'SIM'}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda_digital' } },
                                    { qDef: { qDef: `Sum({<${setFilter}, [Venda Digital?]={'N', 'Não', 'Nao', 'NAO'}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda_fisica' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 500, qWidth: 6 }],
                                qSuppressZero: true
                            }
                        }]);
                        const hLinhas = cLinhas.result.qReturn.qHandle;
                        const lLinhas = await send("GetLayout", hLinhas, []);
                        const totalLinhasRows = lLinhas.result.qLayout.qHyperCube.qSize.qcy;
                        const linhasMatrix = await fetchAllDataPages(hLinhas, totalLinhasRows, 6);
                        const linhas = linhasMatrix.map(r => ({
                            grupo: r[0],
                            linha: r[1],
                            venda: typeof r[2] === 'number' ? r[2] : 0,
                            qtd: typeof r[3] === 'number' ? r[3] : 0,
                            venda_digital: typeof r[4] === 'number' ? r[4] : 0,
                            venda_fisica: typeof r[5] === 'number' ? r[5] : 0
                        }));

                        // 7. Filiais x Dia Venda (Diarização de Vendas por Loja)
                        const cFilialDia = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_filial_dia' },
                            qHyperCubeDef: {
                                qDimensions: [
                                    { qDef: { qFieldDefs: ['ID Loja'] } },
                                    { qDef: { qFieldDefs: ['Dia Venda'] } }
                                ],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setFilter}, [Venda Digital?]={'S', 'Sim', 'SIM'}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda_digital' } },
                                    { qDef: { qDef: `Sum({<${setFilter}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda_total' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 1000, qWidth: 4 }],
                                qSuppressZero: true
                            }
                        }]);
                        const hFilialDia = cFilialDia.result.qReturn.qHandle;
                        const lFilialDia = await send("GetLayout", hFilialDia, []);
                        const totalFilialDiaRows = lFilialDia.result.qLayout.qHyperCube.qSize.qcy;
                        const filialDiaMatrix = await fetchAllDataPages(hFilialDia, totalFilialDiaRows, 4);

                        const filialDailyMap = {};
                        for (const r of filialDiaMatrix) {
                            const idLoja = String(r[0]);
                            const dia = parseInt(r[1]);
                            const vDig = typeof r[2] === 'number' ? r[2] : 0;
                            const vTot = typeof r[3] === 'number' ? r[3] : 0;
                            if (!filialDailyMap[idLoja]) {
                                filialDailyMap[idLoja] = { digital: {}, total: {} };
                            }
                            filialDailyMap[idLoja].digital[dia] = vDig;
                            filialDailyMap[idLoja].total[dia] = vTot;
                        }

                        for (const f of filiais) {
                            const id = String(f.idLoja);
                            const dMap = filialDailyMap[id] || { digital: {}, total: {} };
                            f.dias_digital = [];
                            f.dias_total = [];
                            for (let d = 1; d <= maxDia; d++) {
                                f.dias_digital.push(Math.round((dMap.digital[d] || 0) * 100) / 100);
                                f.dias_total.push(Math.round((dMap.total[d] || 0) * 100) / 100);
                            }
                        }

                        // 8. Grupos x Dia Venda (Diarização de Vendas por Categoria)
                        const cGrupoDia = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_grupo_dia' },
                            qHyperCubeDef: {
                                qDimensions: [
                                    { qDef: { qFieldDefs: ['Grupo'] } },
                                    { qDef: { qFieldDefs: ['Dia Venda'] } }
                                ],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setFilter}, [Venda Digital?]={'S', 'Sim', 'SIM'}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda_digital' } },
                                    { qDef: { qDef: `Sum({<${setFilter}>} [Valor Mercadoria] - [Valor Desconto])`, qLabel: 'venda_total' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 200, qWidth: 4 }],
                                qSuppressZero: true
                            }
                        }]);
                        const hGrupoDia = cGrupoDia.result.qReturn.qHandle;
                        const lGrupoDia = await send("GetLayout", hGrupoDia, []);
                        const totalGrupoDiaRows = lGrupoDia.result.qLayout.qHyperCube.qSize.qcy;
                        const grupoDiaMatrix = await fetchAllDataPages(hGrupoDia, totalGrupoDiaRows, 4);

                        const grupoDailyMap = {};
                        for (const r of grupoDiaMatrix) {
                            const grp = String(r[0]);
                            const dia = parseInt(r[1]);
                            const vDig = typeof r[2] === 'number' ? r[2] : 0;
                            const vTot = typeof r[3] === 'number' ? r[3] : 0;
                            if (!grupoDailyMap[grp]) {
                                grupoDailyMap[grp] = { digital: {}, total: {} };
                            }
                            grupoDailyMap[grp].digital[dia] = vDig;
                            grupoDailyMap[grp].total[dia] = vTot;
                        }

                        for (const g of grupos) {
                            const grp = String(g.grupo);
                            const dMap = grupoDailyMap[grp] || { digital: {}, total: {} };
                            g.dias_digital = [];
                            g.dias_total = [];
                            for (let d = 1; d <= maxDia; d++) {
                                g.dias_digital.push(Math.round((dMap.digital[d] || 0) * 100) / 100);
                                g.dias_total.push(Math.round((dMap.total[d] || 0) * 100) / 100);
                            }
                        }

                        ws.close();
                        resolve({
                            maxDate: evalMaxDate.result.qReturn,
                            maxDia: maxDia,
                            daily,
                            distritais,
                            coordenadores,
                            filiais,
                            grupos,
                            linhas
                        });
                    } catch(err) {
                        ws.close();
                        reject(err);
                    }
                };

                setTimeout(() => {
                    ws.close();
                    reject(new Error("Timeout de 45s na conexão Qlik WebSocket"));
                }, 45000);
            });
        }"""

        qlik_data = await page.evaluate(script, {"appId": APP_ID, "token": csrf_token})
        await browser.close()

    payload = {
        "metadata": {
            "extraido_em": time.strftime("%Y-%m-%d %H:%M:%S"),
            "max_date": qlik_data.get("maxDate"),
            "max_dia": qlik_data.get("maxDia"),
            "total_distritais": len(qlik_data.get("distritais", [])),
            "total_coordenadores": len(qlik_data.get("coordenadores", [])),
            "total_filiais": len(qlik_data.get("filiais", [])),
            "total_grupos": len(qlik_data.get("grupos", [])),
            "total_linhas": len(qlik_data.get("linhas", []))
        },
        "daily": qlik_data.get("daily", []),
        "distritais": qlik_data.get("distritais", []),
        "coordenadores": qlik_data.get("coordenadores", []),
        "filiais": qlik_data.get("filiais", []),
        "grupos": qlik_data.get("grupos", []),
        "linhas": qlik_data.get("linhas", [])
    }

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    elapsed = time.time() - t0
    tot_dig = sum(d.get("venda_digital", 0) for d in qlik_data.get("distritais", []))
    tot_geral = sum(d.get("venda", 0) for d in qlik_data.get("distritais", []))
    print(f"✅ Extração Qlik Cloud concluída com sucesso em {elapsed:.1f}s!")
    print(f"   📅 Data de Corte: {qlik_data.get('maxDate')} (Dia {qlik_data.get('maxDia')})")
    print(f"   💰 Venda Digital: R$ {tot_dig:,.2f} | Total Geral Lojas: R$ {tot_geral:,.2f}")
    print(f"   🏢 Distritais: {len(qlik_data.get('distritais', []))} | Coordenadores: {len(qlik_data.get('coordenadores', []))} | Filiais: {len(qlik_data.get('filiais', []))}")
    print(f"   📁 Salvo em: {OUTPUT_JSON} ({os.path.getsize(OUTPUT_JSON)/1024:.1f} KB)")
    return payload

if __name__ == "__main__":
    asyncio.run(extract_qlik())
