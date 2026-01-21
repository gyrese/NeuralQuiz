# 📝 MODIFICATIONS FINALES POUR AperoEditor.jsx

## ✅ MODIFICATION 1/4 - APPLIQUÉE
**Boutons QCM Kahoothoot sur canvas** - Ligne 403-404

## 📋 MODIFICATIONS RESTANTES (À COPIER-COLLER)

### 🔧 MODIFICATION 2/4 - Templates (Ligne ~662)

**Chercher cette ligne :**
```jsx
                <div className="alert alert-info mt-3 p-2 small">
                    💡 Cliquez sur les boutons <b>+ Texte / Image</b> en haut pour ajouter des éléments libres.
                </div>
```

**Remplacer par :**
```jsx
                {/* KAHOOT TEMPLATES */}
                <div className="template-picker">
                    <div className="gslides-property-header">⚡ Templates</div>
                    <div className="template-grid">
                        <div className="template-card template-qcm" onClick={() => onUpdate({ type: 'question', questionType: 'qcm', questionText: 'Question ?', options: [{label:'A',text:'Réponse 1'},{label:'B',text:'Réponse 2'},{label:'C',text:'Réponse 3'},{label:'D',text:'Réponse 4'}], correctAnswer: 'A', timer: 20, points: 1000 })}>
                            ❓<div style={{fontSize:'10px',marginTop:'4px'}}>Quiz</div>
                        </div>
                        <div className="template-card template-title" onClick={() => onUpdate({ type: 'title', title: 'Titre du slide', subtitle: 'Sous-titre' })}>
                            📝<div style={{fontSize:'10px',marginTop:'4px'}}>Titre</div>
                        </div>
                        <div className="template-card template-poll" onClick={() => onUpdate({ type: 'question', questionType: 'text', questionText: 'Question ouverte ?', timer: 30 })}>
                            📊<div style={{fontSize:'10px',marginTop:'4px'}}>Poll</div>
                        </div>
                        <div className="template-card template-image" onClick={() => onUpdate({ background: { type: 'color', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' } })}>
                            🎨<div style={{fontSize:'10px',marginTop:'4px'}}>Fond</div>
                        </div>
                    </div>
                </div>

                <div className="alert alert-info mt-3 p-2 small">
                    💡 Cliquez sur les boutons <b>+ Texte / Image</b> en haut pour ajouter des éléments libres.
                </div>
```

---

### 🔧 MODIFICATION 3/4 - Timer Slider (Ligne ~637)

**Chercher cette ligne :**
```jsx
                        <label className="mt-2">Temps (s)</label>
                        <input type="number" className="form-control" value={slide.timer} onChange={(e) => onUpdate({ timer: parseInt(e.target.value) })} />
```

**Remplacer par :**
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

### 🔧 MODIFICATION 4/4 - Points Input (Ligne ~638, APRÈS le timer)

**Ajouter APRÈS le code du timer :**
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

## 📍 RÉSUMÉ DES EMPLACEMENTS

### Dans AperoEditor.jsx :

1. ✅ **Ligne ~404** : Boutons QCM Kahoot (DÉJÀ FAIT)
2. ⚠️ **Ligne ~662** : Templates picker (À FAIRE)
3. ⚠️ **Ligne ~637** : Timer slider (À FAIRE)
4. ⚠️ **Ligne ~638** : Points input (À FAIRE)

---

## 🎯 PROCÉDURE

1. Ouvrir `AperoEditor.jsx`
2. Ctrl+F pour chercher les lignes exactes
3. Copier-coller les remplacements
4. Sauvegarder
5. Tester !

---

## ✨ CE QUI FONCTIONNERA APRÈS

✅ Miniatures sidebar  
✅ Toolbar complète  
✅ Drag & drop éléments  
✅ **Boutons QCM colorés Kahoot**  
✅ **Templates cliquables**  
✅ **Timer visuel slider**  
✅ **Système de points**  

**= L'ÉDITEUR PARFAIT ! 🚀**
