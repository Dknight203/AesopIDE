// src/renderer/components/EditorPanel.jsx
import React, { useRef, useEffect } from "react";
import "../styles/editor.css";

export default function EditorPanel({ activeTab, onChangeContent, onSave }) {
    const content = activeTab?.content ?? "";
    const path = activeTab?.path ?? "";
    const textareaRef = useRef(null);
    const lineNumbersRef = useRef(null);

    // Sync scroll between textarea and line numbers
    const handleScroll = () => {
        if (textareaRef.current && lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
        }
    };

    // Generate line numbers
    const lineCount = content.split('\n').length;
    const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');

    if (!activeTab) {
        return (
            <div className="editor-panel empty">
                <div className="empty-state">
                    <div className="empty-state-icon">📝</div>
                    <div className="empty-state-title">No File Open</div>
                    <div className="empty-state-description">
                        Select a file from the explorer to start editing
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="editor-panel">
            <div className="editor-toolbar">
                <div className="editor-file-info">
                    <span className="editor-file-icon">📄</span>
                    <span className="editor-file-path">{path}</span>
                </div>
                <div className="editor-actions">
                    <span className="editor-stats">
                        {lineCount} lines • {content.length} chars
                    </span>
                    <button
                        className="editor-save-button"
                        onClick={onSave}
                        title="Save (Ctrl+S)"
                    >
                        💾 Save
                    </button>
                </div>
            </div>

            <div className="editor-container">
                <div
                    className="editor-gutter"
                    ref={lineNumbersRef}
                >
                    {lineNumbers}
                </div>
                <textarea
                    ref={textareaRef}
                    className="editor-textarea"
                    value={content}
                    onChange={(e) => onChangeContent(e.target.value)}
                    onScroll={handleScroll}
                    spellCheck="false"
                />
            </div>
        </div>
    );
}
