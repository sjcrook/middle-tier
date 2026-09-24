// Generic MarkLogic REST Client — HTTP Digest Auth Transport
// Implements HTTP Digest authentication for any MarkLogic REST endpoint.
// Nonce caching avoids the double-request penalty on subsequent calls.
// This module knows nothing about any specific project or use case.

const http = require('http');
const crypto = require('crypto');
const config = require('../config');

const mlConfig = config.marklogic;

// Nonce cache: keyed by host:port, stores nonce data for reuse
const nonceCache = new Map();

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function parseWwwAuthenticate(header) {
  const parts = {};
  header.replace(/(\w+)=("[^"]*"|[^,]*)/g, (_, key, value) => {
    parts[key] = value.replace(/^"/, '').replace(/"$/, '');
  });
  return parts;
}

function buildDigestHeader(method, uri, username, password, authParams, nc, cnonce) {
  const { realm, nonce, qop, opaque } = authParams;
  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);

  let header = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", `;
  header += `qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
  if (opaque) header += `, opaque="${opaque}"`;

  return header;
}

function logRequest(method, path, body) {
  if (!config.debug.marklogicRequests) return;

  const url = `${mlConfig.protocol}://${mlConfig.host}:${mlConfig.port}${path}`;
  if (method.toUpperCase() === 'GET' || body == null) {
    console.log(`[MarkLogic] ${method} ${url}`);
    return;
  }

  console.log(`[MarkLogic] ${method} ${url}\nPayload:`, body);
}

// Generic authenticated request to any MarkLogic REST path
function request(method, path, body, username, password, contentType, accept) {
  return new Promise((resolve, reject) => {
    const cacheKey = `${mlConfig.host}:${mlConfig.port}`;
    const cnonce = crypto.randomBytes(8).toString('hex');
    const resolvedContentType = contentType || 'application/json';
    const resolvedAccept = accept || 'application/json';

    const options = {
      hostname: mlConfig.host,
      port: mlConfig.port,
      path: path,
      method: method,
      headers: {
        'Content-Type': resolvedContentType,
        'Accept': resolvedAccept
      },
      timeout: 30000
    };

    logRequest(method, path, body);

    // If we have a cached nonce, try with digest auth immediately
    const cached = nonceCache.get(cacheKey);
    if (cached) {
      const newNc = (cached.nc + 1).toString(16).padStart(8, '0');
      options.headers['Authorization'] = buildDigestHeader(
        method, path, username, password,
        cached.params, newNc, cnonce
      );
      nonceCache.set(cacheKey, { ...cached, nc: parseInt(newNc, 16) });
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 401 && !cached) {
          // First request - parse WWW-Authenticate and retry
          const authHeader = res.headers['www-authenticate'];
          if (!authHeader) {
            reject(new Error('No WWW-Authenticate header in 401 response'));
            return;
          }
          const params = parseWwwAuthenticate(authHeader);
          const newNc = '00000001';
          const newCnonce = crypto.randomBytes(8).toString('hex');

          // Cache the nonce params
          nonceCache.set(cacheKey, { params, nc: 1 });

          // Retry with digest auth
          const retryOptions = {
            hostname: mlConfig.host,
            port: mlConfig.port,
            path: path,
            method: method,
            headers: {
              'Content-Type': resolvedContentType,
              'Accept': resolvedAccept,
              'Authorization': buildDigestHeader(
                method, path, username, password,
                params, newNc, newCnonce
              )
            },
            timeout: 30000
          };

          const retryReq = http.request(retryOptions, (retryRes) => {
            let retryData = '';
            retryRes.on('data', chunk => retryData += chunk);
            retryRes.on('end', () => {
              resolve({
                status: retryRes.statusCode,
                headers: retryRes.headers,
                body: retryData
              });
            });
          });
          retryReq.on('error', reject);
          if (body) retryReq.write(body);
          retryReq.end();
        } else {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Lightweight credential check — any authenticated user can reach /v1/search
async function probeCredentials(username, password) {
  const result = await module.exports.request('GET', '/v1/search?pageLength=0', null, username, password);
  return result.status === 200;
}

module.exports = {
  request,
  probeCredentials,
  buildDigestHeader,
  parseWwwAuthenticate,
  logRequest
};
