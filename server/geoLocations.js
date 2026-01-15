/**
 * GeoTrackr - Location Database
 * Gérée via JSON pour permettre le CRUD Admin
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'geoLocations.json');

// Initial Load
let WORLD_LOCATIONS = [];

try {
    if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        WORLD_LOCATIONS = JSON.parse(data);
        console.log('[GeoLocations] Loaded locations from JSON file');
    } else {
        console.error('[GeoLocations] Data file not found:', DATA_FILE);
        WORLD_LOCATIONS = [];
    }
} catch (error) {
    console.error('[GeoLocations] Error loading data file:', error);
    WORLD_LOCATIONS = [];
}

// Helper to save
function saveLocations() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(WORLD_LOCATIONS, null, 4), 'utf8');
        return true;
    } catch (error) {
        console.error('[GeoLocations] Error saving data file:', error);
        return false;
    }
}

// --- Public Methods ---

function getAll() {
    return WORLD_LOCATIONS;
}

function add(location) {
    // location: { lat, lng, country, city }
    if (!location.city || !location.lat || !location.lng) return false;

    // Check strict duplicate on city name to avoid confusion
    if (WORLD_LOCATIONS.some(l => l.city.toLowerCase() === location.city.toLowerCase())) {
        return false;
    }

    WORLD_LOCATIONS.push(location);
    return saveLocations();
}

function update(originalCity, newLocation) {
    const index = WORLD_LOCATIONS.findIndex(l => l.city === originalCity);
    if (index === -1) return false;

    WORLD_LOCATIONS[index] = newLocation;
    return saveLocations();
}

function remove(city) {
    const initialLength = WORLD_LOCATIONS.length;
    WORLD_LOCATIONS = WORLD_LOCATIONS.filter(l => l.city !== city);

    if (WORLD_LOCATIONS.length === initialLength) return false;

    return saveLocations();
}

// Stats helpers
function getStats() {
    return {
        total: WORLD_LOCATIONS.length,
        countries: [...new Set(WORLD_LOCATIONS.map(l => l.country))].length
    };
}

module.exports = {
    getAll,
    add,
    update,
    remove,
    getStats
};
