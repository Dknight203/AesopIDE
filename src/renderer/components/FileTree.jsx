// src/renderer/components/FileTree.jsx
import React, { useEffect, useState, useRef } from "react";
import "../styles/sidebar.css";
import { readDirectory, deleteFile } from "../lib/fileSystem";
import ContextMenu from "./ContextMenu";
import ConfirmModal from "./ConfirmModal";

function joinPath(base, name) {
    if (!base || base === ".") return name;
    return `${base}/${name}`;
}

// Get icon based on file extension
function getFileIcon(name, isDirectory) {
    if (isDirectory) return "📁";

    const ext = name.split('.').pop()?.toLowerCase();
    const iconMap = {
        'js': '📜',
        'jsx': '⚛️',
        'ts': '📘',
        'tsx': '⚛️',
        'json': '📋',
        'css': '🎨',
        'html': '🌐',
        'md': '📝',
        'txt': '📄',
        'png': '🖼️',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'gif': '🖼️',
        'svg': '🎭',
        'pdf': '📕',
        'zip': '📦',
        'git': '🔧',
    };

    return iconMap[ext] || '📄';
}

function NodeRow({ node, level, onOpenFile, onToggleFolder, onContextMenu }) {
    const indent = { paddingLeft: `${8 + level * 16}px` };
    const isDir = node.isDirectory;
    const icon = isDir
        ? (node.expanded ? "📂" : "📁")
        : getFileIcon(node.name, false);

    // Phase 2: Add chevron for folders
    const chevron = isDir ? (node.expanded ? "▼" : "▶") : null;

    return (
        <div
            className={`filetree-row ${isDir ? 'filetree-row-dir' : ''}`}
            style={indent}
            onClick={() => {
                if (isDir) {
                    onToggleFolder(node);
                } else {
                    onOpenFile(node);
                }
            }}
            onContextMenu={(e) => onContextMenu(e, node)}
        >
            {chevron && <span className="filetree-chevron">{chevron}</span>}
            <span className="filetree-icon">{icon}</span>
            <span className="filetree-name">{node.name}</span>
        </div>
    );
}

