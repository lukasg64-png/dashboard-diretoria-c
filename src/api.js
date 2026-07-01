const BASE = window.location.port === '5173' ? 'http://localhost:3005/api' : '/api';

async function req(path, params = {}) {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v && v !== 'all') url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Erro HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.status === 'error') throw new Error(json.error);
  return json;
}

export default {
  getMetas: (filters = {}) => req('/metas', filters),
  getDetalhes: (filters = {}) => req('/detalhes', filters),
  getFiltros: () => req('/filtros'),
  refresh: () => fetch(`${BASE}/refresh`, { method: 'POST' }).then(r => r.json()),
  health: () => req('/health'),
  uploadExcel: async (file, token) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('token', token);
    const res = await fetch(`${BASE}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text();
      let msg = text;
      try {
        const json = JSON.parse(text);
        if (json.error) msg = json.error;
      } catch (_) {}
      throw new Error(msg || `Erro HTTP ${res.status}`);
    }
    return res.json();
  }
};
