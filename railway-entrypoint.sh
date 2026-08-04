#!/usr/bin/env bash
set -euo pipefail

export DISPLAY="${DISPLAY:-:99}"

Xvfb "$DISPLAY" -screen 0 1920x1080x24 -ac +extension RANDR >/tmp/xvfb.log 2>&1 &
XVFB_PID=$!

cleanup() {
  kill "$XVFB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 1
exec node cleanupPendingLeads.js
