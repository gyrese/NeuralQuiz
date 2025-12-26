# 🎨 Draw Up (Pictionary) - Todo List

## ✅ Terminé (Done)

### Core Logic
- [x] **Gestionnaire de Jeu** : `DrawGameManager` fonctionnel avec gestion des salons, états (LOBBY, PLAYING, ROUND_END, GAME_END).
- [x] **Système de Rounds** : Rotation des dessinateurs, mots aléatoires par catégorie.
- [x] **Système de Points** : Points basés sur la rapidité (temps restant), bonus pour le dessinateur.
- [x] **Détection Réponses** : Comparaison normalisée (accents, casse) + détection "très proche" (Levenshtein).
- [x] **Multi-joueurs** : Communication Socket.IO temps réel pour le dessin.

### Client - Host (Hôte TV)
- [x] **Création de Salon** : Code de room + QR code pour rejoindre.
- [x] **Lobby** : Configuration (tours par joueur, temps par tour, catégories).
- [x] **Vue Jeu** : Canvas temps réel, timer, classement, fil des réponses.
- [x] **Fin de Manche** : Révélation du mot, résultats des joueurs.
- [x] **Fin de Partie** : Podium, récompenses (Sherlock, Picasso).

### Client - Player (Joueur Mobile)
- [x] **Écran Join** : Saisie code salon, nom, choix avatar.
- [x] **Vue Dessinateur** : Palette couleurs, tailles pinceaux, bouton effacer, bouton passer.
- [x] **Vue Devineur** : Canvas en lecture seule, champ de saisie réponse.
- [x] **Feedback** : Animation "Bien joué" quand réponse correcte.
- [x] **Dessin Mobile** : `touch-action: none` pour empêcher le scroll pendant le dessin.

### Corrections Récentes
- [x] **Fix boutons bloqués** : Ajout `pointer-events: none` sur l'overlay CSS décoratif.
- [x] **Fix scroll mobile** : Ajout `touch-action: none` sur canvas et conteneurs.

---

## 🚀 À Faire (Todo)

### 1. Bugs à Corriger 🐛
- [ ] **Rotation Dessinateur** : Vérifier que le 2e joueur dessine bien au round 2 (logs debug en place).
- [ ] **Reconnexion** : Tester la reconnexion en cours de partie.
- [ ] **Late Join** : Permettre aux joueurs de rejoindre en cours de partie.

### 2. Fonctionnalités Manquantes 🔧
- [ ] **Historique Canvas** : Rejouer l'historique pour les nouveaux arrivants.
- [ ] **Son** : Ajouter des effets sonores (bonne réponse, timer, fin de manche).
- [ ] **Indice Progressif** : Révéler des lettres du mot au fur et à mesure du temps.
- [ ] **Chat/Guesses Visibles** : Afficher les essais incorrects des autres joueurs.

### 3. Améliorations UX 🎨
- [ ] **Animations Style Kahoot**
  - Compte à rebours 3-2-1 au début de chaque manche
  - Confettis pour le gagnant du round
  - Animation du score qui défile
  
- [ ] **Outils de Dessin Avancés**
  - Gomme
  - Undo/Redo
  - Remplissage de zone
  - Formes géométriques (cercle, carré, ligne)

- [ ] **Catégories de Mots**
  - [ ] Ajouter plus de catégories (Films, Jeux Vidéo, Célébrités, etc.)
  - [ ] Permettre de sélectionner plusieurs catégories dans le lobby
  - [ ] Afficher la catégorie sélectionnée pendant la partie

### 4. Modes de Jeu Alternatifs 🎮
- [ ] **Mode Équipes** : 2 équipes s'affrontent
- [ ] **Mode Collaboration** : Tous dessinent ensemble
- [ ] **Mode Blind** : Le dessinateur ne voit pas ce qu'il dessine

### 5. Technique ⚙️
- [ ] **Optimisation Canvas** : Utiliser requestAnimationFrame pour le dessin
- [ ] **Compression Strokes** : Réduire la taille des données envoyées
- [ ] **Tests** : Ajouter des tests pour `DrawGameManager`

---

## 📝 Notes Techniques

### Architecture
- **DrawGameManager** : Gère l'état serveur (rooms, joueurs, mots, scores)
- **DrawHostView** : Vue TV/ordinateur principal
- **DrawPlayerView** : Vue mobile des joueurs

### Mots et Catégories
Les mots sont définis dans `server/drawWords.js` avec structure :
```javascript
{ word: "Chat", category: "Animaux", hint: "Animal de compagnie" }
```

### Synchronisation Dessin
1. Joueur dessine → envoie stroke au serveur
2. Serveur stocke dans `canvasHistory` + broadcast aux autres
3. Host/autres joueurs reçoivent et dessinent le stroke

### URLs
- Host : `http://localhost:5173` → sélectionner "DRAW UP" → "Créer une partie"
- Player : `http://192.168.X.X:5173?code=XXXX&game=draw` (ou scanner QR code)
