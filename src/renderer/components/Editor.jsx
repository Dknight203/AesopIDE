// src/renderer/components/Editor.jsx
import React, { useState, useRef } from "react";
import "../styles/editor.css";
import ContextMenu from "./ContextMenu";

export default function Editor({ activeTab, onChangeContent, onSave }) {
    const [contextMenu, setContextMenu] = useState(null);
    const textareaRef = useRef(null);

    function handleContextMenu(e) {
        e.preventDefault();

        const textarea = textareaRef.current;
        const hasSelection = textarea && textarea.selectionStart !== textarea.selectionEnd;

        const items = [
            {
                label: 'Cut',
                icon: '✂️',
                shortcut: 'Ctrl+X',
                disabled: !hasSelection,
                onClick: () => {
                    document.execCommand('cut');
                }
            },
            {
                label: 'Copy',
                icon: '📋',
                shortcut: 'Ctrl+C',
                disabled: !hasSelection,
                onClick: () => {
                    document.execCommand('copy');
                }
            },
            {
                label: 'Paste',
                icon: '📄',
                shortcut: 'Ctrl+V',
                onClick: () => {
                    document.execCommand('paste');
                }
            },
            { separator: true },
            {
                label: 'Select All',
                icon: '🔲',
                shortcut: 'Ctrl+A',
                onClick: () => {
                    if (textarea) {
                        textarea.select();
                    }
                }
            },
            { separator: true },
            {
                label: 'Undo',
                icon: '↶',
                shortcut: 'Ctrl+Z',
                onClick: () => {
                    document.execCommand('undo');
                }
            },
            {
                label: 'Redo',
                icon: '↷',
                shortcut: 'Ctrl+Y',
                onClick: () => {
                    document.execCommand('redo');
                }
            }
        ];

        setContextMenu({ x: e.clientX, y: e.clientY, items });
    }

    if (!activeTab) {
        return (
            <div className="editor-panel">
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
            <textarea
                ref={textareaRef}
                className="editor-textarea"
                value={activeTab.content || ""}
                onChange={(e) => onChangeContent(e.target.value)}
                onContextMenu={handleContextMenu}
                spellCheck={false}
            />
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={contextMenu.items}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>
    );
}
