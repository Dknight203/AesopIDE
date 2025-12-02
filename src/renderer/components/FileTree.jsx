// src/renderer/components/FileTree.jsx
import React, { useEffect, useState } from "react";
import "../styles/sidebar.css";
import { readDirectory } from "../lib/fileSystem";

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

function NodeRow({ node, level, onOpenFile, onToggleFolder }) {
    const indent = { paddingLeft: `${8 + level * 16}px` };
    const isDir = node.isDirectory;
    const icon = isDir
        ? (node.expanded ? "📂" : "📁")
        : getFileIcon(node.name, false);

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
        >
            <span className="filetree-icon">{icon}</span>
            <span className="filetree-name">{node.name}</span>
        </div>
    );
}

export default function FileTree({ rootPath, onOpenFile }) {
    const [nodes, setNodes] = useState([]);

    useEffect(() => {
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

        loadRoot();
    }, [rootPath]);

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

    return (
        <>
            <div className="panel-header">
                <span className="panel-title">Explorer</span>
                <div className="panel-actions">
                    {/* Future: Add refresh, collapse all buttons */}
                </div>
            </div>
            <div className="filetree-scroll scrollable">
                {flat.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-state-icon">📁</div>
                        <div className="empty-state-title">No Files</div>
                        <div className="empty-state-description">
                            Open a folder to get started
                        </div>
                    </div>
                )}
                {flat.map((node) => (
                    <NodeRow
                        key={node.path}
                        node={node}
                        level={node.level}
                        onOpenFile={onOpenFile}
                        onToggleFolder={toggleFolder}
                    />
                ))}
            </div>
        </>
    );
}
