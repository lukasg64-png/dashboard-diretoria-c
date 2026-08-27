import React, { useState } from 'react';
import './App.css';
import API from './api';
import DrillPanel from './components/DrillPanel';
import { Upload } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f4f8',
          fontFamily: "'Inter', system-ui, sans-serif",
          padding: 24
        }}>
          <div style={{
            background: '#fff',
            padding: '32px 40px',
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            maxWidth: 550,
            width: '100%',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 18, color: '#0f2050', margin: '0 0 8px', fontWeight: 700 }}>
              Ops! Ocorreu um erro ao carregar o painel
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 }}>
              {this.state.error?.message || 'Houve uma falha inesperada na renderização dos componentes.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#7c3aed',
                color: '#fff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(124,58,237,0.3)'
              }}
            >
              Recarregar Painel
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
      if (!window.XLSX) {
        throw new Error('A biblioteca de processamento Excel ainda está carregando no seu navegador. Tente novamente em 2 segundos.');
      }

      setUploadStatus({ type: 'info', message: 'Lendo e convertendo planilha localmente no seu computador (isso evita lentidão)...' });

      // Ler o arquivo binário local no navegador
      const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(uploadFile);
      });

      // Ler o workbook na aba correta com opções de alta performance
      const wb = window.XLSX.read(fileData, {
        type: 'array',
        dense: true,
        cellDates: false,
        cellNF: false,
        cellText: false,
        cellStyles: false
      });

      const sheetName = wb.SheetNames.includes('BASE DASHBOARD') ? 'BASE DASHBOARD' : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      if (!ws) {
        throw new Error('Nenhuma aba encontrada no arquivo Excel enviado.');
      }

      // Converter aba para CSV usando delimitador ponto e vírgula
      const csvContent = window.XLSX.utils.sheet_to_csv(ws, { FS: ';' });
      
      // Criar arquivo CSV virtual a ser enviado por HTTP
      const csvFile = new File([csvContent], 'base_dashboard.csv', { type: 'text/csv' });

      setUploadStatus({ type: 'info', message: 'Enviando dados compactados para o servidor na nuvem...' });

      await API.uploadExcel(csvFile, uploadToken);
      setUploadStatus({ type: 'success', message: 'Planilha atualizada com sucesso! Recarregando...' });
      setUploadFile(null);
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadStatus(null);
        setRefreshKey(k => k + 1);
      }, 2000);
    } catch (err) {
      setUploadStatus({ type: 'error', message: err.message || 'Erro ao processar/enviar o arquivo.' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <ErrorBoundary>
      <div style={{ minHeight: '100vh', background: '#f0f4f8' }}>
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
    </ErrorBoundary>
  );
}

export default App;
