import React, { useState } from 'react';
import './App.css';
import API from './api';
import DrillPanel from './components/DrillPanel';
import { Upload } from 'lucide-react';

function App() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadToken, setUploadToken] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
      setUploadStatus({ type: 'success', message: 'Planilha atualizada com sucesso! Recarregando...' });
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <DrillPanel
        key={refreshKey}
        onUpload={() => setShowUploadModal(true)}
      />

      {/* Modal Upload */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => !uploading && setShowUploadModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Atualizar Planilha de Metas</span>
              <button
                className="modal-close"
                onClick={() => !uploading && setShowUploadModal(false)}
                disabled={uploading}
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
                  onChange={e => setUploadFile(e.target.files[0])}
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
                  onChange={e => setUploadToken(e.target.value)}
                  className="form-input-text"
                  required
                  disabled={uploading}
                />
              </div>
              {uploadStatus && (
                <div className={`upload-status ${uploadStatus.type}`} style={{ marginTop: 8 }}>
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
