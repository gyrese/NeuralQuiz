# TODO - Draw Up (Pictionary Clone)

## ✅ Fonctionnalités implémentées

### Backend (Server)
- [x] `drawGameManager.js` - Gestionnaire de jeu complet
  - [x] Création/suppression de salons
  - [x] Gestion des joueurs (rejoindre, quitter, reconnexion)
  - [x] Système de tours (chaque joueur dessine à tour de rôle)
  - [x] Sélection aléatoire de mots par catégorie
  - [x] Vérification de réponse exacte
  - [x] Détection d'orthographe proche (Levenshtein distance)
  - [x] Calcul des points (base + bonus temps)
  - [x] Points bonus pour le dessinateur
  - [x] Skip de mot pour le dessinateur
  - [x] Calcul des awards de fin de partie

- [x] `drawWords.js` - Bibliothèque de mots
  - [x] 200+ mots organisés par catégorie
  - [x] Catégories: Objets (facile/moyen), Animaux, Célébrités, Actions, Lieux, Films, Expressions, Métiers, Sports
  - [x] Indices optionnels pour certains mots

- [x] `index.js` - Événements Socket.io
  - [x] `draw-create-room` / `draw-join-room` / `draw-join-remote`
  - [x] `draw-start-game` / `draw-restart-game`
  - [x] `draw-stroke` / `draw-clear` (dessin temps réel)
  - [x] `draw-submit-guess` (avec détection orthographe)
  - [x] `draw-end-round` / `draw-next-round`
  - [x] `draw-skip-word`
  - [x] Gestion déconnexions (drawer left = skip round)

### Frontend (Client)

- [x] `DrawHostView.jsx` - Vue TV/Écran principal
  - [x] Lobby avec code salon et QR Code
  - [x] Paramètres configurables (tours par joueur, temps)
  - [x] Canvas de dessin temps réel
  - [x] Timer animé (vert → jaune → rouge)
  - [x] Classement en direct avec statuts
  - [x] Feed des réponses (correct ✅, proche 🔥)
  - [x] Écran fin de round (mot révélé, résultats)
  - [x] Écran fin de partie (podium, awards)

- [x] `DrawPlayerView.jsx` - Vue Mobile/Joueur
  - [x] Écran de login (nom, avatar, code salon)
  - [x] Vue Dessinateur: canvas tactile, outils (couleurs, tailles, effacer)
  - [x] Vue Devineur: canvas lecture seule, input de réponse
  - [x] Feedback visuel (orthographe proche, trouvé)
  - [x] Skip de mot pour le dessinateur
  - [x] Reconnexion automatique

- [x] `DrawStyles.css` - Styles complets
  - [x] Design moderne (glassmorphism, gradients)
  - [x] Animations (timer, transitions)
  - [x] Responsive mobile

- [x] `App.jsx` - Intégration
  - [x] Carte Draw Up sur le menu principal
  - [x] Écran de sélection (Créer/Rejoindre)
  - [x] Gestion des URL avec paramètre `?game=draw`

## 🔧 Améliorations futures possibles

### Gameplay
- [ ] Mode "Blind" - Le dessinateur ne voit pas le canvas (miroir)
- [ ] Mode "Bomb" - Bombe qui passe au suivant si trouvé
- [ ] Sélection de catégories spécifiques par l'hôte
- [ ] Niveau de difficulté (Facile/Moyen/Difficile)
- [ ] Handicap pour joueurs avancés (temps réduit, moins de couleurs)

### Dessin
- [ ] Outil gomme
- [ ] Remplissage (bucket fill)
- [ ] Undo/Redo
- [ ] Formes géométriques (cercle, rectangle)
- [ ] Plus de couleurs (palette complète)

### Social
- [ ] Chat en jeu
- [ ] Réactions emoji des spectateurs
- [ ] Partage de dessin en fin de round
- [ ] Galerie des meilleurs dessins

### Technique
- [ ] Compression des strokes pour réduire trafic réseau
- [ ] Sauvegarde des parties en cours (persistance)
- [ ] Spectator mode
- [ ] Replays des dessins

### Mots
- [ ] Ajout de plus de célébrités françaises
- [ ] Mots personnalisés par l'hôte
- [ ] Import de listes de mots
- [ ] Mode "Objets de la maison" (pour jouer en famille)

## 📝 Notes techniques

### Fonctionnement du dessin temps réel
1. Le dessinateur trace sur le canvas mobile
2. Chaque trait (`stroke`) est envoyé au serveur avec:
   - Points normalisés (0-1 pour X et Y)
   - Couleur et taille du pinceau
3. Le serveur stocke les strokes et les broadcast
4. Tous les clients reçoivent et dessinent
5. Les late joiners reçoivent l'historique complet

### Détection d'orthographe (Levenshtein)
- Seuil = 25% de la longueur du mot
- Accents ignorés (normalization NFD)
- Caractères spéciaux ignorés
- Si distance <= seuil → "Très proche !"

### Scoring
- Base: 100 points pour deviner
- Bonus temps: +100 * (temps restant / temps total)
- Dessinateur: +50 points par joueur qui trouve

## 🗂️ Structure des fichiers

```
server/
├── drawGameManager.js    # Logique de jeu
├── drawWords.js          # Bibliothèque de mots
└── index.js              # +400 lignes pour Draw Up events

client/src/components/Draw/
├── DrawHostView.jsx      # Vue hôte (TV)
├── DrawPlayerView.jsx    # Vue joueur (mobile)
└── DrawStyles.css        # Styles
```
