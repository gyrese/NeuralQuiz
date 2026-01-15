import { useState, useEffect } from 'react';

const API_URL = `${window.location.protocol}//${window.location.hostname}:3001/api/admin/geo`;

function GeoAdmin() {
    const [locations, setLocations] = useState([]);
    const [filteredLocations, setFilteredLocations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCountry, setFilterCountry] = useState('All');

    // Form state
    const [formData, setFormData] = useState({
        lat: '',
        lng: '',
        country: '',
        city: '',
        originalCity: ''
    });
    const [mapsUrl, setMapsUrl] = useState('');
    const [isParsingUrl, setIsParsingUrl] = useState(false);

    useEffect(() => {
        fetchLocations();
    }, []);

    useEffect(() => {
        filterData();
    }, [locations, searchTerm, filterCountry]);

    const fetchLocations = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/locations`);
            const data = await res.json();
            setLocations(data);
        } catch (error) {
            console.error('Error fetching locations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filterData = () => {
        let filtered = locations;

        if (filterCountry !== 'All') {
            filtered = filtered.filter(l => l.country === filterCountry);
        }

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(l =>
                l.city.toLowerCase().includes(lower) ||
                l.country.toLowerCase().includes(lower)
            );
        }

        setFilteredLocations(filtered);
    };

    // Parse Google Maps URL to extract coordinates
    const parseGoogleMapsUrl = async (url) => {
        if (!url) return;

        setIsParsingUrl(true);

        try {
            // Handle short URLs like maps.app.goo.gl - need to expand them
            let finalUrl = url;

            if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
                // For short URLs, we need to follow the redirect
                // We'll try to extract from the URL pattern after expansion
                // Since we can't do server-side redirect following easily,
                // we'll ask the user to use the expanded URL or try common patterns

                // Try to fetch and get redirected URL via our server
                try {
                    const expandRes = await fetch(`${API_URL}/expand-url?url=${encodeURIComponent(url)}`);
                    if (expandRes.ok) {
                        const data = await expandRes.json();
                        finalUrl = data.expandedUrl || url;
                    }
                } catch (e) {
                    console.log('Could not expand URL, trying direct parse');
                }
            }

            // Try various patterns to extract coordinates
            let lat, lng;

            // Pattern 1: @lat,lng or !3d-lat!4d-lng in URL
            const atPattern = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
            const match1 = finalUrl.match(atPattern);
            if (match1) {
                lat = parseFloat(match1[1]);
                lng = parseFloat(match1[2]);
            }

            // Pattern 2: ?ll=lat,lng
            if (!lat) {
                const llPattern = /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
                const match2 = finalUrl.match(llPattern);
                if (match2) {
                    lat = parseFloat(match2[1]);
                    lng = parseFloat(match2[2]);
                }
            }

            // Pattern 3: !3d and !4d patterns (Street View)
            if (!lat) {
                const dPattern = /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/;
                const match3 = finalUrl.match(dPattern);
                if (match3) {
                    lat = parseFloat(match3[1]);
                    lng = parseFloat(match3[2]);
                }
            }

            // Pattern 4: place/.../@lat,lng
            if (!lat) {
                const placePattern = /place\/[^@]*@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
                const match4 = finalUrl.match(placePattern);
                if (match4) {
                    lat = parseFloat(match4[1]);
                    lng = parseFloat(match4[2]);
                }
            }

            if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
                setFormData(prev => ({
                    ...prev,
                    lat: lat.toFixed(6),
                    lng: lng.toFixed(6)
                }));
                setMapsUrl(''); // Clear the URL field on success
            } else {
                alert('Impossible d\'extraire les coordonnées. Essayez de copier l\'URL complète depuis la barre d\'adresse de Google Maps (pas le lien court).');
            }
        } catch (error) {
            console.error('Error parsing Google Maps URL:', error);
            alert('Erreur lors de l\'analyse du lien');
        } finally {
            setIsParsingUrl(false);
        }
    };

    const handleAdd = () => {
        setEditMode(false);
        setFormData({
            lat: '',
            lng: '',
            country: '',
            city: '',
            originalCity: ''
        });
        setMapsUrl('');
        setShowModal(true);
    };

    const handleEdit = (loc) => {
        setEditMode(true);
        setFormData({
            lat: loc.lat,
            lng: loc.lng,
            country: loc.country,
            city: loc.city,
            originalCity: loc.city
        });
        setShowModal(true);
    };

    const handleDelete = async (city) => {
        if (!window.confirm(`Supprimer le lieu "${city}" ?`)) return;

        try {
            const res = await fetch(`${API_URL}/locations`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ city })
            });
            if (res.ok) {
                fetchLocations();
            } else {
                alert('Erreur lors de la suppression');
            }
        } catch (error) {
            console.error('Delete error:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const endpoint = `${API_URL}/locations`;
        const method = editMode ? 'PUT' : 'POST';

        try {
            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setShowModal(false);
                fetchLocations();
            } else {
                alert('Erreur lors de la sauvegarde');
            }
        } catch (error) {
            console.error('Save error:', error);
        }
    };

    // Derived data
    const countries = ['All', ...new Set(locations.map(l => l.country))].sort();

    return (
        <div className="geo-admin">
            <h2 className="text-secondary mb-4">Gestion GeoTrackr</h2>

            {/* Toolbar */}
            <div className="row mb-4 g-3">
                <div className="col-md-4">
                    <input
                        type="text"
                        className="form-control bg-dark text-white border-secondary"
                        placeholder="Rechercher une ville..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="col-md-4">
                    <select
                        className="form-select bg-dark text-white border-secondary"
                        value={filterCountry}
                        onChange={e => setFilterCountry(e.target.value)}
                    >
                        {countries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="col-md-4 text-end">
                    <button className="btn btn-success" onClick={handleAdd}>
                        + Ajouter un lieu
                    </button>
                    <div className="text-muted small mt-1">Total: {filteredLocations.length} / {locations.length}</div>
                </div>
            </div>

            {/* Locations List */}
            {isLoading ? (
                <div className="text-center p-5">
                    <div className="spinner-border text-secondary" role="status"></div>
                </div>
            ) : (
                <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    <table className="table table-dark table-hover border-secondary table-sm">
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                            <tr>
                                <th>Ville / Lieu</th>
                                <th>Pays</th>
                                <th>Lat</th>
                                <th>Lng</th>
                                <th className="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLocations.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="fw-bold text-white">{item.city}</td>
                                    <td className="text-info">{item.country}</td>
                                    <td className="text-muted small">{item.lat}</td>
                                    <td className="text-muted small">{item.lng}</td>
                                    <td className="text-end">
                                        <button
                                            className="btn btn-sm btn-outline-info me-2"
                                            onClick={() => handleEdit(item)}
                                            title="Éditer"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="btn btn-sm btn-outline-danger"
                                            onClick={() => handleDelete(item.city)}
                                            title="Supprimer"
                                        >
                                            🗑️
                                        </button>
                                        <a
                                            href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${item.lat},${item.lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-sm btn-outline-warning ms-2"
                                            title="Voir sur Maps"
                                        >
                                            👀
                                        </a>
                                    </td>
                                </tr>
                            ))}
                            {filteredLocations.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="text-center text-muted py-4">
                                        Aucun lieu trouvé
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Modal */}
            {showModal && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content bg-dark border-secondary">
                            <div className="modal-header border-secondary">
                                <h5 className="modal-title text-white">
                                    {editMode ? 'Modifier le lieu' : 'Ajouter un lieu'}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label text-secondary">Ville / Nom du Lieu</label>
                                        <input
                                            type="text"
                                            className="form-control bg-black text-white border-secondary"
                                            value={formData.city}
                                            onChange={e => setFormData({ ...formData, city: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label text-secondary">Pays</label>
                                        <input
                                            type="text"
                                            className="form-control bg-black text-white border-secondary"
                                            value={formData.country}
                                            onChange={e => setFormData({ ...formData, country: e.target.value })}
                                            required
                                        />
                                    </div>

                                    {/* Google Maps URL Parser */}
                                    {!editMode && (
                                        <div className="mb-3 p-3 border border-info rounded" style={{ backgroundColor: 'rgba(13, 202, 240, 0.1)' }}>
                                            <label className="form-label text-info">
                                                📍 Coller un lien Google Maps (optionnel)
                                            </label>
                                            <div className="input-group">
                                                <input
                                                    type="text"
                                                    className="form-control bg-black text-white border-secondary"
                                                    placeholder="https://maps.app.goo.gl/... ou URL complète"
                                                    value={mapsUrl}
                                                    onChange={e => setMapsUrl(e.target.value)}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn btn-info"
                                                    onClick={() => parseGoogleMapsUrl(mapsUrl)}
                                                    disabled={!mapsUrl || isParsingUrl}
                                                >
                                                    {isParsingUrl ? '...' : 'Extraire'}
                                                </button>
                                            </div>
                                            <small className="text-muted">Extrait automatiquement les coordonnées</small>
                                        </div>
                                    )}

                                    <div className="row">
                                        <div className="col-6 mb-3">
                                            <label className="form-label text-secondary">Latitude</label>
                                            <input
                                                type="number"
                                                step="any"
                                                className="form-control bg-black text-white border-secondary"
                                                value={formData.lat}
                                                onChange={e => setFormData({ ...formData, lat: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="col-6 mb-3">
                                            <label className="form-label text-secondary">Longitude</label>
                                            <input
                                                type="number"
                                                step="any"
                                                className="form-control bg-black text-white border-secondary"
                                                value={formData.lng}
                                                onChange={e => setFormData({ ...formData, lng: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer border-secondary">
                                    <button type="button" className="btn btn-outline-light" onClick={() => setShowModal(false)}>Annuler</button>
                                    <button type="submit" className="btn btn-primary">Enregistrer</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GeoAdmin;
