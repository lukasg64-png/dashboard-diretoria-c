require('dotenv').config();
const axios = require('axios');
const headers = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'X-VTEX-API-AppKey': process.env.VTEX_APP_KEY,
  'X-VTEX-API-AppToken': process.env.VTEX_APP_TOKEN
};
const account = process.env.VTEX_ACCOUNT;

// Fetch category tree up to 3 levels
axios.get(`https://${account}.vtexcommercestable.com.br/api/catalog_system/pub/category/tree/3`, {headers})
  .then(res => {
    // Find category that matches "diab"
    const findDiab = (categories) => {
      for (const cat of categories) {
        if (cat.name.toLowerCase().includes('diab')) {
          console.log(`FOUND: ${cat.id} - ${cat.name} (Parent: ${cat.Title})`);
        }
        if (cat.hasChildren && cat.children) {
          findDiab(cat.children);
        }
      }
    };
    findDiab(res.data);
  }).catch(e => console.error(e.message));
