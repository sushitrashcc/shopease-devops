'use strict';
const app = require('./app');

if (!process.env.API_KEY) {
  console.error('API_KEY is not set - refusing to start (fail closed)');
  process.exit(1);
}
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => console.log(JSON.stringify({ event: 'STARTED', port })));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
