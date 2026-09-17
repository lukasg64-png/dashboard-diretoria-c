"""
extract_qlik_cintia.py — Extração de dados da Diretoria C (Cíntia Silva) do QLIK CLOUD SaaS
Conecta via WebSocket QIX Engine API ao App Vendas Análise - Analítico (dcfc3ede-5eab-407c-a9ce-12b546eb5bdf).

Canais Digitais Oficiais (Sem Figital) — Meta/Realizado oficial Qlik:
- APP, APP Tele Entrega, SITE, SITE Tele Entrega, iFood
Canal Figital (Exclusivo separado para toggle Com/Sem Figital):
- Figital

Extrai:
1. Diário Geral (Dia Venda, Dt_Venda)
2. Distritais (4 distritais)
3. Coordenadores (29 coordenadores)
4. Filiais (587 lojas)
5. Filiais x Dia
6. Grupos (7 categorias principais)
7. Grupos x Dia
8. Linhas de Produtos (~571 linhas)
9. Linhas x Dia
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
APP_ID = "dcfc3ede-5eab-407c-a9ce-12b546eb5bdf"  # Vendas Análise - Analítico
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
    print("  EXTRAÇÃO QLIK CLOUD SAAS — VENDAS ANÁLISE ANALÍTICO (CÍNTIA SILVA)")
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
        csrf_token = None
        for attempt in range(5):
            try:
                csrf_token = await page.evaluate("""async () => {
                    const r = await fetch('/api/v1/csrf-token');
                    return r.headers.get('qlik-csrf-token');
                }""")
            except Exception:
                pass
            if csrf_token:
                break
            print(f"   Tentativa {attempt+1}/5 para CSRF token... aguardando 2s", flush=True)
            await page.wait_for_timeout(2000)

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
                        await send("ClearAll", doc, [true]);

                        const setBase = "Diretoria={'Cintia Silva'}, [Ano-Mês Venda]={'2026-09'}";
                        const canaisSemFig = "[Canal Detalhado]={'APP', 'APP Tele Entrega', 'SITE', 'SITE Tele Entrega', 'iFood'}";
                        const canaisFig = "[Canal Detalhado]={'Figital'}";
                        const canaisFisica = "[Canal Detalhado]={'Venda Balcão', 'Venda Caixa', 'Auto Atendimento'}";

                        // 0. Max Date da Venda
                        const evalMaxDate = await send("Evaluate", doc, ["Date(Max({<" + setBase + ">} [Dt_Venda]), 'DD/MM/YYYY')"]);

                        // 1. Diário Geral Diretoria C (dias 1..30)
                        const cDaily = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_daily' },
                            qHyperCubeDef: {
                                qDimensions: [
                                    { qDef: { qFieldDefs: ['Dia Venda'] } },
                                    { qDef: { qFieldDefs: ['Dt_Venda'] } }
                                ],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisSemFig}>} [Vl_Mercadoria])`, qLabel: 'venda_sem_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisFig}>} [Vl_Mercadoria])`, qLabel: 'venda_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisFisica}>} [Vl_Mercadoria])`, qLabel: 'venda_fisica' } },
                                    { qDef: { qDef: `Sum({<${setBase}>} [Vl_Mercadoria])`, qLabel: 'venda_total' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 35, qWidth: 6 }],
                                qSuppressZero: true
                            }
                        }]);
                        const lDaily = await send("GetLayout", cDaily.result.qReturn.qHandle, []);
                        const daily = (lDaily.result.qLayout.qHyperCube.qDataPages[0]?.qMatrix || []).map(r => {
                            const vSemFig = r[2].qNum || 0;
                            const vFig = r[3].qNum || 0;
                            const vFis = r[4].qNum || 0;
                            const vTot = r[5].qNum || 0;
                            return {
                                dia: parseInt(r[0].qText),
                                data: r[1].qText,
                                venda: vTot,
                                qtd: 0,
                                venda_digital: vSemFig + vFig,
                                venda_sem_figital: vSemFig,
                                venda_figital: vFig,
                                venda_fisica: vFis
                            };
                        }).sort((a, b) => a.dia - b.dia);

                        const maxDia = daily.length > 0 ? Math.max(...daily.map(d => d.dia)) : 16;

                        // 2. Distritais
                        const cDist = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_dist' },
                            qHyperCubeDef: {
                                qDimensions: [{ qDef: { qFieldDefs: ['Distrital'] } }],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisSemFig}>} [Vl_Mercadoria])`, qLabel: 'venda_sem_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisFig}>} [Vl_Mercadoria])`, qLabel: 'venda_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}>} [Vl_Mercadoria])`, qLabel: 'venda_total' } },
                                    { qDef: { qDef: `Count(DISTINCT {<${setBase}>} [Filial_ID])`, qLabel: 'lojas' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 20, qWidth: 5 }],
                                qSuppressZero: true
                            }
                        }]);
                        const lDist = await send("GetLayout", cDist.result.qReturn.qHandle, []);
                        const distritais = (lDist.result.qLayout.qHyperCube.qDataPages[0]?.qMatrix || []).map(r => {
                            const vSemFig = r[1].qNum || 0;
                            const vFig = r[2].qNum || 0;
                            const vTot = r[3].qNum || 0;
                            return {
                                distrital: r[0].qText,
                                venda: vTot,
                                qtd: 0,
                                lojas: r[4].qNum || 0,
                                venda_digital: vSemFig + vFig,
                                venda_sem_figital: vSemFig,
                                venda_figital: vFig,
                                venda_fisica: Math.max(0, vTot - (vSemFig + vFig))
                            };
                        });

                        // 3. Coordenadores
                        const cCoord = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_coord' },
                            qHyperCubeDef: {
                                qDimensions: [
                                    { qDef: { qFieldDefs: ['Distrital'] } },
                                    { qDef: { qFieldDefs: ['Coordenador'] } }
                                ],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisSemFig}>} [Vl_Mercadoria])`, qLabel: 'venda_sem_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisFig}>} [Vl_Mercadoria])`, qLabel: 'venda_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}>} [Vl_Mercadoria])`, qLabel: 'venda_total' } },
                                    { qDef: { qDef: `Count(DISTINCT {<${setBase}>} [Filial_ID])`, qLabel: 'lojas' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 50, qWidth: 6 }],
                                qSuppressZero: true
                            }
                        }]);
                        const lCoord = await send("GetLayout", cCoord.result.qReturn.qHandle, []);
                        const coordenadores = (lCoord.result.qLayout.qHyperCube.qDataPages[0]?.qMatrix || []).map(r => {
                            const vSemFig = r[2].qNum || 0;
                            const vFig = r[3].qNum || 0;
                            const vTot = r[4].qNum || 0;
                            return {
                                distrital: r[0].qText,
                                coordenador: r[1].qText,
                                venda: vTot,
                                qtd: 0,
                                lojas: r[5].qNum || 0,
                                venda_digital: vSemFig + vFig,
                                venda_sem_figital: vSemFig,
                                venda_figital: vFig,
                                venda_fisica: Math.max(0, vTot - (vSemFig + vFig))
                            };
                        });

                        // 4. Filiais Geral
                        const cFil = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_fil' },
                            qHyperCubeDef: {
                                qDimensions: [
                                    { qDef: { qFieldDefs: ['Filial_ID'] } },
                                    { qDef: { qFieldDefs: ['Desc_Filial'] } },
                                    { qDef: { qFieldDefs: ['Distrital'] } },
                                    { qDef: { qFieldDefs: ['Coordenador'] } }
                                ],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisSemFig}>} [Vl_Mercadoria])`, qLabel: 'venda_sem_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisFig}>} [Vl_Mercadoria])`, qLabel: 'venda_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}>} [Vl_Mercadoria])`, qLabel: 'venda_total' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 1000, qWidth: 7 }],
                                qSuppressZero: true
                            }
                        }]);
                        const lFil = await send("GetLayout", cFil.result.qReturn.qHandle, []);
                        const totalRowsFil = lFil.result.qLayout.qHyperCube.qSize.qcy;
                        const rawFilRows = await fetchAllDataPages(cFil.result.qReturn.qHandle, totalRowsFil, 7);
                        const filiais = rawFilRows.map(r => {
                            const vSemFig = typeof r[4] === 'number' ? r[4] : 0;
                            const vFig = typeof r[5] === 'number' ? r[5] : 0;
                            const vTot = typeof r[6] === 'number' ? r[6] : 0;
                            return {
                                filial_id: String(r[0]),
                                filial: String(r[1]),
                                distrital: String(r[2]),
                                coordenador: String(r[3]),
                                venda: vTot,
                                qtd: 0,
                                venda_digital: vSemFig + vFig,
                                venda_sem_figital: vSemFig,
                                venda_figital: vFig,
                                venda_fisica: Math.max(0, vTot - (vSemFig + vFig))
                            };
                        });

                        // 5. Filiais x Dia
                        const cFilDia = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_fil_dia' },
                            qHyperCubeDef: {
                                qDimensions: [
                                    { qDef: { qFieldDefs: ['Filial_ID'] } },
                                    { qDef: { qFieldDefs: ['Dia Venda'] } }
                                ],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisSemFig}>} [Vl_Mercadoria])`, qLabel: 'venda_sem_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisFig}>} [Vl_Mercadoria])`, qLabel: 'venda_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}>} [Vl_Mercadoria])`, qLabel: 'venda_total' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 1000, qWidth: 5 }],
                                qSuppressZero: true
                            }
                        }]);
                        const lFilDia = await send("GetLayout", cFilDia.result.qReturn.qHandle, []);
                        const totalRowsFilDia = lFilDia.result.qLayout.qHyperCube.qSize.qcy;
                        const rawFilDiaRows = await fetchAllDataPages(cFilDia.result.qReturn.qHandle, totalRowsFilDia, 5);

                        const filiaisDiaMap = {};
                        rawFilDiaRows.forEach(r => {
                            const fid = String(r[0]);
                            const dia = parseInt(r[1]);
                            const vSemFig = typeof r[2] === 'number' ? r[2] : 0;
                            const vFig = typeof r[3] === 'number' ? r[3] : 0;
                            const vTot = typeof r[4] === 'number' ? r[4] : 0;
                            if (!filiaisDiaMap[fid]) filiaisDiaMap[fid] = {};
                            filiaisDiaMap[fid][dia] = { sem_fig: vSemFig, fig: vFig, tot: vTot };
                        });

                        filiais.forEach(f => {
                            const dMap = filiaisDiaMap[f.filial_id] || {};
                            f.dias_sem_figital = [];
                            f.dias_figital = [];
                            f.dias_digital = [];
                            f.dias_total = [];
                            for (let d = 1; d <= maxDia; d++) {
                                const entry = dMap[d] || { sem_fig: 0, fig: 0, tot: 0 };
                                f.dias_sem_figital.push(entry.sem_fig);
                                f.dias_figital.push(entry.fig);
                                f.dias_digital.push(entry.sem_fig + entry.fig);
                                f.dias_total.push(entry.tot);
                            }
                        });

                        // 6. Grupos Geral
                        const cGrp = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_grp' },
                            qHyperCubeDef: {
                                qDimensions: [{ qDef: { qFieldDefs: ['Desc_Grupo'] } }],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisSemFig}>} [Vl_Mercadoria])`, qLabel: 'venda_sem_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisFig}>} [Vl_Mercadoria])`, qLabel: 'venda_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}>} [Vl_Mercadoria])`, qLabel: 'venda_total' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 30, qWidth: 4 }],
                                qSuppressZero: true
                            }
                        }]);
                        const lGrp = await send("GetLayout", cGrp.result.qReturn.qHandle, []);
                        const grupos = (lGrp.result.qLayout.qHyperCube.qDataPages[0]?.qMatrix || []).map(r => {
                            const vSemFig = r[1].qNum || 0;
                            const vFig = r[2].qNum || 0;
                            const vTot = r[3].qNum || 0;
                            return {
                                grupo: r[0].qText,
                                venda: vTot,
                                qtd: 0,
                                venda_digital: vSemFig + vFig,
                                venda_sem_figital: vSemFig,
                                venda_figital: vFig,
                                venda_fisica: Math.max(0, vTot - (vSemFig + vFig))
                            };
                        });

                        // 7. Grupos x Dia
                        const cGrpDia = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_grp_dia' },
                            qHyperCubeDef: {
                                qDimensions: [
                                    { qDef: { qFieldDefs: ['Desc_Grupo'] } },
                                    { qDef: { qFieldDefs: ['Dia Venda'] } }
                                ],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisSemFig}>} [Vl_Mercadoria])`, qLabel: 'venda_sem_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisFig}>} [Vl_Mercadoria])`, qLabel: 'venda_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}>} [Vl_Mercadoria])`, qLabel: 'venda_total' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 1000, qWidth: 5 }],
                                qSuppressZero: true
                            }
                        }]);
                        const lGrpDia = await send("GetLayout", cGrpDia.result.qReturn.qHandle, []);
                        const totalRowsGrpDia = lGrpDia.result.qLayout.qHyperCube.qSize.qcy;
                        const rawGrpDiaRows = await fetchAllDataPages(cGrpDia.result.qReturn.qHandle, totalRowsGrpDia, 5);

                        const grpDiaMap = {};
                        rawGrpDiaRows.forEach(r => {
                            const grp = String(r[0]);
                            const dia = parseInt(r[1]);
                            const vSemFig = typeof r[2] === 'number' ? r[2] : 0;
                            const vFig = typeof r[3] === 'number' ? r[3] : 0;
                            const vTot = typeof r[4] === 'number' ? r[4] : 0;
                            if (!grpDiaMap[grp]) grpDiaMap[grp] = {};
                            grpDiaMap[grp][dia] = { sem_fig: vSemFig, fig: vFig, tot: vTot };
                        });

                        grupos.forEach(g => {
                            const dMap = grpDiaMap[g.grupo] || {};
                            g.dias_sem_figital = [];
                            g.dias_figital = [];
                            g.dias_digital = [];
                            g.dias_total = [];
                            for (let d = 1; d <= maxDia; d++) {
                                const entry = dMap[d] || { sem_fig: 0, fig: 0, tot: 0 };
                                g.dias_sem_figital.push(entry.sem_fig);
                                g.dias_figital.push(entry.fig);
                                g.dias_digital.push(entry.sem_fig + entry.fig);
                                g.dias_total.push(entry.tot);
                            }
                        });

                        // 8. Linhas Geral
                        const cLin = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_lin' },
                            qHyperCubeDef: {
                                qDimensions: [
                                    { qDef: { qFieldDefs: ['Desc_Grupo'] } },
                                    { qDef: { qFieldDefs: ['Desc_Linha'] } }
                                ],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisSemFig}>} [Vl_Mercadoria])`, qLabel: 'venda_sem_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisFig}>} [Vl_Mercadoria])`, qLabel: 'venda_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}>} [Vl_Mercadoria])`, qLabel: 'venda_total' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 1000, qWidth: 5 }],
                                qSuppressZero: true
                            }
                        }]);
                        const lLin = await send("GetLayout", cLin.result.qReturn.qHandle, []);
                        const totalRowsLin = lLin.result.qLayout.qHyperCube.qSize.qcy;
                        const rawLinRows = await fetchAllDataPages(cLin.result.qReturn.qHandle, totalRowsLin, 5);
                        const linhas = rawLinRows.map(r => {
                            const vSemFig = typeof r[2] === 'number' ? r[2] : 0;
                            const vFig = typeof r[3] === 'number' ? r[3] : 0;
                            const vTot = typeof r[4] === 'number' ? r[4] : 0;
                            return {
                                grupo: String(r[0]),
                                linha: String(r[1]),
                                venda: vTot,
                                qtd: 0,
                                venda_digital: vSemFig + vFig,
                                venda_sem_figital: vSemFig,
                                venda_figital: vFig,
                                venda_fisica: Math.max(0, vTot - (vSemFig + vFig))
                            };
                        });

                        // 9. Linhas x Dia
                        const cLinDia = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_lin_dia' },
                            qHyperCubeDef: {
                                qDimensions: [
                                    { qDef: { qFieldDefs: ['Desc_Linha'] } },
                                    { qDef: { qFieldDefs: ['Dia Venda'] } }
                                ],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisSemFig}>} [Vl_Mercadoria])`, qLabel: 'venda_sem_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisFig}>} [Vl_Mercadoria])`, qLabel: 'venda_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}>} [Vl_Mercadoria])`, qLabel: 'venda_total' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 1000, qWidth: 5 }],
                                qSuppressZero: true
                            }
                        }]);
                        const lLinDia = await send("GetLayout", cLinDia.result.qReturn.qHandle, []);
                        const totalRowsLinDia = lLinDia.result.qLayout.qHyperCube.qSize.qcy;
                        const rawLinDiaRows = await fetchAllDataPages(cLinDia.result.qReturn.qHandle, totalRowsLinDia, 5);

                        const linDiaMap = {};
                        rawLinDiaRows.forEach(r => {
                            const lin = String(r[0]);
                            const dia = parseInt(r[1]);
                            const vSemFig = typeof r[2] === 'number' ? r[2] : 0;
                            const vFig = typeof r[3] === 'number' ? r[3] : 0;
                            const vTot = typeof r[4] === 'number' ? r[4] : 0;
                            if (!linDiaMap[lin]) linDiaMap[lin] = {};
                            linDiaMap[lin][dia] = { sem_fig: vSemFig, fig: vFig, tot: vTot };
                        });

                        linhas.forEach(l => {
                            const dMap = linDiaMap[l.linha] || {};
                            l.dias_sem_figital = [];
                            l.dias_figital = [];
                            l.dias_digital = [];
                            l.dias_total = [];
                            for (let d = 1; d <= maxDia; d++) {
                                const entry = dMap[d] || { sem_fig: 0, fig: 0, tot: 0 };
                                l.dias_sem_figital.push(entry.sem_fig);
                                l.dias_figital.push(entry.fig);
                                l.dias_digital.push(entry.sem_fig + entry.fig);
                                l.dias_total.push(entry.tot);
                            }
                        });

                        // 10. Coordenadores x Grupos x Dia (para filtros em Categorias)
                        const cCGD = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_cgd' },
                            qHyperCubeDef: {
                                qMode: 'S',
                                qAlwaysFullyExpanded: true,
                                qDimensions: [
                                    { qDef: { qFieldDefs: ['Distrital'] } },
                                    { qDef: { qFieldDefs: ['Coordenador'] } },
                                    { qDef: { qFieldDefs: ['Desc_Grupo'] } },
                                    { qDef: { qFieldDefs: ['Dia Venda'] } }
                                ],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisSemFig}>} [Vl_Mercadoria])`, qLabel: 'venda_sem_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisFig}>} [Vl_Mercadoria])`, qLabel: 'venda_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}>} [Vl_Mercadoria])`, qLabel: 'venda_total' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 10, qWidth: 7 }],
                                qSuppressZero: true
                            }
                        }]);
                        const lCGD = await send("GetLayout", cCGD.result.qReturn.qHandle, []);
                        const totalRowsCGD = lCGD.result.qLayout.qHyperCube.qSize.qcy;
                        const rawCGDRows = await fetchAllDataPages(cCGD.result.qReturn.qHandle, totalRowsCGD, 7);
                        const coordenadores_grupos_dia = rawCGDRows.map(r => ({
                            distrital: String(r[0]),
                            coordenador: String(r[1]),
                            grupo: String(r[2]),
                            dia: parseInt(r[3]),
                            venda_sem_figital: typeof r[4] === 'number' ? r[4] : 0,
                            venda_figital: typeof r[5] === 'number' ? r[5] : 0,
                            venda_total: typeof r[6] === 'number' ? r[6] : 0
                        }));

                        // 11. Coordenadores x Linhas (para filtros em Linhas de Produtos)
                        const cCL = await send("CreateSessionObject", doc, [{
                            qInfo: { qType: 'q_cl' },
                            qHyperCubeDef: {
                                qMode: 'S',
                                qAlwaysFullyExpanded: true,
                                qDimensions: [
                                    { qDef: { qFieldDefs: ['Distrital'] } },
                                    { qDef: { qFieldDefs: ['Coordenador'] } },
                                    { qDef: { qFieldDefs: ['Desc_Grupo'] } },
                                    { qDef: { qFieldDefs: ['Desc_Linha'] } }
                                ],
                                qMeasures: [
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisSemFig}>} [Vl_Mercadoria])`, qLabel: 'venda_sem_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}, ${canaisFig}>} [Vl_Mercadoria])`, qLabel: 'venda_figital' } },
                                    { qDef: { qDef: `Sum({<${setBase}>} [Vl_Mercadoria])`, qLabel: 'venda_total' } }
                                ],
                                qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 10, qWidth: 7 }],
                                qSuppressZero: true
                            }
                        }]);
                        const lCL = await send("GetLayout", cCL.result.qReturn.qHandle, []);
                        const totalRowsCL = lCL.result.qLayout.qHyperCube.qSize.qcy;
                        const rawCLRows = await fetchAllDataPages(cCL.result.qReturn.qHandle, totalRowsCL, 7);
                        const coordenadores_linhas = rawCLRows.map(r => ({
                            distrital: String(r[0]),
                            coordenador: String(r[1]),
                            grupo: String(r[2]),
                            linha: String(r[3]),
                            venda_sem_figital: typeof r[4] === 'number' ? r[4] : 0,
                            venda_figital: typeof r[5] === 'number' ? r[5] : 0,
                            venda_total: typeof r[6] === 'number' ? r[6] : 0
                        }));

                        ws.close();
                        resolve({
                            metadata: {
                                extraido_em: new Date().toISOString(),
                                max_date: evalMaxDate.result.qReturn,
                                max_dia: maxDia,
                                total_distritais: distritais.length,
                                total_coordenadores: coordenadores.length,
                                total_filiais: filiais.length,
                                total_grupos: grupos.length,
                                total_linhas: linhas.length,
                                total_coord_grupos_dia: coordenadores_grupos_dia.length,
                                total_coord_linhas: coordenadores_linhas.length
                            },
                            daily,
                            distritais,
                            coordenadores,
                            filiais,
                            grupos,
                            linhas,
                            coordenadores_grupos_dia,
                            coordenadores_linhas
                        });
                    } catch(err) {
                        ws.close();
                        resolve({ error: String(err) });
                    }
                };
            });
        }"""

        print("Enviando requisição de extração dos 9 hipercubos...", flush=True)
        results = await page.evaluate(script, {"appId": APP_ID, "token": csrf_token})
        await browser.close()

        if "error" in results:
            raise RuntimeError(f"Erro no QIX Engine: {results['error']}")

        print(f"3/3 Salvando dados em {OUTPUT_JSON}...", flush=True)
        with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        meta = results.get("metadata", {})
        print(f"✅ Extração concluída em {time.time() - t0:.2f}s!")
        print(f"   Max Data: {meta.get('max_date')} (Dia {meta.get('max_dia')})")
        print(f"   Distritais: {meta.get('total_distritais')}")
        print(f"   Coordenadores: {meta.get('total_coordenadores')}")
        print(f"   Filiais: {meta.get('total_filiais')}")
        print(f"   Grupos: {meta.get('total_grupos')}")
        print(f"   Linhas: {meta.get('total_linhas')}")

        # Check total MTD up to dia 15
        daily = results.get("daily", [])
        v15_sem_fig = sum(d["venda_sem_figital"] for d in daily if d["dia"] <= 15)
        v15_fig = sum(d["venda_figital"] for d in daily if d["dia"] <= 15)
        v15_com_fig = sum(d["venda_digital"] for d in daily if d["dia"] <= 15)
        print("---------------------------------------------------------------")
        print(f"  Venda Digital (Sem Figital) dias 1 a 15: R$ {v15_sem_fig:,.2f}")
        print(f"  Venda Figital dias 1 a 15:              R$ {v15_fig:,.2f}")
        print(f"  Venda Digital (Com Figital) dias 1 a 15: R$ {v15_com_fig:,.2f}")
        print("---------------------------------------------------------------")

if __name__ == "__main__":
    asyncio.run(extract_qlik())
