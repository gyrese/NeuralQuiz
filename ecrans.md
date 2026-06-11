# DrawUp — Inventaire complet des écrans

> Document de référence pour la refonte design globale.
> Contexte : DrawUp est un jeu de dessin/devinettes multijoueur en temps réel (style Skribbl.io), avec une identité visuelle **Comic Book BD** (neo-brutalisme, bords noirs épais, ombres décalées, couleurs vives).

---

## Architecture des vues

DrawUp a deux parcours parallèles, synchronisés via WebSocket :

```
HÔTE (DrawHostView)        JOUEUR (DrawPlayerView)
─────────────────          ────────────────────────
   CREATING                   JOIN FORM
      ↓                           ↓
   LOBBY           ←→         LOBBY
      ↓                           ↓
   PLAYING         ←→         PLAYING (dessinateur ou devineur)
      ↓                           ↓
   ROUND_END       ←→         ROUND_END
      ↓                           ↓
      └── [boucle N tours] ──────┘
      ↓                           ↓
   GAME_END        ←→         GAME_END
```

---

## Écran 1 — Page d'accueil DrawUp

**Fichier :** `client/src/pages/draw/DrawSelectPage.jsx`
**Route :** `/draw`

### Rôle
Point d'entrée du jeu. L'utilisateur choisit entre créer une partie (hôte) ou rejoindre une partie existante.

### Éléments UI actuels
- Logo DrawUp avec emoji 🎨
- Tagline : « Dessine · Devine · Ris »
- Mots d'action Comic Book en arrière-plan (POW!, DRAW!, BOOM!, SKETCH!)
- Bouton rouge « Créer une partie (Hôte) »
- Bouton bleu « Rejoindre une partie »
- Bouton retour vers le menu principal

### Transitions
- → `/draw/host` (créer)
- → `/draw/play` (rejoindre)
- → `/` (retour accueil)

### Notes design
Écran minimaliste, but = orienter rapidement. Donne le ton graphique de toute l'expérience.

---

## Écran 2 — Hôte : Création du salon (état transitoire)

**Fichier :** `client/src/components/Draw/DrawHostView.jsx` — état `CREATING`
**Route :** `/draw/host`

### Rôle
État de chargement pendant que le serveur génère la salle. Dure quelques centaines de ms.

### Éléments UI actuels
- Message « 🎨 DrawUp »
- Texte de statut « Création du salon... »
- Aucune interaction possible

### Transitions
- → état LOBBY (automatique, réception de `draw-room-created`)

### Notes design
Écran fantôme, très court. Peut intégrer une animation de chargement originale (ex. pinceau qui dessine le code).

---

## Écran 3 — Hôte : Salon d'attente (Lobby)

**Fichier :** `client/src/components/Draw/DrawHostView.jsx` — état `LOBBY`
**Route :** `/draw/host`

### Rôle
L'hôte attend les joueurs, configure les règles de la partie, puis la lance.

### Éléments UI actuels

**Zone code de salle :**
- Code à 6 caractères en grand
- Bouton « Copier le code »
- QR code (bibliothèque `QRCodeSVG`)

**Liste des joueurs :**
- Grille d'avatars (3-4 colonnes)
- Nom + statut de connexion
- Message d'attente si vide

**Panneau de configuration :**
- Manches par joueur (1–5) avec boutons +/–
- Temps par manche (30–180s) avec boutons +/–
- Sélecteur de catégories de mots :
  - Actions, Animaux, Célébrités, Expressions, Métiers, Films, Objets (facile/moyen), Lieux, Sports
  - Toggle « Tout sélectionner »
  - Catégories actives = fond rouge, texte blanc

**Bouton lancement :**
- Bouton jaune « Lancer la partie »
- Désactivé si < 2 joueurs
- Affiche « Minimum 2 joueurs (X/2) »

### Transitions
- → état PLAYING (réception de `draw-game-started`)
- Émet `draw-start-game` au clic du bouton

### Notes design
Écran riche en information. Tension entre lisibilité du code/QR et densité des options. La configuration peut sembler aride — piste : la rendre plus visuelle/ludique.

---

## Écran 4 — Hôte : Partie en cours (Playing)

**Fichier :** `client/src/components/Draw/DrawHostView.jsx` — état `PLAYING`
**Route :** `/draw/host`

### Rôle
L'hôte monitore la partie en temps réel : voit le canvas se remplir, suit les devinettes, gère la progression.

### Éléments UI actuels

