# 🎮 TODO : MODES DE JEUX AVANCÉS (KAHOOT-LIKE)

Ce document liste les chantiers pour transformer l'Apéro Quiz simple en une suite de mini-jeux interactifs basés sur les réponses aux questions.

---

## 🏗️ PHASE 1 : ARCHITECTURE "GAME MODES" (Serveur)

Actuellement, le serveur gère un seul flux (Question -> Timer -> Réponse -> Score).
Il faut abstraire la logique "Game Manager".

- [ ] **Refactor `socketGame.js`** : Créer une classe `GameMode` abstraite.
- [ ] **State Management** : Le `gameState` doit inclure une propriété `modeData` qui change selon le jeu (ex: position sur la carte, hauteur de la tour, PV du boss).
- [ ] **Sélecteur de Mode** : Écran d'accueil Admin pour choisir le mode de jeu avant de lancer le quiz.

---

## 🏰 PHASE 2 : LES NOUVEAUX MODES DE JEU

### 1. ⚔️ ROYAUMES COLORÉS (Color Kingdoms)
**Concept** : 2 ou 3 Équipes (Rouge vs Bleu). Conquête de territoire sur une grille hexagonale.
- **Mécanique** :
  - Chaque bonne réponse permet de conquérir une case adjacente.
  - Les mauvaises réponses peuvent faire perdre du terrain ou geler le joueur.
- **Host View** :
  - Affiche une grande carte hexagonale.
  - Animation de la "tache d'huile" qui se répand à chaque question.
- **Tech** : Simple grille 2D array, algorithme de remplissage (flood fill).

### 2. 🏗️ LA TOUR INFERNALE (Tower Power)
**Concept** : Coopératif ou Compétitif. Construire la plus haute tour possible.
- **Mécanique** :
  - Bonne réponse = +1 Étage (ou +1 Bloc).
  - Réponse rapide = Bloc plus stable/joli.
  - Série de bonnes réponses = Échafaudage ou bonus.
  - Mauvaise réponse = La tour tremble ou perd un étage.
- **Host View** :
  - Physics Engine léger (Matter.js ou simple CSS Stack) pour voir les tours monter et osciller.

### 3. 🚀 COURSE COSMIQUE (Space Race)
**Concept** : Course linéaire visuelle.
- **Mécanique** :
  - Chaque joueur est une fusée.
  - La vitesse dépend du temps de réponse.
  - Bonus "Turbo" si 3 bonnes réponses d'affilée (Streak).
- **Host View** :
  - Scrolling horizontal ou vertical avec les avatars des joueurs.

### 4. 💎 LE COFFRE AUX TRÉSORS (Gem Collector)
**Concept** : Collecte de ressources.
- **Mécanique** :
  - Les questions rapportent des gemmes au lieu de points.
  - À la fin, on peut "acheter" des éléments cosmétiques pour son avatar (éphémère).

### 5. 👻 CHASSE AUX FANTÔMES (Survival)
**Concept** : Battle Royale simplifié.
- **Mécanique** :
  - Les derniers à répondre (ou ceux qui ont faux) perdent des PV.
  - Le but est d'être le dernier survivant (Highlander).
  - Zone de jeu qui rétrécit (comme Fortnite/PUBG).

---

## 📱 PHASE 3 : INTERFACE JOUEUR (CLIENT)

Le client mobile doit s'adapter au mode de jeu.

- [ ] **UI Dynamique** : Le client reçoit `uiLayout: 'classic' | 'team' | 'grid'` du serveur.
- [ ] **Feedback Visuel** :
  - Mode Royaume : Afficher "Vous avez conquis une case !" ou la couleur de l'équipe.
  - Mode Tour : Animation d'une grue qui pose un bloc.
- [ ] **Team Selector** : Écran avant le jeu pour choisir/assigner aléatoirement une équipe (Rouge/Bleu).

---

## 🎨 PHASE 4 : ASSETS & ANIMATIONS

Pour que ce soit "Kahoot-level", il faut du polish visuel.

- [ ] **Backgrounds animés** pour chaque mode.
- [ ] **Avatars** : Système d'avatars générés ou choisis (déjà partiellement en place avec les animaux).
- [ ] **Sons** : SFX spécifiques (bruit de construction, épée qui frappe, fusée qui décolle).

---

## 📅 PLAN D'ACTION IMMÉDIAT (PRIORITÉS)

1. **Finir l'Éditeur** (C'est la priorité actuelle).
2. Ajouter le **Sélecteur de Mode** sur l'écran "Lobby" (Salle d'attente).
3. Implémenter le mode **"Équipe"** (le plus simple : cumul des scores).
4. Implémenter le mode **"Royaumes"** (le plus visuel et fun).
