// Core Middle Tier Server
// HTTP + HTTPS listeners, request dispatch, core route registration, plugin mounting.
// This module is reusable across projects; project behavior is supplied via plugins.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const auth = require('./auth');
const Router = require('./router');
const { serveStatic } = require('./static-files');
const { loginHandler, logoutHandler, statusHandler } = require('./auth-handlers');
const { registerPlugins } = require('./load-plugins');

function createRouter(plugins) {
  const router = new Router();

  // Auth routes
  router.post('/api/auth/login', loginHandler);
  router.post('/api/auth/logout', logoutHandler);
  router.get('/api/auth/status', statusHandler);

  // Health check
  router.get('/api/health', async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));
  });

  registerPlugins(router, plugins);

  return router;
}

// Parse JSON body helper
function parseBody(req) {
  return new Promise((resolve) => {
    if (req.method === 'GET' || req.method === 'DELETE') {
      resolve(null);
      return;
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve(null);
      }
    });
  });
}

function start({ plugins = [] } = {}) {
  const router = createRouter(plugins);

  async function handleRequest(req, res) {
    const startTime = Date.now();

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    const url = req.url;

    if (url.startsWith('/api/')) {
      const route = router.resolve(req.method, url);
      if (route) {
        try {
          const body = await parseBody(req);
          req.body = body;
          req.params = route.params || {};
          await route.handler(req, res, body);
        } catch (err) {
          console.error(`Handler error [${req.method} ${url}]:`, err.message);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } else {
      serveStatic(req, res);
    }

    const duration = Date.now() - startTime;
    console.log(`${req.method} ${url} ${res.statusCode} ${duration}ms`);
  }

  const httpServer = http.createServer(handleRequest);

  let httpsServer = null;
  try {
    const keyPath = path.resolve(config.https.keyFile);
    const certPath = path.resolve(config.https.certFile);
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      const key = fs.readFileSync(keyPath);
      const cert = fs.readFileSync(certPath);
      httpsServer = https.createServer({ key, cert }, handleRequest);
    }
  } catch (err) {
    console.warn('HTTPS certs not found, starting HTTP only:', err.message);
  }

  auth.startSessionSweep();

  httpServer.listen(config.http.port, () => {
    console.log(`MT HTTP server listening on port ${config.http.port}`);
    console.log(`Serving static files from: ${config.static.root}`);
  });

  if (httpsServer) {
    httpsServer.listen(config.https.port, () => {
      console.log(`MT HTTPS server listening on port ${config.https.port}`);
    });
  }

  function shutdown() {
    console.log('Shutting down...');
    auth.stopSessionSweep();
    httpServer.close();
    if (httpsServer) httpsServer.close();
    // Force exit after 2 s — browser keep-alive connections prevent close() from
    // completing on its own, which would leave the process hanging indefinitely.
    setTimeout(() => process.exit(0), 2000).unref();
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { httpServer, httpsServer };
}

module.exports = { start, createRouter };
