// src/renderer/components/GitPanel.jsx
import React, { useState } from "react";
import "../styles/git.css";
import { gitStatus, gitCommit, gitPush, gitPull } from "../lib/git";

export default function GitPanel() {
    const [status, setStatus] = useState(null);
    const [commitMessage, setCommitMessage] = useState("");
    const [log, setLog] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleStatus() {
        setLoading(true);
        const res = await gitStatus();
        if (!res.ok) {
            setLog("❌ Status error: " + res.error);
        } else {
            setStatus(res.status);
            setLog("✅ Status refreshed.");
        }
        setLoading(false);
    }

    async function handleCommit() {
        const msg = commitMessage.trim() || "AesopIDE commit";
        setLoading(true);
        const res = await gitCommit(msg);
        if (!res.ok) {
            setLog("❌ Commit error: " + res.error);
        } else {
            setLog("✅ Commit complete.");
            setCommitMessage("");
        }
        setLoading(false);
    }

    async function handlePush() {
        setLoading(true);
        const res = await gitPush();
        if (!res.ok) setLog("❌ Push error: " + res.error);
        else setLog("✅ Push complete.");
        setLoading(false);
    }

    async function handlePull() {
        setLoading(true);
        const res = await gitPull();
        if (!res.ok) setLog("❌ Pull error: " + res.error);
        else setLog("✅ Pull complete.");
        setLoading(false);
    }

    return (
        <div className="git-panel">
            <div className="git-actions">
                <div className="git-action-group">
                    <button
                        className="git-btn"
                        onClick={handleStatus}
                        disabled={loading}
                    >
                        🔍 Status
                    </button>
                    <button
                        className="git-btn"
                        onClick={handlePull}
                        disabled={loading}
                    >
                        ⬇️ Pull
                    </button>
                    <button
                        className="git-btn"
                        onClick={handlePush}
                        disabled={loading}
                    >
                        ⬆️ Push
                    </button>
                </div>
            </div>

            <div className="git-commit-section">
                <input
                    className="git-commit-input"
                    placeholder="Enter commit message..."
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleCommit();
                        }
                    }}
                />
                <button
                    className="git-btn git-btn-primary"
                    onClick={handleCommit}
                    disabled={loading || !commitMessage.trim()}
                >
                    💾 Commit
                </button>
            </div>

            {log && (
                <div className="git-log">
                    {log}
                </div>
            )}

            {status && (
                <div className="git-status">
                    <div className="git-status-header">Repository Status</div>
                    <pre className="git-status-pre">
                        {JSON.stringify(status, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
