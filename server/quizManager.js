const db = require('./db');

class QuizManager {
    async getAllQuizzes() {
        try {
            const rows = await db.all('SELECT id, title, description, questions FROM quizzes');
            return rows.map(r => ({
                id: r.id,
                title: r.title,
                description: r.description,
                questions: JSON.parse(r.questions)
            }));
        } catch (err) {
            console.error("Erreur lors de la récupération des quiz depuis SQLite:", err);
            return [];
        }
    }

    async getQuiz(id) {
        try {
            const row = await db.get('SELECT id, title, description, questions FROM quizzes WHERE id = ?', [id]);
            if (!row) return null;
            return {
                id: row.id,
                title: row.title,
                description: row.description,
                questions: JSON.parse(row.questions)
            };
        } catch (err) {
            console.error("Erreur lors de la récupération du quiz depuis SQLite:", err);
            return null;
        }
    }

    async createQuiz(quizData) {
        const id = Date.now().toString();
        const title = quizData.title || '';
        const description = quizData.description || '';
        const questionsJson = JSON.stringify(quizData.questions || []);

        try {
            await db.run(
                'INSERT INTO quizzes (id, title, description, questions) VALUES (?, ?, ?, ?)',
                [id, title, description, questionsJson]
            );
            return { id, title, description, questions: quizData.questions || [] };
        } catch (err) {
            console.error("Erreur lors de la création du quiz dans SQLite:", err);
            return null;
        }
    }

    async updateQuiz(id, quizData) {
        try {
            const existing = await this.getQuiz(id);
            if (!existing) return null;

            const finalTitle = quizData.title !== undefined ? quizData.title : existing.title;
            const finalDesc = quizData.description !== undefined ? quizData.description : existing.description;
            const finalQuestionsJson = quizData.questions !== undefined ? JSON.stringify(quizData.questions) : JSON.stringify(existing.questions);

            await db.run(
                'UPDATE quizzes SET title = ?, description = ?, questions = ? WHERE id = ?',
                [finalTitle, finalDesc, finalQuestionsJson, id]
            );
            
            return {
                id,
                title: finalTitle,
                description: finalDesc,
                questions: quizData.questions !== undefined ? quizData.questions : existing.questions
            };
        } catch (err) {
            console.error("Erreur lors de la mise à jour du quiz dans SQLite:", err);
            return null;
        }
    }

    async deleteQuiz(id) {
        try {
            const result = await db.run('DELETE FROM quizzes WHERE id = ?', [id]);
            return result.changes > 0;
        } catch (err) {
            console.error("Erreur lors de la suppression du quiz dans SQLite:", err);
            return false;
        }
    }
}

module.exports = new QuizManager();
