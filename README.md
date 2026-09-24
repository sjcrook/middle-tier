# middle-tier

A minimal, dependency-free Node.js HTTP/HTTPS middle tier — routing,
session-based auth, static file serving, and a generic MarkLogic REST client —
reusable across projects via a plugin architecture.

## What this is (and isn't)

`src/core` is the reusable framework: HTTP + HTTPS listeners, request routing,
session auth, static file serving, and generic MarkLogic REST wrappers (HTTP
Digest auth, SPARQL query/update). It has **no business logic**, and it is
never edited by a consuming project — it's vendored in and treated as
read-only.

Business/use-case logic lives in **plugins**, which live in the *consuming*
project, not here. Core never requires anything from a plugin; plugins are
injected via `start({ plugins })`.

## Architecture

```
consuming-project/
├── vendor/middle-tier/       <- this repo, vendored in, read-only
│   ├── src/core/             <- routing, auth, config, static files, marklogic client
│   └── test/core/            <- this repo's own tests (not needed by consumers)└── middle-tier/              <- host-owned: composition root + plugins
    ├── bin/start.sh, stop.sh
    ├── certs/
    └── src/
        ├── server.js          <- requires vendor/middle-tier/src/core/server + plugins.config
        ├── plugins.config.js  <- lists enabled plugins
        └── plugins/<name>/    <- your app-specific routes and logic
```

The composition root (`middle-tier/src/server.js` in the consuming project) is
the only file that bridges the two trees. This split is what makes core safely
reusable: it never assumes anything about where it lives in a project, and it
never discovers or requires plugin code on its own.

## Quick start in a new project

1. Vendor this repo into `vendor/middle-tier` (plain copy or git submodule —
   your call).
2. Scaffold the host-owned side:
   ```bash
   vendor/middle-tier/template/create-scaffold-app.sh
   ```
   This creates `./middle-tier/` with a working `server.js`,
   `plugins.config.js`, `bin/start.sh` / `bin/stop.sh`, and the local endpoint
   resolver described below. Pass a different path as the first argument to
   scaffold somewhere other than `./middle-tier`; pass `--force` to overwrite
   an existing directory.
3. Write your first plugin under `middle-tier/src/plugins/<name>/`, exporting
   a manifest: `{ name, routes: [{ method, path, handler }] }`.
4. Add it to `middle-tier/src/plugins.config.js`.
5. `bash middle-tier/bin/start.sh`

## Configuration

Core resolves TLS certs and the static UI root relative to the process's
working directory — `bin/start.sh` `cd`s into the app's `middle-tier/` folder
before launching `node`, so core never has to assume anything about where it
sits relative to the rest of the project. Override any of these with env vars:

| Variable | Default |
|---|---|
| `MT_HTTP_PORT` | `3001` |
| `MT_HTTPS_PORT` | `3443` |
| `MT_TLS_KEY_FILE` | `<cwd>/certs/server.key` |
| `MT_TLS_CERT_FILE` | `<cwd>/certs/server.crt` |
| `MT_STATIC_ROOT` | `<cwd>/../ui/dist` |
| `ML_HOST` / `ML_PORT` / `ML_MANAGE_PORT` / `ML_PROTOCOL` | `localhost` / `8103` / `8102` / `http` |
| `MT_DEBUG_MARKLOGIC_REQUESTS` | off |

## Adding a generic MarkLogic endpoint without waiting on this repo

A consuming project can stage a new generic endpoint locally at
`middle-tier/src/core/marklogic/endpoints/<name>.js` and resolve it through
`middle-tier/src/core/marklogic/endpoints/index.js`'s `endpoint(name)` helper
(included in the scaffold). It checks the local copy first, then falls back
to this repo's `src/core/marklogic/endpoints/`. A name present in both places
resolves to the local copy and logs a warning — that's the signal to finish
upstreaming it here and delete the local copy. Call sites never change either
way.

This only applies to `marklogic/endpoints/` — leaf, additive, side-effect-free
REST wrappers. It doesn't extend to `router.js` / `auth.js` / `server.js`;
changes to shared request/routing/auth behavior belong here, upstreamed
properly, since every plugin in every consuming project depends on them.

## Tests

```bash
node --test test/core/*.test.js
```
