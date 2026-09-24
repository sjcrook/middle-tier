#!/bin/bash
# Stop the Middle Tier server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$MT_DIR/mt.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "Middle Tier is not running (no PID file found)"
    exit 0
fi

PID=$(cat "$PID_FILE")
echo "Stopping Middle Tier (PID: $PID)..."

if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null
    sleep 1
    # Force kill if still running
    if kill -0 "$PID" 2>/dev/null; then
        kill -9 "$PID" 2>/dev/null
    fi
    echo "Middle Tier stopped"
else
    echo "Process $PID not found, cleaning up PID file"
fi

rm -f "$PID_FILE"
