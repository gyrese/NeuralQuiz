const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'quizzes.json');

class QuizManager {
    constructor() {
        this.quizzes = [];
        this.loadQuizzes();
    }

    loadQuizzes() {
        try {
            if (fs.existsSync(DATA_FILE)) {
                const data = fs.readFileSync(DATA_FILE, 'utf8');
                this.quizzes = JSON.parse(data);
            } else {
                this.quizzes = [];
                this.saveQuizzes();
            }
        } catch (err) {
            console.error("Erreur lors du chargement des quiz:", err);
            this.quizzes = [];
        }
    }

    saveQuizzes() {
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(this.quizzes, null, 4), 'utf8');
        } catch (err) {
            console.error("Erreur lors de la sauvegarde des quiz:", err);
        }
    }

    getAllQuizzes() {
        return this.quizzes;
    }

    getQuiz(id) {
        return this.quizzes.find(q => q.id === id);
    }

    createQuiz(quizData) {
        const newQuiz = {
            id: Date.now().toString(),
            ...quizData
        };
        this.quizzes.push(newQuiz);
        this.saveQuizzes();
        return newQuiz;
    }

    updateQuiz(id, quizData) {
        const index = this.quizzes.findIndex(q => q.id === id);
        if (index !== -1) {
            this.quizzes[index] = { ...this.quizzes[index], ...quizData };
            this.saveQuizzes();
            return this.quizzes[index];
        }
        return null;
    }

    deleteQuiz(id) {
        const initialLength = this.quizzes.length;
        this.quizzes = this.quizzes.filter(q => q.id !== id);
        if (this.quizzes.length !== initialLength) {
            this.saveQuizzes();
            return true;
        }
        return false;
    }
}

module.exports = new QuizManager();
