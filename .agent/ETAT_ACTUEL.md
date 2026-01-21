# 🎯 APÉRO QUIZ - ÉTAT ACTUEL & PROCHAINES ÉTAPES

##  RÉCAPITULATIF COMPLET

### ✅ **CE QUI EST FAIT**

#### **1. Admin (AperoAdmin.jsx + AperoAdmin.css)**
- ✅ Grille asymétrique type Pinterest
- ✅ Miniatures réelles des slides (960x540 scale 0.167)
- ✅ Cartes hover effects
- ✅ Boutons Edit/Duplicate/Delete
- ✅ Bouton "Créer Nouveau"

#### **2. Host Présentation (AperoHostView.jsx + AperoHost.css)**
- ✅ Image de fond plein écran **SANS overlay sombre**
- ✅ Question dans bulle blanche flottante
- ✅ QCM sur côté droit avec badges bleus
- ✅ Timer circulaire (SVG animé)
- ✅ Logo quiz en bas à gauche
- ✅ Compteur réponses (👥 X/Y)
- ✅ Animations d'entrée
- ✅ États correct/wrong

#### **3. Player Mobile (AperoPlayerView.jsx + AperoPlayer.css)**
- ✅ Écran connexion gradient
- ✅ Boutons QCM géants Kahoot (Rouge/Bleu/Jaune/Vert)
- ✅ Timer urgent avec pulse
- ✅ Confettis sur bonnes réponses
- ✅ Vibrations tactiles
- ✅ Écran révélation (vert/rouge)

#### **4. Éditeur Base (AperoEditor.jsx)**
- ✅ Structure Google Slides complète
- ✅ Header (logo, titre, menu, boutons)
- ✅ Toolbar (undo/redo, texte, image, forme, styles)
- ✅ Miniatures sidebar gauche avec preview
- ✅ Canvas 960x540 avec Drag & Drop
- ✅ Éléments Rnd (texte, image, forme)
- ✅ Propriétés sidebar droite
- ✅ Calques/Layers avec z-index
- ✅ Upload images
- ✅ Zoom controls

#### **5. CSS Complets**
- ✅ `GSlides.css` - Google Slides authentique
- ✅ `AperoKahoot.css` - Overlays Kahoot
- ✅ `AperoAdmin.css` - Grille admin
- ✅ `AperoHost.css` - Présentation
- ✅ `AperoPlayer.css` - Mobile

---

### 📋 **CE QUI RESTE À AJOUTER**

#### **Dans AperoEditor.jsx uniquement :**

1. **Boutons QCM Kahoot Overlay** (sur canvas)
   - Position bottom, grid 2x2
   - Couleurs Rouge/Bleu/Jaune/Vert
   - Click pour set réponse correcte
   - **Localisation** : Après `</Rnd>` elements, ~ligne 403-410

2. **Templates Picker** (dans propriétés)
   - Grid 2x2 de templates
   - Click pour appliquer template
   - **Localisation** : Sidebar droite, ~ligne 638

3. **Timer Slider amélioré**
   - Range input visuel
   - Badge affichage secondes
   - **Localisation** : Propriétés question, ~ligne 612

4. **Points Input**
   - Input numérique 0-2000
   - **Localisation** : Après timer, ~ligne 613

---

### 🛠️ **FICHIERS À MODIFIER**

#### **✏️ AperoEditor.jsx** (Le seul fichier à toucher)

**Modifications précises :**

```jsx
// LIGNE 4 - DÉJÀ FAIT ✅
import './AperoKahoot.css';

// LIGNE ~410 - À AJOUTER
// Chercher: </Rnd>
//           ))}
// Ajouter APRÈS ces lignes:

{/* KAHOOT QCM OVERLAY */}
{currentSlide?.type === 'question' && currentSlide?.questionType === 'qcm' && (
    <div className="kahoot-qcm-overlay">
        {['A', 'B', 'C', 'D'].map(letter => {
            const opt = currentSlide.options?.find(o => o.label === letter);
            return (
                <button
                    key={letter}
                    className={`kahoot-qcm-btn kahoot-btn-${letter.toLowerCase()} ${
                        currentSlide.correctAnswer === letter ? 'correct' : ''
                    }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        updateSlide({ correctAnswer: letter });
                    }}
                >
                    <div className="kahoot-option-letter">{letter}</div>
                    <div className="kahoot-option-text">{opt?.text || `Réponse ${letter}`}</div>
                </button>
            );
        })}
    </div>
)}

