# Déploiement VPS — Neural Quiz / GeoTrackr

Stack : **Node 20 + Express 5 + Socket.IO + SQLite** dans Docker, reverse proxy **Caddy** (TLS automatique Let's Encrypt).

---

## Prérequis

| Quoi | Détail |
|---|---|
| VPS | Ubuntu 22.04+ LTS, 1 vCPU, 1 Go RAM minimum |
| Domaine | Ex. `quiz.mondomaine.fr` — enregistrement DNS A → IP du VPS |
| Ports ouverts | 80 (HTTP) et 443 (HTTPS) |
| Clé Google Maps | Activée pour **Maps JavaScript API** + **Street View Static API** |

---

## 1. Provisionner le VPS

### 1.1 Connexion initiale + sécurisation SSH

```bash
# Depuis votre machine locale
ssh root@<IP_DU_VPS>

# Créer un utilisateur non-root
adduser deploy
usermod -aG sudo deploy

# Copier votre clé SSH sur le nouvel utilisateur
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# Désactiver la connexion root par mot de passe
sed -i 's/^PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload sshd

# Reconnectez-vous désormais avec : ssh deploy@<IP_DU_VPS>
```

### 1.2 Pare-feu

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

### 1.3 Mises à jour système

```bash
apt update && apt upgrade -y
apt autoremove -y
```

---

## 2. Installer Docker

```bash
# Dépendances
apt install -y ca-certificates curl gnupg lsb-release

# Clé GPG officielle Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Dépôt Docker
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Permettre à l'utilisateur deploy d'utiliser Docker sans sudo
usermod -aG docker deploy

# Vérification
docker --version
docker compose version
```

> Reconnectez-vous (`exit` puis `ssh deploy@<IP>`) pour que le groupe `docker` soit pris en compte.

---

## 3. Déployer l'application

### 3.1 Récupérer le code

```bash
# Cloner le dépôt (ou transférer via scp/rsync)
git clone <URL_DU_REPO> /home/deploy/app
cd /home/deploy/app
```

### 3.2 Configurer le DNS

Dans votre registrar/hébergeur DNS, créer un enregistrement A :

```
quiz.mondomaine.fr  →  <IP_DU_VPS>  TTL 300
```

Vérifier la propagation avant de lancer Caddy :

```bash
dig +short quiz.mondomaine.fr
# doit retourner l'IP du VPS
```

### 3.3 Créer le fichier `.env`

```bash
cd /home/deploy/app
cp .env.example .env
nano .env   # ou vim, ou votre éditeur préféré
```

**Remplir chaque variable — ne pas laisser vide :**

```env
# ── Domaine ────────────────────────────────────────────────────────────────
SITE_ADDRESS=quiz.mondomaine.fr
ACME_EMAIL=votre@email.fr

# ── Secrets applicatifs (OBLIGATOIRES — le serveur refuse de démarrer sans eux)
# Générer JWT_SECRET  : openssl rand -hex 32
# Générer ADMIN_PASSWORD : pwgen -s 20 1  (ou tout gestionnaire de mots de passe)
ADMIN_PASSWORD=<mot_de_passe_admin_fort_min_8_caracteres>
JWT_SECRET=<chaine_aleatoire_64_caracteres_hex>

# ── Google Maps ─────────────────────────────────────────────────────────────
GOOGLE_MAPS_API_KEY=AIzaSy...
```

Générer les secrets d'un coup :

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 20)"
```

Protéger le fichier :

```bash
chmod 600 .env
```

### 3.4 Lancer

```bash
docker compose up -d --build
```

Ce que ça fait en coulisses :
1. **frontend-builder** : `npm ci` + `vite build` (injecte `VITE_GOOGLE_MAPS_API_KEY`)
2. **runner** : `npm ci --omit=dev` + copie du build frontend
3. **app** : démarre Node, valide les secrets (fail-fast), ouvre SQLite, migre les JSON → SQLite au premier boot
4. **caddy** : contacte Let's Encrypt, génère le certificat TLS, monte le reverse proxy

### 3.5 Vérifier le démarrage

```bash
# Logs en direct (arrêt avec Ctrl+C)
docker compose logs -f

# Attendre ces lignes pour confirmer que tout est prêt :
# [DATABASE] Connecté à la base de données SQLite.
# [GEO] Loaded 374 locations from SQLite.
# [SERVER] HTTP en écoute sur le port 3005

# Test HTTPS
curl -I https://quiz.mondomaine.fr
# HTTP/2 200 ✓
```

---

## 4. Configurer la clé Google Maps pour la production

Dans la [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials → votre clé** :

- **Application restrictions** : `HTTP referrers (websites)`
- **Referrers autorisés** :
  ```
  https://quiz.mondomaine.fr/*
  ```
- **API restrictions** : Restreindre à `Maps JavaScript API` + `Street View Static API`

> Sans cette restriction, la clé est utilisable depuis n'importe quel site.

---

## 5. Accès administration

| URL | Usage |
|---|---|
| `https://quiz.mondomaine.fr/` | Jeu (joueurs) |
| `https://quiz.mondomaine.fr/geo/host` | Hôte GeoTrackr |
| `https://quiz.mondomaine.fr/admin` | Interface admin (nécessite ADMIN_PASSWORD) |

---

## 6. Maintenance courante

### Voir les logs

```bash
docker compose logs -f           # tous les services
docker compose logs -f app       # serveur Node uniquement
docker compose logs -f caddy     # reverse proxy / TLS
```

### Redémarrer

```bash
docker compose restart           # redémarrage doux
docker compose down && docker compose up -d   # arrêt + relance complète
```

