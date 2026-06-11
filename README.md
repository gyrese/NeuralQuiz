<p align="center">
  <img src="logo.png" alt="GAME_HUB Logo" width="180" height="180" style="border-radius: 24px; box-shadow: 0 8px 30px rgba(0,255,65,0.2);" />
</p>

<h1 align="center">GAME_HUB</h1>

<p align="center">
  <strong>Une plateforme de jeux multijoueurs en temps réel de qualité premium pour vos événements, soirées et team buildings.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Stack-Node%20%7C%20React%20%7C%20Socket.IO%20%7C%20SQLite-brightgreen" alt="Stack" />
  <img src="https://img.shields.io/badge/Licence-ISC-blue" alt="Licence" />
  <img src="https://img.shields.io/badge/Docker-Compatible-blue" alt="Docker" />
  <img src="https://img.shields.io/badge/Tests-Playwright%20E2E-orange" alt="Playwright" />
</p>

---

## 🎮 Les Expériences de Jeu

GAME_HUB propose quatre modes de jeu uniques conçus pour l'interaction en temps réel :

1. **🧠 NEURAL_QUIZ**  
   Un test de connaissances interactif orienté "Score de QI". Les joueurs répondent à des questions stimulantes avec un système de score dynamique et un classement en temps réel.
   - *Esthétique :* Futuriste Cyberpunk (Néon vert, grid animée).
   - *Technologie :* Synchronisation de questions via WebSocket.

2. **🌍 GEO_TRACKR**  
   Inspiré des meilleurs jeux de géodiffusion. Les joueurs sont placés dans une vue Street View de Google Maps et doivent deviner leur position exacte sur une carte interactive mondiale.
   - *Esthétique :* Épuré et technologique (Cyan néon).
   - *Fonctionnalités :* Calcul de distance et score côté serveur, anti-triche (coordonnées floues envoyées au client).

3. **🎨 DRAW_UP**  
   Un clone de Pictionary / Skribbl.io dynamique en temps réel. Un joueur dessine un mot imposé sur sa tablette ou son téléphone pendant que les autres tentent de le deviner dans un fil de chat en direct.
   - *Esthétique :* Style Comic Book BD (Néo-brutalisme, contours noirs épais, bulles de dialogue, couleurs vives).
   - *Fonctionnalités :* Canvas collaboratif partagé, détection automatique des mots proches (algorithme de similarité).

4. **🍻 APÉRO_QUIZ**  
   L'expérience de quiz de bar ultime. L'hôte affiche la partie sur un grand écran (projecteur/télévision) tandis que les joueurs se connectent avec leurs smartphones pour s'en servir de manette et de buzzer.
   - *Esthétique :* Ambiance conviviale et chaleureuse (Or/Jaune).
   - *Fonctionnalités :* Mode multi-écrans asymétrique synchronisé.

---

## 🛠️ Stack Technique

### Frontend
- **Framework :** React 19 + Vite 7
- **Style :** Tailwind CSS 3 + Bootstrap 5 (pour certains composants)
- **Animations :** Framer Motion
- **Dessin (DrawUp) :** Konva + React Konva
- **Réseau :** Socket.IO Client

### Backend
- **Serveur :** Node.js + Express 5 (v5.1.0)
- **Base de données :** SQLite (Base de données locale persistante et légère via `sqlite3`)
- **Communication bidirectionnelle :** Socket.IO (Sockets en temps réel avec fallback polling)
- **Sécurité :** Bcryptjs (hachage) + JWT (JSON Web Tokens) pour l'administration
- **Upload d'images :** Multer

### Infrastructure & Déploiement
- **Conteneurisation :** Docker + Docker Compose (approche multi-stage build)
- **Reverse Proxy :** Caddy (génération automatique des certificats SSL Let's Encrypt et routage HTTPS)

---

## 🛡️ Fonctionnalités de Sécurité & Robustesse

- **Validation des Secrets (Fail-Fast) :** Le serveur Node refuse de démarrer si les clés essentielles (`JWT_SECRET`, `ADMIN_PASSWORD`) ne sont pas définies.
- **Protection API :** Limitation du taux de requêtes (Rate limiting) à 10 tentatives/15 min pour le login admin et 300 requêtes/min par IP au niveau global.
- **Anti-triche GeoTrackr :** Le serveur envoie uniquement des coordonnées approximatives à ~200 mètres aux joueurs, et calcule les distances/scores uniquement côté serveur.
- **Sécurité SSRF :** Validation rigoureuse des redirections et des hôtes Google Maps autorisés.
- **Requêtes paramétrées :** Protection intégrale contre les injections SQL grâce aux requêtes préparées SQLite.

---

## 🚀 Démarrage Rapide

### Prérequis
- **Node.js** version 20+
- **Clé API Google Maps** (nécessaire pour le Street View de GeoTrackr)

### Configuration
1. Créez un fichier `.env` à la racine à partir du modèle exemple :
   ```bash
   cp .env.example .env
   ```
2. Ouvrez le fichier `.env` et configurez les variables requises :
   - `SITE_ADDRESS` (votre nom de domaine)
   - `ADMIN_PASSWORD` (mot de passe d'administration)
   - `JWT_SECRET` (clé secrète pour signer les tokens JWT)
   - `GOOGLE_MAPS_API_KEY` (votre clé Google Cloud active pour Maps JS et Street View Static API)

### Mode Développement

#### 1. Lancer le Serveur (Backend)
```bash
cd server
npm install
npm run dev
```
Le serveur démarrera en écoute sur le port **3005**.

#### 2. Lancer le Client (Frontend)
```bash
cd client
npm install
npm run dev
```
L'application client sera accessible à l'adresse indiquée dans votre terminal (généralement `http://localhost:5173`).

### Tests de Validation
Pour lancer les tests de validation de bout en bout (E2E) avec Playwright :
```bash
cd client
npm run test:e2e
```

---

## 🐳 Déploiement en Production

Pour déployer GAME_HUB en production sur un VPS Ubuntu via Docker et Caddy :
1. Assurez-vous d'avoir Docker et Docker Compose installés sur votre machine cible.
2. Suivez les étapes pas-à-pas détaillées dans la documentation de déploiement :
   👉 **[Consulter DEPLOYMENT.md](DEPLOYMENT.md)**

---

## 📂 Structure du Projet

```text
├── client/                 # Application Frontend (React/Vite)
│   ├── src/
│   │   ├── components/     # Composants réutilisables par jeu
│   │   ├── pages/          # Vues principales (Home, Join, Jeux...)
│   │   └── utils/          # Scripts utilitaires et gestion sockets
│   └── playwright.config.cjs
├── server/                 # Serveur Backend (Node/Express/Socket.io)
│   ├── controllers/        # Logique métier et gestionnaires sockets
│   ├── data/               # Base de données SQLite et schémas
│   └── index.js            # Point d'entrée de l'API et des serveurs
├── Dockerfile              # Dockerfile pour l'image de l'application
├── docker-compose.yml      # Configuration multi-services (app + caddy)
├── Caddyfile               # Configuration du reverse proxy
└── DEPLOYMENT.md           # Guide d'installation et de maintenance VPS
```

---

*Développé pour offrir la meilleure expérience utilisateur possible, fluide et sans compromis.*
