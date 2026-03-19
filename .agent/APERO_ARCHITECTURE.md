# 🎯 APÉRO QUIZ - ARCHITECTURE COMPLÈTE
## Google Slides + Kahoot Fusion

## 📊 STRUCTURE FINALE

### **1. Éditeur (AperoEditor.jsx)**
```
┌─────────────────────────────────────────────┐
│         HEADER (Google Slides)               │
│  🍻 Apéro Quiz | Fichier | Édition |...     │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│         TOOLBAR (Google Slides)              │
│  ↶ ↷ | 📝 🖼️ ⬛ | B I U | 🎨 | 100% |       │
└─────────────────────────────────────────────┘
┌──┬────────────────────────────────────────┬──┐
│M │                                        │ P│
│I │          CANVAS (GSlides + Kahoot)     │ R│
│N │                                        │ O│
│IA│  ┌──────────────────────────────┐     │ P│
│ T│  │                              │     │ R│
│ U│  │   [Image de fond]            │     │ I│
│ R│  │                              │     │ É│
│ E│  │   ✏️ Éléments Drag&Drop      │     │ T│
│ S│  │                              │     │ É│
│  │  │   🔴 🔵 🟡 🟢 (QCM Kahoot)   │     │ S│
│  │  │                              │     │  │
│  │  └──────────────────────────────┘     │  │
│  │                                        │  │
│1 │         ⊖ 60% ⊕                       │  │
│2 │                                        │  │
│3 │                                        │  │
│4 │                                        │  │
│+ │                                        │  │
└──┴────────────────────────────────────────┴──┘
```

---

## 🛠️ COMPOSANTS

### **A. GOOGLE SLIDES (Existant - À Conserver)**

#### **Header**
- Logo "Apéro Quiz"
- Menu : Fichier, Édition, Insertion, Diapositive
- Input titre quiz
- Boutons : Sauvegarder, Jouer, Partager

#### **Toolbar**
- ↶ Annuler / ↷ Rétablir
- ✏️ Texte / 🖼️ Image / ⬛ Forme
- **B** I U (Bold, Italic, Underline)
- Font: Roboto ▼
- Size: 24 ▼
- 🎨 Couleur texte / 🖌️ Couleur fond
- Alignement: ⬅️ ⬆️ ➡️
- Z-index: ⬆️ ⬇️

#### **Miniatures (Sidebar Gauche)**
- Liste scrollable
- Numéro slide
- Preview miniature (960x540 scale 0.23)
- Selection bleue
- + Ajouter slide

#### **Canvas Central**
- Zone 960x540px
- Background (couleur/image/gradient)
- Éléments Rnd (Drag & Resize)
  - Texte (éditable inline)
  - Image (upload)
  - Forme (rectangle, cercle)
- Zoom controls (⊖ 60% ⊕)

#### **Propriétés (Sidebar Droite)**
- **Calques** (z-index, delete): de l intégralité des objets, meme les fixes, et :les rendres moins fixe
- **Diapositive**: Background, Thème
- **Texte**: Font, Size, Color, Align
- **Image**: URL, Size
- **Forme**: Background, Border

---

### **B. KAHOOT (Nouveautés - À Ajouter)**

#### **QCM Buttons Overlay (sur Canvas)**
```jsx
{currentSlide.questionType === 'qcm' && (
  <div className="kahoot-qcm-overlay">
    <button className="kahoot-btn-a" onClick={() => setCorrect('A')}>
      <div>A</div>
      <div>Réponse 1</div>
    </button>
    // B, C, D...
  </div>
)}
```

#### **Templates Picker (Propriétés)**
```jsx
<div className="template-picker">
  <h4>Templates Kahoot</h4>
  <div className="template-grid">
    <div className="template-qcm">❓ Quiz</div>
    <div className="template-poll">📊 Sondage</div>
    <div className="template-image">🖼️ Image</div>
    <div className="template-title">📝 Titre</div>
  </div>
</div>
```

#### **Quick Actions (Bottom Floating)**
```jsx
<div className="quick-actions-bar">
  <button>❓ Question</button>
  <button>📝 Titre</button>
  <button>📊 Score</button>
  <button>🖼️ Image</button>
</div>
```

#### **Enhanced Properties**
- Timer Slider (5-120s)
- Points Input (0-2000)
- Question Type Dropdown
- Correct Answer Selector

---

## 🎨 STYLES

### **Fichiers CSS**
1. **GSlides.css** (Base Google Slides)
2. **AperoKahoot.css** (Overlays Kahoot)
3. **AperoAdmin.css** (Liste quiz)
4. **AperoHost.css** (Présentation)
5. **AperoPlayer.css** (Mobile)

### **Classes Kahoot Principales**
```css
.kahoot-qcm-overlay {
  position: absolute;
  bottom: 40px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  z-index: 1000;
}

.kahoot-qcm-btn {
  aspect-ratio: 16 / 9;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}

.kahoot-btn-a { background: #e21b3c; }
.kahoot-btn-b { background: #1368ce; }
.kahoot-btn-c { background: #ffa602; }
.kahoot-btn-d { background: #26890c; }
```

---

## 🔄 WORKFLOW

### **Création Question QCM**
1. **Toolbar** : Click "❓ Question"
2. **Canvas** : Ajouter background image
3. **Éléments** : Drag&drop éléments libres (texte, images)
4. **QCM Overlay** : Éditer réponses A,B,C,D directement
5. **Propriétés** : Set timer, points, réponse correcte
6. **Miniatures** : Preview automatique

### **Fonctionnalités Combinées**
- ✅ Drag & Drop (GSlides)
- ✅ Boutons QCM colorés (Kahoot)
- ✅ Background image/gradient (GSlides)
- ✅ Templates rapides (Kahoot)
- ✅ Miniatures preview (GSlides)
- ✅ Timer & Points (Kahoot)
- ✅ Z-index layers (GSlides)
- ✅ Quick actions (Kahoot)

---

## 📝 TODO

### **Fichier AperoEditor.jsx - Modifications**

1. **Import Kahoot CSS**
```jsx
import './AperoKahoot.css';
```

2. **Ajouter QCM Overlay après Rnd elements**
```jsx
{/* After elements */}
{currentSlide?.questionType === 'qcm' && (
  <div className="kahoot-qcm-overlay">
    {['A','B','C','D'].map(letter => (
      <button 
        className={`kahoot-qcm-btn kahoot-btn-${letter.toLowerCase()}`}
        onClick={() => updateSlide({ correctAnswer: letter })}
      >
        <div className="kahoot-option-letter">{letter}</div>
        <div className="kahoot-option-text">
          {currentSlide.options?.find(o => o.label === letter)?.text}
        </div>
      </button>
    ))}
  </div>
)}
```

3. **Ajouter Templates dans Propriétés**
Dans la sidebar droite, après "Diapositive" :
```jsx
<div className="template-picker">
  <div className="gslides-property-header">Templates Kahoot</div>
  <div className="template-grid">
    {/* Templates cards */}
  </div>
</div>
```

4. **Ajouter Quick Actions** (optionnel)
En bas du canvas container :
```jsx
<div className="quick-actions-bar">
  <button onClick={() => addSlide('qcm')}>❓</button>
  <button onClick={() => addSlide('title')}>📝</button>
  <button onClick={() => addSlide('score')}>📊</button>
</div>
```

---

## ✅ RÉSULTAT FINAL

Un éditeur qui :
- Garde TOUT Google Slides (drag&drop, toolbar, miniatures, layers)
- Ajoute Kahoot (QCM colorés, templates, timer, points)
- Interface premium et user-friendly
- 100% fonctionnel pour créer des quiz immersifs
