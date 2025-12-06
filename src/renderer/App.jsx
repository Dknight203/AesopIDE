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
// NEW COMPONENT IMPORT
import PlanReview from "./components/PlanReview";
import IngestModal from "./components/IngestModal"; // Phase 6.3
import AgentManager from "./components/AgentManager"; // Phase 6.4

import { getRoot, openFolderDialog } from "./lib/project";
import { readFile, writeFile, newFile, newFolder } from "./lib/fileSystem";
import { testSupabase } from "./lib/supabase";
import { scanProject } from "./lib/codebase/indexer";
import { findFilesByName } from "./lib/codebase/search";
// NEW TASK MANAGER IMPORTS
import { executeChain, createPlanFile } from "./lib/tasks/manager";

export default function App() {
    const [rootPath, setRootPath] = useState("");
    const [tabs, setTabs] = useState([]);
    const [activePath, setActivePath] = useState("");
    const [promptOpen, setPromptOpen] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");

    // NEW STATE: For pre-filling the prompt input
    const [initialPrompt, setInitialPrompt] = useState("");

    // Phase 3.2 State: Stores content of the plan waiting for review
    const [planModalContent, setPlanModalContent] = useState(null);
    const [ingestModalOpen, setIngestModalOpen] = useState(false); // Phase 6.3

    // Phase 6.4 State: Agent Manager panel visibility and execution state
    const [showAgentManager, setShowAgentManager] = useState(false);
    const [agentSteps, setAgentSteps] = useState([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(-1);
    const [agentPaused, setAgentPaused] = useState(false);

    // Layout state
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(false);

    // Widths and Heights - Initialize from localStorage
    const [sidebarWidth, setSidebarWidth] = useState(
        parseInt(localStorage.getItem('aesop_sidebarWidth')) || 250
    );
    const [rightSidebarWidth, setRightSidebarWidth] = useState(
        parseInt(localStorage.getItem('aesop_rightSidebarWidth')) || 400
    );
    const [bottomPanelHeight, setBottomPanelHeight] = useState(
        parseInt(localStorage.getItem('aesop_bottomPanelHeight')) || 300
    );

    // Persist layout changes
    useEffect(() => {
        localStorage.setItem('aesop_sidebarWidth', sidebarWidth);
        localStorage.setItem('aesop_rightSidebarWidth', rightSidebarWidth);
        localStorage.setItem('aesop_bottomPanelHeight', bottomPanelHeight);
    }, [sidebarWidth, rightSidebarWidth, bottomPanelHeight]);

    // Resizing Flags
    // We can use a single state string: null, 'left', 'right', 'bottom'
    const [resizingPanel, setResizingPanel] = useState(null);

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
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [activePath, tabs, resizingPanel]); // Updated dependency

    // Resize Handlers
    function handleMouseDownLeft(e) { e.preventDefault(); setResizingPanel('left'); }
    function handleMouseDownRight(e) { e.preventDefault(); setResizingPanel('right'); }
    function handleMouseDownBottom(e) { e.preventDefault(); setResizingPanel('bottom'); }

    function handleMouseMove(e) {
        if (!resizingPanel) return;

        if (resizingPanel === 'bottom') {
            const newHeight = window.innerHeight - e.clientY;
            if (newHeight > 50 && newHeight < window.innerHeight * 0.8) {
                setBottomPanelHeight(newHeight);
            }
        } else if (resizingPanel === 'left') {
            const newWidth = e.clientX;
            if (newWidth > 150 && newWidth < 600) {
                setSidebarWidth(newWidth);
            }
        } else if (resizingPanel === 'right') {
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth > 300 && newWidth < 800) {
                setRightSidebarWidth(newWidth);
            }
        }
    }

    function handleMouseUp() {
        setResizingPanel(null);
    }

    function findTab(path) {
        return tabs.find((t) => t.path === path);
    }

    // ... (rest of methods unchanged)

    // ...
    // ...

    // Jump down to render return for sidebar updates

    // ...

    // (Inside render / return)
    // Left Sidebar Update:
    /*
        <div
            className={`app-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}
            style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
        >
            <FileTree rootPath={rootPath} onOpenFile={openFileNode} />
            
            {!sidebarCollapsed && (
               <div 
                   className="resize-handle-horizontal" 
                   style={{ right: 0, cursor: 'col-resize' }}
                   onMouseDown={handleMouseDownLeft}
               />
            )}
        </div>
    */

    // ...

    // Right Sidebar Update:
    /*
        <div 
            className={`app-right-sidebar ${!promptOpen ? "collapsed" : ""}`}
            style={{ width: !promptOpen ? 0 : rightSidebarWidth }} // Use state width
        >
            {promptOpen && (
                 <div 
                   className="resize-handle-horizontal" 
                   style={{ left: 0, right: 'auto', cursor: 'col-resize' }}
                   onMouseDown={handleMouseDownRight}
               />
            )}
            
            <PromptPanel ... />
        </div>
    */

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

    // -----------------------------------------------------------
    // PHASE 3.2 IMPLEMENTATION
    // -----------------------------------------------------------

    /**
     * Attempts to parse tool calls from the plan content and execute them sequentially.
     * @param {string} rawPlanContent - The content of the plan file.
     */
    async function handleExecutePlan(rawPlanContent) {
        setStatusMessage("Starting multi-step execution...");
        setPlanModalContent(null); // Close modal

        try {
            let actionChain;

            // Try parsing as raw JSON first (in case content is already extracted)
            try {
                actionChain = JSON.parse(rawPlanContent);
                console.log("[handleExecutePlan] Parsed as raw JSON");
            } catch (rawParseError) {
                // If raw parsing fails, try extracting from markdown code fence
                console.log("[handleExecutePlan] Raw JSON parse failed, trying markdown extraction");
                const jsonMatch = rawPlanContent.match(/```\s*([\s\S]*?)```/);

                if (!jsonMatch || !jsonMatch[1]) {
                    throw new Error("Plan content must contain valid JSON or a fenced code block with the execution chain.");
                }

                try {
                    actionChain = JSON.parse(jsonMatch[1]);
                    console.log("[handleExecutePlan] Parsed from markdown fence");
                } catch (fenceParseError) {
                    throw new Error(`Failed to parse execution chain. Raw error: ${rawParseError.message}. Fenced error: ${fenceParseError.message}`);
                }
            }

            if (!Array.isArray(actionChain)) {
                throw new Error("Execution chain must be a JSON array of actions.");
            }

            const results = await executeChain(actionChain);

            setStatusMessage(`Execution complete. ${results.length} steps executed successfully.`);

        } catch (err) {
            const errorMsg = err.error || err.message || "Unknown error during execution.";
            setStatusMessage(`Execution failed: ${errorMsg}`);
            console.error("Execution chain failed:", err);
        }
    }

    /**
     * Triggers the UI flow for starting a new plan generation.
     */
    function handleNewPlan() {
        setPromptOpen(true);
        // Hint the user/AI to start a planning task if the prompt is empty
        setStatusMessage("Planning Mode: Ask the AI to create an 'implementation_plan.md'.");

        // ADDED: Set a starting prompt for a better user experience
        setInitialPrompt("I need a plan to implement a new feature. Please create an 'implementation_plan.md' that details the steps.");
    }

    // -----------------------------------------------------------
    // END PHASE 3.2 IMPLEMENTATION
    // -----------------------------------------------------------


    // Parse "AesopIDE target file: some/path.tsx" from AI response
    function extractTargetPath(aiText, fallbackPath) {
        if (!aiText || typeof aiText !== "string") return fallbackPath || null;
        const match = aiText.match(/AesopIDE target file:\s*([^\n\r]+)/i);
        if (match && match[1]) {
            return match[1].trim();
        }
        return fallbackPath || null;
    }

    // FIX: Corrected function to preserve formatting/newlines/spaces within the code block.
    function extractCodeFromAi(aiText) {
        if (!aiText || typeof aiText !== "string") return null;

        const fenced = aiText.match(/```(?:[a-zA-Z0-9]+)?\s*([\s\S]*?)```/);

        if (fenced && fenced[1]) {
            let content = fenced[1];

            content = content.replace(/^\n|\n$/g, '');
            content = content.replace(/\u00a0/g, ' ');

            return content;
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

        // Determine target file and content
        const fallbackPath = activePath || null;
        const targetPath = extractTargetPath(aiText, fallbackPath);
        const newContent = extractCodeFromAi(aiText);

        if (!targetPath) {
            setStatusMessage(
                "AI response did not specify a target file and there is no active file."
            );
            return;
        }

        if (!newContent) {
            setStatusMessage("AI response did not contain a code block to apply.");
            return;
        }

        // -----------------------------------------------------------
        // PHASE 3.2 TRIGGER: Intercept 'implementation_plan.md'
        // -----------------------------------------------------------
        if (targetPath.endsWith('implementation_plan.md')) {
            try {
                // 1. Create the file on disk (Artifact Creation)
                // This is the CRITICAL line that must run successfully.
                await createPlanFile(rootPath, newContent);

                // 2. Load the content into the Plan Review modal (Request user approval)
                // This state change triggers the <PlanReview /> component to render.
                setPlanModalContent(newContent);
                setStatusMessage("Plan received. Awaiting user review and approval.");

            } catch (err) {
                // CRITICAL FIX: This logging will tell us exactly why file creation failed.
                console.error("Error creating implementation plan file:", err);
                setStatusMessage(`ERROR: Failed to save plan file to disk. Check console for details. (${err.message})`);
            }

            return; // EXIT: Do not proceed to open or apply as a normal file
        }
        // -----------------------------------------------------------


        try {
            await openFileByPath(targetPath, newContent);
        } catch (err) {
            console.error("handleApplyCode error:", err);
            setStatusMessage("Error applying AI changes");
        }
    }

    // -----------------------------------------------------------
    // AUTOMATIC OPEN-ON-COMMAND IMPLEMENTATION
    // -----------------------------------------------------------

    const selectBestCandidate = (files) => {
        if (!files || files.length === 0) return null;

        const nonBackupPaths = files.filter(
            (file) =>
                !file.path.toLowerCase().includes('backup') &&
                !file.path.toLowerCase().includes('.bak') &&
                !file.path.startsWith('~') &&
                !file.path.endsWith('.bak')
        );

        let candidates = nonBackupPaths.length > 0 ? nonBackupPaths : files;

        candidates.sort((a, b) => {
            const depthA = (a.path.match(/[\\/]/g) || []).length;
            const depthB = (b.path.match(/[\\/]/g) || []).length;

            return depthA - depthB;
        });

        return candidates[0].path;
    };


    const autoOpenFileAndMessage = async (token, appendMessage) => {
        if (!codebaseIndex || codebaseIndex.length === 0) {
            appendMessage("assistant", "Project index unavailable. Cannot automatically find and open files. Try opening a folder first.");
            return;
        }

        try {
            const pattern = `*${token}*`;
            const foundFiles = findFilesByName(pattern, codebaseIndex);

            if (foundFiles.length === 0) {
                appendMessage("assistant", `File not found: Could not locate a file matching **${token}**.`);
                return;
            }

            const chosenPath = selectBestCandidate(foundFiles);

            if (!chosenPath) {
                appendMessage("assistant", `Could not determine the best file to open for **${token}**.`);
                return;
            }

            await openFileByPath(chosenPath, null);

            appendMessage("assistant", `Opened file: **${chosenPath}**`);

        } catch (err) {
            console.error("[Automatic Open Error]", err);
            appendMessage("assistant", `Error during automatic open: ${err.message}`);
        }
    };


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
                // NEW PROP: Pass handler to TopBar
                onNewPlan={handleNewPlan}
                // NEW PROP: Pass handler to TopBar (from IngestModal context)
                onIngest={() => setIngestModalOpen(true)}
                // Phase 6.4: Toggle Agent Manager
                onToggleAgentManager={() => setShowAgentManager(!showAgentManager)}
                showAgentManager={showAgentManager}
                sidebarCollapsed={sidebarCollapsed}
                bottomPanelCollapsed={bottomPanelCollapsed}
            />

            <div className="app-main">
                {/* Left Sidebar */}
                <div
                    className={`app-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}
                    style={{ width: sidebarCollapsed ? 0 : sidebarWidth, position: 'relative' }} // Add relative pos
                >
                    <FileTree rootPath={rootPath} onOpenFile={openFileNode} />
                    {!sidebarCollapsed && (
                        <div
                            className="resize-handle resize-handle-horizontal"
                            style={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: '5px',
                                cursor: 'col-resize',
                                zIndex: 10
                            }}
                            onMouseDown={handleMouseDownLeft}
                            title="Drag to resize sidebar"
                        />
                    )}
                </div>

                {/* Main Editor Area */}
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
                        {/* Drag Handle */}
                        <div
                            className="resize-handle-top"
                            onMouseDown={handleMouseDownBottom} // Updated handler
                            title="Drag to resize"
                        />
                        <BottomPanel />
                    </div>
                </div>

                {/* Right Sidebar (AI) */}
                <div
                    className={`app-right-sidebar ${!promptOpen ? "collapsed" : ""}`}
                    style={{ width: !promptOpen ? 0 : rightSidebarWidth, position: 'relative' }}
                >
                    {promptOpen && (
                        <div
                            className="resize-handle resize-handle-horizontal"
                            style={{
                                position: 'absolute',
                                left: 0,
                                right: 'auto',
                                top: 0,
                                bottom: 0,
                                width: '5px',
                                cursor: 'col-resize',
                                zIndex: 10
                            }}
                            onMouseDown={handleMouseDownRight}
                            title="Drag to resize AI panel"
                        />
                    )}
                    <PromptPanel
                        onClose={() => {
                            setPromptOpen(false);
                            setInitialPrompt(""); // Clear any lingering initial prompt on close
                        }}
                        onApplyCode={handleApplyCode}
                        onOpenCommand={autoOpenFileAndMessage}
                        // NEW PROP: Pass the initial prompt state
                        initialPrompt={initialPrompt}
                        // NEW PROP: Pass the setter for clearing the initial prompt state
                        onClearInitialPrompt={() => setInitialPrompt("")}
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

            {
                modal && (
                    <InputModal
                        title={modal.title}
                        message={modal.message}
                        onConfirm={modal.onConfirm}
                        onCancel={() => setModal(null)}
                    />
                )
            }

            {/* PHASE 3.2: Render the Plan Review Modal */}
            {
                planModalContent && (
                    <PlanReview
                        rootPath={rootPath}
                        onClose={() => setPlanModalContent(null)}
                        onCancel={() => setPlanModalContent(null)}
                        onExecute={handleExecutePlan} // 🌟 CRITICAL FIX: Prop name corrected to 'onExecute'
                        initialPlanContent={planModalContent}
                    />
                )
            }

            {
                ingestModalOpen && (
                    <IngestModal
                        onClose={() => setIngestModalOpen(false)}
                        onIngest={(result) => setStatusMessage(result.message || 'Document ingested')}
                    />
                )
            }

            {/* Phase 6.4: Agent Manager Panel */}
            {
                showAgentManager && (
                    <AgentManager
                        onClose={() => setShowAgentManager(false)}
                        steps={agentSteps}
                        currentStepIndex={currentStepIndex}
                        isPaused={agentPaused}
                        onPause={() => setAgentPaused(true)}
                        onResume={() => setAgentPaused(false)}
                        onCancel={() => {
                            setAgentSteps([]);
                            setCurrentStepIndex(-1);
                            setAgentPaused(false);
                            setStatusMessage("Agent execution cancelled");
                        }}
                    />
                )
            }
        </div >
    );
}