export default function FileTree({ rootPath, onOpenFile }) {
    const [nodes, setNodes] = useState([]);
    // Phase 2: Add search state
    const [searchQuery, setSearchQuery] = useState("");
    const [contextMenu, setContextMenu] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const nodesRef = useRef(nodes);
    useEffect(() => { nodesRef.current = nodes; }, [nodes]);

    async function loadRoot() {
        try {
            const entries = await readDirectory(".");
            const mapped = entries.map((e) => ({
                name: e.name,
                path: e.name,
                isDirectory: e.isDirectory,
                expanded: false,
                children: [],
                level: 0,
            }));
            setNodes(mapped);
        } catch (err) {
            console.error("FileTree load error:", err);
        }
    }

    useEffect(() => {
        loadRoot();
    }, [rootPath]);

    async function refresh() {
        // 1. Get list of currently expanded paths
        const expandedPaths = new Set();
        function collectExpanded(list) {
            for (const node of list) {
                if (node.expanded) {
                    expandedPaths.add(node.path);
                    if (node.children) collectExpanded(node.children);
                }
            }
        }
        collectExpanded(nodesRef.current);

        // 2. Re-build the tree
        async function buildTree(dirPath, level) {
            try {
                const entries = await readDirectory(dirPath);
                const newNodes = [];
                for (const e of entries) {
                    const fullPath = dirPath === '.' ? e.name : `${dirPath}/${e.name}`;
                    const node = {
                        name: e.name,
                        path: fullPath,
                        isDirectory: e.isDirectory,
                        expanded: expandedPaths.has(fullPath),
                        children: [],
                        level: level
                    };

                    if (node.expanded) {
                        node.children = await buildTree(fullPath, level + 1);
                    }
                    newNodes.push(node);
                }
                return newNodes;
            } catch (err) {
                console.error(`Error reading ${dirPath}:`, err);
                return [];
            }
        }

        const newRoot = await buildTree(".", 0);
        setNodes(newRoot);
    }

    // Auto-refresh every 5 seconds
    useEffect(() => {
        const interval = setInterval(refresh, 5000);
        return () => clearInterval(interval);
    }, []);

    async function toggleFolder(target) {
        if (!target.isDirectory) return;

        // If collapsing, just toggle expanded state
        if (target.expanded) {
            setNodes((prev) => {
                function toggle(list) {
                    return list.map((node) => {
                        if (node.path === target.path) {
                            return { ...node, expanded: false };
                        }
                        if (node.children) {
                            return { ...node, children: toggle(node.children) };
                        }
                        return node;
                    });
                }
                return toggle(prev);
            });
            return;
        }

        // If expanding, load children
        try {
            const entries = await readDirectory(target.path);
            const children = entries.map((e) => ({
                name: e.name,
                path: joinPath(target.path, e.name),
                isDirectory: e.isDirectory,
                expanded: false,
                children: [],
                level: target.level + 1,
            }));

            setNodes((prev) => {
                function update(list) {
                    return list.map((node) => {
                        if (node.path === target.path) {
                            return { ...node, expanded: true, children };
                        }
                        if (node.children) {
                            return { ...node, children: update(node.children) };
                        }
                        return node;
                    });
                }
                return update(prev);
            });
        } catch (err) {
            console.error("Folder expand error:", err);
        }
    }

    function flatten(list) {
        const out = [];
        function walk(arr) {
            for (const node of arr) {
                out.push(node);
                if (node.isDirectory && node.expanded && node.children.length) {
                    walk(node.children);
                }
            }
        }
        walk(list);
        return out;
    }

    const flat = flatten(nodes);
    // Phase 2: Deep search that actually reads directories
    async function deepSearch(query) {
        const results = [];

        async function searchDir(dirPath, level = 0) {
            try {
                const entries = await readDirectory(dirPath);
                for (const entry of entries) {
                    const fullPath = dirPath === '.' ? entry.name : `${dirPath}/${entry.name}`;

                    if (entry.name.toLowerCase().includes(query.toLowerCase())) {
                        results.push({
                            name: entry.name,
                            path: fullPath,
                            isDirectory: entry.isDirectory,
                            expanded: false,
                            children: [],
                            level: level
                        });
                    }

                    // Recursively search subdirectories
                    if (entry.isDirectory) {
                        await searchDir(fullPath, level + 1);
                    }
                }
            } catch (err) {
                console.error(`Error searching ${dirPath}:`, err);
            }
        }

        await searchDir('.');
        return results;
    }

    function handleContextMenu(e, node) {
        e.preventDefault();
        e.stopPropagation();

        const items = [
            {
                label: 'Open',
                icon: '📂',
                onClick: () => {
                    if (node.isDirectory) {
                        toggleFolder(node);
                    } else {
                        onOpenFile(node);
                    }
                }
            },
            { separator: true },
            {
                label: 'Copy Path',
                icon: '📋',
                onClick: () => {
                    navigator.clipboard.writeText(node.path);
                }
            },
            {
                label: 'Reveal in File Explorer',
                icon: '📂',
                onClick: () => {
                    if (window.aesop?.fs?.revealInExplorer) {
                        window.aesop.fs.revealInExplorer(node.path);
                    }
                }
            },
            {
                label: 'Open in Terminal',
                icon: '💻', // Using a generic laptop/terminal icon
                onClick: () => {
                    if (window.aesop?.fs?.openTerminal) {
                        window.aesop.fs.openTerminal(node.path);
                    }
                }
            },
            { separator: true },
            {
                label: 'Delete',
                icon: '🗑️',
                danger: true,
                onClick: () => {
                    setDeleteConfirm({
                        title: `Delete ${node.isDirectory ? 'Folder' : 'File'}`,
                        message: `Are you sure you want to delete "${node.name}"?${node.isDirectory ? ' This will delete all contents.' : ''}`,
                        onConfirm: async () => {
                            try {
                                await deleteFile(node.path);
                                // Reload the tree
                                const entries = await readDirectory(".");
                                const mapped = entries.map((e) => ({
                                    name: e.name,
                                    path: e.name,
                                    isDirectory: e.isDirectory,
                                    expanded: false,
                                    children: [],
                                    level: 0,
                                }));
                                setNodes(mapped);
                                setDeleteConfirm(null);
                            } catch (err) {
                                console.error("Delete error:", err);
                                alert(`Failed to delete: ${err.message}`);
                            }
                        }
                    });
                }
            }
        ];

        setContextMenu({ x: e.clientX, y: e.clientY, items });
    }

    // Phase 2: Filter nodes based on search
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Phase 2: Trigger search when query changes
    useEffect(() => {
        async function performSearch() {
            if (!searchQuery) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                const results = await deepSearch(searchQuery);
                setSearchResults(results);
            } catch (err) {
                console.error('Search error:', err);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }

        const timer = setTimeout(performSearch, 300); // Debounce
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const filteredFlat = searchQuery ? searchResults : flat;

    return (
        <>
            <div className="panel-header">
                <span className="panel-title">Explorer</span>
                <div className="panel-actions">
                </div>
            </div>
            <div className="explorer-search-container">
                <div className="explorer-search-wrapper">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="explorer-search-input"
                        placeholder="Search files..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            className="search-clear-btn"
                            onClick={() => setSearchQuery("")}
                        >
                            ✕
                        </button>
                    )}
                </div>
                <button
                    className="refresh-btn"
                    onClick={refresh}
                    title="Refresh"
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '4px',
                        marginLeft: '4px',
                        fontSize: '14px'
                    }}
                >
                    🔄
                </button>
            </div>
            <div className="filetree-scroll scrollable">
                {filteredFlat.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-state-icon">📁</div>
                        <div className="empty-state-title">
                            {searchQuery ? "No matches" : "No Files"}
                        </div>
                        <div className="empty-state-description">
                            {searchQuery ? `No files match "${searchQuery}"` : "Open a folder to get started"}
                        </div>
                    </div>
                )}
                {filteredFlat.map((node) => (
                    <NodeRow
                        key={node.path}
                        node={node}
                        level={node.level}
                        onOpenFile={onOpenFile}
                        onToggleFolder={toggleFolder}
                        onContextMenu={handleContextMenu}
                    />
                ))}
            </div>
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={contextMenu.items}
                    onClose={() => setContextMenu(null)}
                />
            )}
            {deleteConfirm && (
                <ConfirmModal
                    title={deleteConfirm.title}
                    message={deleteConfirm.message}
                    onConfirm={deleteConfirm.onConfirm}
                    onCancel={() => setDeleteConfirm(null)}
                />
            )}
        </>
    );
}