**Barre supérieure :**
- Badge DrawUp
- Indicateur de manche « Manche X/Y »
- Blancs du mot à deviner (tirets + compteur de lettres)
- Timer : décompte en secondes (rouge)
- Barre de progression (vert → orange → rouge)
- Bouton « Terminer le tour » (manuel)

**Canvas central :**
- Grande zone blanche (reçoit les traits en temps réel via socket)
- Redimensionnement dynamique (`ResizeObserver`)

**Info dessinateur :**
- Avatar + nom + « dessine... »
- Compteur « X/Y ont trouvé »

**Sidebar droite :**
- Classement en direct (position, avatar, nom, score)
  - Bordure rouge = dessinateur 🎨
  - Bordure jaune = a trouvé ✅
  - Défaut = en train de deviner 💭
- Fil de devinettes en temps réel (12 dernières)
  - ✅ Bonne réponse → « [Joueur] a trouvé ! (+X pts) »
  - 🔥 Devinette proche → « [Joueur] s'approche... »

### Transitions
- → état ROUND_END (réception de `draw-round-ended`)

### Notes design
Écran le plus dense. L'hôte est spectateur actif. La sidebar droite est critique pour l'engagement. Le canvas doit être dominant visuellement.

---

## Écran 5 — Hôte : Fin de manche

**Fichier :** `client/src/components/Draw/DrawHostView.jsx` — état `ROUND_END`
**Route :** `/draw/host`

### Rôle
Révélation du mot après chaque manche, avec résultats individuels et compte à rebours avant la manche suivante.

### Éléments UI actuels

**Révélation du mot :**
- Bulle Comic Book rouge (rotation -1°)
- « Le mot était » en texte
- Mot en très grand italique gras
- Catégorie en dessous

**Résultats joueurs :**
- Liste de tous les joueurs
- Avatar, nom, badge statut
  - 🎨 Dessinateur — bordure rouge
  - ✅ Trouvé ! — fond doré, bordure jaune
  - ❌ Pas trouvé — fond gris
- Points gagnés dans la manche

**Compte à rebours :**
- « Prochain tour dans » + chiffre (8s)
- Bouton « Passer maintenant »

### Transitions
- → état PLAYING (émission de `draw-next-round`)

### Notes design
Moment de drama et de récompense. La révélation du mot est un instant clé — doit être spectaculaire. 8 secondes = bon rythme, ne pas raccourcir.

---

## Écran 6 — Hôte : Fin de partie

**Fichier :** `client/src/components/Draw/DrawHostView.jsx` — état `GAME_END`
**Route :** `/draw/host`

### Rôle
Résultats finaux : vainqueur, podium top 3, classement complet, distinctions spéciales.

### Éléments UI actuels

**Annonce du vainqueur :**
- Fond doré + 👑
- Nom du vainqueur en très grand
- Score final

**Podium (top 3) :**
- Position 1 🥇 : plus grande boîte dorée, podium h-16
- Position 2 🥈 : boîte bleue, podium h-12
- Position 3 🥉 : boîte rose/rouge, podium h-9
- Avatars agrandis + nom + score

