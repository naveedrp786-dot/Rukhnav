#!/usr/bin/env bash
set -euo pipefail

APP_USER="${APP_USER:-rukhnav}"
APP_GROUP="${APP_GROUP:-$APP_USER}"

UPLOAD_BASE="${UPLOAD_BASE:-/data/rukhnav}"
UPLOAD_ROOT="${UPLOAD_ROOT:-$UPLOAD_BASE/uploads}"
LOG_ROOT="${LOG_ROOT:-/var/log/rukhnav}"

echo "========================================"
echo "RUKHNAV SERVER DIRECTORY BOOTSTRAP"
echo "========================================"
echo "App user:     $APP_USER"
echo "Upload root:  $UPLOAD_ROOT"
echo "Log root:     $LOG_ROOT"
echo "========================================"

if [[ "$EUID" -ne 0 ]]; then
    echo "Run this script with sudo/root on the production Linux server."
    exit 1
fi

if ! id "$APP_USER" >/dev/null 2>&1; then
    echo "Creating system user: $APP_USER"
    useradd \
        --system \
        --create-home \
        --shell /usr/sbin/nologin \
        "$APP_USER"
fi

mkdir -p \
    "$UPLOAD_ROOT/products" \
    "$UPLOAD_ROOT/categories" \
    "$UPLOAD_ROOT/admins" \
    "$UPLOAD_ROOT/profiles" \
    "$UPLOAD_ROOT/reviews" \
    "$UPLOAD_ROOT/website" \
    "$LOG_ROOT"

chown -R \
    "$APP_USER:$APP_GROUP" \
    "$UPLOAD_BASE" \
    "$LOG_ROOT"

chmod 750 \
    "$UPLOAD_BASE" \
    "$UPLOAD_ROOT" \
    "$LOG_ROOT"

find "$UPLOAD_ROOT" \
    -type d \
    -exec chmod 750 {} \;

echo "========================================"
echo "Persistent directories are ready."
echo "Set production:"
echo "UPLOAD_ROOT=$UPLOAD_ROOT"
echo "========================================"
