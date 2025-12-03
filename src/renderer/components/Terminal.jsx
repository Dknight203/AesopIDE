// src/renderer/components/Terminal.jsx
import React, { useState, useRef, useEffect } from "react";
import "../styles/terminal.css";

// Assuming logToTerminal is used for debugging/messages, but we'll use local state for terminal output
// import { logToTerminal } from "../lib/logger"; 

export default function Terminal() {
    const [output, setOutput] = useState([
        "Terminal ready. Type a command below.",
    ]);
    const [input, setInput] = useState("");
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const outputEndRef = useRef(null);
    const inputRef = useRef(null);
    const [isRunning, setIsRunning] = useState(false);
    const [activeCommandId, setActiveCommandId] = useState(null);

    // Scroll to bottom on output change
    useEffect(() => {
        outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [output]);

    // Focus input when terminal is visible
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Function to append text to the terminal output
    const appendOutput = (text) => {
        setOutput((prev) => [...prev, ...text.split('\n')]);
    };

    async function handleCommandSubmit() {
        const command = input.trim();
        if (!command || isRunning) return;

        // 1. Add command to history and clear input
        setCommandHistory((prev) => [command, ...prev].slice(0, 20)); // Keep last 20
        setHistoryIndex(-1);
        setInput("");
        
        setIsRunning(true);
        appendOutput(`$ ${command}`); // Echo the command

        try {
            // 2. Call IPC handler to run the command
            // window.aesop.tools.runCommand(command) maps to "cmd:run" IPC
            const result = await window.aesop.tools.runCommand(command);

            if (!result.ok) {
                appendOutput(`❌ Command Failed: ${result.error || "Unknown Error"}`);
                if (result.output) {
                     appendOutput(result.output);
                }
            } else {
                // Success: Display full output
                appendOutput(result.output);
            }
        } catch (err) {
            console.error("[Terminal Command Error]", err);
            appendOutput(`❌ Error running command: ${err.message || String(err)}`);
        } finally {
            setIsRunning(false);
            setActiveCommandId(null);
        }
    }

    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleCommandSubmit();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (commandHistory.length > 0) {
                const newIndex = Math.min(commandHistory.length - 1, historyIndex + 1);
                setHistoryIndex(newIndex);
                setInput(commandHistory[newIndex]);
            }
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setInput(commandHistory[newIndex]);
            } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setInput("");
            }
        }
    }

    const handleClear = () => {
        setOutput([]);
    };

    return (
        <div className="terminal">
            <div className="terminal-header">
                <span className="terminal-title">
                    {isRunning ? "⌨️ Terminal (RUNNING...)" : "⌨️ Terminal Output"}
                </span>
                <div className="terminal-actions">
                    {isRunning && (
                        <button 
                            className="terminal-action-btn danger" 
                            onClick={() => window.aesop.tools.killCommand(activeCommandId)}
                            title="Kill active process"
                        >
                            🛑 Kill
                        </button>
                    )}
                    <button
                        className="terminal-clear-btn"
                        onClick={handleClear}
                        title="Clear output"
                    >
                        🗑️ Clear
                    </button>
                </div>
            </div>

            <div className="terminal-output scrollable">
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
                <div ref={outputEndRef} />
            </div>

            <div className="terminal-input-area">
                <span className="terminal-prompt-input">
                    $
                </span>
                <input
                    ref={inputRef}
                    className="terminal-command-input"
                    placeholder="Enter command here..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isRunning}
                />
                <button 
                    className="terminal-run-btn primary"
                    onClick={handleCommandSubmit}
                    disabled={!input.trim() || isRunning}
                >
                    {isRunning ? "⏳" : "Run"}
                </button>
            </div>
        </div>
    );
}