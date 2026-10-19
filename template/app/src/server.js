// Middle Tier entry point — composition root.
// Core lives in external/middle-tier/src/core — an external dependency, never
// edited in place. Enabled use-case plugins are listed in src/plugins.config.js.

const { start } = require('../../external/middle-tier/src/core/server');
const plugins = require('./plugins.config');

module.exports = start({ plugins });
