const https = require('https');

const token = 'be6e7ffc-f9be-4719-826d-e02ffc12f0af';
const teamId = 1131009;

const payload = JSON.stringify({
  name: 'Kimchi Seller Webhook',
  typeName: 'gateway:CustomWebHook',
  teamId: teamId
});

const options = {
  hostname: `eu1.make.com`,
  path: '/api/v2/hooks',
  method: 'POST',
  headers: { 
    'Authorization': `Token ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(data);
  });
});
req.on('error', (error) => console.error(error));
req.write(payload);
req.end();
