// src/renderer/components/BottomPanel.jsx
import React, { useState } from "react";
import "../styles/panel.css";
import GitPanel from "./GitPanel";
import Terminal from "./Terminal";

export default function BottomPanel() {
    const [activeTab, setActiveTab] = useState("git");

    const tabs = [
        { id: "git", label: "Git", icon: "🔀" },
        { id: "terminal", label: "Terminal", icon: "⌨️" },
        { id: "output", label: "Output", icon: "📋" },
    ];

    return (
        <div className="bottom-panel-wrapper">
            <div className="panel-header">
                <div className="panel-tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            className={`panel-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className="panel-tab-icon">{tab.icon}</span>
                            <span className="panel-tab-label">{tab.label}</span>
                        </button>
                    ))}
                </div>
                <div className="panel-actions">
                    {/* Future: Add panel-specific actions */}
                </div>
            </div>

            <div className="panel-content scrollable">
                {activeTab === "git" && <GitPanel />}
                {activeTab === "terminal" && <Terminal />}
                {activeTab === "output" && (
                    <div className="output-panel">
                        <div className="empty-state">
                            <div className="empty-state-icon">📋</div>
                            <div className="empty-state-title">No Output</div>
                            <div className="empty-state-description">
                                Output from tasks will appear here
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
