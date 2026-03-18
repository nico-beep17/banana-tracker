const https = require('https');
const token = 'be6e7ffc-f9be-4719-826d-e02ffc12f0af';

const options = {
  hostname: `eu1.make.com`,
  path: '/api/v2/organizations',
  method: 'GET',
  headers: { 'Authorization': `Token ${token}` }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(data);
  });
});
req.on('error', (error) => console.error(error));
req.end();
