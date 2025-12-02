// src/renderer/components/PromptPanel.jsx
import React, { useState } from "react";
import "../styles/prompt.css";
import { sendPrompt } from "../lib/prompt";

export default function PromptPanel({ onClose }) {
    const [input, setInput] = useState("");
    const [output, setOutput] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSend() {
        const text = input.trim();
        if (!text || loading) return;

        setLoading(true);
        setOutput("");

        try {
            const res = await sendPrompt(text, { model: "gemini-2.5-flash" });

            if (!res.ok) {
                setOutput("Error: " + res.error);
            } else {
                setOutput(res.response);
            }
        } catch (err) {
            setOutput("Error: " + (err.message || err.toString()));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="prompt-panel">
            {/* HEADER */}
            <div className="prompt-header">
                <span>AesopIDE Prompt</span>
                <button onClick={onClose}>Close</button>
            </div>

            {/* TEXTAREA WITH KEYBOARD SHORTCUTS */}
            <textarea
                className="prompt-input"
                placeholder="Ask AesopIDE to change files, explain code, refactor, or generate updates."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    // ENTER = SEND
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }

                    // ESC = CLOSE WINDOW
                    if (e.key === "Escape") {
                        e.preventDefault();
                        onClose();
                    }
                }}
            />

            {/* SEND BUTTON */}
            <button className="prompt-send" onClick={handleSend} disabled={loading}>
                {loading ? "Thinking…" : "Send"}
            </button>

            {/* OUTPUT WINDOW */}
            <div className="prompt-output">
                {output && <pre>{output}</pre>}
            </div>
        </div>
    );
}
