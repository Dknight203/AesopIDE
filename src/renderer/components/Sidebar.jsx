import React from "react";

export default function Sidebar({ onNewFile, onOpenPrompt }) {
  return (
    <div className="sidebar">
      <h2 className="sidebar-title">AesopIDE</h2>

      <button className="sidebar-btn" onClick={onNewFile}>
        New File
      </button>

      <button className="sidebar-btn" onClick={onOpenPrompt}>
        Prompt
      </button>
    </div>
  );
}
