const https = require('https');
const zones = ['eu1', 'eu2', 'us1'];
const token = 'be6e7ffc-f9be-4719-826d-e02ffc12f0af';

async function checkZone(zone) {
  return new Promise((resolve) => {
    const options = {
      hostname: `${zone}.make.com`,
      path: '/api/v2/users/me',
      method: 'GET',
      headers: { 'Authorization': `Token ${token}` }
    };
    
    const req = https.request(options, (res) => {
      if (res.statusCode === 200) {
        resolve(zone);
      } else {
        resolve(null);
      }
    });
    
    req.on('error', () => resolve(null));
    req.end();
  });
}

async function findZone() {
  for (const zone of zones) {
    const valid = await checkZone(zone);
    if (valid) {
      console.log(`ZONEMATCH=${valid}`);
      return;
    }
  }
  console.log('ZONEMATCH=UNKNOWN');
}

findZone();
