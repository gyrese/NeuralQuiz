# 🌍 GeoGuessr (Geo Tracker) - Plan de Débuguage & Stabilisation

Ce document recense tous les bugs connus, les points de friction techniques et le plan de fiabilisation pour le mode Geo Tracker. L'objectif est de garantir une expérience sans faille, même avec des déconnexions, sur tous les appareils.

---

## 🚨 Bugs Critiques & Fixes Immédiats

- [x] **Fuite de mémoire du Timer (Accélération du temps)** : Le temps s'accélérait côté salon (Host) à partir de la manche 3 à cause d'un `setInterval` non nettoyé lors de la réception de l'évènement `geo-next-round`. *(Corrigé)*
- [x] **Désynchronisation des Scores** : Vérifier que les points sont bien ajoutés côté serveur en cas de déconnexion d'un joueur juste après avoir validé sa réponse (avant l'animation de fin). *(Corrigé : Attribution correcte de 0 point pour les absents afin de préserver l'alignement des manches).*
- [x] **Bouton *Start* inactif** : Dans de rares cas, le lancement de partie depuis l'admin ne déclenche pas le Host. Revoir la chaîne d'événements `geo-start-game` -> `geo-game-started`. *(Corrigé : Reconnexion silencieuse du Host aux rooms Socket.IO).*
- [x] **Détection de fin de manche prématurée** : S'assurer que le script n'auto-skip pas si de faux événements "geo-all-guessed" sont déclenchés par des joueurs fantômes ou déconnectés. *(Corrigé : L'évènement de déconnexion ne trigger plus la fin de manche de force).*

---

## 🗺️ Stabilité Street View & Google Maps

- [x] **Écran Noir / Panorama Vide** : Sur certaines positions géographiques ou en cas de connexion lente, l'API Street View renvoie un écran noir. Améliorer la logique de "fallback" ou demander une nouvelle position au serveur si le panorama ne charge pas au bout de 5 secondes. *(Corrigé : Demande désormais automatiquement un nouveau lieu au serveur si le panorama est toujours noir au bout de 12 secondes, au lieu de recharger le même).*
- [x] **Watchdog Street View** : Actuellement, le watchdog recharge tout si le panorama n'est pas vu. Affiner le délai de détection pour éviter les rechargements intempestifs sur mobile (connexion 4G ou 3G). *(Corrigé : Le délai passe de 6 à 12 secondes avant un rechargement pour respecter les connexions plus lentes).*
- [x] **Marqueurs de Joueurs (Custom Overlay)** : Les avatars personnalisés (AvatarMarker) sur Google Maps côté Host peuvent parfois lancer des erreurs DOM lors des fermetures/ouvertures de fenêtres infoWindow. À consolider. *(Corrigé : Sécurisation de la méthode removeChild en vérifiant l'existence du noeud parent).*
- [x] **Optimisation Coûts API** : Vérifier que l'API n'est pas appelée en double lors des recharges (`geo-request-new-location`), ce qui pourrait consommer la tarification Google Maps trop rapidement. *(Corrigé : Ajout d'un verrou "isRequestingLocationRef" empêchant strictement les requêtes en boucle/parallèle).*

---

## 🔄 Synchronisation Socket & Gestion d'État (State Management)

- [x] **Reconnexion Télécommande / Admin** : Quand la télécommande rafraîchit la page, la liaison avec le Host doit remonter instantanément (sync de `gameState`, `currentRound`, `timeLeft`). *(Corrigé : `geo-join-remote` renvoie désormais `gameState`, `currentLocation`, `roundStartTime`, et les résultats en cours. La Remote resynchro son timer avec l'écart serveur).*
- [x] **Leaking Listeners (Écouteurs en double)** : S'assurer que chaque `useEffect` côté Client (Host et Player) désabonne proprement TOUS les évènements `socket.off(...)` lors du démontage pour éviter les doubles déclenchements. *(Corrigé : Ajout de `socket.off('connect', handleReconnect)` dans le cleanup de la Remote).*
- [x] **Gestion des Joueurs Déconnectés** : Si un joueur quitte la partie (fermeture du navigateur) au milieu d'un round, il ne doit plus bloquer la condition `geo-all-guessed` (Tous les joueurs ont répondu). *(Corrigé : `allPlayersGuessed()` filtre les joueurs avec `!p.disconnected`).*
- [x] **Race Condition sur le "Next Round"** : Si l'Host ET la Télécommande appellent `nextRound` en même temps, le serveur ne doit avancer la partie qu'une seule fois. *(Corrigé : `nextRound` côté serveur bloque si `gameState !== 'ROUND_END'`. `endRound` bloque via un flag `isEndingRound` sur le room).*

---

## 🎨 Interface, UX & Animations Pépins

- [x] **Affichage du Classement (Leaderboard) déformé** : Sur le Host, si un nom de joueur est trop long, le podium ou les barres de classement sont cassés visuellement. Ajouter une troncature de texte (`ellipsis`). *(Corrigé : Ajout de text-overflow: ellipsis et whitespace: nowrap sur .geo-podium-name et .geo-final-name)*
- [x] **Clignotement du Timer (Flickering)** : Le décalage de ping entre le serveur (`roundStartTime`) et le client provoque parfois un saut du chronomètre (ex: passage direct de 58 à 56s). Utiliser une simple interpolation locale visuelle. *(Corrigé : Implémentation d'interpolation lisse du timer basée sur roundStartTime côté client et serveur)*
- [x] **Superposition Z-Index** : Le `Confetti` ou les Overlays peuvent parfois bloquer les clics sur les boutons de navigation cachés du Host. *(Corrigé : Ajout de pointer-events: none au confetti-container et countdown-overlay, réduction des z-index)*
- [x] **Feedback des réponses (Lobby)** : L'emoji flottant ou la validation "En attente des autres" ne s'affiche parfois pas assez clairement côté Joueur. *(Corrigé : Animations CSS améliorées pour les messages de succès et d'attente, pulse animations et émojis animés)*
- [x] **Repenser la carte du monde** : Sur mobile la carte est petite et parfois compliqué de repondre precisement, refondre et repensé la carte du monde *(Corrigé : Augmentation de la hauteur par défaut de 120px à 240px, ajout de media queries pour ultra-petits écrans et mode landscape)*

---

## 📱 Optimisations Mobiles (Joueurs)

- [ ] **Carte de "Guess" sur iPhone/Safari** : Le défilement de la page interfère parfois avec le glissement de la Google Map (scroll lock). Empêcher le document body de scroller lorsque le doigt est sur la carte.
- [ ] **Performance du Parallax/Animations** : Désactiver ou alléger la rotation automatique Street View et les particules sur les vieux smartphones pour garder le site fluide.
- [ ] **Mode "Standby" iOS** : Empêcher le téléphone de s'éteindre (Sleep mode) pendant le round si possible (API WebLock ou vidéo invisible).

---

## 📝 Archives (Fonctionnalités déjà stables)

- [x] Création des salons et codes PIN (Socket).
- [x] Lancement de manche (Street View synchronisé).
- [x] Calcul de score Haversine (distance vs. points).
- [x] Télécommande admin pour forcer le Next Round.
- [x] Affichage de fin avec Map et marqueurs des joueurs.
