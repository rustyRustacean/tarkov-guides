#!/usr/bin/env bash
# Stops whatever is listening on the app's port (a previous `npm run start`),
# rebuilds, then starts the production server fresh. Linux/macOS counterpart
# to restart.ps1 (Windows/PowerShell) - same behavior, POSIX tools instead.
#
# Usage: npm run restart:linux   (or: ./restart.sh)

set -euo pipefail

PORT=3000

echo "Stopping any process on port $PORT..."
PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
if [ -n "$PIDS" ]; then
  echo "  Killing PID(s): $PIDS"
  kill -9 $PIDS
  sleep 1
else
  echo "  Nothing listening on port $PORT."
fi

echo "Building..."
npm run build

echo "Starting..."
npm run start
