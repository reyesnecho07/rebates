const { createProxyMiddleware } = require('http-proxy-middleware');

console.log('✅ setupProxy.js loaded');

const BACKEND = process.env.BACKEND_URL || 'http://localhost:3009';

module.exports = function (app) {
  app.use('/api', createProxyMiddleware({ target: BACKEND, changeOrigin: true, logLevel: 'debug' }));
  app.use('/permission-ws', createProxyMiddleware({ target: BACKEND, ws: true, changeOrigin: true }));
};