# 🚀 Guide de Déploiement Public (VPS / Docker) - Neural Quiz

Ce guide explique comment déployer l'application **Neural Quiz** de manière sécurisée et robuste sur un VPS accessible publiquement sur Internet.

La configuration s'appuie sur **Docker** pour le packaging, **SQLite** pour la base de données, et **Caddy** en tant que reverse proxy pour obtenir automatiquement des certificats SSL gratuits (HTTPS) via Let's Encrypt.

---

## 📋 Prérequis sur le VPS

Avant de commencer, assurez-vous d'avoir les éléments suivants sur votre serveur Linux (Ubuntu recommandé) :

1.  **Docker** et **Docker Compose** installés.
2.  Un **nom de domaine** ou sous-domaine (ex: `quiz.mon-domaine.com`) pointant vers l'adresse IP publique de votre VPS (enregistrements DNS `A`).
3.  Les ports **80** (HTTP) et **443** (HTTPS) ouverts dans le pare-feu du VPS.
4.  Une clé API **Google Maps** (nécessaire pour Street View dans GeoTrackr).

---

## ⚙️ Étape 1 : Configuration des Variables d'Environnement

Créez un fichier nommé `.env` à la racine du projet sur votre serveur avec le contenu suivant :

```env
# Adresse de votre site (utilisée par Caddy pour le certificat HTTPS)
SITE_ADDRESS=quiz.mon-domaine.com

# Votre email pour les notifications de renouvellement SSL
ACME_EMAIL=votre-email@example.com

# Mot de passe administrateur sécurisé pour l'interface d'administration
ADMIN_PASSWORD=MonMotDePasseAdminSuperSecurise123!

# Clé secrète JWT pour signer les jetons de session d'administration
JWT_SECRET=CleSecreteUniqueEtLonguePourJWT_987654321

# Clé API Google Maps (Street View & Maps)
GOOGLE_MAPS_API_KEY=AIzaSyYourGoogleMapsAPIKeyHere...
```

---

## 🏗️ Étape 2 : Lancement de l'Application

Une fois le fichier `.env` configuré, exécutez la commande suivante pour construire les images et démarrer les conteneurs en arrière-plan :

```bash
docker compose up -d --build
```

### Que fait cette commande ?
1.  **frontend-builder** : Installe les dépendances du frontend et compile l'application React en insérant la clé Google Maps.
2.  **runner** : Installe les dépendances de production du backend Express et copie les fichiers du frontend compilé.
3.  **database init** : Migre automatiquement toutes vos questions, mots et lieux depuis les fichiers JSON existants vers la base de données SQLite au premier démarrage.
4.  **caddy** : Démarre le serveur web, contacte Let's Encrypt pour générer votre certificat SSL HTTPS, et redirige le trafic public vers le serveur d'application.

---

## 💾 Persistance des Données

Les volumes Docker sont configurés pour sauvegarder automatiquement vos modifications hors du conteneur. Vos données sont persistées dans :
*   `quiz_data` (Base de données SQLite : `/app/server/data/database.sqlite`)
*   `quiz_uploads` (Images uploadées par les administrateurs : `/app/server/uploads/`)
*   `caddy_data` et `caddy_config` (Certificats SSL de votre domaine)

---

## 🛠️ Commandes Utiles de Maintenance

### Voir les logs en direct
```bash
docker compose logs -f
```

### Voir les logs du serveur de jeu uniquement
```bash
docker compose logs -f app
```

### Redémarrer les services
```bash
docker compose restart
```

### Arrêter le serveur de jeu
```bash
docker compose down
```

---

## 🔒 Sécurité et Robustesse Actuelles

L'application intègre désormais les sécurités suivantes pour le déploiement public :
1.  **Authentification Admin renforcée** : Accès protégé aux APIs sensibles par token JWT.
2.  **Protection Anti-Triche GeoTrackr** : Les coordonnées réelles et les noms de lieux ne sont plus transmis aux joueurs pendant la manche. Seule une version approximative bruitée (~200m) est envoyée pour initialiser Street View. Le score est calculé côté serveur par rapport à la vraie position. Si un joueur soumet la position approximative reçue, son score est forcé à 0 pour triche.
3.  **Persistance SQLite** : Plus aucun risque d'écritures concurrentes conflictuelles ou de fichiers JSON corrompus lors de parties simultanées.
4.  **Headers de Sécurité HTTPS** : Configurés automatiquement par Caddy pour limiter les attaques XSS, Clickjacking et MIME-sniffing.
