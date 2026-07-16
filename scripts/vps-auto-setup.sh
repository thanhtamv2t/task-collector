#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

DEPLOY_DOMAIN="${DEPLOY_DOMAIN:-task.orokucode.com}"
DEPLOY_EMAIL="${LETSENCRYPT_EMAIL:-${DEPLOY_EMAIL:-}}"
WEB_ROOT="/var/www/${DEPLOY_DOMAIN}"
NGINX_SITE_NAME="telegram-task-reporter"

log() {
  printf '\n[vps-setup] %s\n' "$1"
}

fail() {
  printf '[vps-setup] %s\n' "$1" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Missing required command: $1"
  fi
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

compose() {
  docker compose "$@"
}

set_env_value() {
  KEY="$1"
  VALUE="$2"
  TMP_FILE=".env.tmp"

  if grep -q "^${KEY}=" .env; then
    awk -v key="$KEY" -v value="$VALUE" 'BEGIN { FS=OFS="=" } $1 == key { print key, value; next } { print }' .env > "$TMP_FILE"
    mv "$TMP_FILE" .env
  else
    printf '%s=%s\n' "$KEY" "$VALUE" >> .env
  fi
}

get_env_value() {
  KEY="$1"
  grep "^${KEY}=" .env | tail -n 1 | cut -d '=' -f 2-
}

random_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    date +%s | sha256sum | cut -c "1-$(( "$1" * 2 ))"
  fi
}

install_package() {
  PACKAGE="$1"
  if command -v apt-get >/dev/null 2>&1; then
    run_as_root apt-get update
    run_as_root apt-get install -y "$PACKAGE"
  elif command -v apk >/dev/null 2>&1; then
    run_as_root apk add --no-cache "$PACKAGE"
  else
    fail "Package '$PACKAGE' is missing. Install it manually, then re-run this script."
  fi
}

ensure_node_atomic_runtime() {
  NODE_BIN="$(command -v node 2>/dev/null || true)"
  if [ -z "$NODE_BIN" ] || ! command -v ldd >/dev/null 2>&1; then
    return
  fi

  if ldd "$NODE_BIN" 2>/dev/null | grep -q 'libatomic.*not found'; then
    log "Installing libatomic for the host Node.js runtime"
    if command -v apt-get >/dev/null 2>&1; then
      install_package libatomic1
    else
      install_package libatomic
    fi
  fi
}

ensure_command() {
  COMMAND="$1"
  PACKAGE="$2"
  if ! command -v "$COMMAND" >/dev/null 2>&1; then
    log "Installing $PACKAGE"
    install_package "$PACKAGE"
  fi
}

restart_nginx() {
  if command -v systemctl >/dev/null 2>&1; then
    run_as_root systemctl enable --now nginx
    run_as_root systemctl reload nginx
  else
    run_as_root service nginx restart
  fi
}

require_env_values() {
  MISSING=""

  for KEY in TELEGRAM_BOT_TOKEN ADMIN_TELEGRAM_USER_IDS OPENROUTER_API_KEY OPENROUTER_MODEL GITHUB_OAUTH_CLIENT_ID GITHUB_OAUTH_CLIENT_SECRET; do
    if [ -z "$(get_env_value "$KEY")" ]; then
      MISSING="${MISSING}
- ${KEY}"
    fi
  done

  if [ -z "$(get_env_value GITHUB_ADMIN_LOGIN)" ] && [ -z "$(get_env_value GITHUB_ADMIN_ID)" ]; then
    MISSING="${MISSING}
- GITHUB_ADMIN_LOGIN or GITHUB_ADMIN_ID"
  fi

  if [ -z "$DEPLOY_EMAIL" ]; then
    MISSING="${MISSING}
- LETSENCRYPT_EMAIL"
  fi

  if [ -n "$MISSING" ]; then
    printf '\n[vps-setup] Missing required environment values:\n%s\n\n' "$MISSING" >&2
    printf 'Fill them in .env or export LETSENCRYPT_EMAIL before running again.\n' >&2
    printf 'GitHub OAuth callback URL must be: https://%s/auth/github/callback\n' "$DEPLOY_DOMAIN" >&2
    exit 1
  fi
}

