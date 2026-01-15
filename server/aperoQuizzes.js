/**
 * Apéro Quiz - Modèle de données pour les Quiz
 * 
 * Structure d'un quiz stocké en JSON
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data', 'apero');
const QUIZZES_FILE = path.join(DATA_DIR, 'quizzes.json');

// Créer le dossier si nécessaire
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialiser le fichier si nécessaire
if (!fs.existsSync(QUIZZES_FILE)) {
    fs.writeFileSync(QUIZZES_FILE, JSON.stringify({ quizzes: [] }, null, 2));
}

/**
 * Structure d'un slide :
 * {
 *   id: "slide_uuid",
 *   type: "question" | "title" | "score" | "interlude",
 *   
 *   // Pour les questions
 *   questionType: "qcm" | "estimation" | "text" | "date" | "truefalse",
 *   questionText: "Texte de la question",
 *   options: ["A", "B", "C", "D"],  // Pour QCM
 *   correctAnswer: "B",             // La bonne réponse
 *   timer: 20,                       // Temps en secondes
 *   points: 100,                     // Points de base
 *   
 *   // Pour les titres/interludes
 *   title: "Série 1 : Culture Générale",
 *   subtitle: "10 questions",
 *   
 *   // Style
 *   theme: "blue",                   // Thème de couleur
 *   background: {
 *     type: "gradient" | "color" | "image",
 *     value: "#1a1a2e" | "linear-gradient(...)" | "url(...)"
 *   },
 *   image: {
 *     url: "...",
 *     position: "center" | "left" | "right" | "background"
 *   }
 * }
 */

class AperoQuizzes {
    constructor() {
        this.quizzes = this.loadQuizzes();
    }

    loadQuizzes() {
        try {
            const data = fs.readFileSync(QUIZZES_FILE, 'utf8');
            const parsed = JSON.parse(data);
            console.log(`[AperoQuizzes] Loaded ${parsed.quizzes?.length || 0} quizzes`);
            return parsed.quizzes || [];
        } catch (error) {
            console.error('[AperoQuizzes] Error loading quizzes:', error);
            return [];
        }
    }

