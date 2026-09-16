"""
deploy_pages.py — Publica o Dashboard Executivo da Diretoria C no GitHub Pages
URL: https://lukasg64-png.github.io/dashboard-diretoria-c/
"""
import os
import sys
import shutil
import tempfile
import subprocess

if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'): sys.stderr.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX_FILE = os.path.join(BASE_DIR, "index.html")
REPO_URL = "https://github.com/lukasg64-png/dashboard-diretoria-c.git"
PAGES_URL = "https://lukasg64-png.github.io/dashboard-diretoria-c/"

def deploy():
    print("=" * 70)
    print("  PUBLICANDO DASHBOARD NO GITHUB PAGES")
    print("=" * 70)

    if not os.path.exists(INDEX_FILE):
        print("Arquivo index.html não encontrado. Compilando antes do deploy...")
        import build_dashboard_cintia
        build_dashboard_cintia.build()

    temp_dir = tempfile.mkdtemp()
    try:
        site_dir = os.path.join(temp_dir, "site")
        os.makedirs(site_dir, exist_ok=True)

        print("[1/4] Copiando arquivos do dashboard para ambiente de deploy...")
        # Copia index.html
        shutil.copy2(INDEX_FILE, os.path.join(site_dir, "index.html"))

        # Copia pasta data com json se existir
        data_src = os.path.join(BASE_DIR, "data")
        data_dst = os.path.join(site_dir, "data")
        if os.path.exists(data_src):
            shutil.copytree(data_src, data_dst, ignore=shutil.ignore_patterns("*.xlsx", "*.log", "*.tmp"))

        # Arquivo .nojekyll
        with open(os.path.join(site_dir, ".nojekyll"), "w") as f:
            f.write("")

        print("[2/4] Preparando repositório Git isolado na branch gh-pages...")
        subprocess.run(["git", "init"], cwd=site_dir, check=True, capture_output=True)
        subprocess.run(["git", "remote", "add", "origin", REPO_URL], cwd=site_dir, check=True, capture_output=True)
        subprocess.run(["git", "checkout", "-b", "gh-pages"], cwd=site_dir, check=True, capture_output=True)

        print("[3/4] Comitando arquivos estáticos...")
        subprocess.run(["git", "add", "-A"], cwd=site_dir, check=True, capture_output=True)
        subprocess.run(["git", "commit", "-m", "deploy(pages): update Diretoria C auto-sync dashboard [skip ci]"], cwd=site_dir, check=True, capture_output=True)

        print("[4/4] Enviando para origin/gh-pages...")
        res = subprocess.run(["git", "push", "--force", "origin", "gh-pages"], cwd=site_dir, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"❌ Erro no push para o GitHub: {res.stderr}")
            return False

        print("✅ Publicado com sucesso no GitHub Pages!")
        print(f"🌐 Link Oficial: {PAGES_URL}")

        # Tenta ativar o GitHub Pages via API se ainda não estiver ativo
        try:
            gh_res = subprocess.run(
                ["gh", "api", "repos/lukasg64-png/dashboard-diretoria-c/pages", "-X", "POST", "-f", "source[branch]=gh-pages", "-f", "source[path]=/"],
                capture_output=True, text=True
            )
            if gh_res.returncode == 0:
                print("⚙️ GitHub Pages habilitado automaticamente via GitHub CLI.")
        except:
            pass

        return True

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    deploy()
