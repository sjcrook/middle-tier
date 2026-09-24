// Generic MarkLogic REST endpoint: /v1/graphs/sparql
// Reusable by any plugin that needs to run a SPARQL query or update.
// https://docs.marklogic.com/REST/GET/v1/graphs/sparql
// https://docs.marklogic.com/REST/POST/v1/graphs/sparql

const restClient = require('../rest-client');

const PATH = '/v1/graphs/sparql';

// Repeats the key for each element — MarkLogic's convention for multi-valued
// parameters (named-graph-uri, collection, ruleset, etc).
function appendParam(params, key, value) {
  if (value == null || value === '') return;
  const values = Array.isArray(value) ? value : [value];
  for (const v of values) {
    if (v == null || v === '') continue;
    params.append(key, v);
  }
}

// bind: { name: 'value' }                  -> bind:name=value       (IRI)
// bind: { name: { value, type: 'xs:int' } } -> bind:name:xs:int=value (typed literal)
// bind: { name: { value, lang: 'en' } }     -> bind:name@en=value     (language string)
function appendBindings(params, bind) {
  if (!bind) return;
  for (const [name, spec] of Object.entries(bind)) {
    if (spec == null) continue;
    if (typeof spec === 'object') {
      const key = spec.lang ? `bind:${name}@${spec.lang}` : spec.type ? `bind:${name}:${spec.type}` : `bind:${name}`;
      appendParam(params, key, spec.value);
    } else {
      appendParam(params, `bind:${name}`, spec);
    }
  }
}

// perm: { role: 'update' } -> perm:role=update
function appendPermissions(params, perm) {
  if (!perm) return;
  for (const [role, capability] of Object.entries(perm)) {
    appendParam(params, `perm:${role}`, capability);
  }
}

function buildParams({
  query,
  update,
  defaultGraphUri,
  namedGraphUri,
  usingGraphUri,
  usingNamedGraphUri,
  database,
  dedup,
  base,
  perm,
  txid,
  start,
  pageLength,
  q,
  structuredQuery,
  options,
  collection,
  directory,
  ruleset,
  defaultRulesets,
  optimize,
  bind,
  timestamp
} = {}) {
  if (query != null && update != null) {
    throw new Error('query and update are mutually exclusive');
  }

  const params = new URLSearchParams();
  appendParam(params, 'query', query);
  appendParam(params, 'update', update);
  appendParam(params, 'default-graph-uri', defaultGraphUri);
  appendParam(params, 'named-graph-uri', namedGraphUri);
  appendParam(params, 'using-graph-uri', usingGraphUri);
  appendParam(params, 'using-named-graph-uri', usingNamedGraphUri);
  appendParam(params, 'database', database);
  appendParam(params, 'dedup', dedup);
  appendParam(params, 'base', base);
  appendPermissions(params, perm);
  appendParam(params, 'txid', txid);
  appendParam(params, 'start', start);
  appendParam(params, 'pageLength', pageLength);
  appendParam(params, 'q', q);
  appendParam(params, 'structuredQuery', structuredQuery);
  appendParam(params, 'options', options);
  appendParam(params, 'collection', collection);
  appendParam(params, 'directory', directory);
  appendParam(params, 'ruleset', ruleset);
  appendParam(params, 'default-rulesets', defaultRulesets);
  appendParam(params, 'optimize', optimize);
  appendBindings(params, bind);
  appendParam(params, 'timestamp', timestamp);
  return params;
}

// Runs a SPARQL query or update via POST, the form encoding this endpoint's
// W3C SPARQL Protocol binding requires. `params` may be a bare SPARQL query
// string (shorthand for { query }), or an object accepting any parameter
// documented for this endpoint, e.g. { query, defaultGraphUri, namedGraphUri,
// pageLength, bind, perm } for a query, or { update, usingGraphUri,
// usingNamedGraphUri } for a SPARQL Update. `accept` overrides the response
// MIME type (default application/json / application/sparql-results+json).
function sparqlQuery(params, username, password, accept) {
  const body = buildParams(typeof params === 'string' ? { query: params } : params).toString();
  return restClient.request('POST', PATH, body, username, password, 'application/x-www-form-urlencoded', accept);
}

// Runs a read-only SPARQL query via GET. Only the query/dataset/search/paging
// parameters apply — this endpoint has no GET form for SPARQL Update.
function sparqlQueryGet(params, username, password, accept) {
  const { update, usingGraphUri, usingNamedGraphUri, ...rest } = typeof params === 'string' ? { query: params } : (params || {});
  if (update != null || usingGraphUri != null || usingNamedGraphUri != null) {
    throw new Error('SPARQL Update is not supported via GET /v1/graphs/sparql');
  }
  const search = buildParams(rest).toString();
  return restClient.request('GET', `${PATH}?${search}`, null, username, password, undefined, accept);
}

module.exports = { sparqlQuery, sparqlQueryGet };
