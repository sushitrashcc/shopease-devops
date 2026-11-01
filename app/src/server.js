'use strict';
const app = require('./app');

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => console.log(`ShopEase ${process.env.APP_VERSION || 'dev'} listening on ${port}`));

process.on('SIGTERM', () => server.close(() => process.exit(0)));
