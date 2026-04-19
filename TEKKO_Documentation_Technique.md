# Tapal by TEKKO — Documentation Technique Complète
**GeoChifâ · Dakar, Sénégal · Version April 2026**

---

## Sommaire

1. [Vue d'ensemble du produit](#1-vue-densemble-du-produit)
2. [Architecture technique](#2-architecture-technique)
3. [Offres et tarification](#3-offres-et-tarification)
4. [Studio de commande (BuilderView)](#4-studio-de-commande)
5. [Carte digitale publique (PublicCardView)](#5-carte-digitale-publique)
6. [Formulaire événementiel (CeremonyView)](#6-formulaire-événementiel)
7. [Flux de paiement](#7-flux-de-paiement)
8. [Tableau de bord admin (AdminView)](#8-tableau-de-bord-admin)
9. [API — Toutes les routes](#9-api--toutes-les-routes)
10. [Base de données — Schéma complet](#10-base-de-données--schéma-complet)
11. [Intégrations paiement](#11-intégrations-paiement)
12. [Email transactionnel](#12-email-transactionnel)
13. [Génération PDF](#13-génération-pdf)
14. [Analytics & tracking](#14-analytics--tracking)
15. [Stockage des fichiers](#15-stockage-des-fichiers)
16. [Sécurité & configuration serveur](#16-sécurité--configuration-serveur)

---

## 1. Vue d'ensemble du produit

**Tapal** est une plateforme complète de cartes de visite NFC à destination des professionnels d'Afrique de l'Ouest.

Le client configure sa carte digitale + sa carte NFC physique via un studio interactif, paye par mobile money (Wave ou CinetPay), et reçoit une URL publique permanente du type `tapal.geochifa.com/c/{slug}`. La carte NFC physique redirige vers cette URL lorsqu'elle est tapée.

| Élément | Valeur |
|---------|--------|
| Domaine public | `tapal.geochifa.com` |
| Domaine admin | `saytutekko.geochifa.com` |
| Serveur | Hetzner CAX11 ARM64, Ubuntu 22.04, IP `178.104.176.213` |
| Reverse proxy | Caddy 2.6.2 (HTTPS auto via Let's Encrypt) |
| Monnaie | XOF (FCFA) |

---

## 2. Architecture technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18 (JSX), Vite 5.4 |
| Backend | Node.js 20, Express.js |
| Base de données | SQLite via `better-sqlite3` (WAL mode) |
| Paiement primaire | Wave Africa API v1 |
| Paiement fallback | CinetPay API v2 |
| Email | Brevo (ex-Sendinblue) API transactionnelle |
| PDF | `pdfmake` (server-side) |
| QR Code | `qrcode` npm (canvas-based) |
| Cartes (analytics) | Leaflet.js + CartoDB Dark tiles |
| Maps (builder) | Google Maps Places Autocomplete |
| Hébergement uploads | Filesystem local `/opt/cardtap/website/uploads/` |
| Process manager | systemd (`cardtap.service`) |

### Structure des dossiers

```
website/
├── src/                    # Frontend React
│   ├── views/
│   │   ├── BuilderView.jsx       # Studio commande
│   │   ├── PublicCardView.jsx    # Carte digitale publique
│   │   ├── AdminView.jsx         # Dashboard admin
│   │   ├── CeremonyView.jsx      # Formulaire événements
│   │   └── PaymentStateView.jsx  # Retour paiement
│   ├── lib/
│   │   ├── api.js                # Client API fetch
│   │   └── catalog.js            # Packs, thèmes, matériaux, polices
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── server/
│   ├── index.js                  # Express app + toutes les routes
│   ├── database.js               # SQLite setup + toutes les requêtes
│   ├── email.js                  # Envoi email Brevo
│   ├── storage.js                # Gestion fichiers uploadés
│   ├── pdf-receipt.js            # Génération reçu PDF
│   ├── pdf-invoice.js            # Génération facture PDF
│   └── payments/
│       ├── wave.js               # Intégration Wave
│       └── cinetpay.js           # Intégration CinetPay
├── data/
│   └── cardtap.db                # Base SQLite (sur serveur)
└── uploads/
    └── {orderId}/                # Images par commande
        ├── avatar.jpg
        ├── cover.jpg
        ├── logo.jpg / logo.png
        └── artwork.jpg
```

---

## 3. Offres et tarification

### 3.1 Packs

| Pack | Prix de base | Quantité | Description |
|------|-------------|----------|-------------|
| **Starter** | 15 000 FCFA | 1 carte | Carte NFC avec profil digital personnalisé |
| **Pro** | 22 500 FCFA | 1 carte | Carte premium avec dorure et design sur mesure |
| **Business** | 60 000 FCFA (-20%) | 5 cartes | Domaine partagé, tarif groupé |

Délai de production : Starter 72h, Pro 48h, Business 5 jours.

### 3.2 Suppléments matériaux

| Matériau | Couleur de base | Supplément |
|----------|----------------|------------|
| Soft touch PVC | `#1d2430` (noir) | +0 FCFA |
| **Brushed metal** | `#747c86` (gris métal) | **+20 000 FCFA** |
| Frosted black | `#0d1218` (noir mat) | +0 FCFA |
| Pearl white | `#f5f5f3` (blanc nacré) | +0 FCFA |

### 3.3 Suppléments dorure (foil)

| Dorure | Supplément |
|--------|------------|
| Sans dorure | +0 FCFA |
| **Gold foil** (doré) | **+5 000 FCFA** |
| **Silver foil** (argenté) | **+5 000 FCFA** |
| **Copper foil** (cuivré) | **+5 000 FCFA** |

### 3.4 Finitions disponibles
Matte · Soft matte · Satin · Gloss

### 3.5 Formule de prix finale

```
Prix total = Prix pack
           + (Brushed metal ? +20 000 : 0)
           + (Dorure ≠ aucune ? +5 000 : 0)
           − Remise coupon
           + Supplément domaine personnalisé
```

### 3.6 Domaines personnalisés (pack Pro & Business)

TEKKO prend en charge jusqu'à **6 000 FCFA/an** du coût d'enregistrement. Grille tarifaire TLD (marge 20% incluse) :

| Extension | Prix annuel |
|-----------|-------------|
| .com | 12 600 FCFA |
| .sn | 26 400 FCFA |
| .io | 37 200 FCFA |
| .ai | 73 200 FCFA |
| .fr | 10 200 FCFA |
| .africa | 13 200 FCFA |

Disponibilité vérifiée en temps réel via DNS Google + RDAP.

### 3.7 Coupons de réduction

| Type | Fonctionnement |
|------|---------------|
| `percent` | Réduction en pourcentage (ex. 20 = 20%) |
| `fixed` | Réduction montant fixe en FCFA |

Paramètres : code (uppercase), type, valeur, nombre max d'utilisations (0 = illimité), compteur d'utilisations.

---

## 4. Studio de commande

Interface en 2 modes : **Studio** (7 étapes) et **Clé en main** (3 étapes simplifiées).

### 4.1 Mode Clé en main
Formulaire simplifié : nom + WhatsApp + ville + choix du pack → génère un message WhatsApp pré-rempli vers `+221776585371`.

### 4.2 Mode Studio — 7 étapes

#### Étape 1 : Profil digital
| Champ | Type | Description |
|-------|------|-------------|
| `fullName` | Texte | Nom complet |
| `role` | Texte | Fonction / titre |
| `company` | Texte | Entreprise |
| `phone` | Téléphone | Numéro affiché sur la carte |
| `email` | Email | Adresse email |
| `website` | URL | Site web |
| `location` | Texte | Localisation (avec autocomplétion Google Maps) |
| `bio` | Textarea | Bio / description courte |

Le champ `location` dispose d'un `LocationPicker` (Google Maps Places Autocomplete) avec prévisualisation statique de carte.

#### Étape 2 : Images
| Asset | Usage | Contrôles |
|-------|-------|-----------|
| **Avatar** | Photo profil sur carte digitale | Zoom 0.6×–2.4×, déplacement X/Y, opacité |
| **Artwork** | Visuel principal sur carte NFC physique | Zoom, déplacement, rotation -35°→+35°, opacité |
| **Logo** | Logo entreprise | Zoom, déplacement, opacité |
| **Cover** | Image de couverture (layout Bannière) | Zoom, déplacement |

Chaque asset supporte :
- Upload fichier (max 8 MB, formats JPEG / PNG / WebP)
- URL distante
- Repositionnement gestuel (drag souris/touch, scroll/pinch pour zoom)

#### Étape 3 : Style digital
- **Couleur accent** (color picker, verrouillée si mode auto-style)
- **Couleur texte** (override optionnel + bouton reset)
- **Couleur fond** (override optionnel + bouton reset)
- **Style de police** : 7 options

| Clé | Rendu | Stack CSS |
|-----|-------|-----------|
| `moderne` | Moderne | `-apple-system, Segoe UI, sans-serif` |
| `elegant` | Élégant | `Georgia, Times New Roman, serif` |
| `technique` | Technique | `Courier New, monospace` |
| `arrondi` | Arrondi | `Trebuchet MS, Comic Sans MS, Nunito` |
| `roboto` | Google | `Roboto, sans-serif` |
| `sf` | Apple | `SF Pro Display, Helvetica Neue, sans-serif` |
| `segoe` | Microsoft | `Segoe UI, Calibri, Arial, sans-serif` |

- **Label de carte** (texte court, ex. "Tapal Signature")
- **Layout de carte** : 5 options

| Layout | Description |
|--------|-------------|
| Classic | Avatar + en-tête entreprise, identité, contacts, QR |
| Bannière | Image de couverture, avatar chevauchant, corps centré |
| Bicolonne | Photo à gauche (panel coloré), infos à droite |
| Minimal | Monogramme circulaire, liens épurés |
| Sur mesure | Design piloté par description texte + image de référence |

- **Animations** : toggle on/off + champ description si activé
- **Prompt IA** : saisie texte → analyse des mots-clés → applique automatiquement matériau / finition / dorure

| Thème auto-détecté | Mots-clés déclencheurs | Matériau → Finition → Dorure |
|--------------------|----------------------|------------------------------|
| Executive | executive, luxury, premium, gold, finance, law | Brushed metal → Soft matte → Gold foil |
| Pulse | tech, startup, fintech, digital, electric | Frosted black → Gloss → Silver foil |
| Teranga | warm, natural, earth, organic, hospitality | Pearl white → Satin → Copper foil |
| Studio | minimal, clean, editorial, creative, fashion | Soft touch PVC → Matte → No foil |

- **4 thèmes visuels prédéfinis** :

| Thème | Accent | Fond | Cible |
|-------|--------|------|-------|
| Executive Noir | `#d4a147` (or) | Dégradé sombre | Finance, droit, luxe |
| Studio Editorial | `#ff6b2c` (orange) | Dégradé clair chaud | Consultants, créatifs |
| Pulse Tech | `#2bd1ff` (cyan) | Dégradé sombre bleu | Startups, fintech, produit |
| Teranga Warm | `#8e6f48` (brun) | Dégradé brun chaud | Hospitalité, communauté |

#### Étape 4 : Carte NFC physique
- Matériau (dropdown, affiche "épuisé" si stock = false)
- Finition (dropdown)
- Dorure (dropdown, affiche "épuisé" si stock = false)
- Message verso (texte)
- Case "QR code au verso"
- Case "Logo au recto"

#### Étape 5 : Livraison
| Champ | Type |
|-------|------|
| Nom contact | Texte |
| Email contact | Email |
| Téléphone contact | Téléphone |
| Ville de livraison | Texte |
| Adresse | Texte |
| Code postal | Texte |
| Notes livraison | Textarea |

Délai estimé affiché : 2–5 jours ouvrés (Sénégal), 1 semaine–1 mois (international).

#### Étape 6 : Récapitulatif
Ticket de caisse visuel : infos client, matériau, finition, dorure, QR/logo flags, domaine si demandé.

#### Étape 7 : Pack & Paiement
- Sélecteur de pack (3 options)
- Option domaine personnalisé (Pro/Business uniquement) avec vérificateur de disponibilité en temps réel
- Tableau de prix détaillé
- Saisie de coupon (validation en temps réel)
- **Bouton WhatsApp** : message pré-rempli
- **Bouton "Valider ma commande"** → checkout

### 4.3 Flux de validation & checkout
1. Validation champs obligatoires (fullName, phone, contact name/phone/city)
2. `POST /api/orders` → sauvegarde commande draft + fichiers uploadés
3. Affichage reçu de validation avec QR code + lien de prévisualisation (10 min)
4. "Payer avec Wave" → `POST /api/orders/:id/checkout`
5. Si Wave configuré → redirection vers `wave_launch_url`
6. Sinon → bouton WhatsApp manuel de secours

### 4.4 Aperçu temps réel
- Panneau droit : bascule entre aperçu **Digital** (maquette smartphone) et **Physique** (mockup 3D carte NFC)
- Basculement automatique au scroll (IntersectionObserver, seuil 15%)

---

## 5. Carte digitale publique

URL : `https://tapal.geochifa.com/c/{slug}`

### 5.1 Chargement
- `GET /api/cards/:slug`
- Si non payée ET > 2h → affiche "Aperçu expiré"
- Si introuvable → affiche "Carte introuvable"
- `document.title` = `{Nom} · Tapal`

### 5.2 Variables CSS appliquées dynamiquement
```css
--ecard-accent:    customization.accent (ou thème par défaut)
--ecard-highlight: thème highlight
--ecard-font:      police selon fontStyle
--ecard-text:      customization.textColor (si défini)
--ecard-bg:        customization.bgColor (si défini)
```

### 5.3 Sections communes à tous les layouts
- **Bloc contacts** : téléphone (`tel:`), email (`mailto:`), site web (lien externe), localisation (Google Maps)
- **Section QR** : QR code (lien vers site ou URL de la carte) + boutons d'action
- **Bouton "Sauvegarder le contact"** : télécharge un fichier `.vcf` (vCard 3.0)
- **Bouton "Partager cette carte"** : `navigator.share` ou copie du lien
- **Footer** : badge NFC · QR + URL de la carte

### 5.4 vCard générée (format 3.0)
```
BEGIN:VCARD
VERSION:3.0
N:Nom;Prénom;;;
FN:Nom complet
ORG:Entreprise
TITLE:Fonction
TEL;TYPE=CELL:+221...
EMAIL:...
URL:https://...
NOTE:Bio
ADR;TYPE=WORK:;;rue;ville;;;pays
PHOTO;ENCODING=b;TYPE=JPEG:{image bannière en base64}
LOGO;ENCODING=b;TYPE=JPEG:{photo avatar en base64}
END:VCARD
```

L'image de couverture (bannière) est utilisée comme photo principale du contact → **s'affiche comme Contact Poster iOS et photo de contact Android**.

### 5.5 Détail des layouts

**Classic**
```
[Barre dégradée accent]
[Avatar] [Entreprise / Label]          [Logo]
────────────────────────────────
[Nom]
● FONCTION
  ENTREPRISE
  Bio
[Contacts]
[QR + Boutons]
[Footer]
```

**Bannière**
```
[Image de couverture (180px) avec overlay]
       [Avatar chevauchant]
    [Logo circulaire] [Nom]
         ● FONCTION
           ENTREPRISE
           Bio
[Contacts]
[QR + Boutons]
[Footer]
```

**Bicolonne**
```
[Photo plein cadre gauche  | Logo]
[Entreprise / Label        | Nom]
                           | ● Fonction
                           | Bio
                           | [Contacts]
                           | [Boutons]
[Footer]
```

**Minimal**
```
[Monogramme circulaire (photo ou initiales)]
[Nom centré]
[Fonction · Entreprise · Logo]
Bio
[Ligne icône — téléphone]
[Ligne icône — email]
[Ligne icône — site]
[Ligne icône — lieu]
[Boutons]
[Footer]
```

---

## 6. Formulaire événementiel

URL : `/ceremonies`

Pour les événements (mariages, galas, séminaires, etc.) nécessitant des cartes NFC personnalisées.

### 6.1 Types d'événements
`mariage` · `gala` · `séminaire` · `formation` · `corporate` · `festival` · `autre`

### 6.2 Services proposables (cases à cocher)
1. Galerie photos et souvenirs numériques
2. Vidéo récapitulative
3. Livre d'or numérique
4. Catalogue de ressources et documents
5. Cartes NFC aux couleurs de l'événement
6. Badges d'accès NFC
7. Programme / Agenda de l'événement
8. Plans et itinéraires interactifs

### 6.3 Champs du formulaire
Contact (nom*, téléphone*, email, entreprise) + Événement (type*, nom, date, ville, nb invités) + Design (description couleurs/style, budget, notes libres)

### 6.4 Soumission
`POST /api/ceremonies` → confirmation + lien WhatsApp pré-rempli

---

## 7. Flux de paiement

### 7.1 Initialisation (checkout)
```
Client → POST /api/orders/:id/checkout
         │
         ├─ Wave configuré ? → initializeWaveCheckout()
         │                     → redirection wave_launch_url
         │
         └─ Sinon → initializeCinetPayCheckout()
                    → redirection CinetPay
```

### 7.2 Confirmation post-paiement
La page `/payment/success?orderId=...` effectue un **polling** :
- 12 tentatives × 3 secondes = 36 secondes maximum
- Appelle `POST /api/orders/:id/verify-payment` à chaque tentative
- Si payé → redirection automatique vers la carte (`tapal.geochifa.com/c/{slug}`)
- Si toujours non payé après 36s → message manuel + lien carte si disponible

### 7.3 Webhooks

**Wave** (`POST /api/payments/wave/webhook`)
- Vérifie signature HMAC-SHA256 avec `WAVE_WEBHOOK_SECRET`
- Header : `wave-signature: t={timestamp},v1={hex}`
- Calcul : `HMAC-SHA256(secret, timestamp + rawBody)`
- Événements traités : `checkout.session.completed` (→ paid), `checkout.session.payment_failed` (→ failed)
- Ping de santé (sans référence) → retourne 200 directement

**CinetPay** (`POST /api/payments/cinetpay/webhook`)
- Vérifie en rappelant l'API CinetPay (`/payment/check/trans`)
- Statuts reconnus : `ACCEPTED/SUCCESS/COMPLETED/PAID/00` → `paid`

### 7.4 Actions post-confirmation paiement
1. `updatePayment()` → met à jour `payment_status = 'paid'` en base
2. `useCoupon()` → incrémente `used_count` du coupon si utilisé
3. `sendOrderConfirmationEmail()` → envoie emails de confirmation client + admin

---

## 8. Tableau de bord admin

URL : `https://saytutekko.geochifa.com/admin`  
Authentification : email + mot de passe → token stocké dans `localStorage`.

### 8.1 Barre de statistiques (toujours visible)
Total commandes · Payées · En attente · En production · Livrées · **Chiffre d'affaires** (somme payées)

### 8.2 Onglet Commandes

**Filtres** : recherche texte libre (nom, email, téléphone, ID) · statut paiement · statut commande · bouton reset

**Carte commande (accordéon)** — Vue étendue :
- Vignettes avatar + artwork
- **Aperçu carte digitale** : iframe embarqué de la carte live
- **Aperçu carte NFC physique** : miniature recto (artwork, nom, rôle) + verso (QR ou "Tap only")
- Téléchargements : artwork · QR code · photo profil · reçu PDF
- Données : téléphone, email, ville, URL carte, domaine + liens registraires (Hostinger, Namecheap, GoDaddy)
- Tags : matériau · finition · dorure · thème · layout · police · label
- Chips couleurs : accent · textColor · bgColor
- Prompt style, description animations

**Actions admin par commande** :
| Action | Détail |
|--------|--------|
| Changer statut commande | `submitted` → `in-production` → `ready` → `delivered` → `cancelled` |
| Changer statut paiement | `pending` → `paid` → `failed` → `unknown` |
| Uploader avatar / logo | Remplace le fichier sur le serveur |
| Appliquer / retirer coupon | Code coupon + recalcul remise |
| Notes admin | Textarea interne |
| Notes livraison | Textarea visible équipe |
| **Modifier la carte** | Édition directe de : nom, fonction, entreprise, téléphone, email, site, localisation, bio, couleur fond, couleur texte, accent |
| Régénérer lien paiement | Nouveau checkout Wave |
| Télécharger reçu PDF | |
| Marquer livrée | Raccourci |

### 8.3 Onglet Stock
Bascule en stock / épuisé pour chaque matériau et chaque dorure.  
Les éléments épuisés apparaissent avec la mention "épuisé" dans le studio client.

### 8.4 Onglet Coupons
Créer : code · type (percent/fixed) · valeur · max utilisations  
Liste : code · type · valeur · max · utilisé · actif · supprimer

### 8.5 Onglet Cérémonies
Liste des demandes événementielles. Admin peut mettre à jour : statut (`nouveau` → `en-cours` → `termine` → `annule`) + notes admin.

### 8.6 Onglet Factures
Générateur de factures standalone :
- Infos client (nom, téléphone, email, notes)
- Lignes de facture (description, quantité, prix unitaire) — ajout/suppression dynamique
- Génère : lien de paiement Wave + PDF téléchargeable

### 8.7 Onglet Analytics
Période : `24h` | `7d` | `30d` | `90d`

Métriques :
- Total visites · Visiteurs uniques · Vues cartes · Vues pages
- **Graphique temporel** : barres (visites + uniques par jour)
- Top 20 pages, pays, villes
- Répartition devices, navigateurs, OS
- Top 20 référents
- **Carte Leaflet** : points géolocalisés des visiteurs (taille proportionnelle aux visites), centrée Afrique de l'Ouest
- **Journal brut** : dernières 100 visites (chemin, drapeau pays, device, navigateur, OS, ville, timestamp)

---

## 9. API — Toutes les routes

### Routes publiques

| Méthode | Chemin | Limite | Description |
|---------|--------|--------|-------------|
| GET | `/api/health` | — | Statut serveur + paiements configurés |
| GET | `/api/cards/:slug` | — | Données carte publique (payée ou < 2h) |
| POST | `/api/orders` | 5/15min | Créer commande + upload fichiers |
| POST | `/api/orders/:orderId/checkout` | — | Initialiser paiement Wave ou CinetPay |
| GET | `/api/orders/:orderId/receipt.pdf` | — | Reçu PDF (commandes payées) |
| POST | `/api/orders/:orderId/verify-payment` | — | Vérification paiement Wave (polling) |
| POST | `/api/payments/wave/webhook` | — | Webhook Wave (HMAC vérifié) |
| POST | `/api/payments/cinetpay/webhook` | — | Webhook CinetPay (API vérifiée) |
| GET | `/api/inventory` | — | Stock matériaux/dorures |
| GET | `/api/domain/check?domain=` | — | Disponibilité + prix domaine |
| GET | `/api/coupons/validate?code=` | 15/15min | Valider un coupon |
| POST | `/api/track` | 60/min | Beacon analytics (dédup 30s même IP+chemin) |
| POST | `/api/ceremonies` | — | Soumettre demande événementielle |

### Routes admin (header `x-admin-token` requis)

| Méthode | Chemin | Description |
|---------|--------|-------------|
| POST | `/api/admin/login` | Authentification email + mot de passe |
| GET | `/api/admin/orders` | Lister toutes les commandes |
| PATCH | `/api/admin/orders/:orderId` | Modifier statut / notes |
| PATCH | `/api/admin/orders/:orderId/card` | Modifier profil + personnalisation carte |
| POST | `/api/admin/orders/:orderId/coupon` | Appliquer/retirer coupon |
| POST | `/api/admin/orders/:orderId/upload-asset` | Uploader avatar ou logo |
| POST | `/api/admin/orders/:orderId/payment-link` | Régénérer lien Wave |
| GET | `/api/admin/orders/:orderId/receipt.pdf` | Reçu PDF (toutes commandes) |
| PUT | `/api/admin/inventory/:type/:key` | Toggler stock matériau/dorure |
| GET | `/api/admin/coupons` | Lister coupons |
| POST | `/api/admin/coupons` | Créer coupon |
| DELETE | `/api/admin/coupons/:code` | Supprimer coupon |
| GET | `/api/admin/ceremonies` | Lister demandes événementielles |
| PATCH | `/api/admin/ceremonies/:id` | Mettre à jour statut/notes cérémonie |
| POST | `/api/admin/invoices/generate` | Générer facture PDF + lien Wave |
| GET | `/api/admin/analytics` | Agrégats analytics (période) |
| GET | `/api/admin/analytics/visits` | Journal brut visites (500 max) |

### Statique / SPA
- `/uploads/*` — Fichiers images uploadés
- `/*` — Fallback SPA (`dist/index.html`, headers no-cache)

---

## 10. Base de données — Schéma complet

Moteur : **SQLite** (better-sqlite3), WAL mode, foreign keys ON  
Chemin serveur : `/opt/cardtap/website/data/cardtap.db`

### Table `orders`

| Colonne | Type | Description |
|---------|------|-------------|
| `order_id` | TEXT PK | UUID commande |
| `slug` | TEXT UNIQUE | Slug URL (ex. `sokhna-a1b2c3`) |
| `customer_name` | TEXT | Nom contact livraison |
| `customer_email` | TEXT | |
| `customer_phone` | TEXT | |
| `pack_key` | TEXT | `starter` / `pro` / `business` |
| `pack_price` | INTEGER | Prix de base FCFA |
| `currency` | TEXT | `XOF` par défaut |
| `profile_json` | TEXT | Objet profil JSON |
| `customization_json` | TEXT | Objet personnalisation JSON |
| `order_contact_json` | TEXT | Coordonnées livraison JSON |
| `assets_json` | TEXT | URLs fichiers uploadés JSON |
| `package_json` | TEXT | Sélection package JSON |
| `final_card_url` | TEXT | URL publique complète |
| `order_status` | TEXT | `submitted` / `in-production` / `ready` / `delivered` / `cancelled` |
| `payment_provider` | TEXT | `wave` / `cinetpay` |
| `payment_status` | TEXT | `pending` / `paid` / `failed` / `unknown` |
| `payment_reference` | TEXT | ID checkout Wave ou CinetPay |
| `payment_url` | TEXT | URL de redirection paiement |
| `payment_payload_json` | TEXT | Payload brut webhook |
| `admin_notes` | TEXT | Notes internes |
| `delivery_notes` | TEXT | Instructions livraison |
| `coupon_code` | TEXT | Code coupon appliqué |
| `discount_amount` | INTEGER | Remise en FCFA |
| `created_at` | TEXT | ISO 8601 |
| `updated_at` | TEXT | ISO 8601 |

Index : `created_at DESC`, `payment_status`, `order_status`

### Table `inventory`

| Colonne | Type | Description |
|---------|------|-------------|
| `item_type` | TEXT PK | `material` ou `foil` |
| `item_key` | TEXT PK | Ex. `Brushed metal`, `Gold foil` |
| `in_stock` | INTEGER | 1=disponible, 0=épuisé |
| `updated_at` | TEXT | |

### Table `coupons`

| Colonne | Type | Description |
|---------|------|-------------|
| `code` | TEXT PK | Code majuscules |
| `discount_type` | TEXT | `percent` ou `fixed` |
| `discount_value` | INTEGER | % ou FCFA |
| `max_uses` | INTEGER | 0=illimité |
| `used_count` | INTEGER | Incrémenté à chaque paiement confirmé |
| `active` | INTEGER | 1=actif |
| `created_at` | TEXT | |

### Table `ceremonies`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | TEXT PK | UUID |
| `contact_name` | TEXT | |
| `contact_email` | TEXT | |
| `contact_phone` | TEXT | |
| `company` | TEXT | |
| `event_type` | TEXT | `mariage`, `gala`, etc. |
| `event_name` | TEXT | |
| `event_date` | TEXT | |
| `event_city` | TEXT | |
| `guest_count` | TEXT | |
| `services_json` | TEXT | Array services sélectionnés |
| `custom_design` | TEXT | Description design |
| `budget` | TEXT | Budget estimé |
| `notes` | TEXT | |
| `status` | TEXT | `nouveau` (défaut) |
| `admin_notes` | TEXT | |
| `created_at` / `updated_at` | TEXT | |

### Table `visit_events`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `visited_at` | TEXT | ISO 8601 |
| `kind` | TEXT | `page` ou `card` |
| `path` | TEXT | Chemin URL |
| `slug` | TEXT | Slug carte (pour vues cartes) |
| `host` | TEXT | Domaine |
| `referrer` | TEXT | HTTP Referer |
| `user_agent` | TEXT | UA brut |
| `browser` | TEXT | Navigateur parsé |
| `browser_version` | TEXT | |
| `os` | TEXT | Système parsé |
| `os_version` | TEXT | |
| `device_type` | TEXT | `desktop` / `mobile` / `tablet` |
| `ip_raw` | TEXT | IP client |
| `ip_hash` | TEXT | SHA-256 IP (dédup + confidentialité) |
| `country_code` | TEXT | ISO 2 lettres |
| `country` | TEXT | |
| `region` | TEXT | |
| `city` | TEXT | |
| `language` | TEXT | Accept-Language |
| `screen` | TEXT | Ex. `1920x1080` |
| `latitude` | REAL | Géolocalisation |
| `longitude` | REAL | |

Index : `visited_at DESC`, `ip_hash`, `slug`, `kind`

---

## 11. Intégrations paiement

### 11.1 Wave Africa (paiement primaire)

Variables d'environnement :
- `WAVE_API_KEY` — clé Bearer API Wave
- `WAVE_SIGNING_SECRET` — signature des requêtes sortantes (optionnel)
- `WAVE_WEBHOOK_SECRET` — vérification des webhooks entrants
- `WAVE_SUCCESS_URL` / `WAVE_ERROR_URL` — redirections

Endpoint API Wave : `POST https://api.wave.com/v1/checkout/sessions`

Payload envoyé :
```json
{
  "amount": "22500",
  "currency": "XOF",
  "success_url": "https://tapal.geochifa.com/?payment=success",
  "error_url": "https://tapal.geochifa.com/?payment=error",
  "client_reference": "{orderId}"
}
```

Vérification webhook :
```
wave-signature: t={timestamp},v1={hex}
HMAC-SHA256(WAVE_WEBHOOK_SECRET, timestamp + rawBody) == hex
```

Événements webhook traités :
- `checkout.session.completed` + `payment_status: succeeded` → `paid`
- `checkout.session.payment_failed` → `failed`

### 11.2 CinetPay (fallback)

Variables d'environnement :
- `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`
- `CINETPAY_NOTIFY_URL`, `CINETPAY_RETURN_URL`, `CINETPAY_CANCEL_URL`

Endpoint : `POST https://api-checkout.cinetpay.com/v2/payment`

ID transaction format : `TAPAL{timestamp}{orderId.slice(0,4).toUpperCase()}`

Vérification webhook : rappel API CinetPay `/payment/check/trans`

Statuts reconnus : `ACCEPTED/SUCCESS/COMPLETED/PAID/00` → `paid`

---

## 12. Email transactionnel

Fournisseur : **Brevo** (ex-Sendinblue), HTTPS API.

Variable : `BREVO_API_KEY` (si absent, emails silencieusement ignorés)

### Emails envoyés

**Email client** (`sendOrderConfirmationEmail`)
- Destinataire : email du contact de livraison
- Objet : `Votre carte Tapal est en cours de création !`
- Contenu HTML : résumé commande, pack, prix, matériau, lien carte, délai production
- Expéditeur : `BREVO_SENDER_EMAIL` (configurable)

**Email admin** (`ADMIN_EMAIL`)
- Notification de nouvelle commande payée
- Contenu : détails client, pack, montant, lien carte

---

## 13. Génération PDF

Librairie : `pdfmake` (server-side Node.js)

### Reçu de commande (`pdf-receipt.js`)
- Généré à `/api/orders/:orderId/receipt.pdf` (commandes payées)
- Contenu : logo TEKKO, détails commande, profil, pack, matériau, finition, dorure, montant, référence paiement

### Facture admin (`pdf-invoice.js`)
- Généré via `POST /api/admin/invoices/generate`
- Contenu : infos client, tableau de lignes (description × qté × prix unitaire = sous-total), total, TVA si applicable
- Retourné en base64 dans la réponse JSON + lien de paiement Wave

---

## 14. Analytics & tracking

### Beacon de suivi
`POST /api/track` — appeléé depuis le frontend à chaque changement de page.

Données collectées :
- Chemin URL, type (`page` ou `card`), slug si carte
- IP (hashée SHA-256 pour confidentialité + dédup)
- Pays, région, ville (géolocalisation IP)
- Navigateur, version, OS, type de device
- Référent HTTP, Accept-Language, résolution écran
- Coordonnées GPS (pour carte Leaflet)

**Déduplication** : même IP + même chemin dans la même fenêtre de 30 secondes → une seule entrée.

### Métriques agrégées disponibles
- Total visites / visiteurs uniques / vues cartes / vues pages
- Série temporelle journalière
- Top pages, pays, villes, referrers (top 20)
- Répartition devices, navigateurs, OS (top 10)
- Points géolocalisés pour carte
- Journal brut 100 dernières visites

---

## 15. Stockage des fichiers

Répertoire : `/opt/cardtap/website/uploads/{orderId}/`

Fichiers par commande :
- `avatar.jpg` — Photo profil
- `artwork.jpg` — Visuel carte NFC physique
- `cover.jpg` — Image de couverture bannière
- `logo.jpg` / `logo.png` — Logo entreprise

Contraintes upload :
- Taille max : **8 MB** par fichier
- Formats acceptés : `image/jpeg`, `image/png`, `image/webp`
- Servis via `/uploads/*` en statique avec headers `Content-Disposition: inline`

Les assets en base de données stockent : `sourceType`, `remoteUrl`, `storedUrl`, `mimeType`, `originalName`, `fileSize`, `zoom`, `positionX`, `positionY`, `rotation`, `opacity`.

---

## 16. Sécurité & configuration serveur

### Rate limiting

| Endpoint | Limite |
|----------|--------|
| API générale | 100 req / 15 min |
| Authentification | 10 req / 15 min |
| Création commande | 5 req / 15 min |
| Validation coupon | 15 req / 15 min |
| Beacon analytics | 60 req / min |

### CORS
Origines autorisées : `tapal.geochifa.com`, `saytutekko.geochifa.com`, `tekko.geochifa.com` + `localhost` en développement.

### Sécurité
- `trust proxy: 1` (Caddy devant Express)
- Rawbody capturé pour vérification HMAC webhooks
- Token admin via header `x-admin-token`
- Signature Wave vérifiée avec HMAC-SHA256
- Webhook CinetPay vérifié via rappel API
- Headers fichiers statiques : `X-Content-Type-Options: nosniff`

### Nettoyage automatique
Cron toutes les **10 minutes** : suppression des commandes brouillon (sans `payment_reference`) créées il y a plus de **2 heures**.

### Variables d'environnement requises

| Variable | Description |
|----------|-------------|
| `SERVER_PORT` | Port serveur (défaut 4000) |
| `DATABASE_PATH` | Chemin SQLite |
| `UPLOAD_DIR` | Dossier uploads |
| `WAVE_API_KEY` | Clé API Wave (active le paiement Wave) |
| `WAVE_WEBHOOK_SECRET` | Secret vérification webhooks Wave |
| `WAVE_SIGNING_SECRET` | Signature requêtes sortantes Wave |
| `WAVE_SUCCESS_URL` | URL retour succès |
| `WAVE_ERROR_URL` | URL retour erreur |
| `CINETPAY_API_KEY` | Clé CinetPay (fallback si Wave absent) |
| `CINETPAY_SITE_ID` | Site ID CinetPay |
| `CINETPAY_NOTIFY_URL` | URL webhook CinetPay |
| `CINETPAY_RETURN_URL` | Retour succès CinetPay |
| `CINETPAY_CANCEL_URL` | Retour annulation CinetPay |
| `BREVO_API_KEY` | Clé API email Brevo |
| `BREVO_SENDER_EMAIL` | Email expéditeur |
| `ADMIN_EMAIL` | Email administrateur (notifications) |
| `ADMIN_PASSWORD` | Mot de passe dashboard admin |
| `ADMIN_DASHBOARD_TOKEN` | Token d'authentification admin |
| `VITE_GOOGLE_MAPS_KEY` | Clé Google Maps (build frontend) |
| `BASE_URL` | URL publique base (ex. `https://tapal.geochifa.com`) |

---

*Document généré le 18 avril 2026 — Tapal by TEKKO / GeoChifâ*
