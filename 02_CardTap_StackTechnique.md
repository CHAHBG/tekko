# STACK TECHNIQUE CARDTAP
## Architecture Multi-Clients & Infrastructure Cloud

---

## 1. OVERVIEW ARCHITECTURE

CardTap repose sur une architecture **multi-tenant** où chaque client dispose de son propre sous-domaine (`client.geochifa.com`) tout en partageant l'infrastructure commune pour optimiser les coûts.

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Smartphone  │  │   Carte NFC  │  │  QR Code Scan   │  │
│  │  (iOS/Andro) │  │   (Tag NDEF) │  │  (Fallback)     │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼─────────────────┼──────────────────┼──────────┘
          │                 │                  │
          └─────────────────┴──────────────────┘
                            │
                    ┌───────▼────────┐
                    │   Cloudflare   │
                    │   (CDN/DNS)    │
                    └───────┬────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
    ┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │ Hetzner      │ │  Hetzner    │ │   Hetzner   │
    │ (Falkenstein)│ │  (Helsinki) │ │  (Nuremberg)│
    │  Primary     │ │  Backup     │ │  Future     │
    └───────┬──────┘ └─────────────┘ └─────────────┘
            │
    ┌───────┴───────────────────────────────┐
    │           VPS CardTap (CPX31)         │
    │  ┌─────────────────────────────────┐  │
    │  │          Nginx (Reverse Proxy)   │  │
    │  │     ┌──────────────────────┐   │  │
    │  │     │   Server Blocks      │   │  │
    │  │     │  *.geochifa.com      │   │  │
    │  │     └──────────────────────┘   │  │
    │  └─────────────────────────────────┘  │
    │  ┌─────────────────────────────────┐  │
    │  │      Application Node.js       │  │
    │  │   (Générateur de cartes)       │  │
    │  └─────────────────────────────────┘  │
    │  ┌─────────────────────────────────┐  │
    │  │      PostgreSQL (Analytics)     │  │
    │  │   ┌─────────┐ ┌──────────────┐  │  │
    │  │   │  Users  │ │  Page Views  │  │  │
    │  │   └─────────┘ └──────────────┘  │  │
    │  └─────────────────────────────────┘  │
    └───────────────────────────────────────┘
```

---

## 2. INFRASTRUCTURE CLOUD

### 2.1 Choix du Provider : Hetzner Cloud

**Pourquoi Hetzner ?**

| Critère | AWS | Hetzner | Avantage |
|---------|-----|---------|----------|
| **Coût 2vCPU/4GB** | 35€/mois | 7.59€/mois | **-78%** |
| **Coût 4vCPU/8GB** | 70€/mois | 14.49€/mois | **-79%** |
| **Bande passante** | Payante (cher) | 20TB inclus | **Économie massive** |
| **Localisation** | Afrique du Sud uniquement | Europe (latence acceptable) | GDPR compliant |
| **Complexité** | Élevée (100+ services) | Simple (VPS) | Maintenance réduite |

**Configuration recommandée pour CardTap** :

```yaml
Serveur: Hetzner Cloud CPX31
Specs:
  vCPU: 4 coeurs dédiés (AMD EPYC)
  RAM: 8 GB
  Stockage: 160 GB NVMe SSD
  Traffic: 20 TB/mois inclus
  Localisation: Falkenstein (Allemagne) ou Helsinki (Finlande)
