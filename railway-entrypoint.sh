#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo "Starting ScraperCleanup entrypoint"
echo "Node: $(command -v node)"
echo "Xvfb: $(command -v Xvfb)"
echo "Working directory: $(pwd)"
echo "============================================================"

export DISPLAY=:99

rm -f /tmp/.X99-lock
rm -f /tmp/.X11-unix/X99

echo "Starting Xvfb on ${DISPLAY}..."

Xvfb "${DISPLAY}" \
  -screen 0 1920x1080x24 \
  -ac \
  +extension RANDR \
  -nolisten tcp \
  >/tmp/xvfb.log 2>&1 &

XVFB_PID=$!

cleanup() {
  if kill -0 "$XVFB_PID" 2>/dev/null; then
    kill "$XVFB_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

for attempt in $(seq 1 30); do
  if [ -S /tmp/.X11-unix/X99 ]; then
    echo "Xvfb is ready on ${DISPLAY}."
    break
  fi

  if ! kill -0 "$XVFB_PID" 2>/dev/null; then
    echo "Xvfb exited unexpectedly:"
    cat /tmp/xvfb.log || true
    exit 1
  fi

  if [ "$attempt" -eq 30 ]; then
    echo "Timed out waiting for Xvfb."
    cat /tmp/xvfb.log || true
    exit 1
  fi

  sleep 0.25
done

echo "Starting FTN cleanup enrichment..."

exec node cleanupPendingLeads.js