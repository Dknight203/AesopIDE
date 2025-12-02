// src/renderer/components/GitPanel.jsx
import React, { useState } from "react";
import "../styles/sidebar.css";
import { gitStatus, gitCommit, gitPush, gitPull } from "../lib/git";

export default function GitPanel() {
    const [status, setStatus] = useState(null);
    const [commitMessage, setCommitMessage] = useState("");
    const [log, setLog] = useState("");

    async function handleStatus() {
        const res = await gitStatus();
        if (!res.ok) {
            setLog("Status error: " + res.error);
        } else {
            setStatus(res.status);
            setLog("Status refreshed.");
        }
    }

    async function handleCommit() {
        const msg = commitMessage.trim() || "AesopIDE commit";
        const res = await gitCommit(msg);
        if (!res.ok) {
            setLog("Commit error: " + res.error);
        } else {
            setLog("Commit complete.");
        }
    }

    async function handlePush() {
        const res = await gitPush();
        if (!res.ok) setLog("Push error: " + res.error);
        else setLog("Push complete.");
    }

    async function handlePull() {
        const res = await gitPull();
        if (!res.ok) setLog("Pull error: " + res.error);
        else setLog("Pull complete.");
    }

    return (
        <div className="git-panel">
            <div className="git-row">
                <button onClick={handleStatus}>Status</button>
                <button onClick={handlePull}>Pull</button>
                <button onClick={handlePush}>Push</button>
            </div>

            <div className="git-commit">
                <input
                    placeholder="Commit message"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                />
                <button onClick={handleCommit}>Commit</button>
            </div>

            <div className="git-status">
                {status && (
                    <pre className="git-status-pre">
                        {JSON.stringify(status, null, 2)}
                    </pre>
                )}
                <div className="git-log">{log}</div>
            </div>
        </div>
    );
}
