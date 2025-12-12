# 🔄 Relancer Proprement avec PM2

Si vous voyez un ancien processus ("monnaie virtuelle"), nous allons nettoyer cela et lancer proprement **Neural Quiz**.

Sur le VPS, dans le dossier `~/LTNhout/server` :

### 1. Nettoyer les anciens processus (Optionnel mais recommandé)
Si "monnaie virtuelle" ne sert plus ou utilise le même port (3001), supprimez-le :

```bash
pm2 delete all
```
*(Cela arrête tout. Si vous avez d'autres sites importants qui tournent sur ce VPS, faites plutôt `pm2 delete "monnaie virtuelle"` ou `pm2 delete ID`)*

### 2. Démarrer le Serveur Neural Quiz

Lancez cette commande pour démarrer votre serveur :

```bash
# Assurez-vous d'être dans le dossier server
cd ~/LTNhout/server

# Démarrer
pm2 start index.js --name "neural-quiz"
```

### 3. Vérifier

```bash
pm2 status
```
Vous devriez voir `neural-quiz` avec un statut **online** (vert).

Ensuite, testez l'accès au site dans votre navigateur !
