// src/renderer/components/TopBar.jsx
import React from "react";
import "../styles/topbar.css";

export default function TopBar({
    onOpenFolder,
    onNewFile,
    onNewFolder,
    onOpenPrompt,
    onTestSupabase,
    onToggleSidebar,
    onToggleBottomPanel,
    onNewPlan, // NEW PROP
    onIngest, // Phase 6.3
    onToggleAgentManager, // Phase 6.4
    showAgentManager, // Phase 6.4
    sidebarCollapsed,
    bottomPanelCollapsed,
}) {
    return (
        <div className="topbar">
            <div className="topbar-left">
                <button
                    className="topbar-icon-btn"
                    onClick={onToggleSidebar}
                    title={sidebarCollapsed ? "Show Sidebar (Ctrl+B)" : "Hide Sidebar (Ctrl+B)"}
                >
                    {sidebarCollapsed ? "☰" : "◧"}
                </button>
                <span className="topbar-title">AesopIDE</span>
            </div>

            <div className="topbar-center">
                <div className="topbar-actions">
                    <button onClick={onOpenFolder} title="Open Folder">
                        📁 Open
                    </button>
                    <button onClick={onNewFile} title="New File">
                        📄 New File
                    </button>
                    <button onClick={onNewFolder} title="New Folder">
                        📂 New Folder
                    </button>
                    <button
                        className="topbar-btn-accent"
                        onClick={onNewPlan} // NEW BUTTON ACTION
                        title="Start a new AI Planning Session"
                    >
                        📝 Plan
                    </button>
                    <button
                        className="topbar-btn-accent"
                        onClick={onIngest}
                        title="Ingest documentation from URL or file"
                    >
                        📚 Ingest
                    </button>
                </div>
            </div>

            <div className="topbar-right">
                <button
                    className="topbar-btn-accent"
                    onClick={onOpenPrompt}
                    title="Open AI Prompt"
                >
                    ✨ AI Prompt
                </button>
                <button
                    className={`topbar-btn-accent ${showAgentManager ? 'active' : ''}`}
                    onClick={onToggleAgentManager}
                    title="Toggle Agent Manager"
                >
                    🤖 Agent
                </button>
                <button
                    className="topbar-btn-ghost"
                    onClick={onTestSupabase}
                    title="Test Supabase Connection"
                >
                    🔌 Test DB
                </button>
                <button
                    className="topbar-icon-btn"
                    onClick={onToggleBottomPanel}
                    title={bottomPanelCollapsed ? "Show Panel (Ctrl+`)" : "Hide Panel (Ctrl+`)"}
                >
                    {bottomPanelCollapsed ? "⬆" : "⬇"}
                </button>
            </div>
        </div>
    );
}