// Middle Tier entry point — composition root.
// Core lives in vendor/middle-tier/src/core — a vendored dependency, never
// edited in place. Enabled use-case plugins are listed in src/plugins.config.js.

const { start } = require('../../vendor/middle-tier/src/core/server');
const plugins = require('./plugins.config');

module.exports = start({ plugins });
