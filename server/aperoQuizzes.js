const db = require('./db');

class AperoQuizzes {
    async getAll() {
        try {
            const rows = await db.all('SELECT id, title, description, slides, createdAt, updatedAt FROM apero_quizzes');
            return rows.map(q => {
                const slides = JSON.parse(q.slides || '[]');
                return {
                    id: q.id,
                    title: q.title,
                    description: q.description,
                    slides: slides,
                    slideCount: slides.length,
                    questionCount: slides.filter(s => s.type === 'question').length,
                    createdAt: q.createdAt,
                    updatedAt: q.updatedAt
                };
            });
        } catch (error) {
            console.error('[AperoQuizzes] Error loading quizzes:', error);
            return [];
        }
    }

    async getById(quizId) {
        try {
            const row = await db.get('SELECT id, title, description, slides, createdAt, updatedAt FROM apero_quizzes WHERE id = ?', [quizId]);
            if (!row) return null;
            return {
                id: row.id,
                title: row.title,
                description: row.description,
                slides: JSON.parse(row.slides || '[]'),
                createdAt: row.createdAt,
                updatedAt: row.updatedAt
            };
        } catch (error) {
            console.error('[AperoQuizzes] Error fetching quiz by ID:', error);
            return null;
        }
    }

    async create(quizData) {
        const id = this.generateId();
        const title = quizData.title || 'Nouveau Quiz';
        const description = quizData.description || '';
        const slides = quizData.slides || [this.createDefaultTitleSlide()];
        const now = new Date().toISOString();

        try {
            await db.run(
                'INSERT INTO apero_quizzes (id, title, description, slides, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
                [id, title, description, JSON.stringify(slides), now, now]
            );
            console.log(`[AperoQuizzes] Created quiz "${title}" (${id})`);
            return { id, title, description, slides, createdAt: now, updatedAt: now };
        } catch (error) {
            console.error('[AperoQuizzes] Error creating quiz:', error);
            return null;
        }
    }

    async update(quizId, updates) {
        try {
            const existing = await this.getById(quizId);
            if (!existing) return null;

            const title = updates.title !== undefined ? updates.title : existing.title;
            const description = updates.description !== undefined ? updates.description : existing.description;
            const slides = updates.slides !== undefined ? updates.slides : existing.slides;
            const now = new Date().toISOString();

            await db.run(
                'UPDATE apero_quizzes SET title = ?, description = ?, slides = ?, updatedAt = ? WHERE id = ?',
                [title, description, JSON.stringify(slides), now, quizId]
            );

            return {
                id: quizId,
                title,
                description,
                slides,
                createdAt: existing.createdAt,
                updatedAt: now
            };
        } catch (error) {
            console.error('[AperoQuizzes] Error updating quiz:', error);
            return null;
        }
    }

    async delete(quizId) {
        try {
            const result = await db.run('DELETE FROM apero_quizzes WHERE id = ?', [quizId]);
            return result.changes > 0;
        } catch (error) {
            console.error('[AperoQuizzes] Error deleting quiz:', error);
            return false;
        }
    }

    async duplicate(quizId) {
        try {
            const original = await this.getById(quizId);
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

            await db.run(
                'INSERT INTO apero_quizzes (id, title, description, slides, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
                [copy.id, copy.title, copy.description, JSON.stringify(copy.slides), copy.createdAt, copy.updatedAt]
            );

            return copy;
        } catch (error) {
            console.error('[AperoQuizzes] Error duplicating quiz:', error);
            return null;
        }
    }

    // === Slide Operations ===

    async addSlide(quizId, slideData, afterIndex = null) {
        try {
            const quiz = await this.getById(quizId);
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

            await this.update(quizId, { slides: quiz.slides });
            return slide;
        } catch (error) {
            console.error('[AperoQuizzes] Error adding slide:', error);
            return null;
        }
    }

    async updateSlide(quizId, slideId, updates) {
        try {
            const quiz = await this.getById(quizId);
            if (!quiz) return null;

            const slideIndex = quiz.slides.findIndex(s => s.id === slideId);
            if (slideIndex === -1) return null;

            quiz.slides[slideIndex] = {
                ...quiz.slides[slideIndex],
                ...updates,
                id: slideId
            };

            await this.update(quizId, { slides: quiz.slides });
            return quiz.slides[slideIndex];
        } catch (error) {
            console.error('[AperoQuizzes] Error updating slide:', error);
            return null;
        }
    }

    async deleteSlide(quizId, slideId) {
        try {
            const quiz = await this.getById(quizId);
            if (!quiz) return false;

            const slideIndex = quiz.slides.findIndex(s => s.id === slideId);
            if (slideIndex === -1) return false;

            quiz.slides.splice(slideIndex, 1);
            await this.update(quizId, { slides: quiz.slides });
            return true;
        } catch (error) {
            console.error('[AperoQuizzes] Error deleting slide:', error);
            return false;
        }
    }

    async reorderSlides(quizId, newOrder) {
        try {
            const quiz = await this.getById(quizId);
            if (!quiz) return false;

            const reordered = [];
            for (const slideId of newOrder) {
                const slide = quiz.slides.find(s => s.id === slideId);
                if (slide) reordered.push(slide);
            }

            quiz.slides = reordered;
            await this.update(quizId, { slides: quiz.slides });
            return true;
        } catch (error) {
            console.error('[AperoQuizzes] Error reordering slides:', error);
            return false;
        }
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
                    acceptedAnswers: []
                };
            case 'date':
                return {
                    ...base,
                    hint: 'Entrez une date (année ou JJ/MM/AAAA)',
                    correctAnswer: '',
                    tolerance: 0
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

    generateId() {
        return 'slide_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
}

module.exports = new AperoQuizzes();
