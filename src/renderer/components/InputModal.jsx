import React, { useState, useEffect, useRef } from 'react';
import '../styles/app.css';

export default function InputModal({ title, message, initialValue = "", onConfirm, onCancel }) {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            onConfirm(value);
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <span className="modal-title">{title}</span>
                    <button className="modal-close" onClick={onCancel}>✕</button>
                </div>
                <div className="modal-body">
                    <p className="modal-message">{message}</p>
                    <input
                        ref={inputRef}
                        type="text"
                        className="modal-input"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                    <button className="btn btn-primary" onClick={() => onConfirm(value)}>Confirm</button>
                </div>
            </div>
        </div>
    );
}
