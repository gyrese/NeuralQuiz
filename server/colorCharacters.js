const db = require('./db');

// Get all characters
async function getAll() {
    try {
        const rows = await db.all('SELECT * FROM color_characters');
        return rows;
    } catch (error) {
        console.error('[ColorCharacters] Error getting all characters:', error);
        return [];
    }
}

// Get a random set of count characters
async function getRandomSet(count = 5) {
    try {
        // Only return the 11 characters that have transparent WebP assets ready
        const allowedIds = [
            'spongebob-body', 'luckyluke', 'goku-hair', 'bugsbunny', 'scoobydoo-fur', 'winnie',
            'cartman', 'tom', 'morty', 'goofy', 'luffy'
        ];
        const placeholders = allowedIds.map(() => '?').join(',');
        const rows = await db.all(`SELECT * FROM color_characters WHERE id IN (${placeholders}) ORDER BY RANDOM() LIMIT ?`, [...allowedIds, count]);
        return rows;
    } catch (error) {
        console.error('[ColorCharacters] Error getting random set of characters:', error);
        return [];
    }
}

// Get a single character by ID
async function getById(id) {
    try {
        const row = await db.get('SELECT * FROM color_characters WHERE id = ?', [id]);
        return row;
    } catch (error) {
        console.error(`[ColorCharacters] Error getting character ${id}:`, error);
        return null;
    }
}

// Add a new character
async function addCharacter(char) {
    try {
        const result = await db.run(
            'INSERT INTO color_characters (id, name, part, source, target_h, target_s, target_b, image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [char.id, char.name, char.part, char.source, char.target_h, char.target_s, char.target_b, char.image_path]
        );
        return result.changes > 0;
    } catch (error) {
        console.error('[ColorCharacters] Error adding character:', error);
        return false;
    }
}

// Update an existing character
async function updateCharacter(id, char) {
    try {
        const result = await db.run(
            'UPDATE color_characters SET name = ?, part = ?, source = ?, target_h = ?, target_s = ?, target_b = ?, image_path = ? WHERE id = ?',
            [char.name, char.part, char.source, char.target_h, char.target_s, char.target_b, char.image_path, id]
        );
        return result.changes > 0;
    } catch (error) {
        console.error(`[ColorCharacters] Error updating character ${id}:`, error);
        return false;
    }
}

// Delete a character
async function deleteCharacter(id) {
    try {
        const result = await db.run('DELETE FROM color_characters WHERE id = ?', [id]);
        return result.changes > 0;
    } catch (error) {
        console.error(`[ColorCharacters] Error deleting character ${id}:`, error);
        return false;
    }
}

module.exports = {
    getAll,
    getRandomSet,
    getById,
    addCharacter,
    updateCharacter,
    deleteCharacter
};
