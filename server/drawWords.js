/**
 * Draw Up - Word/Phrase Database
 * Bibliothèque de mots et phrases à dessiner
 */

const DRAW_WORDS = {
    // Objets du quotidien - Facile
    objects_easy: [
        { word: 'Pomme', category: 'Objet' },
        { word: 'Chaise', category: 'Objet' },
        { word: 'Soleil', category: 'Objet' },
        { word: 'Maison', category: 'Objet' },
        { word: 'Voiture', category: 'Objet' },
        { word: 'Arbre', category: 'Objet' },
        { word: 'Fleur', category: 'Objet' },
        { word: 'Ballon', category: 'Objet' },
        { word: 'Livre', category: 'Objet' },
        { word: 'Téléphone', category: 'Objet' },
        { word: 'Parapluie', category: 'Objet' },
        { word: 'Escalier', category: 'Objet' },
        { word: 'Pizza', category: 'Objet' },
        { word: 'Guitare', category: 'Objet' },
        { word: 'Vélo', category: 'Objet' },
        { word: 'Chapeau', category: 'Objet' },
        { word: 'Lunettes', category: 'Objet' },
        { word: 'Banane', category: 'Objet' },
        { word: 'Horloge', category: 'Objet' },
        { word: 'Bougie', category: 'Objet' },
    ],

    // Objets - Moyen
    objects_medium: [
        { word: 'Machine à laver', category: 'Objet' },
        { word: 'Aspirateur', category: 'Objet' },
        { word: 'Micro-ondes', category: 'Objet' },
        { word: 'Tronçonneuse', category: 'Objet' },
        { word: 'Aquarium', category: 'Objet' },
        { word: 'Trampoline', category: 'Objet' },
        { word: 'Montgolfière', category: 'Objet' },
        { word: 'Périscope', category: 'Objet' },
        { word: 'Sablier', category: 'Objet' },
        { word: 'Boussole', category: 'Objet' },
        { word: 'Toboggan', category: 'Objet' },
        { word: 'Gyrophare', category: 'Objet' },
        { word: 'Télescope', category: 'Objet' },
        { word: 'Catapulte', category: 'Objet' },
        { word: 'Hamac', category: 'Objet' },
    ],

    // Animaux
    animals: [
        { word: 'Éléphant', category: 'Animal' },
        { word: 'Girafe', category: 'Animal' },
        { word: 'Crocodile', category: 'Animal' },
        { word: 'Papillon', category: 'Animal' },
        { word: 'Dauphin', category: 'Animal' },
        { word: 'Pingouin', category: 'Animal' },
        { word: 'Koala', category: 'Animal' },
        { word: 'Kangourou', category: 'Animal' },
        { word: 'Hippopotame', category: 'Animal' },
        { word: 'Pieuvre', category: 'Animal' },
        { word: 'Caméléon', category: 'Animal' },
        { word: 'Flamant rose', category: 'Animal' },
        { word: 'Hérisson', category: 'Animal' },
        { word: 'Paresseux', category: 'Animal' },
        { word: 'Autruche', category: 'Animal' },
        { word: 'Méduse', category: 'Animal' },
        { word: 'Scorpion', category: 'Animal' },
        { word: 'Requin', category: 'Animal' },
        { word: 'Tortue', category: 'Animal' },
        { word: 'Perroquet', category: 'Animal' },
    ],

    // Célébrités (françaises et internationales)
    celebrities: [
        { word: 'Michael Jackson', category: 'Célébrité', hint: 'Chanteur américain' },
        { word: 'Elvis Presley', category: 'Célébrité', hint: 'Le King du Rock' },
        { word: 'Marilyn Monroe', category: 'Célébrité', hint: 'Actrice blonde iconique' },
        { word: 'Albert Einstein', category: 'Célébrité', hint: 'Scientifique E=mc²' },
        { word: 'Napoléon', category: 'Célébrité', hint: 'Empereur français' },
        { word: 'Mona Lisa', category: 'Célébrité', hint: 'Tableau célèbre' },
        { word: 'Charlie Chaplin', category: 'Célébrité', hint: 'Acteur muet' },
        { word: 'Zinédine Zidane', category: 'Célébrité', hint: 'Footballeur français' },
        { word: 'Jean-Paul Gaultier', category: 'Célébrité', hint: 'Styliste français' },
        { word: 'Coluche', category: 'Célébrité', hint: 'Humoriste français' },
        { word: 'Astérix', category: 'Célébrité', hint: 'Gaulois de BD' },
        { word: 'Tintin', category: 'Célébrité', hint: 'Reporter de BD' },
        { word: 'Batman', category: 'Célébrité', hint: 'Super-héros chauve-souris' },
        { word: 'Mickey Mouse', category: 'Célébrité', hint: 'Souris Disney' },
        { word: 'Bob l\'éponge', category: 'Célébrité', hint: 'Éponge jaune' },
        { word: 'Pikachu', category: 'Célébrité', hint: 'Pokémon électrique' },
        { word: 'Mario', category: 'Célébrité', hint: 'Plombier Nintendo' },
        { word: 'Shrek', category: 'Célébrité', hint: 'Ogre vert' },
        { word: 'Harry Potter', category: 'Célébrité', hint: 'Sorcier à lunettes' },
        { word: 'Dark Vador', category: 'Célébrité', hint: 'Star Wars' },
    ],

    // Actions / Verbes
    actions: [
        { word: 'Danser', category: 'Action' },
        { word: 'Nager', category: 'Action' },
        { word: 'Jongler', category: 'Action' },
        { word: 'Cuisiner', category: 'Action' },
        { word: 'Dormir', category: 'Action' },
        { word: 'Pleurer', category: 'Action' },
        { word: 'Rire', category: 'Action' },
        { word: 'Courir', category: 'Action' },
        { word: 'Sauter', category: 'Action' },
        { word: 'Voler', category: 'Action' },
        { word: 'Pêcher', category: 'Action' },
        { word: 'Éternuer', category: 'Action' },
        { word: 'Méditer', category: 'Action' },
        { word: 'Bailler', category: 'Action' },
        { word: 'Applaudir', category: 'Action' },
    ],

    // Lieux
    places: [
        { word: 'Plage', category: 'Lieu' },
        { word: 'Montagne', category: 'Lieu' },
        { word: 'Château', category: 'Lieu' },
        { word: 'Pyramide', category: 'Lieu' },
        { word: 'Tour Eiffel', category: 'Lieu' },
        { word: 'Statue de la Liberté', category: 'Lieu' },
        { word: 'Colisée', category: 'Lieu' },
        { word: 'Igloo', category: 'Lieu' },
        { word: 'Volcan', category: 'Lieu' },
        { word: 'Île déserte', category: 'Lieu' },
        { word: 'Zoo', category: 'Lieu' },
        { word: 'Cirque', category: 'Lieu' },
        { word: 'Cinéma', category: 'Lieu' },
        { word: 'Hôpital', category: 'Lieu' },
        { word: 'Prison', category: 'Lieu' },
    ],

    // Films / Séries
    movies: [
        { word: 'Titanic', category: 'Film', hint: 'Bateau qui coule' },
        { word: 'Le Roi Lion', category: 'Film', hint: 'Disney safari' },
        { word: 'Avatar', category: 'Film', hint: 'Aliens bleus' },
        { word: 'Jurassic Park', category: 'Film', hint: 'Dinosaures' },
        { word: 'Matrix', category: 'Film', hint: 'Pilule rouge/bleue' },
        { word: 'Indiana Jones', category: 'Film', hint: 'Archéologue aventurier' },
        { word: 'E.T.', category: 'Film', hint: 'Alien qui téléphone maison' },
        { word: 'Retour vers le Futur', category: 'Film', hint: 'DeLorean' },
        { word: 'Les Dents de la Mer', category: 'Film', hint: 'Requin tueur' },
        { word: 'Forrest Gump', category: 'Film', hint: 'Course et chocolats' },
        { word: 'Ratatouille', category: 'Film', hint: 'Rat cuisinier' },
        { word: 'Nemo', category: 'Film', hint: 'Poisson clown' },
        { word: 'La Reine des Neiges', category: 'Film', hint: 'Libérée, délivrée' },
        { word: 'Shining', category: 'Film', hint: 'Hôtel hanté' },
        { word: 'Gladiator', category: 'Film', hint: 'Rome antique' },
    ],

    // Expressions / Concepts difficiles
    expressions: [
        { word: 'Avoir le cafard', category: 'Expression' },
        { word: 'Coup de foudre', category: 'Expression' },
        { word: 'Poisson d\'avril', category: 'Expression' },
        { word: 'Avoir la tête dans les nuages', category: 'Expression' },
        { word: 'Se lever du pied gauche', category: 'Expression' },
        { word: 'Tomber dans les pommes', category: 'Expression' },
        { word: 'Avoir un chat dans la gorge', category: 'Expression' },
        { word: 'Quand les poules auront des dents', category: 'Expression' },
        { word: 'Poser un lapin', category: 'Expression' },
        { word: 'Mettre les pieds dans le plat', category: 'Expression' },
    ],

    // Métiers
    jobs: [
        { word: 'Astronaute', category: 'Métier' },
        { word: 'Pompier', category: 'Métier' },
        { word: 'Magicien', category: 'Métier' },
        { word: 'Pirate', category: 'Métier' },
        { word: 'Chevalier', category: 'Métier' },
        { word: 'Clown', category: 'Métier' },
        { word: 'Détective', category: 'Métier' },
        { word: 'Ninja', category: 'Métier' },
        { word: 'Cow-boy', category: 'Métier' },
        { word: 'Pharaon', category: 'Métier' },
        { word: 'Footballeur', category: 'Métier' },
        { word: 'Cuisinier', category: 'Métier' },
        { word: 'DJ', category: 'Métier' },
        { word: 'Photographe', category: 'Métier' },
        { word: 'Pilote', category: 'Métier' },
    ],

    // Sports
    sports: [
        { word: 'Surf', category: 'Sport' },
        { word: 'Ski', category: 'Sport' },
        { word: 'Boxe', category: 'Sport' },
        { word: 'Basket', category: 'Sport' },
        { word: 'Tennis', category: 'Sport' },
        { word: 'Golf', category: 'Sport' },
        { word: 'Escalade', category: 'Sport' },
        { word: 'Plongée', category: 'Sport' },
        { word: 'Parachutisme', category: 'Sport' },
        { word: 'Haltérophilie', category: 'Sport' },
    ]
};

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

module.exports = {
    DRAW_WORDS,
    getAllWords,
    getWordsByCategory,
    getRandomWord,
    getCategories
};