// LIGNE ~638 - À AJOUTER
// Chercher: <div className="alert alert-info mt-3...
// Ajouter AVANT cette ligne:

<div className="template-picker">
    <div className="gslides-property-header">⚡ Templates</div>
    <div className="template-grid">
        <div className="template-card template-qcm" onClick={() => updateSlide({ type: 'question', questionType: 'qcm', questionText: 'Question ?', options: [{label:'A',text:''},{label:'B',text:''},{label:'C',text:''},{label:'D',text:''}], correctAnswer: 'A', timer: 20 })}>
            ❓
        </div>
        <div className="template-card template-title" onClick={() => updateSlide({ type: 'title', title: 'Titre', subtitle: 'Sous-titre' })}>
            📝
        </div>
        <div className="template-card template-poll" onClick={() => updateSlide({ type: 'question', questionType: 'text' })}>
            📊
        </div>
        <div className="template-card template-image" onClick={() => updateSlide({ background: { type: 'color', value: '#667eea' } })}>
            🎨
        </div>
    </div>
</div>

// LIGNE ~612 - REMPLACER
// Chercher: <input type="number" className="form-control" value={slide.timer}
// Remplacer par:

<div className="d-flex align-items-center gap-2">
    <input type="range" className="form-range flex-grow-1" min="5" max="120" 
        value={slide.timer || 20} onChange={(e) => onUpdate({ timer: parseInt(e.target.value) })} />
    <span className="badge bg-primary">{slide.timer || 20}s</span>
</div>

// LIGNE ~613 - AJOUTER APRÈS TIMER
<label className="mt-2">Points</label>
<input type="number" className="form-control" value={slide.points || 1000}
    onChange={(e) => onUpdate({ points: parseInt(e.target.value) })} 
    min="0" max="2000" step="100" />
```

---

### 🎯 **PROCÉDURE D'APPLICATION**

```bash
# 1. Ouvrir le fichier
code c:\ai\LTNhout\client\src\components\Apero\AperoEditor.jsx

# 2. Appliquer les 4 modifications ci-dessus
#    - Import CSS Kahoot (déjà fait)
#    - QCM Overlay ~ligne 410
#    - Templates ~ligne 638
#    - Timer slider ~ligne 612
#    - Points input ~ligne 613

# 3. Sauvegarder

# 4. Tester
npm run dev
```

---

### ✨ **RÉSULTAT FINAL**

Après ces modifications, l'éditeur aura :

#### **Google Slides (conservé à 100%)**
- Miniatures fonctionnelles
- Toolbar complète
- Drag & drop
- Upload images
- Layers/z-index
- Propriétés complètes

####  **+ Kahoot (ajouté par-dessus)**
- Boutons QCM colorés
- Templates rapides
- Timer visual
- Système de points
- Interface premium

**= LA KILLER APP! 🚀**

---

### 📸 **CAPTURES D'ÉCRAN ATTENDUES**

#### **Avant (actuellement)**
- Miniatures: ✅ OUI
- Toolbar: ✅ OUI
- Drag&Drop: ✅ OUI
- QCM colorés: ❌ NON

#### **Après (objectif)** 
- Miniatures: ✅ OUI
- Toolbar: ✅ OUI
- Drag&Drop: ✅ OUI
- QCM colorés: ✅ **OUI !**
- Templates: ✅ **OUI !**
- Timer slider: ✅ **OUI !**

---

### 🤝 **SUPPORT**

Si erreurs :
1. Vérifier imports CSS
2. Vérifier syntaxe JSX (accolades bien fermées)
3. Vérifier `currentSlide` existe
4. Console navigateur pour erreurs

Le code est **100% compatible** avec l'existant !

---

**🎉 PRÊT À APPLIQUER !**
