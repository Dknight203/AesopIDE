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
import InputModal from "./components/InputModal";
import StatusBar from "./components/StatusBar";

import { getRoot, openFolderDialog } from "./lib/project";
import { readFile, writeFile, newFile, newFolder } from "./lib/fileSystem";
import { testSupabase } from "./lib/supabase";
import { scanProject } from "./lib/codebase/indexer";

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

    const [modal, setModal] = useState(null); // { title, message, onConfirm }

    // Codebase index for AI context
    const [codebaseIndex, setCodebaseIndex] = useState([]);
    const [indexing, setIndexing] = useState(false);

    useEffect(() => {
        async function loadRoot() {
            try {
                const root = await getRoot();
                setRootPath(root);

                // Index the codebase for AI context
                if (root) {
                    indexCodebase();
                }
            } catch (err) {
                console.error("getRoot error:", err);
                setStatusMessage("Error reading project root");
            }
        }
        loadRoot();
    }, []);

    // Index codebase for AI
    async function indexCodebase() {
        setIndexing(true);
        setStatusMessage("Indexing codebase...");
        try {
            const index = await scanProject(rootPath);
            setCodebaseIndex(index);
            setStatusMessage(`Indexed ${index.length} files`);
        } catch (err) {
            console.error("Indexing error:", err);
            setStatusMessage("Error indexing codebase");
        } finally {
            setIndexing(false);
        }
    }

    // Keyboard shortcuts
    useEffect(() => {
        function handleKeyDown(e) {
            // Ctrl+B: Toggle sidebar
            if (e.ctrlKey && e.key === "b") {
                e.preventDefault();
                setSidebarCollapsed((prev) => !prev);
            }
            // Ctrl+`: Toggle bottom panel
            if (e.ctrlKey && e.key === "`") {
                e.preventDefault();
                setBottomPanelCollapsed((prev) => !prev);
            }
            // Ctrl+S: Save active file
            if (e.ctrlKey && e.key === "s") {
                e.preventDefault();
                saveActiveFile();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activePath, tabs]);

    function findTab(path) {
        return tabs.find((t) => t.path === path);
    }

    // Open a file from the file tree on the left
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

    // Open or create a tab for a specific path, using AI content if provided
    async function openFileByPath(path, aiContent = null) {
        if (!path || typeof path !== "string") {
            setStatusMessage("AI did not provide a valid target file path");
            return;
        }

        const existingTab = findTab(path);

        try {
            // Always try to read the existing file content from disk first
            let diskContent = "";
            try {
                diskContent = await readFile(path);
            } catch {
                // If file does not exist yet, leave diskContent as empty string
                diskContent = "";
            }

            const newContent = aiContent != null ? aiContent : diskContent;

            if (existingTab) {
                // Update existing tab with AI content or disk content
                const updatedTab = {
                    ...existingTab,
                    content: newContent,
                    isDirty: newContent !== existingTab.originalContent,
                };
                setTabs((prev) =>
                    prev.map((t) => (t.path === path ? updatedTab : t))
                );
            } else {
                // Create new tab
                const name = path.split(/[\\/]/).pop() || path;
                const newTab = {
                    path,
                    name,
                    content: newContent,
                    originalContent: diskContent,
                    isDirty: newContent !== diskContent,
                };
                setTabs((prev) => [...prev, newTab]);
            }

            setActivePath(path);

            if (aiContent != null) {
                setStatusMessage(
                    `AI changes staged in ${path}. Review in the editor and save when ready.`
                );
            } else {
                setStatusMessage(`Opened ${path}`);
            }
        } catch (err) {
            console.error("openFileByPath error:", err);
            setStatusMessage("Error preparing AI changes");
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
                        isDirty: newContent !== t.originalContent,
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

            // Re-index the new project
            await indexCodebase();
        } catch (err) {
            console.error("openFolder error:", err);
            setStatusMessage("Error opening folder");
        }
    }

    function handleNewFile() {
        setModal({
            title: "New File",
            message: "Enter file name (relative to root):",
            onConfirm: async (name) => {
                if (!name) return;
                try {
                    await newFile(name);
                    setStatusMessage(`Created file ${name}`);
                    setModal(null);
                } catch (err) {
                    console.error("newFile error:", err);
                    setStatusMessage("Error creating file");
                }
            },
        });
    }

    function handleNewFolder() {
        setModal({
            title: "New Folder",
            message: "Enter folder name (relative to root):",
            onConfirm: async (name) => {
                if (!name) return;
                try {
                    await newFolder(name);
                    setStatusMessage(`Created folder ${name}`);
                    setModal(null);
                } catch (err) {
                    console.error("newFolder error:", err);
                    setStatusMessage("Error creating folder");
                }
            },
        });
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

    // Parse "AesopIDE target file: some/path.tsx" from AI response
    function extractTargetPath(aiText, fallbackPath) {
        if (!aiText || typeof aiText !== "string") return fallbackPath || null;
        const match = aiText.match(/AesopIDE target file:\s*([^\n\r]+)/i);
        if (match && match[1]) {
            return match[1].trim();
        }
        return fallbackPath || null;
    }

    // Extract the first fenced code block from AI response
    function extractCodeFromAi(aiText) {
        if (!aiText || typeof aiText !== "string") return null;

        const fenced = aiText.match(/```(?:[a-zA-Z0-9]+)?\s*\n([\s\S]*?)```/);
        if (fenced && fenced[1]) {
            return fenced[1].trim();
        }

        return null;
    }

    // Called when you click "Apply to file" on an AI message
    async function handleApplyCode(aiText) {
        if (!aiText || typeof aiText !== "string") {
            setStatusMessage("AI response invalid");
            return;
        }

        // Check for open only command: "AesopIDE open file: path"
        const openMatch = aiText.match(/AesopIDE open file:\s*([^\n\r]+)/i);
        if (openMatch && openMatch[1]) {
            const path = openMatch[1].trim();
            try {
                await openFileByPath(path, null);
                setStatusMessage("Opened " + path + " as requested by AI");
            } catch (err) {
                console.error("open only error:", err);
                setStatusMessage("Failed to open file");
            }
            return;
        }

        // Normal edit flow using "AesopIDE target file" and a code block
        const fallbackPath = activePath || null;
        const targetPath = extractTargetPath(aiText, fallbackPath);

        if (!targetPath) {
            setStatusMessage(
                "AI response did not specify a target file and there is no active file."
            );
            return;
        }

        const newContent = extractCodeFromAi(aiText);
        if (!newContent) {
            setStatusMessage("AI response did not contain a code block to apply.");
            return;
        }

        try {
            await openFileByPath(targetPath, newContent);
        } catch (err) {
            console.error("handleApplyCode error:", err);
            setStatusMessage("Error applying AI changes");
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
                onToggleBottomPanel={() =>
                    setBottomPanelCollapsed(!bottomPanelCollapsed)
                }
                sidebarCollapsed={sidebarCollapsed}
                bottomPanelCollapsed={bottomPanelCollapsed}
            />

            <div className="app-main">
                <div
                    className={`app-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}
                    style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
                >
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

                    <div
                        className={`bottom-panels ${bottomPanelCollapsed ? "collapsed" : ""
                            }`}
                        style={{
                            height: bottomPanelCollapsed ? 0 : bottomPanelHeight,
                        }}
                    >
                        <BottomPanel />
                    </div>
                </div>

                <div className={`app-right-sidebar ${!promptOpen ? "collapsed" : ""}`}>
                    <PromptPanel
                        onClose={() => setPromptOpen(false)}
                        onApplyCode={handleApplyCode}
                        onOpenFile={openFileByPath}
                        activeTab={activeTab}
                        rootPath={rootPath}
                        codebaseIndex={codebaseIndex}
                    />
                </div>
            </div>

            <StatusBar
                rootPath={rootPath}
                activePath={activePath}
                activeTab={activeTab}
                message={statusMessage}
            />

            {modal && (
                <InputModal
                    title={modal.title}
                    message={modal.message}
                    onConfirm={modal.onConfirm}
                    onCancel={() => setModal(null)}
                />
            )}
        </div>
    );
}
