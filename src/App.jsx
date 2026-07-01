import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import API from './api';
import Sidebar from './components/Sidebar';
import FilterBar from './components/FilterBar';
import DashboardPrincipal from './components/DashboardPrincipal';
import CategoriasPage from './components/CategoriasPage';
import LinhasPage from './components/LinhasPage';
import FiliaisPage from './components/FiliaisPage';
import { RefreshCw, AlertCircle, Upload } from 'lucide-react';

const PAGES = {
  dashboard:     { title: 'Painel Geral',   Comp: DashboardPrincipal },
  categorias:    { title: 'Categorias',    Comp: CategoriasPage },
  linhas:        { title: 'Linhas',         Comp: LinhasPage },
  filiais:       { title: 'Filiais',        Comp: FiliaisPage },
};

function App() {
  const [page, setPage] = useState('dashboard');
  const [filters, setFilters] = useState({ distrital: 'all', coordenador: 'all', filial: 'all' });
  const [metasData, setMetasData] = useState(null);
  const [rawOptions, setRawOptions] = useState({ distritoriais: [], coordenadores: [], filiais: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Estados para Upload
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadToken, setUploadToken] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);

  const loadMetas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.getMetas(filters);
      setMetasData(res.data);
      if (res.options) {
        setRawOptions(res.options);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, refreshKey]);

  async function handleUploadSubmit(e) {
    e.preventDefault();
    if (!uploadFile) {
      setUploadStatus({ type: 'error', message: 'Selecione um arquivo Excel (.xlsx).' });
      return;
    }
    setUploading(true);
    setUploadStatus(null);
    try {
      await API.uploadExcel(uploadFile, uploadToken);
      setUploadStatus({ type: 'success', message: 'Planilha atualizada com sucesso! Recarregando dados...' });
      setUploadFile(null);
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadStatus(null);
        setRefreshKey(k => k + 1);
      }, 2000);
    } catch (err) {
      setUploadStatus({ type: 'error', message: err.message || 'Erro ao enviar o arquivo.' });
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => { loadMetas(); }, [loadMetas]);

  function handleRefresh() {
    setLoading(true);
    API.refresh()
      .then(() => setRefreshKey(k => k + 1))
      .catch(() => setRefreshKey(k => k + 1));
  }

  function handleFilterChange(newFilters) {
    setFilters(newFilters);
  }

  function handleRowClick(filterUpdate) {
    setFilters(prev => ({ ...prev, ...filterUpdate }));
    setPage('dashboard');
  }

  const { Comp } = PAGES[page] || PAGES.dashboard;

  // Filtragem hierárquica das opções no frontend
  const distritoriaisOptions = (rawOptions.distritoriais || []).map(d => d.nome).sort();
  
  const coordenadoresOptions = (rawOptions.coordenadores || [])
    .filter(c => filters.distrital === 'all' || c.distrital === filters.distrital)
    .map(c => c.nome)
    .sort();

  const filiaisOptions = (rawOptions.filiais || [])
    .filter(f => {
      if (filters.coordenador !== 'all') {
        return f.coordenador === filters.coordenador;
      }
      if (filters.distrital !== 'all') {
        const coordObj = (rawOptions.coordenadores || []).find(c => c.nome === f.coordenador);
        return coordObj && coordObj.distrital === filters.distrital;
      }
      return true;
    })
    .map(f => f.nome)
    .sort();

  const filterOptions = {
    distritoriais: distritoriaisOptions,
    coordenadores: coordenadoresOptions,
    filiais: filiaisOptions,
  };

  return (
    <div className="app-layout">
      <Sidebar page={page} onNavigate={setPage} data={metasData} />

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-title">{PAGES[page]?.title || 'Dashboard'}</span>
            {filters.distrital !== 'all'   && <span className="filter-chip">Dist: {filters.distrital}</span>}
            {filters.coordenador !== 'all' && <span className="filter-chip">Coord: {filters.coordenador}</span>}
            {filters.filial !== 'all'      && <span className="filter-chip">Filial: {filters.filial}</span>}
          </div>
          <div className="topbar-right">
            {metasData?.arquivo && (
              <span className="topbar-file">{metasData.arquivo}</span>
            )}
            <button 
              className="upload-btn" 
              onClick={() => setShowUploadModal(true)} 
              title="Subir nova Planilha Excel"
              style={{ marginRight: '8px' }}
            >
              <Upload size={14} />
              <span>Atualizar Excel</span>
            </button>
            <button className="refresh-btn" onClick={handleRefresh} title="Recarregar dados do Excel">
              <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            </button>
          </div>
        </header>

        <FilterBar
          filters={filters}
          options={filterOptions}
          onChange={handleFilterChange}
          loading={loading}
        />

        {error && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>Erro: {error}</span>
            <button className="error-retry" onClick={handleRefresh}>Tentar novamente</button>
          </div>
        )}

        <div className="page-content">
          <Comp
            data={metasData}
            loading={loading && !metasData}
            filters={filters}
            onFilterChange={handleFilterChange}
            onRowClick={handleRowClick}
          />
        </div>
      </div>

      {showUploadModal && (
        <div className="modal-overlay" onClick={() => !uploading && setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Atualizar Planilha de Metas</span>
              <button 
                className="modal-close" 
                onClick={() => !uploading && setShowUploadModal(false)} 
                disabled={uploading}
                style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUploadSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">Planilha Excel (BASE DASHBOARD)</label>
                <input 
                  type="file" 
                  accept=".xlsx" 
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="form-input-text"
                  required
                  disabled={uploading}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Senha de Confirmação</label>
                <input 
                  type="password" 
                  placeholder="Digite a senha para upload"
                  value={uploadToken}
                  onChange={(e) => setUploadToken(e.target.value)}
                  className="form-input-text"
                  required
                  disabled={uploading}
                />
              </div>
              {uploadStatus && (
                <div className={`upload-status ${uploadStatus.type}`} style={{ marginTop: '8px' }}>
                  {uploadStatus.message}
                </div>
              )}
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={uploading || !uploadFile || !uploadToken}
                >
                  {uploading ? 'Enviando...' : 'Enviar Planilha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
