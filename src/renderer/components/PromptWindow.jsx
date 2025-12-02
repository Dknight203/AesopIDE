import React, { useState } from "react";
import "../styles/prompt.css";

export default function PromptWindow({ onSend }) {
    const [input, setInput] = useState("");

    function send() {
        if (!input.trim()) return;
        onSend(input);
        setInput("");
    }

    return (
        <div className="prompt-window">
            <textarea
                className="prompt-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask AesopIDE anything..."
            />

            <button className="prompt-send" onClick={send}>
                Send
            </button>
        </div>
    );
}
