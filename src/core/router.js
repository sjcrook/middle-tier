// URL Router
// Pattern matching with parameter extraction, method routing

class Router {
  constructor() {
    this.routes = [];
  }

  // Register a route: method, pattern, handler
  // Pattern can include :param segments
  on(method, pattern, handler) {
    // Convert pattern to regex with named capture groups
    const paramNames = [];
    const regexStr = pattern.replace(/:([a-zA-Z_]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const regex = new RegExp(`^${regexStr}$`);
    this.routes.push({ method: method.toUpperCase(), regex, paramNames, handler });
  }

  // Convenience methods
  get(pattern, handler) { this.on('GET', pattern, handler); }
  post(pattern, handler) { this.on('POST', pattern, handler); }
  put(pattern, handler) { this.on('PUT', pattern, handler); }
  patch(pattern, handler) { this.on('PATCH', pattern, handler); }
  delete(pattern, handler) { this.on('DELETE', pattern, handler); }

  // Resolve a request to a handler
  resolve(method, url) {
    // Parse URL path (strip query string)
    const path = url.split('?')[0];

    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) continue;
      const match = path.match(route.regex);
      if (match) {
        // Extract named parameters
        const params = {};
        route.paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });
        return { handler: route.handler, params };
      }
    }
    return null;
  }
}

module.exports = Router;
