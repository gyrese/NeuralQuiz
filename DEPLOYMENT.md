# 🚀 Guide de Déploiement - Neural Quiz

Ce guide vous explique comment déployer l'application **Neural Quiz** (Antigravity) en mode production.

## 📋 Prérequis

*   **Node.js** (version 18 ou supérieure recommandée) doit être installé sur la machine.
*   Accès au terminal/invite de commande.

---

## 🏗️ Étape 1 : Construction du Frontend (Client)

Le frontend (interface utilisateur) doit être "construit" (compilé) pour être servi par le serveur backend.

1.  Ouvrez votre terminal et allez dans le dossier `client` :
    ```bash
    cd c:/ai/Antigravity/client
    ```

2.  Installez les dépendances (si ce n'est pas déjà fait) :
    ```bash
    npm install
    ```

3.  Lancez la construction du projet :
    ```bash
    npm run build
    ```
    ✅ **Résultat** : Un dossier `dist` va être créé dans `client/`. Il contient tous les fichiers optimisés pour la production.

---

## ⚙️ Étape 2 : Configuration du Backend (Serveur)

Le serveur Node.js va gérer la logique du jeu ET servir les fichiers du frontend que nous venons de créer.

1.  Allez dans le dossier `server` :
    ```bash
    cd c:/ai/Antigravity/server
    ```

2.  Installez les dépendances :
    ```bash
    npm install
    ```

3.  **⚠️ IMPORTANT : Activation du mode Production**
    
    Vous devez modifier le fichier `server/index.js` pour qu'il serve les fichiers du client.
    
    Ouvrez `c:/ai/Antigravity/server/index.js` et trouvez la section tout en bas (lignes ~395).
    
    **Décommentez** le bloc de code suivant (enlevez les `/*` et `*/`) :

    ```javascript
    // --- SERVITUDE STATIQUE (POUR LE NAS/PROD) ---
    // Sert les fichiers du frontend buildé s'ils existent
    app.use(express.static(path.join(__dirname, '../client/dist')));

    // Pour toutes les autres requêtes (SPA), renvoyer index.html
    app.get('/*', (req, res) => {
        const indexPath = path.join(__dirname, '../client/dist/index.html');
        if (require('fs').existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send("Frontend build not found. Did you run 'npm run build' in the client folder?");
        }
    });
    ```

---

## 🚀 Étape 3 : Lancement

Une fois le frontend construit et le backend configuré :

1.  Assurez-vous d'être dans le dossier `server` :
    ```bash
    cd c:/ai/Antigravity/server
    ```

2.  Démarrez le serveur :
    ```bash
    npm start
    ```

3.  **Accès à l'application** :
    *   Ouvrez votre navigateur.
    *   L'application est maintenant accessible sur le port **3001** (et non plus 5173).
    *   Adresse locale : `http://localhost:3001`
    *   Adresse réseau (pour les autres joueurs) : `http://VOTRE_ADRESSE_IP:3001`

---

## 🛡️ Optionnel : Garder le serveur actif (PM2)

Pour éviter que le serveur ne s'arrête si vous fermez la console, utilisez **PM2**.

1.  Installez PM2 globalement :
    ```bash
    npm install -g pm2
    ```

2.  Lancez le serveur avec PM2 :
    ```bash
    cd c:/ai/Antigravity/server
    pm2 start index.js --name "neural-quiz"
    ```

3.  Commandes utiles :
    *   Voir le statut : `pm2 status`
    *   Arrêter : `pm2 stop neural-quiz`
    *   Redémarrer : `pm2 restart neural-quiz`
    *   Voir les logs : `pm2 logs`
