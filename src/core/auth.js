// Authentication & Session Management
// In-memory session store with AES-256-GCM encrypted credentials
// HMAC-signed session cookies

const crypto = require('crypto');
const config = require('./config');

const sessions = new Map();
const serverSecret = crypto.randomBytes(config.session.secretBytes);
let sessionSweepTimer = null;

// Derive encryption key from server secret
const encryptionKey = crypto.hkdfSync('sha256', serverSecret, Buffer.alloc(16), 'credential-encryption', 32);

function encryptCredentials(username, password) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  let encrypted = cipher.update(JSON.stringify({ username, password }), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex')
  };
}

function decryptCredentials(encrypted, ivHex, authTagHex) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

function signSessionId(sessionId) {
  const hmac = crypto.createHmac('sha256', serverSecret);
  hmac.update(sessionId);
  return hmac.digest('hex');
}

function verifySessionId(sessionId, signature) {
  const expected = signSessionId(sessionId);
  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function generateSessionId() {
  return crypto.randomBytes(config.session.secretBytes).toString('hex');
}

// Create a new session
function createSession(username, password) {
  const sessionId = generateSessionId();
  const { encrypted, iv, authTag } = encryptCredentials(username, password);
  const now = Date.now();

  sessions.set(sessionId, {
    username,
    credentials: encrypted,
    iv,
    authTag,
    createdAt: now,
    lastAccessed: now
  });

  const signature = signSessionId(sessionId);
  const cookieValue = `${sessionId}.${signature}`;

  return { sessionId, cookieValue, username };
}

// Get session from cookie value
function getSession(cookieValue) {
  if (!cookieValue) return null;

  const dotIndex = cookieValue.indexOf('.');
  if (dotIndex === -1) return null;

  const sessionId = cookieValue.substring(0, dotIndex);
  const signature = cookieValue.substring(dotIndex + 1);

  if (!verifySessionId(sessionId, signature)) return null;

  const session = sessions.get(sessionId);
  if (!session) return null;

  // Check expiry
  const now = Date.now();
  if (now - session.lastAccessed > config.session.ttlMs) {
    sessions.delete(sessionId);
    return null;
  }

  // Update last accessed
  session.lastAccessed = now;

  // Decrypt credentials
  const { username, password } = decryptCredentials(
    session.credentials,
    session.iv,
    session.authTag
  );

  return { sessionId, username, password, session };
}

// Destroy a session
function destroySession(cookieValue) {
  if (!cookieValue) return;
  const dotIndex = cookieValue.indexOf('.');
  if (dotIndex === -1) return;
  const sessionId = cookieValue.substring(0, dotIndex);
  sessions.delete(sessionId);
}

function startSessionSweep() {
  if (sessionSweepTimer) return;

  sessionSweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [sid, session] of sessions) {
      if (now - session.lastAccessed > config.session.ttlMs) {
        sessions.delete(sid);
      }
    }
  }, config.session.sweepIntervalMs);
}

function stopSessionSweep() {
  if (sessionSweepTimer) {
    clearInterval(sessionSweepTimer);
    sessionSweepTimer = null;
  }
}

module.exports = {
  createSession,
  getSession,
  destroySession,
  startSessionSweep,
  stopSessionSweep
};
