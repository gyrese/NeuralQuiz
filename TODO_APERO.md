# 🍻 Apéro Quiz - TODO

## 🎯 Objectif
Quiz de bar interactif où les équipes répondent sur leur téléphone pendant que le diaporama est affiché sur l'écran du bar.

---

## ✅ Phase 1 - Fondations (TERMINÉ)

### Backend
- [x] `aperoGameManager.js` - Gestion des salles et logique de jeu
- [x] `aperoQuizzes.js` - CRUD pour les quiz (stockage JSON)
- [x] `aperoController.js` - API REST + Socket.IO namespace `/apero`
- [x] Intégration dans `server/index.js`

### Types de Questions
- [x] **QCM** (A/B/C/D) - Correct = 100pts + bonus rapidité
- [x] **Estimation** (nombre) - Plus proche = plus de points + bonus top 3
- [x] **Texte libre** - Match exact (insensible casse/accents)
- [x] **Date** - Proximité en jours
- [x] **Vrai/Faux** - Correct = 100pts

### Frontend Admin
- [x] `AperoAdmin.jsx` - Liste des quiz (créer, éditer, dupliquer, supprimer)
- [x] `AperoEditor.jsx` - Éditeur de slides type PowerPoint
  - [x] Panel gauche : Liste des slides avec sélection
  - [x] Canvas central : Preview live du slide
  - [x] Panel droit : Propriétés (question, options, réponse, timer, thème)
- [x] Thèmes de couleur prédéfinis (10 thèmes)
- [x] Types de slides : Titre, Question QCM, Estimation, Texte, Score

### Frontend Host (Écran Bar)
- [x] `AperoHostView.jsx` - Présentation fullscreen
- [x] Sélection de quiz au démarrage
- [x] QR Code + code de salon pour les équipes
- [x] Affichage des slides avec timer
- [x] Stats live (nombre de réponses reçues)
- [x] Révélation de la bonne réponse avec stats A/B/C/D
- [x] Contrôles au clavier (← → navigation, Entrée ouvrir/révéler, F fullscreen)

### Frontend Player (Mobile Équipe)
- [x] `AperoPlayerView.jsx` - Interface mobile
- [x] Écran de connexion (code + nom d'équipe)
- [x] Boutons A/B/C/D pour QCM
- [x] Input numérique pour estimation
- [x] Input texte pour questions texte libre
- [x] Confirmation de réponse
- [x] Affichage résultat (correct/incorrect + points)

---

## 🔨 Phase 2 - Améliorations UX (EN COURS)

### Éditeur
- [ ] **Drag & Drop** : Réordonner les slides par glisser-déposer
- [ ] **Copier/Coller** : Dupliquer un slide rapidement
- [ ] **Raccourcis clavier** : Ctrl+S sauvegarder, Ctrl+N nouveau slide
- [ ] **Undo/Redo** : Annuler les modifications
- [ ] **Preview Mode** : Voir le quiz comme un joueur

### Médias
- [ ] **Upload d'images** : Ajouter une image à une question
- [ ] **Positionnement** : Image en fond, à gauche, à droite
- [ ] **GIFs animés** : Support des animations
- [ ] **Redimensionnement** : Ajuster la taille de l'image

### Thèmes & Styles
- [ ] **Thème par slide** : Pouvoir changer le thème slide par slide
- [ ] **Couleurs personnalisées** : Picker de couleur pour background
- [ ] **Polices** : Choix de police pour le texte
- [ ] **Animations** : Transitions entre slides

---

## 🚀 Phase 3 - Fonctionnalités Avancées

### Import/Export
- [ ] **Import Google Slides** : Extraire texte depuis URL GSlides
- [ ] **Import CSV** : Importer questions depuis fichier CSV
- [ ] **Export PDF** : Exporter le quiz en PDF
- [ ] **Partage** : Lien de partage pour collaborer sur un quiz

### Mode Équipe Avancé
- [ ] **Couleur d'équipe** : Chaque équipe a une couleur assignée
- [ ] **Avatar d'équipe** : Emoji ou image pour identifier l'équipe
- [ ] **Historique des réponses** : Voir les réponses de chaque équipe
- [ ] **Mode Jokers** : 50/50, Question bonus, etc.

### Animations & Effets
- [ ] **Countdown animé** : 3-2-1 avant ouverture question
- [ ] **Confetti** : Animation pour bonne réponse
- [ ] **Révélation progressive** : Montrer les réponses une par une
- [ ] **Musique** : Sons de fond, jingles

### Statistiques
- [ ] **Historique des parties** : Sauvegarder les scores par partie
- [ ] **Analytics** : Questions les plus réussies/ratées
- [ ] **Export résultats** : CSV des scores finaux

---

## 📋 Phase 4 - Production Ready

### Robustesse
- [ ] **Reconnexion automatique** : Pour les équipes déconnectées
- [ ] **Sauvegarde auto** : Sauvegarder l'éditeur toutes les 30s
- [ ] **Mode hors-ligne** : Fonctionner sans réseau (host)

### Performance
- [ ] **Lazy loading** : Charger les images à la demande
- [ ] **Optimisation** : Réduire la taille des bundles

### Sécurité
- [ ] **Validation** : Valider les entrées côté serveur
- [ ] **Rate limiting** : Limiter les requêtes

---

## 🐛 Bugs Connus

- [ ] (Aucun pour l'instant - à remplir après tests)

---

## 💡 Idées Futures

- [ ] **Mode Buzzer** : Premier à répondre correctement gagne plus de points
- [ ] **Mode Blind Test** : Questions audio (extraits musicaux)
- [ ] **Mode Photo** : Identifier une image
- [ ] **Mode Géo** : Placer un lieu sur une carte (fusion avec GeoTrackr)
- [ ] **Mode Battle Royale** : Élimination progressive
- [ ] **Intégration Twitch/YouTube** : Questions du chat

---

## 📁 Structure des Fichiers

```
server/
├── aperoGameManager.js    # Logique de jeu (salles, scores, timer)
├── aperoQuizzes.js        # CRUD quiz (lecture/écriture JSON)
├── controllers/
│   └── aperoController.js # Routes API + Socket.IO
└── data/
    └── apero/
        └── quizzes.json   # Stockage des quiz

client/src/components/Apero/
├── AperoAdmin.jsx         # Liste des quiz (admin)
├── AperoEditor.jsx        # Éditeur de slides (admin)
├── AperoHostView.jsx      # Présentation écran bar (host)
├── AperoPlayerView.jsx    # Vue mobile (équipes)
└── AperoStyles.css        # Styles CSS dédiés
```

---

## 📝 Notes

- **5 quiz par semaine** : L'éditeur doit être rapide et efficace
- **Mode équipe** : 1 téléphone par équipe (pas de scores individuels)
- **Types de questions** : Priorité au QCM, mais estimation et texte libre sont importants
- **Migration GSlides** : Les quiz existants sont sur Google Slides, un import serait très utile