**Classement 4+ :**
- Liste numérotée (#4, #5...) avec nom et points

**Distinctions spéciales :**
- Grille 2x2 si applicable
  - 🔍 **Sherlock** : meilleur devineur (+ de mots trouvés)
  - 🎨 **Picasso** : meilleur artiste (+ de points par dessin)
- Icône, titre, nom du joueur, valeur

**Boutons d'action :**
- 🔄 « Rejouer » → retour en LOBBY (mêmes joueurs)
- 🏠 « Menu » → retour accueil `/`

### Transitions
- → état LOBBY (émission de `draw-restart-game`)
- → `/` (navigation)

### Notes design
Écran climax. Le moment le plus mémorable. La célébration du vainqueur doit être spectaculaire. Les distinctions Sherlock/Picasso ajoutent une couche de fun au-delà du classement brut.

---

## Écran 7 — Joueur : Formulaire de connexion

**Fichier :** `client/src/components/Draw/DrawPlayerView.jsx` — état `!isJoined`
**Route :** `/draw/play` ou `/draw/play/:roomCode`

### Rôle
Le joueur entre dans la partie : renseigne son pseudo, choisit son avatar, et entre le code de salle.

### Éléments UI actuels

**Header :**
- Logo DrawUp + « Rejoindre une partie »

**Affichage d'erreur (si besoin) :**
- Boîte jaune avec message (salle introuvable, code invalide...)

**Formulaire :**
- **Code de salle :** Input centré, police 2xl, max 6 caractères, majuscules automatiques, placeholder « ABCDE1 ». Peut être pré-rempli via URL (readonly)
- **Pseudo :** Input, max 20 caractères, placeholder « Picasso »
- **Grille d'avatars :** 5x6 = 30 avatars (`/avatars/avatar_1.webp` → `avatar_30.webp`). Avatar sélectionné = bordure rouge + scale-105

**Bouton :**
- Grand bouton jaune « Rejoindre la Partie »
- Désactivé si pseudo ou code vide

**Retour :**
- Lien texte « Retour »

### Transitions
- → état LOBBY (si partie pas encore lancée)
- → état PLAYING (si late-join pendant une partie en cours)

### Notes design
Premier contact d'un nouveau joueur avec DrawUp. L'expérience doit être ultra-rapide (< 30s pour être en jeu). La grille d'avatars est un moment de personnalisation important — pas juste fonctionnel.

---

## Écran 8 — Joueur : Salon d'attente (Lobby)

**Fichier :** `client/src/components/Draw/DrawPlayerView.jsx` — état `LOBBY` / `isJoined=true`
**Route :** `/draw/play`

### Rôle
Le joueur attend que l'hôte lance la partie. Écran passif.

### Éléments UI actuels
- Avatar du joueur (grand cercle)
- Nom du joueur
- Code du salon « Salon : ABCDE1 »
- Carte d'attente avec sablier animé (pulse)
- « En attente du lancement... »

### Transitions
- → état PLAYING (réception de `draw-game-started`)

### Notes design
Moment oisif potentiellement long. Piste : afficher en temps réel la liste des autres joueurs qui arrivent, animer les avatars, créer de l'anticipation.

---

## Écran 9 — Joueur : Tour de dessin (Dessinateur)

**Fichier :** `client/src/components/Draw/DrawPlayerView.jsx` — état `PLAYING` / `isDrawer=true`
**Route :** `/draw/play`

### Rôle
Le joueur désigné dessine le mot pendant que les autres devinent.

### Éléments UI actuels

**Barre supérieure :**
- Timer (color-coded, rouge si critique)
- Barre de progression
- Indicateur « X/Y »

**Bandeau du mot (jaune/rouge) :**
- « À toi de dessiner : »
- Mot en très grand italique majuscule
- Indice 💡 si disponible
- Bouton 🔄 « Passer » (changer de mot)

**Canvas principal :**
- Grande zone blanche de dessin
- Gestion souris + tactile
- `ResizeObserver` pour le responsive

**Barre d'outils (bas) :**
- **Palette de couleurs :** 9 couleurs (noir, rouge, orange, jaune, vert, cyan, violet, marron, blanc)
- **Tailles de pinceau :** 4 options (3px, 8px, 16px, 30px), visualisées par un point
- **Bouton « Effacer » :** fond rouge, icône poubelle

### Transitions
- → état ROUND_END (réception de `draw-round-ended`)

### Notes design
Écran central du jeu — 80% de l'espace doit être canvas. Les outils doivent être accessibles sans encombrer. Sur mobile, la barre d'outils prend toute la largeur en bas (comme Paint).

---

## Écran 10 — Joueur : Tour de devinette (Devineur)

**Fichier :** `client/src/components/Draw/DrawPlayerView.jsx` — état `PLAYING` / `isDrawer=false`
**Route :** `/draw/play`

### Rôle
Le joueur observe le dessin en cours et soumet ses devinettes.

### Éléments UI actuels

**Barre supérieure :**
- Timer (synchronisé avec le dessinateur)
- Barre de progression
- Indicateur de manche
- Score actuel « X pts »

**Bandeau info dessinateur (bleu) :**
- « 🎨 [NomDessinateur] dessine... »
- Badge catégorie (rouge/blanc)
- Blancs du mot (tirets) + nombre de lettres

**Canvas (lecture seule) :**
- Le dessin apparaît en temps réel
- `pointer-events: none` (pas de dessin)
- **Overlay si deviné :**
  - Grand ✅
  - « Bravo ! »
  - Points gagnés + rang (ex. « +95 pts — #2 »)
  - Fond doré semi-transparent + flou

**Zone de devinette :**
- Champ texte « Tape ta réponse... »
- Bouton jaune de validation (icône check)
- Désactivé après devinette correcte

**Feedback :**
- Animation shake si devinette proche : « 🔥 Très proche ! Vérifie l'orthographe »

### Transitions
- → état ROUND_END (réception de `draw-round-ended`)

### Notes design
L'overlay de succès (✅ doré) est le moment de récompense principal pour le devineur. Le feedback « 🔥 Très proche » maintient l'engagement. Le canvas doit rester lisible malgré la surcharge d'UI.

---

## Écran 11 — Joueur : Fin de manche

**Fichier :** `client/src/components/Draw/DrawPlayerView.jsx` — état `ROUND_END`
**Route :** `/draw/play`

### Rôle
Révélation du mot après la manche, affichage du score cumulé, attente de la manche suivante.

### Éléments UI actuels

**Révélation du mot :**
- Boîte rouge (rotation -1°)
- « Le mot était »
- Mot en grand italique
- Ombre Comic Book

**Score :**
- Boîte blanche
- « Ton score »
- Très grand nombre
- Label « points »

**Attente :**
- « Prochain tour bientôt... » (pulse)
- Pas de compte à rebours visible (contrairement à l'hôte)

### Transitions
- → état PLAYING (réception de `draw-next-round`)

### Notes design
Écran simple, intentionnellement. Le joueur n'a pas besoin d'info supplémentaire. Mais il pourrait y avoir plus de récompense émotionnelle (ex. animation de score, aperçu du classement intermédiaire).

---

## Écran 12 — Joueur : Fin de partie

**Fichier :** `client/src/components/Draw/DrawPlayerView.jsx` — état `GAME_END`
**Route :** `/draw/play`

### Rôle
Résultats finaux du joueur : son rang, le classement de tous les joueurs, les distinctions.

### Éléments UI actuels

**Carte résultat personnel :**
- Fond selon rang :
  - 🥇 1er = or (FFD60A)
  - 🥈 2e = bleu clair (C2DCFF)
  - 🥉 3e = rose/rouge (FFE0DC)
  - Autres = blanc
- Rotation -1° Comic Book
- Médaille 🥇🥈🥉 ou 🎨 (hors podium)
- « Victoire ! » (si 1er) ou « #X »
- Score final
- Nom du vainqueur si pas 1er

**Tableau classement final :**
- Header « Classement final »
- Tous les joueurs, médailles top 3
- Joueur courant surligné (bordure + fond rouges)
- Nom + points

**Distinctions (si applicable) :**
- 🔍 Sherlock (meilleur devineur)
- 🎨 Picasso (meilleur artiste)

**Bouton :**
- « 🏠 Retour au menu »
- → `/`

### Notes design
Le joueur n'a pas de bouton « Rejouer » (seul l'hôte peut). C'est un choix intentionnel mais peut frustrer. Le résultat personnel doit être immédiatement lisible au premier coup d'œil.

---

## Écran 13 — Administration des mots

**Fichier :** `client/src/components/Draw/DrawAdmin.jsx` (supposé)
**Route :** `/admin`

### Rôle
Interface admin pour gérer la base de données des mots par catégorie.

### Notes design
Interface interne, pas prioritaire pour la refonte UX joueur.

---

## Synthèse des enjeux design

### Points forts actuels
- Identité Comic Book cohérente (ombres noires, rotations légères, couleurs vives)
- Flux logique bien structuré
- Feedback temps réel efficace (canvas, devinettes, scores)

### Points de friction identifiés

| Écran | Problème |
|-------|----------|
| Lobby hôte | Dense et aride — la configuration des catégories est peu visuelle |
| Lobby joueur | Long moment passif sans feedback des autres joueurs |
| Playing (devineur) | Canvas + UI latérale + input = surcharge potentielle sur mobile |
| Round End (joueur) | Peu de récompense émotionnelle — pas de classement intermédiaire visible |
| Game End (joueur) | Pas de bouton Rejouer — rupture de l'expérience |
| Général | Responsive mobile non optimisé (outils de dessin, sidebar) |

### Opportunités de refonte
1. **Lobby vivant** : animer les entrées de joueurs, montrer les avatars en mouvement
2. **Écran de dessin mobile-first** : revoir le layout pour petits écrans (outils en bas, canvas plein écran)
3. **Transitions dramatiques** : révélation du mot, annonce du dessinateur, podium final
4. **Classement intermédiaire** : mini-leaderboard entre les manches côté joueur
5. **Récompenses visuelles** : animations de confettis, effets sonores visuels
6. **Bouton Rejouer côté joueur** : demande à l'hôte de relancer

---

*Ce document est destiné à être lu par un agent design pour produire une refonte UI/UX complète de DrawUp.*
