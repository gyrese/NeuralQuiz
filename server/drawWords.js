const db = require('./db');

// Get all words flattened
async function getAllWords() {
    try {
        const rows = await db.all('SELECT word, category, hint FROM draw_words WHERE word != "__INIT__"');
        return rows;
    } catch (error) {
        console.error('[DrawWords] Error getting all words:', error);
        return [];
    }
}

// Get words by category
async function getWordsByCategory(categoryKey) {
    try {
        const rows = await db.all('SELECT word, category, hint FROM draw_words WHERE categoryKey = ? AND word != "__INIT__"', [categoryKey]);
        return rows;
    } catch (error) {
        console.error('[DrawWords] Error getting words by category:', error);
        return [];
    }
}

// Get random word from selected categories
async function getRandomWord(categories = null) {
    try {
        let rows = [];
        if (!categories || categories.length === 0 || categories.includes('all')) {
            rows = await db.all('SELECT word, category, hint FROM draw_words WHERE word != "__INIT__"');
        } else {
            // Construire les placeholders pour le IN
            const placeholders = categories.map(() => '?').join(',');
            rows = await db.all(`SELECT word, category, hint FROM draw_words WHERE categoryKey IN (${placeholders}) AND word != "__INIT__"`, categories);
        }

        if (rows.length === 0) {
            // Fallback
            rows = await db.all('SELECT word, category, hint FROM draw_words WHERE word != "__INIT__"');
        }

        if (rows.length === 0) return null;
        return rows[Math.floor(Math.random() * rows.length)];
    } catch (error) {
        console.error('[DrawWords] Error getting random word:', error);
        return null;
    }
}

// Get available categories
async function getCategories() {
    try {
        const rows = await db.all('SELECT DISTINCT categoryKey FROM draw_words');
        return rows.map(r => r.categoryKey);
    } catch (error) {
        console.error('[DrawWords] Error getting categories:', error);
        return [];
    }
}

// Reconstruire la base de données au format d'origine (groupé par catégorie) pour l'admin
async function getFullDatabase() {
    try {
        const rows = await db.all('SELECT categoryKey, word, category, hint FROM draw_words');
        const dbGrouped = {};
        for (const row of rows) {
            if (!dbGrouped[row.categoryKey]) {
                dbGrouped[row.categoryKey] = [];
            }
            if (row.word !== '__INIT__') {
                dbGrouped[row.categoryKey].push({
                    word: row.word,
                    category: row.category,
                    hint: row.hint
                });
            }
        }
        return dbGrouped;
    } catch (error) {
        console.error('[DrawWords] Error getting full database:', error);
        return {};
    }
}

// --- CRUD Operations ---

async function addCategory(categoryKey, categoryName) {
    try {
        const existing = await db.get('SELECT COUNT(*) as count FROM draw_words WHERE categoryKey = ?', [categoryKey]);
        if (existing && existing.count > 0) return false;
        
        await db.run(
            'INSERT OR IGNORE INTO draw_words (categoryKey, word, category, hint) VALUES (?, ?, ?, ?)',
            [categoryKey, '__INIT__', categoryName || 'Divers', '']
        );
        return true;
    } catch (err) {
        console.error('[DrawWords] Error adding category:', err);
        return false;
    }
}

async function deleteCategory(categoryKey) {
    try {
        const result = await db.run('DELETE FROM draw_words WHERE categoryKey = ?', [categoryKey]);
        return result.changes > 0;
    } catch (err) {
        console.error('[DrawWords] Error deleting category:', err);
        return false;
    }
}

async function addWord(categoryKey, wordObj) {
    try {
        // Supprimer le mot d'initialisation factice si présent
        await db.run('DELETE FROM draw_words WHERE categoryKey = ? AND word = "__INIT__"', [categoryKey]);

        const result = await db.run(
            'INSERT OR IGNORE INTO draw_words (categoryKey, word, category, hint) VALUES (?, ?, ?, ?)',
            [categoryKey, wordObj.word, wordObj.category, wordObj.hint || '']
        );
        return result.changes > 0;
    } catch (err) {
        console.error('[DrawWords] Error adding word:', err);
        return false;
    }
}

async function updateWord(categoryKey, originalWord, newWordObj) {
    try {
        const result = await db.run(
            'UPDATE draw_words SET word = ?, category = ?, hint = ? WHERE categoryKey = ? AND word = ?',
            [newWordObj.word, newWordObj.category, newWordObj.hint || '', categoryKey, originalWord]
        );
        return result.changes > 0;
    } catch (err) {
        console.error('[DrawWords] Error updating word:', err);
        return false;
    }
}

async function deleteWord(categoryKey, word) {
    try {
        const result = await db.run(
            'DELETE FROM draw_words WHERE categoryKey = ? AND word = ?',
            [categoryKey, word]
        );
        return result.changes > 0;
    } catch (err) {
        console.error('[DrawWords] Error deleting word:', err);
        return false;
    }
}

module.exports = {
    getAllWords,
    getWordsByCategory,
    getRandomWord,
    getCategories,
    getFullDatabase,
    addCategory,
    deleteCategory,
    addWord,
    updateWord,
    deleteWord
};
