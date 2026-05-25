/**
 * GeoTrackr - Location Database (SQLite Version)
 */

const db = require('./db');

// --- Public Methods ---

async function getAll() {
    try {
        const rows = await db.all('SELECT city, lat, lng, country FROM geo_locations');
        return rows;
    } catch (error) {
        console.error('[GeoLocations] Error loading locations from SQLite:', error);
        return [];
    }
}

async function add(location) {
    // location: { lat, lng, country, city }
    if (!location.city || location.lat === undefined || location.lng === undefined) {
        return false;
    }

    try {
        // Check strict duplicate on city name to avoid confusion (case-insensitive)
        const existing = await db.get('SELECT city FROM geo_locations WHERE LOWER(city) = LOWER(?)', [location.city]);
        if (existing) {
            return false;
        }

        await db.run(
            'INSERT INTO geo_locations (city, lat, lng, country) VALUES (?, ?, ?, ?)',
            [location.city, location.lat, location.lng, location.country || '']
        );
        return true;
    } catch (error) {
        console.error('[GeoLocations] Error adding location to SQLite:', error);
        return false;
    }
}

async function update(originalCity, newLocation) {
    if (!originalCity || !newLocation.city || newLocation.lat === undefined || newLocation.lng === undefined) {
        return false;
    }

    try {
        // Si le nom de la ville a changé, vérifier si la nouvelle ville existe déjà
        if (originalCity.toLowerCase() !== newLocation.city.toLowerCase()) {
            const existing = await db.get('SELECT city FROM geo_locations WHERE LOWER(city) = LOWER(?)', [newLocation.city]);
            if (existing) {
                return false;
            }
        }

        const result = await db.run(
            'UPDATE geo_locations SET city = ?, lat = ?, lng = ?, country = ? WHERE city = ?',
            [newLocation.city, newLocation.lat, newLocation.lng, newLocation.country || '', originalCity]
        );
        return result.changes > 0;
    } catch (error) {
        console.error('[GeoLocations] Error updating location in SQLite:', error);
        return false;
    }
}

async function remove(city) {
    if (!city) return false;

    try {
        const result = await db.run('DELETE FROM geo_locations WHERE city = ?', [city]);
        return result.changes > 0;
    } catch (error) {
        console.error('[GeoLocations] Error deleting location from SQLite:', error);
        return false;
    }
}

// Stats helpers
async function getStats() {
    try {
        const totalRow = await db.get('SELECT COUNT(*) as count FROM geo_locations');
        const countriesRow = await db.get('SELECT COUNT(DISTINCT country) as count FROM geo_locations');
        return {
            total: totalRow ? totalRow.count : 0,
            countries: countriesRow ? countriesRow.count : 0
        };
    } catch (error) {
        console.error('[GeoLocations] Error getting stats from SQLite:', error);
        return { total: 0, countries: 0 };
    }
}

module.exports = {
    getAll,
    add,
    update,
    remove,
    getStats
};
