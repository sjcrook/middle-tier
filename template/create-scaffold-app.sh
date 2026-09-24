#!/bin/bash
# Scaffolds a host-owned middle-tier/ directory (composition root + plugins)
# in a project that vendors this repo.
# Usage: vendor/middle-tier/template/create-scaffold-app.sh [target] [--force]
# Run from the consuming project's repo root; target defaults to ./middle-tier.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/app"

TARGET="middle-tier"
FORCE=0
for arg in "$@"; do
    if [ "$arg" = "--force" ]; then
        FORCE=1
    else
        TARGET="$arg"
    fi
done

if [ -e "$TARGET" ] && [ "$FORCE" -ne 1 ]; then
    echo "Refusing to overwrite existing '$TARGET' (pass --force to proceed)." >&2
    exit 1
fi

mkdir -p "$TARGET"
cp -R "$TEMPLATE_DIR/." "$TARGET/"
chmod +x "$TARGET/bin/start.sh" "$TARGET/bin/stop.sh"

echo "Scaffolded a middle-tier app at '$TARGET'."
echo "Next steps:"
echo "  1. Write your first plugin under $TARGET/src/plugins/<name>/"
echo "  2. Add it to $TARGET/src/plugins.config.js"
echo "  3. Run $TARGET/bin/start.sh"
