const drawWords = require('../drawWords');
const geoLocations = require('../geoLocations');

module.exports = {
    setupRoutes: (app) => {
        // ================================================
        // ADMIN - GEO TRACKR
        // ================================================

        // Get all locations
        app.get('/api/admin/geo/locations', (req, res) => {
            res.json(geoLocations.getAll());
        });

        // Expand Google Maps short URL
        app.get('/api/admin/geo/expand-url', async (req, res) => {
            const { url } = req.query;

            if (!url) {
                return res.status(400).json({ error: 'URL is required' });
            }

            try {
                // Use fetch to follow redirects and get the final URL
                const https = require('https');
                const http = require('http');

                const expandUrl = (shortUrl) => {
                    return new Promise((resolve, reject) => {
                        const protocol = shortUrl.startsWith('https') ? https : http;

                        const request = protocol.get(shortUrl, {
                            timeout: 5000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        }, (response) => {
                            // Check for redirect
                            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                                // Follow redirect
                                expandUrl(response.headers.location).then(resolve).catch(reject);
                            } else {
                                // Final URL - return what we have
                                resolve(shortUrl);
                            }
                        });

                        request.on('error', reject);
                        request.on('timeout', () => {
                            request.destroy();
                            reject(new Error('Timeout'));
                        });
                    });
                };

                const expandedUrl = await expandUrl(url);
                res.json({ expandedUrl });
            } catch (error) {
                console.error('Error expanding URL:', error);
                res.status(500).json({ error: 'Could not expand URL', expandedUrl: url });
            }
        });

        // Add a new location
        app.post('/api/admin/geo/locations', (req, res) => {
            const { lat, lng, country, city } = req.body;

            if (!lat || !lng || !country || !city) {
                return res.status(400).json({ error: 'Lat, Lng, Country and City are required' });
            }

            const newLocation = { lat: parseFloat(lat), lng: parseFloat(lng), country, city };
            const success = geoLocations.add(newLocation);

            if (success) {
                res.json({ success: true, location: newLocation });
            } else {
                res.status(500).json({ error: 'Failed to add location (duplicate city?)' });
            }
        });

        // Update a location
        app.put('/api/admin/geo/locations', (req, res) => {
            const { originalCity, lat, lng, country, city } = req.body;

            if (!originalCity || !lat || !lng || !country || !city) {
                return res.status(400).json({ error: 'OriginalCity, Lat, Lng, Country and City are required' });
            }

            const newLocation = { lat: parseFloat(lat), lng: parseFloat(lng), country, city };
            const success = geoLocations.update(originalCity, newLocation);

            if (success) {
                res.json({ success: true, location: newLocation });
            } else {
                res.status(500).json({ error: 'Failed to update location' });
            }
        });

        // Delete a location
        app.delete('/api/admin/geo/locations', (req, res) => {
            const { city } = req.body;

            if (!city) {
                return res.status(400).json({ error: 'City is required' });
            }

            const success = geoLocations.remove(city);
            if (success) {
                res.json({ success: true });
            } else {
                res.status(500).json({ error: 'Failed to delete location' });
            }
        });

        // ================================================
        // ADMIN - DRAW UP (PICTIONARY)
        // ================================================

        // Get all words (grouped by category key)
        app.get('/api/admin/draw/words', (req, res) => {
            res.json(drawWords.getFullDatabase());
        });

        // Add a new word
        app.post('/api/admin/draw/words', (req, res) => {
            const { categoryKey, word, hint, categoryLabel } = req.body;

            if (!categoryKey || !word) {
                return res.status(400).json({ error: 'CategoryKey and Word are required' });
            }

            const newWord = {
                word,
                category: categoryLabel || 'Divers', // Visual category label
                hint
            };

            const success = drawWords.addWord(categoryKey, newWord);
            if (success) {
                res.json({ success: true, word: newWord });
            } else {
                res.status(500).json({ error: 'Failed to add word (duplicate or invalid category)' });
            }
        });

        // Update a word
        app.put('/api/admin/draw/words', (req, res) => {
            const { categoryKey, originalWord, newWord, newHint, newCategoryLabel } = req.body;

            if (!categoryKey || !originalWord || !newWord) {
                return res.status(400).json({ error: 'CategoryKey, OriginalWord and NewWord are required' });
            }

            const newWordObj = {
                word: newWord,
                category: newCategoryLabel || 'Divers',
                hint: newHint
            };

            const success = drawWords.updateWord(categoryKey, originalWord, newWordObj);
            if (success) {
                res.json({ success: true, word: newWordObj });
            } else {
                res.status(500).json({ error: 'Failed to update word' });
            }
        });

        // Delete a word
        app.delete('/api/admin/draw/words', (req, res) => {
            const { categoryKey, word } = req.body;

            if (!categoryKey || !word) {
                return res.status(400).json({ error: 'CategoryKey and Word are required' });
            }

            const success = drawWords.deleteWord(categoryKey, word);
            if (success) {
                res.json({ success: true });
            } else {
                res.status(500).json({ error: 'Failed to delete word' });
            }
        });

        // Add a new category
        app.post('/api/admin/draw/categories', (req, res) => {
            const { key, label } = req.body;
            if (!key) return res.status(400).json({ error: 'Key is required' });

            const success = drawWords.addCategory(key, label);
            if (success) {
                res.json({ success: true });
            } else {
                res.status(500).json({ error: 'Failed to add category (key might exist)' });
            }
        });

        // Delete a category
        app.delete('/api/admin/draw/categories/:key', (req, res) => {
            const { key } = req.params;
            const success = drawWords.deleteCategory(key);
            if (success) {
                res.json({ success: true });
            } else {
                res.status(500).json({ error: 'Failed to delete category' });
            }
        });
    }
};
