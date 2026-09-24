const test = require('node:test');
const assert = require('node:assert/strict');

const auth = require('../../src/core/auth');

test('createSession then getSession round-trips the username and password', () => {
  const { cookieValue } = auth.createSession('alice', 'secret');
  const session = auth.getSession(cookieValue);

  assert.ok(session);
  assert.equal(session.username, 'alice');
  assert.equal(session.password, 'secret');
});

test('getSession rejects a tampered signature', () => {
  const { cookieValue } = auth.createSession('bob', 'secret');
  const [sessionId] = cookieValue.split('.');
  const tampered = `${sessionId}.deadbeef`;

  assert.equal(auth.getSession(tampered), null);
});

test('getSession rejects a cookie with no signature separator', () => {
  assert.equal(auth.getSession('not-a-valid-cookie'), null);
});

test('destroySession invalidates the session', () => {
  const { cookieValue } = auth.createSession('carol', 'secret');
  assert.ok(auth.getSession(cookieValue));

  auth.destroySession(cookieValue);
  assert.equal(auth.getSession(cookieValue), null);
});

test('getSession returns null for an unknown session id', () => {
  assert.equal(auth.getSession(''), null);
  assert.equal(auth.getSession(null), null);
});
