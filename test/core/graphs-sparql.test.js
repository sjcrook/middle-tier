const test = require('node:test');
const assert = require('node:assert/strict');

const restClient = require('../../src/core/marklogic/rest-client');
const { sparqlQuery, sparqlQueryGet } = require('../../src/core/marklogic/endpoints/graphs-sparql');

function withMockedRequest(mock, fn) {
  const original = restClient.request;
  restClient.request = mock;
  return Promise.resolve(fn()).finally(() => { restClient.request = original; });
}

test('sparqlQuery accepts a bare string as shorthand for { query }', async () => {
  let captured;
  await withMockedRequest(async (...args) => { captured = args; return { status: 200, body: '{}' }; }, () =>
    sparqlQuery('SELECT * WHERE { ?s ?p ?o }', 'alice', 'secret'));

  const [method, path, body, username, password, contentType] = captured;
  assert.equal(method, 'POST');
  assert.equal(path, '/v1/graphs/sparql');
  assert.equal(username, 'alice');
  assert.equal(password, 'secret');
  assert.equal(contentType, 'application/x-www-form-urlencoded');
  assert.equal(new URLSearchParams(body).get('query'), 'SELECT * WHERE { ?s ?p ?o }');
});

test('sparqlQuery repeats multi-valued parameters and encodes bind/perm objects', async () => {
  let captured;
  await withMockedRequest(async (...args) => { captured = args; return { status: 200, body: '{}' }; }, () =>
    sparqlQuery({
      query: 'SELECT * WHERE { ?s ?p ?o }',
      namedGraphUri: ['urn:g1', 'urn:g2'],
      collection: 'things',
      pageLength: 50,
      bind: {
        label: 'plain-iri',
        count: { value: '5', type: 'xs:int' },
        greeting: { value: 'hello', lang: 'en' }
      },
      perm: { editor: 'update' }
    }, 'alice', 'secret'));

  const params = new URLSearchParams(captured[2]);
  assert.deepEqual(params.getAll('named-graph-uri'), ['urn:g1', 'urn:g2']);
  assert.equal(params.get('collection'), 'things');
  assert.equal(params.get('pageLength'), '50');
  assert.equal(params.get('bind:label'), 'plain-iri');
  assert.equal(params.get('bind:count:xs:int'), '5');
  assert.equal(params.get('bind:greeting@en'), 'hello');
  assert.equal(params.get('perm:editor'), 'update');
});

test('sparqlQuery rejects query and update together', () => {
  assert.throws(() => sparqlQuery({ query: 'SELECT * WHERE {}', update: 'INSERT DATA {}' }, 'a', 'b'));
});

test('sparqlQuery passes an update through the update parameter', async () => {
  let captured;
  await withMockedRequest(async (...args) => { captured = args; return { status: 200, body: '' }; }, () =>
    sparqlQuery({ update: 'INSERT DATA { <a> <b> <c> }', usingGraphUri: 'urn:g1' }, 'alice', 'secret'));

  const params = new URLSearchParams(captured[2]);
  assert.equal(params.get('update'), 'INSERT DATA { <a> <b> <c> }');
  assert.equal(params.get('using-graph-uri'), 'urn:g1');
  assert.equal(params.has('query'), false);
});

test('sparqlQuery forwards a custom Accept header', async () => {
  let captured;
  await withMockedRequest(async (...args) => { captured = args; return { status: 200, body: '' }; }, () =>
    sparqlQuery('SELECT * WHERE {}', 'alice', 'secret', 'application/sparql-results+xml'));

  assert.equal(captured[6], 'application/sparql-results+xml');
});

test('sparqlQueryGet builds a query string on the path and sends no body', async () => {
  let captured;
  await withMockedRequest(async (...args) => { captured = args; return { status: 200, body: '{}' }; }, () =>
    sparqlQueryGet({ query: 'SELECT * WHERE {}', defaultGraphUri: 'urn:g1' }, 'alice', 'secret'));

  const [method, path, body] = captured;
  assert.equal(method, 'GET');
  assert.equal(body, null);
  assert.match(path, /^\/v1\/graphs\/sparql\?/);
  const params = new URLSearchParams(path.split('?')[1]);
  assert.equal(params.get('query'), 'SELECT * WHERE {}');
  assert.equal(params.get('default-graph-uri'), 'urn:g1');
});

test('sparqlQueryGet rejects update-only parameters', () => {
  assert.throws(() => sparqlQueryGet({ update: 'INSERT DATA {}' }, 'alice', 'secret'));
});
