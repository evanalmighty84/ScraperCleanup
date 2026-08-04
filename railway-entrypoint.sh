#!/usr/bin/env bash
set -euo pipefail

exec xvfb-run \
  -a \
  -s "-screen 0 1920x1080x24 -ac +extension RANDR" \
  node cleanupPendingLeads.js
