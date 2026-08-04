#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo "Starting ScraperCleanup entrypoint"
echo "Node: $(command -v node)"
echo "Xvfb: $(command -v Xvfb)"
echo "xvfb-run: $(command -v xvfb-run)"
echo "xauth: $(command -v xauth)"
echo "Working directory: $(pwd)"
echo "Files:"
ls -la
echo "============================================================"

exec xvfb-run \
  -a \
  -e /dev/stderr \
  -s "-screen 0 1920x1080x24 -ac +extension RANDR" \
  node cleanupPendingLeads.js