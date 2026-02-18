const http = require('http');

const data = JSON.stringify({ name: '' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/companies/test-company/runs',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => { body += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    console.log('Body:', body);
  });
});

req.on('error', error => {
  console.error('Request error:', error);
});

req.write(data);
req.end();
