const http = require('http');

http.get('http://localhost:3002/api/monitor', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const stores = json.data.stores;
    
    const unknown = stores
      .filter(s => s.coordenador === 'Desconhecido')
      .map(s => ({ name: s.name, id: s.id, sales: s.salesToday, status: s.status }));
    
    console.log(`Unmatched stores (${unknown.length}):`);
    unknown.forEach(s => {
      console.log(`  "${s.name}" (ID: ${s.id}, Sales: ${s.sales}, Status: ${s.status})`);
    });
  });
}).on('error', e => console.error(e.message));
