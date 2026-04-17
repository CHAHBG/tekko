# Hetzner CAX11 ARM64 — Deployment Guide

## Server specs
- **Model**: CAX11 (ARM64, 2 vCPU, 4 GB RAM, 40 GB SSD, 4.49 €/mo)
- **IP**: `178.104.176.213`
- **OS**: Ubuntu 22.04 LTS (ARM64)
- **Stack**: Node.js 20, Express, SQLite, Nginx

---

## First deploy (fresh server)

```bash
# 1. SSH into your server
ssh root@178.104.176.213

# 2. Upload the project (from your Mac)
scp -r /Users/user/Desktop/Applications/CardTap/website root@178.104.176.213:/opt/cardtap/

# 3. Run the setup script
bash /opt/cardtap/website/deploy/deploy.sh
```

---

## Configure environment variables

```bash
cp /opt/cardtap/website/.env.example /opt/cardtap/website/.env
nano /opt/cardtap/website/.env
```

Fill in:

| Variable | Description |
|---|---|
| `CINETPAY_API_KEY` | From CinetPay merchant dashboard |
| `CINETPAY_SITE_ID` | From CinetPay merchant dashboard |
| `CINETPAY_NOTIFY_URL` | `http://178.104.176.213/api/payments/notify` (HTTPS required for production) |
| `CINETPAY_RETURN_URL` | `http://178.104.176.213/` |
| `CINETPAY_CANCEL_URL` | `http://178.104.176.213/` |
| `ADMIN_DASHBOARD_TOKEN` | A long random secret — generate with `openssl rand -hex 32` |
| `BASE_URL` | `http://178.104.176.213` |
| `PORT` | `4000` |

After editing `.env`:

```bash
systemctl restart cardtap
curl http://178.104.176.213/api/health
# → {"ok":true,"paymentConfigured":true,"adminConfigured":true}
```

---

## Redeploy after code changes (from your Mac)

```bash
# Build frontend locally first
cd /Users/user/Desktop/Applications/CardTap/website
npm run build

# Sync changes to server (fast, only changed files)
rsync -avz --exclude 'node_modules' --exclude '.env' --exclude 'data' --exclude 'uploads' \
  /Users/user/Desktop/Applications/CardTap/website/ \
  root@178.104.176.213:/opt/cardtap/website/

# Restart server (if server code changed)
ssh root@178.104.176.213 "cd /opt/cardtap/website && npm ci --production && systemctl restart cardtap"
```

---

## Useful server commands

```bash
# Check server status
systemctl status cardtap

# View live logs
journalctl -u cardtap -f

# Restart after config change
systemctl restart cardtap

# Check database
sqlite3 /opt/cardtap/website/data/cardtap.db "SELECT order_id, created_at FROM orders ORDER BY created_at DESC LIMIT 10;"

# Nginx reload after config change
nginx -t && systemctl reload nginx
```

---

## Optional: Add HTTPS with Certbot

You need a domain pointing to `178.104.176.213` first (DNS A record).

```bash
certbot --nginx -d cardtap.yourdomain.com
```

Then update `.env`:
```
BASE_URL=https://cardtap.yourdomain.com
CINETPAY_NOTIFY_URL=https://cardtap.yourdomain.com/api/payments/notify
CINETPAY_RETURN_URL=https://cardtap.yourdomain.com/
CINETPAY_CANCEL_URL=https://cardtap.yourdomain.com/
```

And update `nginx.conf` to enable the HTTPS block (uncomment it).

```bash
systemctl restart cardtap && nginx -t && systemctl reload nginx
```

---

## Sub-domain setup per customer (GeoChifa strategy)

Add a DNS wildcard `*.geochifa.com → 178.104.176.213`.

Then in Nginx, add a wildcard `server_name *.geochifa.com;` block that proxies to port 4000 — the Express router already serves `/cards/:slug` which maps to each card.

For enterprise customers who want their own domain (ex: `cartes.entreprise.sn`):
1. Ask them to add a CNAME `cartes.entreprise.sn → 178.104.176.213`
2. Add one `server { server_name cartes.entreprise.sn; ... }` block to Nginx
3. Run `certbot --nginx -d cartes.entreprise.sn` for their SSL cert

Each additional domain: ~10 minutes, bill 10 000 FCFA/an.

---

## Security checklist

- [ ] `ADMIN_DASHBOARD_TOKEN` is a long random secret (not the default `cardtap-admin-local`)
- [ ] `/admin` route is NOT linked from the customer-facing builder (already removed)
- [ ] Firewall allows only ports 22, 80, 443 (UFW configured by `deploy.sh`)
- [ ] HTTPS enabled before going live (CinetPay requires HTTPS for webhook URL)
- [ ] `.env` file is never committed to git (already in `.gitignore`)
