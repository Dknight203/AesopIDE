// src/renderer/components/EditorTabs.jsx
import React from "react";
import "../styles/tabs.css";

export default function EditorTabs({ tabs, activePath, onSelect, onClose }) {
    if (tabs.length === 0) {
        return (
            <div className="editor-tabs-container">
                <div className="editor-tabs-empty">No files open</div>
            </div>
        );
    }

    return (
        <div className="editor-tabs-container">
            <div className="editor-tabs">
                {tabs.map((tab) => (
                    <div
                        key={tab.path}
                        className={`editor-tab ${tab.path === activePath ? 'active' : ''}`}
                        onClick={() => onSelect(tab.path)}
                    >
                        <span className="editor-tab-name" title={tab.path}>
                            {tab.name}
                        </span>
                        {tab.isDirty && (
                            <span className="editor-tab-dirty" title="Unsaved changes"></span>
                        )}
                        <button
                            className="editor-tab-close"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose(tab.path);
                            }}
                            title="Close"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