install_dashboard_dependencies() {
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

write_nginx_config() {
  TMP_FILE="$(mktemp)"
  cat > "$TMP_FILE" <<EOF
server {
  listen 80;
  server_name ${DEPLOY_DOMAIN};

  root ${WEB_ROOT};
  index index.html;

  client_max_body_size 2m;

  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }

  location /auth/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /internal/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /webhooks/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /health {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}
EOF

  if [ -d /etc/nginx/sites-available ] && [ -d /etc/nginx/sites-enabled ]; then
    run_as_root cp "$TMP_FILE" "/etc/nginx/sites-available/${NGINX_SITE_NAME}"
    run_as_root ln -sf "/etc/nginx/sites-available/${NGINX_SITE_NAME}" "/etc/nginx/sites-enabled/${NGINX_SITE_NAME}"
  else
    run_as_root cp "$TMP_FILE" "/etc/nginx/conf.d/${NGINX_SITE_NAME}.conf"
  fi

  rm -f "$TMP_FILE"
}

log "Checking VPS tooling"
require_command docker
ensure_node_atomic_runtime

if ! docker compose version >/dev/null 2>&1; then
  fail "Docker is installed, but docker compose is not available."
fi

if [ ! -f .env ]; then
  log "Creating .env from .env.example"
  cp .env.example .env
fi

if [ -z "$DEPLOY_EMAIL" ]; then
  DEPLOY_EMAIL="$(get_env_value LETSENCRYPT_EMAIL)"
fi

set_env_value NODE_ENV production
set_env_value DASHBOARD_URL "https://${DEPLOY_DOMAIN}"
set_env_value TELEGRAM_WEBHOOK_URL "https://${DEPLOY_DOMAIN}/webhooks/telegram"
set_env_value GITHUB_OAUTH_CALLBACK_URL "https://${DEPLOY_DOMAIN}/auth/github/callback"

if [ -z "$(get_env_value POSTGRES_PASSWORD)" ] || [ "$(get_env_value POSTGRES_PASSWORD)" = "password" ]; then
  log "Generating POSTGRES_PASSWORD"
  POSTGRES_PASSWORD="$(random_hex 24)"
  set_env_value POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
  set_env_value DATABASE_URL "postgresql://telegram_reporter:${POSTGRES_PASSWORD}@localhost:5432/telegram_reporter"
fi

if [ -z "$(get_env_value TELEGRAM_WEBHOOK_SECRET)" ]; then
  log "Generating TELEGRAM_WEBHOOK_SECRET"
  set_env_value TELEGRAM_WEBHOOK_SECRET "$(random_hex 32)"
fi

if [ -z "$(get_env_value INTERNAL_ADMIN_TOKEN)" ]; then
  log "Generating INTERNAL_ADMIN_TOKEN"
  set_env_value INTERNAL_ADMIN_TOKEN "$(random_hex 32)"
fi

if [ -z "$(get_env_value AUTH_SESSION_SECRET)" ]; then
  log "Generating AUTH_SESSION_SECRET"
  set_env_value AUTH_SESSION_SECRET "$(random_hex 32)"
fi

require_env_values

ensure_command nginx nginx
ensure_command certbot certbot
if ! certbot plugins 2>/dev/null | grep -q 'nginx'; then
  log "Installing python3-certbot-nginx"
  install_package python3-certbot-nginx
fi

install_dashboard_dependencies

log "Building dashboard"
pnpm --dir dashboard install --frozen-lockfile
pnpm --dir dashboard build
run_as_root mkdir -p "$WEB_ROOT"
run_as_root cp -R dashboard/dist/. "$WEB_ROOT/"

log "Building containers"
compose build

log "Starting PostgreSQL"
compose up -d postgres

log "Waiting for PostgreSQL healthcheck"
POSTGRES_CONTAINER="$(compose ps -q postgres)"
i=0
STATUS="unknown"
while [ "$i" -lt 60 ]; do
  STATUS="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' "$POSTGRES_CONTAINER")"
  if [ "$STATUS" = "healthy" ]; then
    break
  fi
  i=$((i + 1))
  sleep 2
done

if [ "$STATUS" != "healthy" ]; then
  printf '[vps-setup] PostgreSQL did not become healthy. Current status: %s\n' "$STATUS" >&2
  compose logs postgres
  exit 1
fi

log "Running database migrations inside app image"
compose run --rm api npm run db:migrate

log "Starting API and worker"
compose up -d api worker

log "Configuring Nginx"
run_as_root mkdir -p /var/www/certbot
write_nginx_config
run_as_root nginx -t
restart_nginx

log "Requesting/renewing SSL certificate"
run_as_root certbot --nginx -d "$DEPLOY_DOMAIN" --non-interactive --agree-tos --email "$DEPLOY_EMAIL" --redirect

log "Current service status"
compose ps

printf '\n[vps-setup] Done.\n'
printf 'Dashboard: https://%s\n' "$DEPLOY_DOMAIN"
printf 'GitHub OAuth callback: https://%s/auth/github/callback\n' "$DEPLOY_DOMAIN"
printf 'Telegram webhook URL: https://%s/webhooks/telegram\n' "$DEPLOY_DOMAIN"
