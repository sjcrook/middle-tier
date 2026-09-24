// Local staging area for MarkLogic REST endpoint wrappers.
//
// Add a same-named file in this directory to use a new generic endpoint
// immediately, without waiting on vendor/middle-tier to add it. Once it's
// been upstreamed to vendor/middle-tier/src/core/marklogic/endpoints/,
// delete the local copy here — call sites never change.
//
// A name present in both places resolves to the local copy and logs a
// warning: that's the signal to finish upstreaming and delete it.

const path = require('path');

const vendorDir = path.join(__dirname, '..', '..', '..', '..', '..', 'vendor', 'middle-tier', 'src', 'core', 'marklogic', 'endpoints');

function tryRequire(modulePath) {
  try {
    return require(modulePath);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') return null;
    throw err;
  }
}

function endpoint(name) {
  const local = tryRequire(path.join(__dirname, name));
  const vendor = tryRequire(path.join(vendorDir, name));

  if (local && vendor) {
    console.warn(`[middle-tier] endpoint "${name}" exists locally and in vendor/middle-tier; using the local copy. Upstream it and delete the local copy.`);
  }
  if (!local && !vendor) {
    throw new Error(`Unknown MarkLogic endpoint: ${name}`);
  }
  return local || vendor;
}

module.exports = { endpoint };
