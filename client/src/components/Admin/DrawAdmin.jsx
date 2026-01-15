import { useState, useEffect } from 'react';

const API_URL = `${window.location.protocol}//${window.location.hostname}:3001/api/admin/draw`;

function DrawAdmin() {
    const [wordsData, setWordsData] = useState({});
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        word: '',
        hint: '',
        categoryKey: '',
        categoryLabel: '',
        originalWord: ''
    });

    useEffect(() => {
        fetchWords();
    }, []);

    const fetchWords = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/words`);
            const data = await res.json();
            setWordsData(data);
            if (!selectedCategory && Object.keys(data).length > 0) {
                setSelectedCategory(Object.keys(data)[0]);
            }
        } catch (error) {
            console.error('Error fetching words:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = () => {
        setEditMode(false);
        setFormData({
            word: '',
            hint: '',
            categoryKey: selectedCategory,
            categoryLabel: wordsData[selectedCategory]?.[0]?.category || '',
            originalWord: ''
        });
        setShowModal(true);
    };

    const handleEdit = (wordObj) => {
        setEditMode(true);
        setFormData({
            word: wordObj.word,
            hint: wordObj.hint || '',
            categoryKey: selectedCategory,
            categoryLabel: wordObj.category,
            originalWord: wordObj.word
        });
        setShowModal(true);
    };

    const handleDelete = async (word) => {
        if (!window.confirm(`Supprimer le mot "${word}" ?`)) return;

        try {
            const res = await fetch(`${API_URL}/words`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoryKey: selectedCategory, word })
            });
            if (res.ok) {
                fetchWords();
            } else {
                alert('Erreur lors de la suppression');
            }
        } catch (error) {
            console.error('Delete error:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const endpoint = `${API_URL}/words`;
        const method = editMode ? 'PUT' : 'POST';

        try {
            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setShowModal(false);
                fetchWords();
            } else {
                alert('Erreur lors de la sauvegarde');
            }
        } catch (error) {
            console.error('Save error:', error);
        }
    };

    return (
        <div className="draw-admin">
            <h2 className="text-secondary mb-4">Gestion Draw Up</h2>

            {/* Category Tabs */}
            <ul className="nav nav-tabs mb-4 border-secondary">
                {Object.keys(wordsData).map(key => (
                    <li className="nav-item" key={key}>
                        <button
                            className={`nav-link ${selectedCategory === key ? 'active bg-secondary text-white' : 'text-muted'}`}
                            onClick={() => setSelectedCategory(key)}
                            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                        >
                            {key} <span className="badge bg-dark rounded-pill ms-2">{wordsData[key].length}</span>
                        </button>
                    </li>
                ))}
            </ul>

            {/* Toolbar */}
            <div className="d-flex justify-content-end mb-3">
                <button className="btn btn-success" onClick={handleAdd}>
                    + Ajouter un mot
                </button>
            </div>

            {/* Word List */}
            {isLoading ? (
                <div className="text-center p-5">
                    <div className="spinner-border text-secondary" role="status"></div>
                </div>
            ) : (
                <div className="table-responsive">
                    <table className="table table-dark table-hover border-secondary">
                        <thead>
                            <tr>
                                <th>Mot</th>
                                <th>Indice</th>
                                <th className="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {wordsData[selectedCategory]?.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="fw-bold text-white">{item.word}</td>
                                    <td className="text-muted fst-italic">{item.hint || '-'}</td>
                                    <td className="text-end">
                                        <button
                                            className="btn btn-sm btn-outline-info me-2"
                                            onClick={() => handleEdit(item)}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="btn btn-sm btn-outline-danger"
                                            onClick={() => handleDelete(item.word)}
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {wordsData[selectedCategory]?.length === 0 && (
                                <tr>
                                    <td colSpan="3" className="text-center text-muted py-4">
                                        Aucun mot dans cette catégorie
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Modal (Simple overlay for now) */}
            {showModal && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content bg-dark border-secondary">
                            <div className="modal-header border-secondary">
                                <h5 className="modal-title text-white">
                                    {editMode ? 'Modifier le mot' : 'Ajouter un mot'}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label text-secondary">Mot / Phrase</label>
                                        <input
                                            type="text"
                                            className="form-control bg-black text-white border-secondary"
                                            value={formData.word}
                                            onChange={e => setFormData({ ...formData, word: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label text-secondary">Indice (optionnel)</label>
                                        <input
                                            type="text"
                                            className="form-control bg-black text-white border-secondary"
                                            value={formData.hint}
                                            onChange={e => setFormData({ ...formData, hint: e.target.value })}
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label text-secondary">Catégorie (Label)</label>
                                        <input
                                            type="text"
                                            className="form-control bg-black text-white border-secondary"
                                            value={formData.categoryLabel}
                                            onChange={e => setFormData({ ...formData, categoryLabel: e.target.value })}
                                        />
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

export default DrawAdmin;
