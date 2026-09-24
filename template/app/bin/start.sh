#!/bin/bash
# Start the Middle Tier server
# Usage: ./start.sh [--daemon] [--port PORT]
#
# ML_HOST is auto-detected: host.docker.internal inside the dev container,
# localhost otherwise. Override on the command line if needed:
#   ML_HOST=localhost bash bin/start.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
    echo "Loading environment from $ENV_FILE"
    set -a
    . "$ENV_FILE"
    set +a
else
    echo "No environment file found at $ENV_FILE; using script defaults"
fi

# MarkLogic - auto-detect dev container vs host so .env doesn't need edits
if [ -z "$ML_HOST" ]; then
    if [ -f /.dockerenv ] || grep -qa docker /proc/1/cgroup 2>/dev/null; then
        ML_HOST="host.docker.internal"
    else
        ML_HOST="localhost"
    fi
fi
export ML_HOST

echo "Using ML_HOST=$ML_HOST"

MT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$MT_DIR/mt.pid"
LOG_FILE="$MT_DIR/mt.log"
SERVER_JS="$MT_DIR/src/server.js"

# Core (vendor/middle-tier) resolves cert and static paths relative to the
# working directory, so pin it to this app's own middle-tier/ folder here.
cd "$MT_DIR"

# Default port
PORT=${2:-3001}

cleanup_stale_middle_tier() {
    local pid="$1"
    if [ -z "$pid" ]; then
        return 0
    fi

    if kill -0 "$pid" 2>/dev/null; then
        echo "Stopping stale Middle Tier process (PID: $pid)"
        kill "$pid" 2>/dev/null || true
        sleep 1
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
        fi
    fi

    rm -f "$PID_FILE"
}

check_port_for_stale_server() {
    if command -v lsof >/dev/null 2>&1; then
        local pid
        pid=$(lsof -ti "tcp:$PORT" 2>/dev/null | head -n 1 || true)
        if [ -n "$pid" ]; then
            local cmd
            cmd=$(ps -p "$pid" -o args= 2>/dev/null || true)
            if [[ "$cmd" == *"$SERVER_JS"* ]]; then
                cleanup_stale_middle_tier "$pid"
                return 0
            fi

            echo "Port $PORT is already in use by PID $pid: $cmd" >&2
            echo "Refusing to stop an unrelated process. Please free the port or change the configured port." >&2
            exit 1
        fi
    fi

    local stale_pid
    stale_pid=$(pgrep -af "node .*src/server.js" | awk '{print $1}' | head -n 1 || true)
    if [ -n "$stale_pid" ]; then
        cleanup_stale_middle_tier "$stale_pid"
    fi
}

# Check if already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "Middle Tier is already running (PID: $PID). Restarting it..."
        cleanup_stale_middle_tier "$PID"
    else
        rm -f "$PID_FILE"
    fi
fi

check_port_for_stale_server

# Generate self-signed certs if they don't exist
CERT_DIR="$MT_DIR/certs"
if [ ! -f "$CERT_DIR/server.key" ] || [ ! -f "$CERT_DIR/server.crt" ]; then
    echo "Generating self-signed certificates..."
    mkdir -p "$CERT_DIR"
    openssl req -x509 -newkey rsa:2048 -keyout "$CERT_DIR/server.key" \
        -out "$CERT_DIR/server.crt" -days 365 -nodes \
        -subj '/CN=localhost' 2>/dev/null
    echo "Certificates generated at $CERT_DIR"
fi

# Start the server
if [ "$1" = "--daemon" ]; then
    echo "Starting Middle Tier in daemon mode..."
    nohup node "$SERVER_JS" >> "$LOG_FILE" 2>&1 &
    PID=$!
    echo $PID > "$PID_FILE"
    echo "Middle Tier started (PID: $PID). Log: $LOG_FILE"
    echo "The process is running in the background; this command will return immediately."
else
    echo "Starting Middle Tier in foreground..."
    echo "This process is expected to stay running until you stop it with Ctrl+C."
    node "$SERVER_JS"
fi
