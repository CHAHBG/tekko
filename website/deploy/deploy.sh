#!/usr/bin/env bash
# =============================================================================
# CardTap — Hetzner CAX11 ARM64 (Ubuntu 22.04) full setup script
# Run as root: bash deploy.sh
# Server: 178.104.176.213
# =============================================================================
set -euo pipefail

APP_DIR="/opt/cardtap"
APP_USER="cardtap"
REPO_URL="https://github.com/your-org/cardtap.git"   # ← update this
NODE_VERSION="20"

echo "==> [1/8] System update"
apt-get update -qq && apt-get upgrade -y -qq

echo "==> [2/8] Install Node.js ${NODE_VERSION} (ARM64-safe via NodeSource)"
curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
apt-get install -y nodejs

echo "==> [3/8] Install Nginx, Certbot, SQLite3, Git"
apt-get install -y nginx certbot python3-certbot-nginx sqlite3 git

echo "==> [4/8] Create app user and directory"
id -u "$APP_USER" &>/dev/null || useradd --system --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> [5/8] Clone or pull repository"
if [[ -d "$APP_DIR/.git" ]]; then
    git -C "$APP_DIR" pull --rebase
else
    git clone "$REPO_URL" "$APP_DIR"
fi

echo "==> [6/8] Install npm dependencies and build frontend"
cd "$APP_DIR/website"
npm ci --omit=dev --ignore-scripts   # omit devDeps; safer for production
npm ci                               # full install for the build step
npm run build                        # Vite builds dist/
npm prune --production               # remove devDeps after build

# Create persistent directories owned by app user
mkdir -p data uploads
chown -R "$APP_USER:$APP_USER" data uploads "$APP_DIR"

echo "==> [7/8] Install systemd service"
cp "$APP_DIR/website/deploy/cardtap.service" /etc/systemd/system/cardtap.service
systemctl daemon-reload
systemctl enable cardtap
systemctl restart cardtap
echo "CardTap service status:"
systemctl status cardtap --no-pager

echo "==> [8/8] Install Nginx config and open firewall"
cp "$APP_DIR/website/deploy/nginx.conf" /etc/nginx/sites-available/cardtap
ln -sf /etc/nginx/sites-available/cardtap /etc/nginx/sites-enabled/cardtap
rm -f /etc/nginx/sites-enabled/default   # remove default site
nginx -t && systemctl reload nginx

# UFW firewall rules
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo ""
echo "============================================================"
echo " CardTap deployed successfully!"
echo " ► HTTP:  http://178.104.176.213"
echo " ► Admin: http://178.104.176.213/admin"
echo " ► API:   http://178.104.176.213/api/health"
echo ""
echo " NEXT STEPS:"
echo " 1. Copy .env.example to .env and fill in credentials:"
echo "    cp $APP_DIR/website/.env.example $APP_DIR/website/.env"
echo "    nano $APP_DIR/website/.env"
echo "    systemctl restart cardtap"
echo ""
echo " 2. (Optional) Add domain + HTTPS:"
echo "    certbot --nginx -d your-domain.com"
echo "    Then update CINETPAY_NOTIFY_URL and BASE_URL in .env"
echo "============================================================"
