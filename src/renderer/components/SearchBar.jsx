import React, { useState } from 'react';
import '../styles/searchbar.css';

export default function SearchBar({ onClose, onFind, onReplace, onReplaceAll }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [replaceTerm, setReplaceTerm] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);

    const handleFind = (direction = 'next') => {
        if (searchTerm) {
            onFind(searchTerm, { caseSensitive, direction });
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleFind(e.shiftKey ? 'prev' : 'next');
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div className="search-bar">
            <div className="search-row">
                <input
                    type="text"
                    className="search-input"
                    placeholder="Find..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                />
                <button
                    className="search-btn"
                    onClick={() => handleFind('prev')}
                    title="Previous (Shift+Enter)"
                >
                    ↑
                </button>
                <button
                    className="search-btn"
                    onClick={() => handleFind('next')}
                    title="Next (Enter)"
                >
                    ↓
                </button>
                <label className="search-option">
                    <input
                        type="checkbox"
                        checked={caseSensitive}
                        onChange={(e) => setCaseSensitive(e.target.checked)}
                    />
                    <span>Aa</span>
                </label>
                <button className="search-close" onClick={onClose} title="Close (Esc)">
                    ✕
                </button>
            </div>
            <div className="search-row">
                <input
                    type="text"
                    className="search-input"
                    placeholder="Replace..."
                    value={replaceTerm}
                    onChange={(e) => setReplaceTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button
                    className="search-btn"
                    onClick={() => onReplace(searchTerm, replaceTerm, { caseSensitive })}
                    disabled={!searchTerm}
                >
                    Replace
                </button>
                <button
                    className="search-btn"
                    onClick={() => onReplaceAll(searchTerm, replaceTerm, { caseSensitive })}
                    disabled={!searchTerm}
                >
                    All
                </button>
            </div>
        </div>
    );
}
