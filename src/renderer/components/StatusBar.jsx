// src/renderer/components/StatusBar.jsx
import React from "react";
import "../styles/status.css";

export default function StatusBar({ rootPath, activePath, message }) {
    return (
        <div className="status-bar">
            <div className="status-left">
                <span className="status-item">
                    Root: {rootPath || "(none)"}
                </span>
                <span className="status-item">
                    File: {activePath || "(no file)"}
                </span>
            </div>
            <div className="status-right">
                <span className="status-item">
                    {message || "Ready"}
                </span>
            </div>
        </div>
    );
}
