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

## 🔨 Phase 2 - Améliorations UX & Design (PRIORITÉ)

### Design & Architecture Graphique
- [x] **Stack Technique** : Intégration de `framer-motion` (Animations fluides comme Kahoot)
- [x] **Structure Slide** : Séparation stricte Background (avec overlay opacité 60%) / Média (Image/Vidéo/GIF)
- [x] **Refonte Host View** : Animations d'entrée, timer pulsant, podium animé
- [x] **Refonte Admin** : Grille de quiz moderne, previews visuelles, actions rapides

### Player Mobile
- [x] **Refonte Player UI** : Interface immersive Dark/Neon, gros boutons couleur style Kahoot
- [x] **Feedback** : Animations Succès/Échec plein écran, vibrations
- [x] **Attente** : Écran "Regardez l'écran" animé

### Éditeur (WYSIWYG)
- [x] **Mode Canvas Libre** : Intégration de `react-rnd` pour Drag & Drop & Resize
- [x] **Types d'éléments** : Texte riche, Image, Forme (Rectangle/Rond), Sticker
- [x] **Toolbar** : Outils de mise en forme (Police, Couleur, Alignement, Z-Index)
- [x] **Menu Contextuel** : Clic droit (Copier/Coller, Premier plan, Animer...)
- [x] **Édition Rapide** : Double-clic pour éditer le texte
- [x] **Animations d'éléments** : Apparition/Disparition au clic (Séquenceur)
- [ ] **Drag & Drop Slides** : Réordonner la liste des slides (Sidebar)
- [ ] **Undo/Redo** : Annuler les modifications
- [ ] **Preview Mode** : Voir le quiz comme un joueur

### Médias & Contenu
- [ ] **Upload d'images** : Stockage local des images (Backend)
- [ ] **Import Google Slides** : Script d'extraction du texte depuis GSlides
- [ ] **Vidéo Youtube** : Ajouter une vidéo à une question
- [ ] **GIFs animés** : Support des animations

### Thèmes & Styles
- [ ] **Thème par slide** : Pouvoir changer le thème slide par slide
- [ ] **Couleurs personnalisées** : Picker de couleur pour background
- [ ] **Animations Globales** : Transitions entre slides (Fondus, Glissements)

---

## 🚀 Phase 3 - Fonctionnalités Avancées

### Import/Export
- [x] **Import Google Slides** : Import PDF -> Images de fond
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
- [x] **Reconnexion automatique** : Hôte (persist session) et joueurs
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