### Mettre à jour l'application

```bash
cd /home/deploy/app
git pull

# Si des dépendances ont changé → rebuild
docker compose up -d --build

# Sinon (code seulement) → simple redémarrage
docker compose restart app
```

### Inspecter un conteneur

```bash
docker compose exec app sh       # shell dans le conteneur Node
docker compose exec app node -e "console.log('ok')"
```

---

## 7. Sauvegardes

Les données persistantes sont dans des volumes Docker nommés :

| Volume | Contient |
|---|---|
| `quiz_data` | `database.sqlite` (parties, quiz, lieux, mots) |
| `quiz_uploads` | Images uploadées via l'admin |
| `caddy_data` | Certificats TLS Let's Encrypt |

### Script de sauvegarde quotidienne

```bash
# /home/deploy/backup.sh
#!/bin/bash
set -e
BACKUP_DIR=/home/deploy/backups
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Copie à chaud du SQLite (safe car SQLite supporte les lectures concurrentes)
docker compose -f /home/deploy/app/docker-compose.yml exec -T app \
  sh -c "sqlite3 /app/server/data/database.sqlite '.backup /tmp/db_backup.sqlite'"
docker compose -f /home/deploy/app/docker-compose.yml cp app:/tmp/db_backup.sqlite \
  "$BACKUP_DIR/database_$DATE.sqlite"

# Conserver les 30 dernières sauvegardes
ls -t "$BACKUP_DIR"/database_*.sqlite | tail -n +31 | xargs -r rm

echo "[BACKUP] OK → $BACKUP_DIR/database_$DATE.sqlite"
```

```bash
chmod +x /home/deploy/backup.sh

# Ajouter une cron daily à 3h
crontab -e
# Ajouter la ligne :
0 3 * * * /home/deploy/backup.sh >> /home/deploy/backup.log 2>&1
```

---

## 8. Supervision (optionnel)

```bash
# Usage mémoire / CPU des conteneurs en temps réel
docker stats

# Espace disque des volumes
docker system df -v

# Supprimer les images/layers non utilisés (libérer de l'espace)
docker system prune -f
```

---

## 9. Résolution de problèmes fréquents

### Le serveur refuse de démarrer

```bash
docker compose logs app | grep FATAL
```

Cause la plus fréquente : `JWT_SECRET` ou `ADMIN_PASSWORD` absent ou vide dans `.env`. Remplir et relancer :

```bash
docker compose up -d --build
```

### Certificat TLS non obtenu

```bash
docker compose logs caddy | grep -i error
```

Vérifier :
1. `SITE_ADDRESS` dans `.env` correspond exactement au domaine DNS
2. Le domaine pointe bien vers l'IP du VPS (`dig +short quiz.mondomaine.fr`)
3. Les ports 80 et 443 sont ouverts (`ufw status`)

Caddy réessaie automatiquement — attendre 1-2 minutes après correction DNS.

### `address already in use` sur le port 3005

```bash
# Identifier le process
lsof -i :3005
# Le tuer si nécessaire
docker compose down
docker compose up -d
```

### Socket.IO : joueurs ne reçoivent pas les événements

```bash
docker compose logs app | grep -i "POLLING\|SOCKET\|ERR"
```

Le transport est en `polling` uniquement (stable mobile). Caddy supporte nativement le proxying des requêtes polling — aucune configuration WebSocket requise.

### Télécommande GeoTrackr : « Télécommande non autorisée »

Le token de télécommande est généré à la création du salon et embarqué dans le QR de l'hôte. Causes possibles :
- QR scanné depuis un ancien salon (expiré / room supprimée)
- URL saisie manuellement sans le paramètre `?rt=...`

→ Demander à l'hôte de recréer un salon et rescanner le QR.

---

## 10. Récapitulatif sécurité intégrée

| Mécanisme | Détail |
|---|---|
| **Secrets fail-fast** | Le serveur refuse de démarrer sans `JWT_SECRET` et `ADMIN_PASSWORD` |
| **Rate limiting** | Login admin : 10 tentatives / 15 min. API globale : 300 req/min/IP |
| **Auth JWT** | Toutes les routes d'écriture admin protégées (24h d'expiration) |
| **Remote token (H1)** | Token 32 hex généré par salon, transmis uniquement via QR de l'hôte |
| **Anti-triche GeoTrackr** | Coordonnées approximatives (~200m) aux joueurs, calcul score côté serveur |
| **SSRF expand-url** | Allowlist hôtes Google uniquement + validation des redirections |
| **SQLite paramétré** | Zéro injection SQL |
| **0 vulnérabilité npm** | `npm audit --omit=dev` → 0 (server + client) |
| **HTTPS auto** | Caddy + Let's Encrypt, renouvellement automatique |
| **Headers sécurité** | X-Frame-Options, X-Content-Type-Options, Referrer-Policy (Caddyfile) |

---

## Checklist avant la mise en production

```
[ ] DNS A configuré et propagé (dig +short <domaine> → IP du VPS)
[ ] .env créé avec ADMIN_PASSWORD, JWT_SECRET, GOOGLE_MAPS_API_KEY, SITE_ADDRESS, ACME_EMAIL
[ ] chmod 600 .env
[ ] Clé Google Maps restreinte au domaine de production
[ ] Ports 80 et 443 ouverts (ufw status)
[ ] docker compose up -d --build → aucune erreur
[ ] curl -I https://<domaine> → HTTP/2 200
[ ] Connexion admin fonctionnelle
[ ] Créer un salon GeoTrackr → QR joueur + QR télécommande fonctionnels
```