Coût: ~14.49€/mois (~9 500 FCFA/mois)
Capacité: ~1000 cartes actives simultanées
```

**Alternative si croissance** :
- Scale vertical : CCX23 (4 vCPU dédiés, 16GB) : 38.35€/mois
- Scale horizontal : Load balancer Hetzner (5.99€/mois) + 2x CPX31

### 2.2 Architecture Multi-Sites (Sous-domaines)

Chaque client CardTap obtient une URL unique : `prenom-nom.geochifa.com`

**Méthode 1 : Wildcard DNS + Nginx Server Blocks** (Recommandé)

```nginx
# /etc/nginx/sites-available/geochifa-wildcard
server {
    listen 80;
    listen [::]:80;
    server_name *.geochifa.com;

    # Redirection HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name *.geochifa.com;

    # SSL Certificates (Let's Encrypt wildcard)
    ssl_certificate /etc/letsencrypt/live/geochifa.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/geochifa.com/privkey.pem;

    # Extraction du subdomain
    set $subdomain "";
    if ($host ~ ^([^.]+)\.geochifa\.com$) {
        set $subdomain $1;
    }

    # Root directory par client
    root /var/www/geochifa/clients/$subdomain;
    index index.html;

    # Gestion erreur si client inexistant
    if (!-d /var/www/geochifa/clients/$subdomain) {
        return 404 "Carte non trouvée";
    }

    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # Cache statique
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1M;
        add_header Cache-Control "public, immutable";
    }

    # Analytics endpoint
    location /api/track {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Structure des dossiers** :

```
/var/www/geochifa/
├── clients/                    # Sites clients statiques
│   ├── cheikh-gningue/        # cheikh-gningue.geochifa.com
│   │   ├── index.html         # Carte digitale personnalisée
│   │   ├── assets/
│   │   │   ├── logo.png
│   │   │   ├── photo.jpg
│   │   │   └── animation.js
│   │   └── vcard.vcf          # Contact téléchargeable
│   ├── fatima-diallo/
│   └── ... (autres clients)
├── templates/                  # Templates HTML de base
│   ├── starter/
│   └── pro/
├── admin/                      # Dashboard admin (protégé)
└── logs/                       # Logs d'accès
```

---

## 3. STACK APPLICATION

### 3.1 Frontend (Cartes Digitales)

**Technologies** :
- **HTML5** : Structure sémantique, meta tags Open Graph
- **CSS3** : Flexbox/Grid, animations, variables CSS pour thèmes
- **JavaScript vanilla** : Pas de framework lourd (performance)
- **Three.js** (option Pro) : Animation 3D légère (gzip ~100KB)
- **QRCode.js** : Génération QR côté client

**Optimisations performance** (crucial pour mobile 3G/4G au Sénégal) :

```html
<!-- Exemple structure HTML optimisée -->
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Preconnect pour accélérer chargement -->
    <link rel="preconnect" href="https://cdnjs.cloudflare.com">
    <link rel="preconnect" href="https://fonts.googleapis.com">

    <!-- Critical CSS inline -->
    <style>
        /* CSS critique pour premier rendu < 1s */
        body{margin:0;font-family:system-ui,sans-serif;background:#fff}
        .card{max-width:600px;margin:0 auto;padding:20px}
        /* ... */
    </style>

    <!-- Chargement différé CSS non-critique -->
    <link rel="preload" href="/assets/styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">

    <!-- Lazy loading images -->
    <img src="photo.jpg" loading="lazy" alt="Photo profil" width="200" height="200">
</head>
<body>
    <!-- Contenu -->
    <script defer src="/assets/app.js"></script>
</body>
</html>
```

**Objectifs Lighthouse** :
- Performance : >90
- Accessibilité : >95
- SEO : >90
- Taille page : <500KB (idéalement <300KB)

### 3.2 Backend & Génération

**Node.js + Express** pour :
- Génération automatique des sites clients
- API analytics (tracking vues/clics)
- Génération vCard (.vcf)
- Webhook paiement (Wave/OM/CinetPay)

**Architecture simplifiée** :

```javascript
// server.js - API CardTap
const express = require('express');
const fs = require('fs-extra');
const handlebars = require('handlebars');
const app = express();

// Génération nouvelle carte
app.post('/api/create-card', async (req, res) => {
    const { clientId, template, data } = req.body;

    // 1. Charger template
    const templateSource = await fs.readFile(`templates/${template}.html`, 'utf8');
    const template = handlebars.compile(templateSource);

    // 2. Générer HTML personnalisé
    const html = template(data);

    // 3. Créer dossier client
    const clientPath = `/var/www/geochifa/clients/${clientId}`;
    await fs.ensureDir(clientPath);
    await fs.writeFile(`${clientPath}/index.html`, html);

    // 4. Générer vCard
    const vcard = generateVCard(data);
    await fs.writeFile(`${clientPath}/contact.vcf`, vcard);

    // 5. Mettre à jour DNS (automatique via wildcard)
    res.json({ 
        url: `https://${clientId}.geochifa.com`,
        qrCode: generateQR(`https://${clientId}.geochifa.com`)
    });
});

