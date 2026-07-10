require('dotenv').config();
const axios = require('axios');
const headers = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'X-VTEX-API-AppKey': process.env.VTEX_APP_KEY,
  'X-VTEX-API-AppToken': process.env.VTEX_APP_TOKEN
};
const account = process.env.VTEX_ACCOUNT;
axios.get(`https://${account}.vtexcommercestable.com.br/api/oms/pvt/orders/1645676696533-01`, {headers})
  .then(res => {
    const items = res.data.items;
    console.log(JSON.stringify(items[0], null, 2));
  }).catch(e => console.error(e.message));
