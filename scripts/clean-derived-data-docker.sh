#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

printf '[clean-derived] Running cleanup inside api image...\n'
docker compose run --rm api node scripts/clean-derived-data.js --yes
