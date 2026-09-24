const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../../src/core/config');
const { buildDigestHeader, parseWwwAuthenticate, probeCredentials, logRequest } = require('../../src/core/marklogic/rest-client');

test('parseWwwAuthenticate extracts digest challenge parameters', () => {
  const header = 'Digest realm="public", qop="auth", nonce="abc123", opaque="xyz"';
  const parsed = parseWwwAuthenticate(header);

  assert.equal(parsed.realm, 'public');
  assert.equal(parsed.qop, 'auth');
  assert.equal(parsed.nonce, 'abc123');
  assert.equal(parsed.opaque, 'xyz');
});

test('buildDigestHeader produces a well-formed Digest Authorization value', () => {
  const header = buildDigestHeader(
    'GET',
    '/v1/search',
    'alice',
    'secret',
    { realm: 'public', nonce: 'n1', qop: 'auth', opaque: 'op1' },
    '00000001',
    'c1'
  );

  assert.match(header, /^Digest /);
  assert.match(header, /username="alice"/);
  assert.match(header, /realm="public"/);
  assert.match(header, /nonce="n1"/);
  assert.match(header, /uri="\/v1\/search"/);
  assert.match(header, /qop=auth/);
  assert.match(header, /nc=00000001/);
  assert.match(header, /cnonce="c1"/);
  assert.match(header, /opaque="op1"/);
  assert.match(header, /response="[0-9a-f]{32}"/);
});

test('probeCredentials returns false when the transport rejects the request', async () => {
  const originalRequest = require('../../src/core/marklogic/rest-client').request;
  const client = require('../../src/core/marklogic/rest-client');
  client.request = async () => ({ status: 401, headers: {}, body: '' });

  try {
    const valid = await probeCredentials('nobody', 'wrong');
    assert.equal(valid, false);
  } finally {
    client.request = originalRequest;
  }
});

test('logRequest logs the MarkLogic URL and non-GET payload when debugging is enabled', (t) => {
  const messages = [];
  const originalDebug = config.debug.marklogicRequests;
  config.debug.marklogicRequests = true;
  t.mock.method(console, 'log', (...args) => messages.push(args));

  try {
    logRequest('GET', '/v1/search?q=test', null);
    logRequest('POST', '/v1/graphs/sparql', 'query=SELECT');

    const marklogicUrl = `${config.marklogic.protocol}://${config.marklogic.host}:${config.marklogic.port}`;
    assert.deepEqual(messages, [
      [`[MarkLogic] GET ${marklogicUrl}/v1/search?q=test`],
      [`[MarkLogic] POST ${marklogicUrl}/v1/graphs/sparql\nPayload:`, 'query=SELECT']
    ]);
  } finally {
    config.debug.marklogicRequests = originalDebug;
  }
});

test('logRequest is silent when MarkLogic request debugging is disabled', (t) => {
  const originalDebug = config.debug.marklogicRequests;
  config.debug.marklogicRequests = false;
  const log = t.mock.method(console, 'log');

  try {
    logRequest('POST', '/v1/graphs/sparql', 'query=SELECT');
    assert.equal(log.mock.callCount(), 0);
  } finally {
    config.debug.marklogicRequests = originalDebug;
  }
});
