# 🌍 GeoGuessr Project - Todo List

## ✅ Terminé (Done)

### Core Logic
- [x] **Gestionnaire de Jeu** : `GeoGameManager` fonctionnel avec gestion des salons, états de jeu (LOBBY, PLAYING, ROUND_END, GAME_END).
- [x] **Système de Rounds** : Flot complet implémenté (Start -> Timer -> End Round -> Next Round -> Game Over).
- [x] **Calcul des Scores** : Formule de Haversine implémentée avec attribution de points exponentielle (max 5000 pts).
- [x] **Multi-joueurs** : Communication Socket.IO temps réel fonctionnelle.

### Client - Host (Hôte)
- [x] **Création de Salon** : Interface de configuration (nombre de manches, temps, région).
- [x] **Tableau de Bord** : Vue dashboard pendant le jeu (Timer géant, statut des joueurs).
- [x] **Affichage Résultats** : Grande carte interactive avec marqueurs de tous les joueurs.
- [x] **Contrôle** : Boutons pour forcer la fin de manche et passer à la suivante.

### Client - Player (Joueur)
- [x] **Interface de Jeu** : Vue Google Street View immersive.
- [x] **Guessing** : Mini-carte Google Maps pour placer son marqueur.
- [x] **Feedback** : Affichage immédiat de la distance et du score après la manche.
- [x] **Optimisation** : Réutilisation de l'instance Street View (fix écran noir round 2+).

### Contenu & Assets
- [x] **Base de Données** : +400 lieux chargés (Monde, Europe, Asie, Amériques, Afrique, Océanie).
- [x] **Visuels** : Utilisation des avatars des joueurs comme marqueurs sur la carte.
- [x] **Mobile** : Configuration réseau (`host: true`) pour accès depuis smartphones.

---

## 🚀 À Faire (Todo)

### 1. Interface & UX
- [x] **Sélecteur de Régions (Host)** : Mettre à jour le menu déroulant pour inclure les nouvelles régions (Asie, Afrique, Amériques, Océanie, France).
- [x] **Feedback Visuel** : Ajouter des animations de gain de points.
- [x] **Sons** : Bruitages pour :
  - Début de round (Gong/Sifflet)
  - Fin du timer (Compte à rebours)
  - Résultats (Applaudissements/Musique)
- [x] **Loading** : Spinner de chargement pendant l'initialisation de Street View.

### 2. Fonctionnalités Gameplay
- [x] **Kick Player** : Option pour l'hôte de virer un joueur inactif ou gênant.
- [x] **Rejouer** : Bouton "Rejouer" en fin de partie pour relancer sans recréer le lobby.
- [ ] **Mode "Battle Royale"** (Idée) : Le dernier joueur de chaque manche est éliminé ?
- [x] **Bonus de Temps** : Points supplémentaires pour les réponses rapides.

### 3. Technique
- [x] **Gestion Déconnexion et la reconnexion** : Gérer proprement si un joueur quitte en cours de manche (ne pas bloquer le bouton "Terminer manuellement") et le reconnecter automatiquement si il se connect a l application.
- [ ] **Optimisation API** : Mettre en cache les panoramas si possible (limité par les ToS Google).
- [ ] **Refactoring** : Extraire les composants Maps dans des fichiers séparés (`GeoMap.jsx`, `StreetView.jsx`).

### 4. Bugs Connus (À surveiller)
- [ ] Parfois le Street View peut être noir si la connexion est lente (loader à ajouter).
- [ ] Vérifier l'affichage sur très petits écrans (iPhone SE / vieux Android).
