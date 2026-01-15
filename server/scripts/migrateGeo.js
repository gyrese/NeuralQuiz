const fs = require('fs');
const path = require('path');
const locations = require('../geoLocations');

const outputPath = path.join(__dirname, '../data/geoLocations.json');

try {
    fs.writeFileSync(outputPath, JSON.stringify(locations, null, 4), 'utf8');
    console.log(`Successfully migrated ${locations.length} locations to ${outputPath}`);
} catch (error) {
    console.error('Error migrating locations:', error);
}
