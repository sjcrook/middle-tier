// Core Middle Tier Configuration
// Reusable across projects: listener ports, static serving, session policy, MarkLogic connection.
// Project-specific settings belong in a plugin's own config module.

const path = require('path');

function isEnabled(value) {
  return value === 'true' || value === '1';
}

// Core is a vendored dependency and may live at any depth under the app
// (see bin/start.sh), so path defaults are resolved from the process's
// working directory — the app's own middle-tier/ folder — never from
// __dirname. Override via env var if an app's layout differs.
const appDir = process.cwd();

const config = {
  debug: {
    marklogicRequests: isEnabled(process.env.MT_DEBUG_MARKLOGIC_REQUESTS)
  },

  http: { port: Number(process.env.MT_HTTP_PORT) || 3001 },
  https: {
    port: Number(process.env.MT_HTTPS_PORT) || 3443,
    keyFile: process.env.MT_TLS_KEY_FILE || path.join(appDir, 'certs', 'server.key'),
    certFile: process.env.MT_TLS_CERT_FILE || path.join(appDir, 'certs', 'server.crt')
  },

  // Static file serving - built UI output
  static: {
    root: process.env.MT_STATIC_ROOT || path.resolve(appDir, '..', 'ui', 'dist'),
    spaFallback: true
  },

  // Session management
  session: {
    ttlMs: 30 * 60 * 1000,        // 30 minutes idle timeout
    sweepIntervalMs: 5 * 60 * 1000, // Sweep expired every 5 min
    cookieName: process.env.SESSION_COOKIE_NAME || 'mt_sid',
    cookiePath: '/',
    secretBytes: 32
  },

  // MarkLogic connection
  marklogic: {
    host: process.env.ML_HOST || 'localhost',
    port: Number(process.env.ML_PORT) || 8103,
    managePort: Number(process.env.ML_MANAGE_PORT) || 8102,
    protocol: process.env.ML_PROTOCOL || 'http'
  },

  // Content types for static serving
  mimeTypes: {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
  }
};

module.exports = config;