// Tracking analytics (lightweight)
app.post('/api/track/:clientId', (req, res) => {
    const { type } = req.body; // 'view', 'save', 'share'
    db.query('INSERT INTO analytics (client_id, type, timestamp) VALUES (?, ?, NOW())', 
        [req.params.clientId, type]);
    res.sendStatus(200);
});
```

### 3.3 Base de Données

**PostgreSQL** (hébergé sur même VPS ou service managé) :

```sql
-- Structure tables CardTap
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    pack_type VARCHAR(20), -- 'starter', 'pro', 'enterprise'
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE analytics (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    event_type VARCHAR(50), -- 'page_view', 'contact_save', 'qr_scan', 'nfc_tap'
    ip_address INET,
    user_agent TEXT,
    referrer VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX idx_analytics_client_date ON analytics(client_id, created_at);
CREATE INDEX idx_analytics_event ON analytics(event_type);

-- Vue pour dashboard
CREATE VIEW daily_stats AS
SELECT 
    client_id,
    DATE(created_at) as date,
    COUNT(*) FILTER (WHERE event_type = 'page_view') as views,
    COUNT(*) FILTER (WHERE event_type = 'contact_save') as saves,
    COUNT(DISTINCT ip_address) as unique_visitors
FROM analytics
GROUP BY client_id, DATE(created_at);
```

---

## 4. SÉCURITÉ

### 4.1 SSL/TLS (HTTPS)

**Let's Encrypt** avec certificat wildcard (`*.geochifa.com`) :

```bash
# Installation Certbot
sudo apt install certbot python3-certbot-nginx

# Génération certificat wildcard
sudo certbot certonly --manual --preferred-challenges dns     -d geochifa.com -d *.geochifa.com

# Renouvellement automatique (cron)
0 3 * * * certbot renew --quiet --nginx
```

### 4.2 Sécurisation Nginx

```nginx
# /etc/nginx/nginx.conf - Extra security headers
http {
    # Protection DDoS basique
    limit_req_zone $binary_remote_addr zone=one:10m rate=10r/s;
    limit_conn_zone $binary_remote_addr zone=addr:10m;

    # Headers sécurité
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com;" always;

    # Masquer version Nginx
    server_tokens off;

    # Protection contre les attaques communes
    location ~ /\. {
        deny all;
    }

    location ~* \.(bak|config|sql|fla|psd|ini|log|sh|inc|swp|dist)$ {
        deny all;
    }
}
```

### 4.3 Firewall & Accès

```bash
# UFW (Uncomplicated Firewall)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable

# Fail2ban (protection brute force)
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

---

## 5. DÉPLOIEMENT & CI/CD

### 5.1 Script de Déploiement Automatisé

```bash
#!/bin/bash
# deploy.sh - Déploiement nouvelle carte client

CLIENT_ID=$1
TEMPLATE=$2
CONFIG_FILE=$3

# 1. Créer structure
mkdir -p /var/www/geochifa/clients/$CLIENT_ID/assets

# 2. Copier template de base
cp -r /var/www/geochifa/templates/$TEMPLATE/* /var/www/geochifa/clients/$CLIENT_ID/

# 3. Personnaliser avec sed/awk ou Node.js script
node /var/www/geochifa/scripts/customize.js     --client $CLIENT_ID     --config $CONFIG_FILE

# 4. Optimiser assets (compression images)
# Utiliser sharp.js pour redimensionner/compresser photos

# 5. Tester URL
curl -s -o /dev/null -w "%{http_code}" https://$CLIENT_ID.geochifa.com

# 6. Envoyer confirmation au client
# (Intégration API WhatsApp Business ou email)
```

### 5.2 Backup & Monitoring

**Stratégie backup** (3-2-1) :
- 3 copies des données
- 2 médias différents
- 1 offsite

```bash
# Backup quotidien (cron à 2h du matin)
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR="/backups/$DATE"

# 1. Backup fichiers clients
tar -czf $BACKUP_DIR-clients.tar.gz /var/www/geochifa/clients/

# 2. Backup base de données
pg_dump cardtap_db > $BACKUP_DIR-database.sql

# 3. Upload vers S3 (Hetzner Object Storage ou AWS S3)
# Coût Hetzner Object Storage : ~0.01€/GB/mois
s3cmd sync $BACKUP_DIR s3://cardtap-backups/

# 4. Garder seulement 7 jours
find /backups -type f -mtime +7 -delete
```

**Monitoring** (Prometheus + Grafana ou solution simple) :

```bash
# Script monitoring basique (à exécuter toutes les 5 min)
#!/bin/bash
# check_health.sh

# Check serveur web
if ! curl -s -f https://geochifa.com > /dev/null; then
    echo "ALERTE: Site down" | mail -s "CardTap Alert" admin@geochifa.com
fi

# Check espace disque
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "ALERTE: Disque plein à ${DISK_USAGE}%" | mail -s "CardTap Disk Alert" admin@geochifa.com
fi

# Check mémoire
MEMORY=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ $MEMORY -gt 90 ]; then
    echo "ALERTE: Mémoire saturée à ${MEMORY}%" | mail -s "CardTap Memory Alert" admin@geochifa.com
fi
```

---

## 6. SCALING & CROISSANCE

### 6.1 Capacité Actuelle (CPX31)

| Métrique | Valeur | Limite |
|----------|--------|--------|
| Sites statiques hébergés | ~1000 | Illimité (espace disque) |
| Requêtes/secondes | ~1000 | CPU/Mémoire |
| Bande passante | 20TB/mois | 20TB (dépassable à 1€/TB) |
| Temps de réponse moyen | <100ms | -- |

### 6.2 Plan de Scaling

**Phase 1 : 0-1000 clients** (Actuel)
- 1x CPX31 (4vCPU, 8GB)
- Coût : ~15 000 FCFA/mois
- Gestion : Manuelle

**Phase 2 : 1000-5000 clients**
- 1x CCX33 (8vCPU dédiés, 32GB) : ~80€/mois
- Ou : 2x CPX31 + Load Balancer Hetzner
- Mise en place CDN Cloudflare (gratuit)
- Automatisation complète (API provisioning)

**Phase 3 : 5000+ clients**
- Architecture Kubernetes (3+ nodes)
- Hetzner Load Balancer
- Séparation BDD (PostgreSQL managé ou cluster)
- Object Storage pour assets (images)
- Coût estimé : 200-300€/mois

### 6.3 Optimisation Coûts

**Stratégies pour rester rentable** :

1. **Compression aggressive** : Brotli + Gzip
   - Réduction taille 60-80%
   - Moins de bande passante consommée

2. **Cache navigateur** : Headers Cache-Control longs
   - Réduction requêtes serveur
   - Meilleure expérience utilisateur

3. **Lazy loading** : Chargement images uniquement si visibles
   - Réduction data mobile (crucial pour Afrique)

4. **Minification** : HTML/CSS/JS sans espace
   - Réduction 20-30% taille fichiers

---

## 7. INTÉGRATIONS EXTERNES

### 7.1 Paiement Mobile (Sénégal)

**Wave** (le plus populaire) :
- API Wave Checkout
- Commission : 1.5% par transaction
- Délai encaissement : Instantané

**Orange Money** :
- API OM Sénégal
- Commission : 1-2% selon montant
- Intégration via CinetPay (agrégateur)

**CinetPay** (recommandé pour multi-opérateurs) :
- Support Wave, OM, Free Money
- Commission : 3-4%
- Facilité d'intégration (SDK Node.js)

```javascript
// Exemple intégration CinetPay
const Cinetpay = require('@cinetpay/cinetpay-node-sdk');

const cp = new Cinetpay({
    apikey: process.env.CINETPAY_API_KEY,
    site_id: process.env.CINETPAY_SITE_ID,
    notify_url: 'https://api.geochifa.com/payment/notify',
    return_url: 'https://geochifa.com/payment/success',
    cancel_url: 'https://geochifa.com/payment/cancel',
    mode: 'PRODUCTION'
});

// Créer paiement
app.post('/create-payment', async (req, res) => {
    const payment = await cp.payment.init({
        transaction_id: `CARD_${Date.now()}`,
        amount: 15000, // FCFA
        currency: 'XOF',
        description: 'CardTap Starter Pack',
        customer_name: req.body.name,
        customer_phone: req.body.phone
    });
    res.json({ payment_url: payment.payment_url });
});
```

### 7.2 WhatsApp Business API

Pour notifications automatiques :
- Confirmation commande
- Livraison carte
- Support client

**Solutions** :
1. **WhatsApp Business API** (officiel) - Nécessite Meta Business verification
2. **WhatsApp Web + Puppeteer** (non officiel, risque ban)
3. **Twilio WhatsApp API** (payant mais fiable)

---

## 8. CHECKLIST MISE EN PRODUCTION

### Avant lancement

- [ ] Serveur Hetzner provisionné (CPX31)
- [ ] Nginx configuré avec wildcard SSL
- [ ] DNS Cloudflare pointé vers serveur
- [ ] Templates HTML créés (Starter + Pro)
- [ ] Scripts génération automatique testés
- [ ] Base de données PostgreSQL initialisée
- [ ] Backups automatisés configurés
- [ ] Monitoring basique en place
- [ ] Paiement CinetPay intégré et testé
- [ ] Politique de confidentialité rédigée
- [ ] Conditions générales de vente

### Post-lancement (maintenance)

- [ ] Mise à jour sécurité (apt update hebdo)
- [ ] Renouvellement SSL (auto via cron)
- [ ] Vérification backups (test restore mensuel)
- [ ] Analyse logs (fail2ban, erreurs 404/500)
- [ ] Optimisation images clients (compression)
- [ ] Mise à jour templates (nouvelles fonctionnalités)

---

## 9. ESTIMATION COÛTS TECHNIQUES (Année 1)

| Poste | Coût mensuel | Coût annuel | Notes |
|-------|-------------|-------------|-------|
| **Hébergement Hetzner** | | | |
| VPS CPX31 (4vCPU/8GB) | 15 000 FCFA | 180 000 FCFA | Principal |
| Backup storage (50GB) | 2 500 FCFA | 30 000 FCFA | Object Storage |
| **Domaine & DNS** | | | |
| Domaine geochifa.com | - | 15 000 FCFA | Namecheap/Cloudflare |
| Cloudflare Pro (option) | 20 000 FCFA | 240 000 FCFA | Optionnel an 1 |
| **Outils & Services** | | | |
| GitHub Pro (privé) | - | 30 000 FCFA | Développement |
| Monitoring (UptimeRobot) | Gratuit | 0 | Suffisant début |
| SendGrid/Mailgun (emails) | 5 000 FCFA | 60 000 FCFA | Transactionnels |
| **Licences & Logiciels** | | | |
| Adobe Creative Cloud | 30 000 FCFA | 360 000 FCFA | Design (ou alternatifs gratuits) |
| **Total Infrastructure** | **~72 500 FCFA/mois** | **~915 000 FCFA/an** | **~1 395€** |

**Répartition par carte vendue** (base 600 cartes/an) :
- Coût technique par carte : **1 525 FCFA** (~2.30€)
- Soit **10% du prix Starter** (15 000 FCFA) - **Excellent ratio!**

---

## 10. ARCHITECTURE FUTURE (Année 2-3)

### Roadmap technique

**Q3 2025** :
- [ ] API REST complète
- [ ] Application mobile CardTap (PWA ou React Native)
- [ ] Dashboard client avancé (analytics temps réel)

**Q4 2025** :
- [ ] Intégration CRM (HubSpot, Salesforce)
- [ ] API Webhook pour entreprises
- [ ] Multi-langue (FR/EN/AR/WOLOF)

**2026** :
- [ ] Infrastructure multi-région (Afrique du Sud, Singapour)
- [ ] Intelligence artificielle (suggestions réseautage)
- [ ] Blockchain (certification authenticité cartes - option)

---

*Architecture conçue pour CardTap by GeoChifâ*
*Version 1.0 - Document technique*
*Respect des contraintes économiques du marché sénégalais*
