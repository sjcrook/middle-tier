# middle-tier

Host-owned composition root and plugins for this project's middle tier.

This directory was scaffolded from [`vendor/middle-tier`](../vendor/middle-tier),
which holds the reusable, read-only framework (routing, session auth, static
file serving, generic MarkLogic REST client). Nothing under `vendor/` is
edited here — business/use-case logic lives in this directory instead.

```
middle-tier/
├── bin/start.sh, stop.sh
├── certs/
└── src/
    ├── server.js          <- requires vendor/middle-tier/src/core/server + plugins.config
    ├── plugins.config.js  <- lists enabled plugins
    └── plugins/<name>/    <- your app-specific routes and logic
```

## Usage

1. Write a plugin under `src/plugins/<name>/`, exporting a manifest:
   `{ name, routes: [{ method, path, handler }] }`.
2. Add it to `src/plugins.config.js`.
3. `bin/start.sh` (and `bin/stop.sh` to stop it).

See `vendor/middle-tier/README.md` for configuration env vars and other
details of the underlying framework.
