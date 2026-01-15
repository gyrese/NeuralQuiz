# 🎮 NeuralQuiz - Admin Interface TODO

## 🎯 Objectif
Créer une interface d'administration centralisée pour gérer le contenu de tous les jeux de la plateforme.

---

## ✅ Fonctionnalités Implémentées

### Draw Up (Pictionary) - ✅ TERMINÉ
- [x] **CRUD Mots** : Ajouter/modifier/supprimer des mots à dessiner
- [x] **Catégories** : Gérer les catégories de mots (Animaux, Objets, Actions, etc.)
- [x] **Indices** : Ajouter des indices optionnels pour les mots
- [x] **Migration JSON** : `server/data/drawWords.json` pour stockage persistant
- [x] **API REST** : `/api/admin/draw/words` (GET, POST, PUT, DELETE)
- [x] **Interface Client** : `DrawAdmin.jsx` avec liste, filtres, formulaire modal

### GeoTrackr - ✅ TERMINÉ
- [x] **CRUD Lieux** : Ajouter/modifier/supprimer des lieux
- [x] **Migration JSON** : `server/data/geoLocations.json` pour stockage persistant
- [x] **API REST** : `/api/admin/geo/locations` (GET, POST, PUT, DELETE)
- [x] **Interface Client** : `GeoAdmin.jsx` avec liste, recherche, filtres par pays
- [x] **Lien Google Maps** : Coller un lien maps.app.goo.gl et extraire auto les coordonnées
- [x] **Lien Visualisation** : Bouton pour voir chaque lieu sur Google Street View

### 🍻 Apéro Quiz - ✅ EN COURS (Phase 1 terminée)
- [x] **Structure du jeu** : Mode équipe (1 téléphone par équipe)
- [x] **Types de questions** : QCM, Estimation, Texte libre, Date
- [x] **Éditeur de Quiz** : Interface style PowerPoint avec :
  - Panel des slides à gauche (drag & drop à venir)
  - Canvas central avec preview live
  - Panel de propriétés à droite
  - Thèmes de couleurs prédéfinis
- [x] **API REST** : `/api/apero/quizzes` (GET, POST, PUT, DELETE)
- [x] **Socket.IO** : Namespace `/apero` pour jeu en temps réel
- [x] **Host View** : Présentation fullscreen avec timer et stats live
- [x] **Player View** : Interface mobile adaptée (boutons A/B/C/D, inputs)
- [x] **Scoring** : Points de base + bonus rapidité + bonus proximité (estimation)

### À faire pour Apéro Quiz (Phase 2)
- [ ] **Drag & Drop** : Réordonner les slides par glisser-déposer
- [ ] **Import Google Slides** : Script d'extraction du texte depuis GSlides
- [ ] **Médias** : Upload d'images pour les questions
- [ ] **Animations** : Transitions entre slides, effets de révélation
- [ ] **Mode équipes avancé** : Gestion des équipes avec couleurs
- [ ] **Historique** : Sauvegarder les parties jouées pour statistiques

---

## 📋 Fonctionnalités Restantes

### 1. Gestion des Quiz (NeuralQuiz)
- [ ] **CRUD Questions** : Ajouter/modifier/supprimer des questions
- [ ] **Import/Export** : Import CSV/JSON de questions en masse
- [ ] **Catégories** : Gérer les catégories de quiz
- [ ] **Médias** : Upload d'images/vidéos pour les questions
- [ ] **Prévisualisation** : Voir le rendu d'une question avant publication

### 2. Améliorations GeoTrackr
- [ ] **Carte Interactive** : Placer des points sur une carte pour ajouter des lieux
- [ ] **Vérification Street View** : Tester automatiquement si le lieu a une couverture Street View
- [ ] **Régions** : Gérer les catégories de régions (Parcs, Plages, Marchés, etc.)
- [ ] **Import GPX** : Importer des lieux depuis des fichiers GPX

### 3. Améliorations Draw Up
- [ ] **Difficulté** : Assigner un niveau de difficulté aux mots
- [ ] **Statistiques** : Voir quels mots sont les plus/moins devinés

### 4. Gestion Globale
- [ ] **Dashboard** : Vue d'ensemble des statistiques (parties jouées, joueurs, etc.)
- [ ] **Utilisateurs** : Gérer les comptes admin
- [ ] **Logs** : Historique des modifications
- [ ] **Backup** : Export/Import de toute la base de données
- [ ] **Settings** : Configuration globale (durées par défaut, scores, etc.)

---

## 🏗️ Architecture Technique (Implémentée)

### Option A : Interface React Intégrée ✅
```
/admin → Route protégée dans l'app React existante
- Composants: AdminView.jsx, DrawAdmin.jsx, GeoAdmin.jsx, AperoAdmin.jsx, AperoEditor.jsx
- API: server/controllers/adminController.js, server/controllers/aperoController.js
- Données: server/data/*.json
```

---

## 🔐 Sécurité
- [ ] Authentification admin (username/password ou OAuth)
- [ ] Protection des routes API
- [ ] Rate limiting sur les endpoints d'admin
- [ ] Audit log des actions

---

## 📅 Priorité Mise à Jour
1. ~~**Phase 1** : CRUD basique pour les mots Draw Up~~ ✅ FAIT
2. ~~**Phase 2** : CRUD pour les lieux GeoTrackr~~ ✅ FAIT
3. ~~**Phase 3** : Apéro Quiz - Nouveau jeu complet~~ ✅ EN COURS
4. **Phase 4** : Dashboard et statistiques

---

## 📝 Notes Techniques
- **Stockage des données** :
  - `server/data/drawWords.json` → Mots Draw Up
  - `server/data/geoLocations.json` → Lieux GeoTrackr (374 lieux)
  - `server/data/apero/quizzes.json` → Quiz Apéro
- **Services** :
  - `server/drawWords.js` → Service CRUD pour Draw Up
  - `server/geoLocations.js` → Service CRUD pour GeoTrackr
  - `server/aperoQuizzes.js` → Service CRUD pour Apéro Quiz
  - `server/aperoGameManager.js` → Logique de jeu Apéro Quiz
- **Composants Client Apéro** :
  - `AperoAdmin.jsx` → Liste des quiz
  - `AperoEditor.jsx` → Éditeur type PowerPoint
  - `AperoHostView.jsx` → Présentation écran bar
  - `AperoPlayerView.jsx` → Vue mobile équipes
- Migration possible vers SQLite ou MongoDB pour faciliter l'admin à grande échelle
