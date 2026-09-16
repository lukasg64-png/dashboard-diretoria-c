@echo off
pushd "%~dp0"
if not exist logs mkdir logs
set LOG=logs\sync.log

echo ======================================================================
echo   ATUALIZACAO AUTOMATICA - DIRETORIA C (CINTIA SILVA)
echo ======================================================================

echo [1/4] Sincronizando com Qlik Cloud SaaS...
python -u extract_qlik_cintia.py >> "%LOG%" 2>&1
if errorlevel 1 goto :erro

echo.
echo [2/4] Consolidando vendas com metas oficiais...
python -u consolidate_cintia_data.py >> "%LOG%" 2>&1
if errorlevel 1 goto :erro

echo.
echo [3/4] Compilando Dashboard HTML Executivo...
python -u build_dashboard_cintia.py >> "%LOG%" 2>&1
if errorlevel 1 goto :erro

echo.
echo [4/4] Publicando no GitHub Pages...
python -u deploy_pages.py >> "%LOG%" 2>&1
if errorlevel 1 goto :erro

echo.
echo ======================================================================
echo   SUCESSO: Dashboard Diretoria C atualizado e publicado no GitHub Pages!
echo   URL: https://lukasg64-png.github.io/dashboard-diretoria-c/
echo ======================================================================
popd
exit /b 0

:erro
echo.
echo ======================================================================
echo   ERRO NA ATUALIZACAO DO DASHBOARD DIRETORIA C
echo ======================================================================
popd
exit /b 1
