// Core Authentication Handlers
// POST /api/auth/login, POST /api/auth/logout, GET /api/auth/status

const auth = require('./auth');
const config = require('./config');
const { probeCredentials } = require('./marklogic/rest-client');

async function loginHandler(req, res, body) {
  try {
    const { username, password } = body || {};

    if (!username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Username and password required' }));
      return;
    }

    // Validate credentials against MarkLogic
    const valid = await probeCredentials(username, password);
    if (!valid) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid credentials' }));
      return;
    }

    // Create session
    const { cookieValue, username: uname } = auth.createSession(username, password);

    // Set cookie
    const cookieHeader = `${config.session.cookieName}=${cookieValue}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${config.session.ttlMs / 1000}`;

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieHeader
    });
    res.end(JSON.stringify({ username: uname, authenticated: true }));
  } catch (err) {
    console.error('Login error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

function logoutHandler(req, res) {
  const cookies = parseCookies(req);
  const sid = cookies[config.session.cookieName];
  if (sid) {
    auth.destroySession(sid);
  }

  // Clear cookie
  res.writeHead(204, {
    'Set-Cookie': `${config.session.cookieName}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`
  });
  res.end();
}

function statusHandler(req, res) {
  const cookies = parseCookies(req);
  const sid = cookies[config.session.cookieName];
  const session = auth.getSession(sid);

  if (session) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ authenticated: true, username: session.username }));
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ authenticated: false }));
  }
}

function parseCookies(req) {
  const cookieHeader = req.headers['cookie'];
  if (!cookieHeader) return {};
  const cookies = {};
  cookieHeader.split(';').forEach(c => {
    const parts = c.trim().split('=');
    if (parts.length >= 2) {
      cookies[parts[0]] = parts.slice(1).join('=');
    }
  });
  return cookies;
}

module.exports = { loginHandler, logoutHandler, statusHandler, parseCookies };
