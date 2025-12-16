# 🌍 GeoGuessr Project - Todo List

## ✅ Terminé (Done)

### Core Logic
- [x] **Gestionnaire de Jeu** : `GeoGameManager` fonctionnel avec gestion des salons, états de jeu (LOBBY, PLAYING, ROUND_END, GAME_END).
- [x] **Système de Rounds** : Flot complet implémenté (Start -> Timer -> End Round -> Next Round -> Game Over).
- [x] **Calcul des Scores** : Formule de Haversine implémentée avec attribution de points exponentielle (max 5000 pts).
- [x] **Multi-joueurs** : Communication Socket.IO temps réel fonctionnelle.
- [x] **Synchronisation Timer** : Timer synchronisé entre Host et joueurs via `roundStartTime` serveur.
- [x] **Auto-progression** : La partie avance automatiquement (30s après fin de manche, timer déclenche endRound).

### Client - Host (Hôte)
- [x] **Création de Salon** : Interface de configuration (nombre de manches, temps, région).
- [x] **Tableau de Bord** : Vue dashboard pendant le jeu (Timer géant, statut des joueurs).
- [x] **Affichage Résultats** : Grande carte interactive avec marqueurs de tous les joueurs.
- [x] **Contrôle** : Boutons pour forcer la fin de manche et passer à la suivante.
- [x] **Jouable sans télécommande** : La partie peut être jouée uniquement depuis le Host.

### Client - Player (Joueur)
- [x] **Interface de Jeu** : Vue Google Street View immersive.
- [x] **Guessing** : Mini-carte Google Maps pour placer son marqueur.
- [x] **Feedback** : Affichage immédiat de la distance et du score après la manche.
- [x] **Optimisation** : Réutilisation de l'instance Street View (fix écran noir round 2+).
- [x] **Paramètre newgame** : `?newgame=1` dans l'URL pour éviter la reconnexion automatique.

### Contenu & Assets
- [x] **Base de Données** : +400 lieux chargés (Monde, Europe, Asie, Amériques, Afrique, Océanie).
- [x] **Visuels** : Utilisation des avatars des joueurs comme marqueurs sur la carte.
- [x] **Mobile** : Configuration réseau (`host: true`) pour accès depuis smartphones.
- [x] **Catégories spéciales** : Parcs d'attractions, Plages, Marchés avec filtrage par mots-clés.

### Télécommande Admin
- [x] **Télécommande Mobile** : Interface de contrôle dédiée (`GeoRemoteView.jsx`).
- [x] **QR Code Télécommande** : Deuxième QR code dans le lobby pour accéder à l'interface de contrôle.
- [x] **Persistance de Session** : Reconnexion automatique robuste lors du rafraîchissement.
- [x] **Sync Settings** : Les settings modifiés sur la télécommande sont broadcastés au Host.

---

## 🚀 À Faire (Todo)

### 1. Animations Style Kahoot 🎮
> Priorité haute - rendre l'expérience plus dynamique et engageante

- [ ] **Animation Début de Manche**
  - Compte à rebours géant 3-2-1 en overlay
  - Animation de zoom avant sur le globe terrestre
  - Son de démarrage épique

- [ ] **Animation Timer**
  - Effet pulsant quand il reste < 10 secondes
  - Changement de couleur progressif (vert → jaune → rouge)
  - Shake/tremblement dans les 5 dernières secondes

- [ ] **Animation Fin de Manche**
  - Confettis pour le gagnant du round
  - Animation de score qui défile (compteur animé)
  - Transition fluide entre les écrans

- [ ] **Animation Classement**
  - Barres de score qui s'allongent avec effet de course
  - Podium 3D animé pour les 3 premiers
  - Emoji qui rebondissent à côté des noms

- [ ] **Animation Réponse Joueur**
  - Feedback visuel quand un joueur répond sur le Host (icône qui apparaît)
  - Animation de marqueur sur la carte
  - Effet de propagation comme une onde

- [ ] **Animation Fin de Partie**
  - Feux d'artifice pour le vainqueur final
  - Musique de victoire épique
  - Animation du trophée

- [ ] **Transitions Écrans**
  - Slide-in / slide-out pour les changements d'état
  - Fade-in progressif des éléments
  - Parallax effect sur les fonds

### 2. Améliorations UX
- [ ] **Mode Battle Royale** : Élimination du dernier à chaque manche
- [ ] **Mode Équipes** : 2 à 4 équipes qui s'affrontent
- [ ] **Tableau de Bord Live** : Afficher les distances en temps réel pendant la manche

### 3. Technique
- [ ] **Optimisation API** : Préchargement Street View au lobby
- [ ] **Refactoring** : Extraire `GeoMap.jsx`, `StreetView.jsx` en composants séparés
- [ ] **Tests** : Ajouter des tests pour le `geoGameManager`

### 4. Bugs Connus
- [ ] Vérifier l'affichage sur très petits écrans (iPhone SE)
- [ ] Street View peut être lent sur connexions 3G

---

## 📝 Notes Techniques

### Synchronisation Timer
Le serveur stocke `room.roundStartTime = Date.now()` au début de chaque round.
Les clients calculent le temps restant : `remaining = timePerRound - (Date.now() - roundStartTime) / 1000`

### Paramètres URL
- `?room=XXXX` : Pré-remplit le code du salon
- `?newgame=1` : Efface la session précédente, empêche la reconnexion auto
