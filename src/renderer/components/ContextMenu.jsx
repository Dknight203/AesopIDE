// src/renderer/components/ContextMenu.jsx
import React, { useEffect } from "react";
import "../styles/sidebar.css";

export default function ContextMenu({ x, y, items, onClose }) {
    useEffect(() => {
        const handleClick = () => onClose();
        const handleEscape = (e) => {
            if (e.key === "Escape") onClose();
        };

        document.addEventListener("click", handleClick);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("click", handleClick);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [onClose]);

    return (
        <div
            className="context-menu"
            style={{ top: y, left: x }}
            onClick={(e) => e.stopPropagation()}
        >
            {items.map((item, idx) => (
                item.separator ? (
                    <div key={idx} className="context-menu-separator" />
                ) : (
                    <div
                        key={item.label}
                        className={`context-menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!item.disabled) {
                                item.onClick();
                                onClose();
                            }
                        }}
                    >
                        <span className="context-menu-icon">{item.icon}</span>
                        <span className="context-menu-label">{item.label}</span>
                        {item.shortcut && <span className="context-menu-shortcut">{item.shortcut}</span>}
                    </div>
                )
            ))}
        </div>
    );
}
