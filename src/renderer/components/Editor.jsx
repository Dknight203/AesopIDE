// src/renderer/components/Editor.jsx
import React, { useRef } from "react";
import MonacoEditor from "@monaco-editor/react";
import "../styles/editor.css";

export default function Editor({ activeTab, onChangeContent, onSave }) {
    const editorRef = useRef(null);

    function handleEditorDidMount(editor, monaco) {
        editorRef.current = editor;

        // Preserve Ctrl+S save functionality
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            if (onSave) {
                onSave();
            }
        });

        // Add AI context query action (Ctrl+Shift+A)
        editor.addAction({
            id: 'aesop-ai-assist',
            label: 'Ask AI About Selection',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyA],
            contextMenuGroupId: 'aesop',
            contextMenuOrder: 1.5,
            run: (ed) => {
                const selection = ed.getModel().getValueInRange(ed.getSelection());
                if (selection && window.aesop && window.aesop.events) {
                    window.aesop.events.emit('ai:contextQuery', { code: selection });
                    console.log('[Editor] AI context query triggered with selection:', selection.substring(0, 50) + '...');
                }
            }
        });

        console.log('[Editor] Monaco Editor mounted successfully');
    }

    /**
     * Detect language from file extension
     * @param {string} path - File path
     * @returns {string} Monaco language identifier
     */
    function getLanguage(path) {
        if (!path) return 'plaintext';

        const ext = path.split('.').pop().toLowerCase();

        const languageMap = {
            // JavaScript/TypeScript
            js: 'javascript',
            jsx: 'javascript',
            ts: 'typescript',
            tsx: 'typescript',
            mjs: 'javascript',
            cjs: 'javascript',

            // Web
            html: 'html',
            htm: 'html',
            css: 'css',
            scss: 'scss',
            sass: 'sass',
            less: 'less',

            // Data/Config
            json: 'json',
            xml: 'xml',
            yaml: 'yaml',
            yml: 'yaml',
            toml: 'toml',

            // Markdown/Text
            md: 'markdown',
            markdown: 'markdown',
            txt: 'plaintext',

            // Programming Languages
            py: 'python',
            java: 'java',
            c: 'c',
            cpp: 'cpp',
            cs: 'csharp',
            go: 'go',
            rs: 'rust',
            rb: 'ruby',
            php: 'php',

            // Shell/Scripts
            sh: 'shell',
            bash: 'shell',
            zsh: 'shell',
            ps1: 'powershell',
            bat: 'bat',
            cmd: 'bat',

            // Database
            sql: 'sql',

            // Other
            dockerfile: 'dockerfile',
            docker: 'dockerfile',
            gitignore: 'plaintext',
            env: 'plaintext'
        };

        return languageMap[ext] || 'plaintext';
    }

    // Empty state when no file is open
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
            <MonacoEditor
                height="100%"
                language={getLanguage(activeTab.path)}
                value={activeTab.content || ""}
                onChange={onChangeContent}
                theme="vs-dark"
                options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    fontFamily: "'Consolas', 'Courier New', monospace",
                    automaticLayout: true,  // Auto-adjust on panel resize
                    tabSize: 2,
                    insertSpaces: true,
                    wordWrap: 'off',
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: true,
                    renderLineHighlight: 'all',
                    lineNumbers: 'on',
                    glyphMargin: true,
                    folding: true,
                    foldingStrategy: 'indentation',
                    showFoldingControls: 'mouseover',
                    matchBrackets: 'always',
                    autoClosingBrackets: 'always',
                    autoClosingQuotes: 'always',
                    formatOnPaste: true,
                    formatOnType: true,
                    suggestOnTriggerCharacters: true,
                    acceptSuggestionOnEnter: 'on',
                    quickSuggestions: true,
                    parameterHints: { enabled: true },
                    snippetSuggestions: 'inline',
                    contextmenu: true,  // Enable Monaco's built-in context menu
                }}
                onMount={handleEditorDidMount}
                loading={
                    <div className="editor-loading">
                        <div className="loading-spinner"></div>
                        <div>Loading Monaco Editor...</div>
                    </div>
                }
            />
        </div>
    );
}
