# 🔧 PATCH KAHOOT POUR APÉRO EDITOR

## Instructions pour ajouter les fonctionnalités Kahoot sans casser Google Slides

### ✅ **DÉJÀ FAIT**
- Import CSS Kahoot (ligne 4)
- Structure Google Slides complète
- Miniatures fonctionnelles
- Toolbar complète
- Propriétés complètes

---

### 📝 **À AJOUTER MANUELLEMENT**

#### **1. Boutons QCM Kahoot sur Canvas (ligne ~410)**

Après la fermeture des éléments Rnd `))}`  et avant `{/* Standard Content Layer */}`, ajouter :

```jsx
{/* KAHOOT QCM OVERLAY */}
{currentSlide?.type === 'question' && currentSlide?.questionType === 'qcm' && currentSlide?.options && (
    <div className="kahoot-qcm-overlay" style={{ pointerEvents: 'all' }}>
        {['A', 'B', 'C', 'D'].map(letter => {
            const option = currentSlide.options.find(o => o.label === letter);
            return (
                <button
                    key={letter}
                    className={`kahoot-qcm-btn kahoot-btn-${letter.toLowerCase()} ${currentSlide.correctAnswer === letter ? 'correct' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        updateSlide({ correctAnswer: letter });
                    }}
                >
                    <div className="kahoot-option-letter">{letter}</div>
                    <div className="kahoot-option-text">
                        {option?.text || `Réponse ${letter}`}
                    </div>
                </button>
            );
        })}
    </div>
)}
```

---

#### **2. Templates Kahoot dans Propriétés (ligne ~638)**

Avant le `💡 Cliquez sur les boutons`, ajouter :

```jsx
{/* KAHOOT TEMPLATES */}
<div className="template-picker">
    <div className="gslides-property-header">⚡ Templates Rapides</div>
    <div className="template-grid">
        <div 
            className="template-card template-qcm" 
            onClick={() => {
                if (currentSlide.type !== 'question') {
                    updateSlide({
                        type: 'question',
                        questionType: 'qcm',
                        questionText: 'Votre question ici',
                        options: [
                            { label: 'A', text: 'Réponse 1' },
                            { label: 'B', text: 'Réponse 2' },
                            { label: 'C', text: 'Réponse 3' },
                            { label: 'D', text: 'Réponse 4' }
                        ],
                        correctAnswer: 'A',
                        timer: 20
                    });
                }
            }}
        >
            ❓
        </div>
        <div 
            className="template-card template-title"
            onClick={() => updateSlide({
                type: 'title',
                title: 'Titre',
                subtitle: 'Sous-titre'
            })}
        >
            📝
        </div>
        <div 
            className="template-card template-poll"
            onClick={() => updateSlide({
                type: 'question',
                questionType: 'poll',
                questionText: 'Sondage'
            })}
        >
            📊
        </div>
        <div 
            className="template-card template-image"
            onClick={() => {
                updateSlide({
                    background: { 
                        type: 'color', 
                        value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                    }
                });
            }}
        >
            🎨
        </div>
    </div>
</div>
```

---

#### **3. Enhanced Timer Slider (optionnel, ligne ~612)**

Remplacer l'input timer par :

```jsx
<label className="mt-2">Temps</label>
<div className="d-flex align-items-center gap-2">
    <input 
        type="range" 
        className="form-range flex-grow-1" 
        min="5" 
        max="120" 
        value={slide.timer || 20}
        onChange={(e) => onUpdate({ timer: parseInt(e.target.value) })}
    />
    <span className="badge bg-primary">{slide.timer || 20}s</span>
</div>
```

---

#### **4. Points Input (ligne ~613)**

Après le timer, ajouter :

```jsx
<label className="mt-2">Points</label>
<input 
    type="number" 
    className="form-control" 
    value={slide.points || 1000}
    onChange={(e) => onUpdate({ points: parseInt(e.target.value) })}
    min="0"
    max="2000"
    step="100"
/>
```

---

### 🎨 **CSS DÉJÀ PRÊT**

Fichiers existants :
- ✅ `GSlides.css` - Base Google Slides
- ✅ `AperoKahoot.css` - Overlays Kahoot (déjà importé)
- ✅ `AperoAdmin.css` - Grille admin
- ✅ `AperoHost.css` - Présentation immersive
- ✅ `AperoPlayer.css` - Interface mobile

---

### ✨ **RÉSULTAT**

Après ces ajouts, vous aurez :

✅ **Google Slides complet** :
- Miniatures dans sidebar
- Toolbar avec tous les outils
- Drag & drop éléments
- Canvas 960x540
- Propriétés complètes
- Layers/Calques
- Upload images

✅ **Kahoot ajouté** :
- Boutons QCM colorés en overlay
- Templates rapides
- Timer slider
- Points système
- Interface premium

---

### 🚀 **NAVIGATION**

1. Ouvrir `AperoEditor.jsx`
2. Chercher ligne ~410 → Ajouter QCM overlay
3. Chercher ligne ~638 → Ajouter templates
4. Chercher ligne ~612 → Améliorer timer
5. Sauvegarder
6. Test !

✨ **Le meilleur des deux mondes sans rien perdre !**
