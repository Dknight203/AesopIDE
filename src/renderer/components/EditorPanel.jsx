// src/renderer/components/EditorPanel.jsx
// src/renderer/components/EditorPanel.jsx
import React, { useRef, useEffect, useState } from "react";
import "../styles/editor.css";
import ContextMenu from "./ContextMenu";
import SearchBar from './SearchBar';

export default function EditorPanel({ activeTab, onChangeContent, onSave }) {
    const content = activeTab?.content ?? "";
    const path = activeTab?.path ?? "";
    const textareaRef = useRef(null);
    const lineNumbersRef = useRef(null);
    const [editorContextMenu, setEditorContextMenu] = useState(null); // <-- ADDED STATE
    const [showSearch, setShowSearch] = useState(false);
    const [searchMatches, setSearchMatches] = useState([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

    // Sync scroll between textarea and line numbers
    const handleScroll = () => {
        if (textareaRef.current && lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
        }
    };
    // Ctrl+F keyboard shortcut
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                setShowSearch(true);
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // <-- FIXED CONTEXT MENU HANDLER -->
    function handleEditorContextMenu(e) {
        // CRITICAL FIX: Always prevent the default context menu to ensure our custom one is reliable.
        e.preventDefault(); 
        
        const textarea = textareaRef.current;
        // Determine if text is selected to enable Cut/Copy
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
                // Paste is always available (the browser handles clipboard access)
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
            }
        ];

        setEditorContextMenu({ x: e.clientX, y: e.clientY, items });
    }
    // <-- END FIXED CONTEXT MENU HANDLER -->


    // Generate line numbers
    const lineCount = content.split('\n').length;
    const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');

    // Search functions
    const handleFind = (searchTerm, options) => {
        if (!textareaRef.current || !searchTerm) return;
        
        const text = textareaRef.current.value;
        const searchRegex = new RegExp(
            searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            options.caseSensitive ? 'g' : 'gi'
        );
        
        const matches = [];
        let match;
        while ((match = searchRegex.exec(text)) !== null) {
            matches.push({ index: match.index, length: searchTerm.length });
        }
        
        setSearchMatches(matches);
        if (matches.length > 0) {
            const index = options.direction === 'prev' 
                ? (currentMatchIndex <= 0 ? matches.length - 1 : currentMatchIndex - 1)
                : (currentMatchIndex >= matches.length - 1 ? 0 : currentMatchIndex + 1);
            
            setCurrentMatchIndex(index);
            textareaRef.current.setSelectionRange(
                matches[index].index,
                matches[index].index + matches[index].length
            );
            textareaRef.current.focus();
        }
    };
    const handleReplace = (searchTerm, replaceTerm, options) => {
        if (!textareaRef.current || !searchTerm) return;
        
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const text = textareaRef.current.value;
        
        if (text.substring(start, end) === searchTerm || 
            (!options.caseSensitive && text.substring(start, end).toLowerCase() === searchTerm.toLowerCase())) {
            const newText = text.substring(0, start) + replaceTerm + text.substring(end);
            onChangeContent(newText);
            textareaRef.current.setSelectionRange(start, start + replaceTerm.length);
        }
    };
    const handleReplaceAll = (searchTerm, replaceTerm, options) => {
        if (!textareaRef.current || !searchTerm) return;
        
        const text = textareaRef.current.value;
        const searchRegex = new RegExp(
            searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            options.caseSensitive ? 'g' : 'gi'
        );
        
        const newText = text.replace(searchRegex, replaceTerm);
        onChangeContent(newText);
    };

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
                    onContextMenu={handleEditorContextMenu} // <-- USING FIXED HANDLER
                    spellCheck="false"
                />
            </div>
            {/* <-- ADDED CONTEXT MENU RENDERER --> */}
            {editorContextMenu && (
                <ContextMenu
                    x={editorContextMenu.x}
                    y={editorContextMenu.y}
                    items={editorContextMenu.items}
                    onClose={() => setEditorContextMenu(null)}
                />
            )}
            
            {/* ← ADD THIS BLOCK */}
            {showSearch && (
                <SearchBar
                    onClose={() => setShowSearch(false)}
                    onFind={handleFind}
                    onReplace={handleReplace}
                    onReplaceAll={handleReplaceAll}
                />
            )}
        </div>
    );
}