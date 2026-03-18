const https = require('https');
const fs = require('fs');

const token = 'be6e7ffc-f9be-4719-826d-e02ffc12f0af';
const teamId = 1131009;

const blueprint = JSON.parse(fs.readFileSync('C:/Agents/kimchi-seller/make-blueprint.json', 'utf8'));

const payload = JSON.stringify({
  blueprint: JSON.stringify(blueprint),
  scheduling: JSON.stringify({
    type: 'indefinitely',
    interval: 900
  }),
  name: 'Kimchi Seller Social Media Integration',
  teamId: teamId
});

const options = {
  hostname: `eu1.make.com`,
  path: '/api/v2/scenarios',
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
    console.log(`Status: ${res.statusCode}`);
    console.log(data);
  });
});
req.on('error', (error) => console.error(error));
req.write(payload);
req.end();
