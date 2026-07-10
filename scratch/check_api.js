const http = require('http');

http.get('http://localhost:3002/api/monitor', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const stores = json.data.stores;
      
      console.log('Total stores:', stores.length);
      
      // Find Dark Store or Delivery
      const darkMatches = stores.filter(s => 
        s.name.toLowerCase().includes('dark') || 
        s.name.toLowerCase().includes('delivery')
      );
      
      console.log('\nDark/Delivery stores found:', darkMatches.length);
      darkMatches.forEach(s => {
        console.log(`  Name: ${s.name}`);
        console.log(`  Coord: ${s.coordenador}, Dist: ${s.distrital}, Dir: ${s.diretor}`);
        console.log(`  Sales Today: ${s.salesToday}, Status: ${s.status}`);
      });
      
      // Count stores with "Desconhecido" coordinator
      const unknownCoord = stores.filter(s => s.coordenador === 'Desconhecido');
      console.log(`\nStores with "Desconhecido" coordinator: ${unknownCoord.length} / ${stores.length}`);
      
      // Show first 10 stores
      console.log('\nFirst 10 stores:');
      stores.slice(0, 10).forEach(s => {
        console.log(`  ${s.name} | Coord: ${s.coordenador} | Dist: ${s.distrital} | Sales: ${s.salesToday} | Status: ${s.status}`);
      });
      
      // Show summary
      console.log('\nSummary:', json.data.summary);
    } catch (e) {
      console.error('Parse error:', e.message);
      console.log('Raw response (first 500 chars):', data.slice(0, 500));
    }
  });
}).on('error', e => {
  console.error('Request error:', e.message);
});
