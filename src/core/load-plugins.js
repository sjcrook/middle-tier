// Mounts a project plugin's declared routes onto the core router.
// A plugin manifest is { name, routes: [{ method, path, handler }] }.

function registerPlugins(router, plugins = []) {
  for (const plugin of plugins) {
    if (!plugin || !Array.isArray(plugin.routes)) {
      throw new Error(`Invalid plugin manifest: ${plugin && plugin.name ? plugin.name : plugin}`);
    }
    for (const route of plugin.routes) {
      const method = String(route.method || '').toLowerCase();
      if (typeof router[method] !== 'function') {
        throw new Error(`Plugin "${plugin.name}" declared an unsupported method: ${route.method}`);
      }
      router[method](route.path, route.handler);
    }
  }
}

module.exports = { registerPlugins };
