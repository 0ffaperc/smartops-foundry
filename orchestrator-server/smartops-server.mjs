// SmartOps Foundry — Static site server + API proxy
// Serves landing page, login, and agency dashboard
// Proxies /api/* to the orchestrator server (:8787)

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join as pathJoin, extname } from 'node:path';

const PORT = 3000;
const PUBLIC_DIR = 'C:/Users/shahe/Desktop/lifeos-v2-restored/lifeos-v2-ready/public';
const ORCHESTRATOR = { host: '127.0.0.1', port: 8787 };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function proxy(req, res) {
  const options = {
    hostname: ORCHESTRATOR.host,
    port: ORCHESTRATOR.port,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `${ORCHESTRATOR.host}:${ORCHESTRATOR.port}` },
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
      ...proxyRes.headers,
    });
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Backend unavailable: ' + e.message }));
  });
  req.pipe(proxyReq);
}

import { request as httpRequest } from 'node:http';

const server = createServer((req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    });
    res.end();
    return;
  }

  // Proxy API requests to orchestrator
  if (req.url.startsWith('/api/')) {
    const options = {
      hostname: ORCHESTRATOR.host,
      port: ORCHESTRATOR.port,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `${ORCHESTRATOR.host}:${ORCHESTRATOR.port}` },
    };
    const proxyReq = httpRequest(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
        ...proxyRes.headers,
      });
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (e) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Backend unavailable: ' + e.message }));
    });
    req.pipe(proxyReq);
    return;
  }

  // Route mapping
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  // Serve static files from public dir
  const filePath = pathJoin(PUBLIC_DIR, urlPath);
  if (existsSync(filePath)) {
    const ext = extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    try {
      const content = readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'no-cache',
      });
      res.end(content);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal error');
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SmartOps Foundry server running on http://localhost:${PORT}`);
  console.log(`Serving from: ${PUBLIC_DIR}`);
  console.log(`API proxy → http://${ORCHESTRATOR.host}:${ORCHESTRATOR.port}`);
});
