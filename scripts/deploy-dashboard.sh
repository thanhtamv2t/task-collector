#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

DEPLOY_DOMAIN="${DEPLOY_DOMAIN:-task.orokucode.com}"
WEB_ROOT="${WEB_ROOT:-/var/www/${DEPLOY_DOMAIN}}"

log() {
  printf '\n[dashboard-deploy] %s\n' "$1"
}

fail() {
  printf '[dashboard-deploy] %s\n' "$1" >&2
  exit 1
}

run_as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    fail "This step needs root privileges. Re-run as root or install sudo."
  fi
}

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    return
  fi

  if command -v corepack >/dev/null 2>&1; then
    log "Enabling pnpm through corepack"
    corepack enable
    corepack prepare pnpm@latest --activate
    return
  fi

  fail "pnpm is required to build the dashboard. Install pnpm or Node.js with corepack, then re-run."
}

reload_nginx_if_available() {
  if ! command -v nginx >/dev/null 2>&1; then
    log "Nginx command not found; copied files without reload"
    return
  fi

  run_as_root nginx -t

  if command -v systemctl >/dev/null 2>&1; then
    run_as_root systemctl reload nginx
  else
    run_as_root service nginx reload
  fi
}

ensure_pnpm

log "Building dashboard"
pnpm --dir dashboard install --frozen-lockfile
pnpm --dir dashboard build

log "Publishing dashboard to ${WEB_ROOT}"
run_as_root mkdir -p "$WEB_ROOT"
run_as_root cp -R dashboard/dist/. "$WEB_ROOT/"

log "Reloading Nginx"
reload_nginx_if_available

printf '\n[dashboard-deploy] Done: https://%s\n' "$DEPLOY_DOMAIN"
