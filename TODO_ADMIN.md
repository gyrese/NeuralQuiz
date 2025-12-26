# 🎮 NeuralQuiz - Admin Interface TODO

## 🎯 Objectif
Créer une interface d'administration centralisée pour gérer le contenu de tous les jeux de la plateforme.

---

## 📋 Fonctionnalités Prévues

### 1. Gestion des Quiz (NeuralQuiz)
- [ ] **CRUD Questions** : Ajouter/modifier/supprimer des questions
- [ ] **Import/Export** : Import CSV/JSON de questions en masse
- [ ] **Catégories** : Gérer les catégories de quiz
- [ ] **Médias** : Upload d'images/vidéos pour les questions
- [ ] **Prévisualisation** : Voir le rendu d'une question avant publication

### 2. Gestion GeoTrackr
- [ ] **CRUD Lieux** : Ajouter/modifier/supprimer des lieux
- [ ] **Carte Interactive** : Placer des points sur une carte pour ajouter des lieux
- [ ] **Vérification Street View** : Tester automatiquement si le lieu a une couverture Street View
- [ ] **Régions** : Gérer les catégories de régions (Parcs, Plages, Marchés, etc.)
- [ ] **Import GPX** : Importer des lieux depuis des fichiers GPX

### 3. Gestion Draw Up (Pictionary)
- [ ] **CRUD Mots** : Ajouter/modifier/supprimer des mots à dessiner
- [ ] **Catégories** : Gérer les catégories de mots (Animaux, Objets, Actions, etc.)
- [ ] **Difficulté** : Assigner un niveau de difficulté aux mots
- [ ] **Indices** : Ajouter des indices optionnels pour les mots difficiles
- [ ] **Statistiques** : Voir quels mots sont les plus/moins devinés

### 4. Gestion Globale
- [ ] **Dashboard** : Vue d'ensemble des statistiques (parties jouées, joueurs, etc.)
- [ ] **Utilisateurs** : Gérer les comptes admin
- [ ] **Logs** : Historique des modifications
- [ ] **Backup** : Export/Import de toute la base de données
- [ ] **Settings** : Configuration globale (durées par défaut, scores, etc.)

---

## 🏗️ Architecture Technique

### Option A : Interface React Intégrée
```
/admin → Route protégée dans l'app React existante
- Avantage : Même stack, pas de nouveau déploiement
- Inconvénient : Alourdit le bundle client
```

### Option B : App Admin Séparée
```
/admin-app → Nouvelle application React/Vue séparée
- Avantage : Séparation des concerns, bundle léger pour les joueurs
- Inconvénient : Maintenance de 2 apps
```

### Option C : Admin via JSON Files + Script CLI
```
Scripts Node.js pour éditer les fichiers JSON directement
- Avantage : Simple, pas d'interface à développer
- Inconvénient : Moins user-friendly
```

### Recommandation
**Option A** pour commencer (route `/admin` protégée), puis migrer vers **Option B** si l'app grandit.

---

## 🔐 Sécurité
- [ ] Authentification admin (username/password ou OAuth)
- [ ] Protection des routes API
- [ ] Rate limiting sur les endpoints d'admin
- [ ] Audit log des actions

---

## 📅 Priorité
1. **Phase 1** : CRUD basique pour les mots Draw Up (le plus urgent)
2. **Phase 2** : CRUD pour les lieux GeoTrackr
3. **Phase 3** : CRUD pour les questions Quiz
4. **Phase 4** : Dashboard et statistiques

---

## 📝 Notes
- Les données actuelles sont stockées dans des fichiers JS:
  - `server/drawWords.js` → Mots Draw Up
  - `server/geoLocations.js` → Lieux GeoTrackr
  - (Quiz questions à identifier)
- Migration possible vers SQLite ou MongoDB pour faciliter l'admin
