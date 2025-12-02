// src/renderer/App.jsx
import React, { useEffect, useState } from "react";
import "./styles/app.css";
import "./styles/layout.css";

import TopBar from "./components/TopBar";
import FileTree from "./components/FileTree";
import EditorTabs from "./components/EditorTabs";
import EditorPanel from "./components/EditorPanel";
import BottomPanel from "./components/BottomPanel";
import PromptPanel from "./components/PromptPanel";
import StatusBar from "./components/StatusBar";

import { getRoot, openFolderDialog } from "./lib/project";
import { readFile, writeFile, newFile, newFolder } from "./lib/fileSystem";
import { testSupabase } from "./lib/supabase";

export default function App() {
    const [rootPath, setRootPath] = useState("");
    const [tabs, setTabs] = useState([]);
    const [activePath, setActivePath] = useState("");
    const [promptOpen, setPromptOpen] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");

    // Layout state
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(250);
    const [bottomPanelHeight, setBottomPanelHeight] = useState(200);

    useEffect(() => {
        async function loadRoot() {
            try {
                const root = await getRoot();
                setRootPath(root);
            } catch (err) {
                console.error("getRoot error:", err);
                setStatusMessage("Error reading project root");
            }
        }
        loadRoot();
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        function handleKeyDown(e) {
            // Ctrl+B: Toggle sidebar
            if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                setSidebarCollapsed(prev => !prev);
            }
            // Ctrl+`: Toggle bottom panel
            if (e.ctrlKey && e.key === '`') {
                e.preventDefault();
                setBottomPanelCollapsed(prev => !prev);
            }
            // Ctrl+S: Save active file
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                saveActiveFile();
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activePath, tabs]);

    function findTab(path) {
        return tabs.find((t) => t.path === path);
    }

    async function openFileNode(node) {
        if (!node || !node.path || node.isDirectory) return;

        const path = node.path;

        const existing = findTab(path);
        if (existing) {
            setActivePath(path);
            return;
        }

        try {
            const content = await readFile(path);
            const newTab = {
                path,
                name: node.name || path,
                content,
                originalContent: content, // Track original for dirty state
                isDirty: false,
            };
            setTabs((prev) => [...prev, newTab]);
            setActivePath(path);
            setStatusMessage(`Opened ${path}`);
        } catch (err) {
            console.error("openFile error:", err);
            setStatusMessage("Error opening file");
        }
    }

    function updateActiveContent(newContent) {
        if (!activePath) return;
        setTabs((prev) =>
            prev.map((t) =>
                t.path === activePath
                    ? {
                        ...t,
                        content: newContent,
                        isDirty: newContent !== t.originalContent
                    }
                    : t
            )
        );
    }

    async function saveActiveFile() {
        const tab = findTab(activePath);
        if (!tab) return;
        try {
            await writeFile(tab.path, tab.content);
            // Update tab to mark as saved
            setTabs((prev) =>
                prev.map((t) =>
                    t.path === activePath
                        ? { ...t, originalContent: t.content, isDirty: false }
                        : t
                )
            );
            setStatusMessage(`Saved ${tab.path}`);
        } catch (err) {
            console.error("save error:", err);
            setStatusMessage("Error saving file");
        }
    }

    function closeTab(path) {
        setTabs((prev) => prev.filter((t) => t.path !== path));
        if (activePath === path) {
            const remaining = tabs.filter((t) => t.path !== path);
            setActivePath(remaining.length ? remaining[0].path : "");
        }
    }

    async function handleOpenFolder() {
        try {
            const res = await openFolderDialog();
            if (res.canceled) return;
            setRootPath(res.root);
            setTabs([]);
            setActivePath("");
            setStatusMessage(`Opened project ${res.root}`);
        } catch (err) {
            console.error("openFolder error:", err);
            setStatusMessage("Error opening folder");
        }
    }

    async function handleNewFile() {
        const name = window.prompt("New file name (relative to root):");
        if (!name) return;
        try {
            await newFile(name);
            setStatusMessage(`Created file ${name}`);
        } catch (err) {
            console.error("newFile error:", err);
            setStatusMessage("Error creating file");
        }
    }

    async function handleNewFolder() {
        const name = window.prompt("New folder name (relative to root):");
        if (!name) return;
        try {
            await newFolder(name);
            setStatusMessage(`Created folder ${name}`);
        } catch (err) {
            console.error("newFolder error:", err);
            setStatusMessage("Error creating folder");
        }
    }

    async function handleTestSupabase() {
        try {
            const res = await testSupabase();
            if (!res.ok) {
                setStatusMessage("Supabase error: " + res.error);
            } else {
                setStatusMessage("Supabase wired. " + (res.warning || "OK."));
            }
        } catch (err) {
            console.error("supabase test error:", err);
            setStatusMessage("Supabase test failed");
        }
    }

    const activeTab = findTab(activePath);

    return (
        <div className="app-root">
            <TopBar
                onOpenFolder={handleOpenFolder}
                onNewFile={handleNewFile}
                onNewFolder={handleNewFolder}
                onOpenPrompt={() => setPromptOpen(true)}
                onTestSupabase={handleTestSupabase}
                onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
                onToggleBottomPanel={() => setBottomPanelCollapsed(!bottomPanelCollapsed)}
                sidebarCollapsed={sidebarCollapsed}
                bottomPanelCollapsed={bottomPanelCollapsed}
            />

            <div className="app-main">
                <div className={`app-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                    <FileTree rootPath={rootPath} onOpenFile={openFileNode} />
                </div>

                <div className="editor-area">
                    <EditorTabs
                        tabs={tabs}
                        activePath={activePath}
                        onSelect={setActivePath}
                        onClose={closeTab}
                    />

                    <EditorPanel
                        activeTab={activeTab}
                        onChangeContent={updateActiveContent}
                        onSave={saveActiveFile}
                    />

                    <div className={`bottom-panels ${bottomPanelCollapsed ? 'collapsed' : ''}`}>
                        <BottomPanel />
                    </div>
                </div>

                <div className={`app-right-sidebar ${!promptOpen ? 'collapsed' : ''}`}>
                    <PromptPanel onClose={() => setPromptOpen(false)} />
                </div>
            </div>

            <StatusBar
                rootPath={rootPath}
                activePath={activePath}
                activeTab={activeTab}
                message={statusMessage}
            />
        </div>
    );
}