    saveQuizzes() {
        try {
            fs.writeFileSync(QUIZZES_FILE, JSON.stringify({ quizzes: this.quizzes }, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('[AperoQuizzes] Error saving quizzes:', error);
            return false;
        }
    }

    // === CRUD Operations ===

    getAll() {
        return this.quizzes.map(q => ({
            id: q.id,
            title: q.title,
            description: q.description,
            slideCount: q.slides?.length || 0,
            questionCount: q.slides?.filter(s => s.type === 'question').length || 0,
            createdAt: q.createdAt,
            updatedAt: q.updatedAt
        }));
    }

    getById(quizId) {
        return this.quizzes.find(q => q.id === quizId);
    }

    create(quizData) {
        const quiz = {
            id: this.generateId(),
            title: quizData.title || 'Nouveau Quiz',
            description: quizData.description || '',
            slides: quizData.slides || [this.createDefaultTitleSlide()],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.quizzes.push(quiz);
        this.saveQuizzes();

        console.log(`[AperoQuizzes] Created quiz "${quiz.title}" (${quiz.id})`);
        return quiz;
    }

    update(quizId, updates) {
        const index = this.quizzes.findIndex(q => q.id === quizId);
        if (index === -1) return null;

        this.quizzes[index] = {
            ...this.quizzes[index],
            ...updates,
            id: quizId, // Préserver l'ID
            updatedAt: new Date().toISOString()
        };

        this.saveQuizzes();
        return this.quizzes[index];
    }

    delete(quizId) {
        const index = this.quizzes.findIndex(q => q.id === quizId);
        if (index === -1) return false;

        this.quizzes.splice(index, 1);
        this.saveQuizzes();
        return true;
    }

    duplicate(quizId) {
        const original = this.getById(quizId);
        if (!original) return null;

        const copy = {
            ...JSON.parse(JSON.stringify(original)),
            id: this.generateId(),
            title: `${original.title} (copie)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Régénérer les IDs des slides
        copy.slides = copy.slides.map(slide => ({
            ...slide,
            id: this.generateId()
        }));

        this.quizzes.push(copy);
        this.saveQuizzes();
        return copy;
    }

    // === Slide Operations ===

    addSlide(quizId, slideData, afterIndex = null) {
        const quiz = this.getById(quizId);
        if (!quiz) return null;

        const slide = {
            id: this.generateId(),
            type: slideData.type || 'question',
            ...slideData
        };

        if (afterIndex !== null && afterIndex >= 0 && afterIndex < quiz.slides.length) {
            quiz.slides.splice(afterIndex + 1, 0, slide);
        } else {
            quiz.slides.push(slide);
        }

        quiz.updatedAt = new Date().toISOString();
        this.saveQuizzes();
        return slide;
    }

    updateSlide(quizId, slideId, updates) {
        const quiz = this.getById(quizId);
        if (!quiz) return null;

        const slideIndex = quiz.slides.findIndex(s => s.id === slideId);
        if (slideIndex === -1) return null;

        quiz.slides[slideIndex] = {
            ...quiz.slides[slideIndex],
            ...updates,
            id: slideId
        };

        quiz.updatedAt = new Date().toISOString();
        this.saveQuizzes();
        return quiz.slides[slideIndex];
    }

    deleteSlide(quizId, slideId) {
        const quiz = this.getById(quizId);
        if (!quiz) return false;

        const slideIndex = quiz.slides.findIndex(s => s.id === slideId);
        if (slideIndex === -1) return false;

        quiz.slides.splice(slideIndex, 1);
        quiz.updatedAt = new Date().toISOString();
        this.saveQuizzes();
        return true;
    }

    reorderSlides(quizId, newOrder) {
        const quiz = this.getById(quizId);
        if (!quiz) return false;

        // newOrder est un tableau d'IDs dans le nouvel ordre
        const reordered = [];
        for (const slideId of newOrder) {
            const slide = quiz.slides.find(s => s.id === slideId);
            if (slide) reordered.push(slide);
        }

        quiz.slides = reordered;
        quiz.updatedAt = new Date().toISOString();
        this.saveQuizzes();
        return true;
    }

    // === Templates ===

    createDefaultTitleSlide() {
        return {
            id: this.generateId(),
            type: 'title',
            title: '🍻 Apéro Quiz',
            subtitle: 'Préparez vos méninges !',
            theme: 'gradient-purple',
            background: {
                type: 'gradient',
                value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }
        };
    }

    createDefaultQuestionSlide(questionType = 'qcm') {
        const base = {
            id: this.generateId(),
            type: 'question',
            questionType: questionType,
            questionText: '',
            correctAnswer: '',
            timer: 20,
            points: 100,
            theme: 'dark',
            background: {
                type: 'color',
                value: '#1a1a2e'
            }
        };

        switch (questionType) {
            case 'qcm':
                return {
                    ...base,
                    options: [
                        { label: 'A', text: '' },
                        { label: 'B', text: '' },
                        { label: 'C', text: '' },
                        { label: 'D', text: '' }
                    ],
                    correctAnswer: 'A'
                };
            case 'truefalse':
                return {
                    ...base,
                    options: [
                        { label: 'V', text: 'Vrai' },
                        { label: 'F', text: 'Faux' }
                    ],
                    correctAnswer: 'V'
                };
            case 'estimation':
                return {
                    ...base,
                    hint: 'Entrez un nombre',
                    correctAnswer: '0'
                };
            case 'text':
                return {
                    ...base,
                    hint: 'Entrez votre réponse',
                    correctAnswer: '',
                    acceptedAnswers: [] // Réponses alternatives acceptées
                };
            case 'date':
                return {
                    ...base,
                    hint: 'Entrez une date (année ou JJ/MM/AAAA)',
                    correctAnswer: '',
                    tolerance: 0 // Tolérance en jours
                };
            default:
                return base;
        }
    }

    createScoreSlide() {
        return {
            id: this.generateId(),
            type: 'score',
            title: '🏆 Classement',
            showTop: 10,
            theme: 'gold',
            background: {
                type: 'gradient',
                value: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)'
            }
        };
    }

    createInterludeSlide(seriesNumber) {
        return {
            id: this.generateId(),
            type: 'interlude',
            title: `Série ${seriesNumber}`,
            subtitle: '10 questions',
            theme: 'gradient-blue',
            background: {
                type: 'gradient',
                value: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)'
            }
        };
    }

    // === Helpers ===

    generateId() {
        return 'slide_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // === Themes prédéfinis ===

    static THEMES = {
        'dark': {
            background: '#1a1a2e',
            text: '#ffffff',
            accent: '#00d4ff'
        },
        'light': {
            background: '#f5f5f5',
            text: '#1a1a2e',
            accent: '#6c5ce7'
        },
        'gradient-purple': {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            text: '#ffffff',
            accent: '#ffd700'
        },
        'gradient-blue': {
            background: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
            text: '#ffffff',
            accent: '#ffd700'
        },
        'gradient-green': {
            background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        'gradient-orange': {
            background: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        'gradient-pink': {
            background: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        'neon': {
            background: '#0f0f23',
            text: '#00ff88',
            accent: '#ff00ff'
        },
        'retro': {
            background: '#2d1b69',
            text: '#ff71ce',
            accent: '#01cdfe'
        },
        'gold': {
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            text: '#ffd700',
            accent: '#ffffff'
        }
    };
}

module.exports = new AperoQuizzes();
