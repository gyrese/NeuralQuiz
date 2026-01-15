/**
 * Draw Up - Word/Phrase Database
 * Bibliothèque de mots et phrases à dessiner
 * Gérée via JSON pour permettre le CRUD Admin
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'drawWords.json');

// Initial load
let DRAW_WORDS = {};

try {
    if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        DRAW_WORDS = JSON.parse(data);
        console.log('[DrawWords] Loaded words from JSON file');
    } else {
        console.error('[DrawWords] Data file not found:', DATA_FILE);
        DRAW_WORDS = {};
    }
} catch (error) {
    console.error('[DrawWords] Error loading data file:', error);
    DRAW_WORDS = {};
}

// Helper to save data
function saveWords() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(DRAW_WORDS, null, 4), 'utf8');
        return true;
    } catch (error) {
        console.error('[DrawWords] Error saving data file:', error);
        return false;
    }
}

// Get all words flattened
function getAllWords() {
    return Object.values(DRAW_WORDS).flat();
}

// Get words by category
function getWordsByCategory(category) {
    return DRAW_WORDS[category] || [];
}

// Get random word from selected categories
function getRandomWord(categories = null) {
    let pool = [];

    if (!categories || categories.length === 0 || categories.includes('all')) {
        pool = getAllWords();
    } else {
        categories.forEach(cat => {
            if (DRAW_WORDS[cat]) {
                pool = pool.concat(DRAW_WORDS[cat]);
            }
        });
    }

    if (pool.length === 0) {
        pool = getAllWords();
    }

    return pool[Math.floor(Math.random() * pool.length)];
}

// Get available categories
function getCategories() {
    return Object.keys(DRAW_WORDS);
}

// --- CRUD Operations ---

function getFullDatabase() {
    return DRAW_WORDS;
}

function addCategory(categoryKey, categoryName) { // e.g., 'videogames', 'Jeu Vidéo'
    if (DRAW_WORDS[categoryKey]) return false;
    DRAW_WORDS[categoryKey] = [];
    return saveWords();
}

function deleteCategory(categoryKey) {
    if (!DRAW_WORDS[categoryKey]) return false;
    delete DRAW_WORDS[categoryKey];
    return saveWords();
}

function addWord(categoryKey, wordObj) {
    // wordObj: { word: 'Mario', category: 'Célébrité', hint: 'Plombier' }
    if (!DRAW_WORDS[categoryKey]) return false;

    // Check duplicates
    if (DRAW_WORDS[categoryKey].some(w => w.word.toLowerCase() === wordObj.word.toLowerCase())) {
        return false;
    }

    DRAW_WORDS[categoryKey].push(wordObj);
    return saveWords();
}

function updateWord(categoryKey, originalWord, newWordObj) {
    if (!DRAW_WORDS[categoryKey]) return false;

    const index = DRAW_WORDS[categoryKey].findIndex(w => w.word === originalWord);
    if (index === -1) return false;

    DRAW_WORDS[categoryKey][index] = newWordObj;
    return saveWords();
}

function deleteWord(categoryKey, word) {
    if (!DRAW_WORDS[categoryKey]) return false;

    const initialLength = DRAW_WORDS[categoryKey].length;
    DRAW_WORDS[categoryKey] = DRAW_WORDS[categoryKey].filter(w => w.word !== word);

    if (DRAW_WORDS[categoryKey].length === initialLength) return false;

    return saveWords();
}

module.exports = {
    // Read
    getAllWords,
    getWordsByCategory,
    getRandomWord,
    getCategories,
    getFullDatabase,

    // Write
    addCategory,
    deleteCategory,
    addWord,
    updateWord,
    deleteWord
};
