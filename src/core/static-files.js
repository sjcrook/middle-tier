// Static File Server
// Serves the built UI at root path with content-type mapping and path traversal prevention

const fs = require('fs');
const path = require('path');
const config = require('./config');

const root = config.static.root;
const mimeTypes = config.mimeTypes;

function serveStatic(req, res) {
  let filePath = path.join(root, req.url === '/' ? 'index.html' : req.url);

  // Path traversal prevention
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Check if file exists
  try {
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      // Try index.html in directory
      const indexPath = path.join(resolved, 'index.html');
      if (fs.existsSync(indexPath)) {
        filePath = indexPath;
      } else {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
    }
  } catch (err) {
    // SPA fallback: serve index.html for unknown paths (hash routing)
    if (config.static.spaFallback) {
      filePath = path.join(root, 'index.html');
      try {
        fs.statSync(filePath);
      } catch (e) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
    } else {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(content);
  } catch (err) {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
}

module.exports = { serveStatic };
