const test = require('node:test');
const assert = require('node:assert/strict');

const Router = require('../../src/core/router');

test('resolves a matching route and extracts named params', () => {
  const router = new Router();
  let called = null;
  router.get('/api/things/:id', (req) => { called = req; });

  const match = router.resolve('GET', '/api/things/abc-123?x=1');
  assert.ok(match);
  assert.deepEqual(match.params, { id: 'abc-123' });
});

test('does not match a different method on the same path', () => {
  const router = new Router();
  router.get('/api/things/:id', () => {});

  assert.equal(router.resolve('POST', '/api/things/abc-123'), null);
});

test('returns null for unregistered paths', () => {
  const router = new Router();
  router.get('/api/things', () => {});

  assert.equal(router.resolve('GET', '/api/other'), null);
});

test('decodes URI-encoded param segments', () => {
  const router = new Router();
  router.get('/api/things/:id', () => {});

  const match = router.resolve('GET', '/api/things/hello%20world');
  assert.equal(match.params.id, 'hello world');
});
