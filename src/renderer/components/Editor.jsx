// src/components/EditorTabs.jsx
import React from "react";
import "../styles/editor.css";

export default function EditorTabs({
    openedTabs = [],
    setOpenedTabs,
    activeTab,
    setActiveTab,
}) {
    function handleSelect(tab) {
        if (setActiveTab) {
            setActiveTab(tab);
        }
    }

    function handleClose(e, tab) {
        e.stopPropagation();
        if (!setOpenedTabs) return;

        const remaining = openedTabs.filter((t) => t !== tab);
        setOpenedTabs(remaining);

        if (activeTab === tab) {
            setActiveTab(remaining.length ? remaining[remaining.length - 1] : null);
        }
    }

    if (!Array.isArray(openedTabs)) {
        return (
            <div className="editor-tabs">
                <div className="editor-tab error">EditorTabs misconfigured</div>
            </div>
        );
    }

    return (
        <div className="editor-tabs">
            {openedTabs.length === 0 ? (
                <div className="editor-tab placeholder">No files open</div>
            ) : (
                openedTabs.map((tab) => (
                    <div
                        key={tab}
                        className={`editor-tab ${activeTab === tab ? "active" : ""
                            }`}
                        onClick={() => handleSelect(tab)}
                    >
                        <span className="editor-tab-label">
                            {tab.split(/[\\/]/).pop()}
                        </span>
                        <button
                            className="editor-tab-close"
                            onClick={(e) => handleClose(e, tab)}
                        >
                            ×
                        </button>
                    </div>
                ))
            )}
        </div>
    );
}
