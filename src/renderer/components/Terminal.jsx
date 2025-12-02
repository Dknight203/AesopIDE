import React, { useState } from "react";
import "../styles/terminal.css";

export default function Terminal() {
    const [output, setOutput] = useState([
        "Terminal ready. (Note: Full terminal integration coming soon)",
    ]);

    const handleClear = () => {
        setOutput([]);
    };

    return (
        <div className="terminal">
            <div className="terminal-header">
                <span className="terminal-title">⌨️ Terminal Output</span>
                <button
                    className="terminal-clear-btn"
                    onClick={handleClear}
                    title="Clear output"
                >
                    🗑️ Clear
                </button>
            </div>

            <div className="terminal-output">
                {output.length === 0 ? (
                    <div className="terminal-empty">
                        No output yet
                    </div>
                ) : (
                    output.map((line, index) => (
                        <div key={index} className="terminal-line">
                            <span className="terminal-prompt">$</span>
                            <span className="terminal-text">{line}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
