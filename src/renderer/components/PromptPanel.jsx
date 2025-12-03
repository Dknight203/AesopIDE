// src/renderer/components/PromptPanel.jsx
import React, { useState, useRef, useEffect } from "react";
import "../styles/prompt.css";
import { askGemini } from "../lib/gemini";
import { SYSTEM_PROMPT } from "../lib/ai/systemPrompt";
import { buildFileContext } from "../lib/codebase/context";

export default function PromptPanel({ onClose, onApplyCode, activeTab, rootPath, codebaseIndex }) {
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content:
                "Hello. I am your AI assistant inside AesopIDE. Ask me about your code or project and I will help.",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    async function handleSend() {
        if (!input.trim() || isLoading) return;

        const text = input;
        const userMessage = {
            role: "user",
            content: text,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            // Build context using the new multi-file context builder
            let fileContext = "";
            if (activeTab && activeTab.path) {
                fileContext = await buildFileContext(activeTab.path, codebaseIndex || [], {
                    includeImports: true,
                    includeImporters: true
                });
            }

            const reply = await askGemini(text, {
                systemPrompt: SYSTEM_PROMPT,
                fileContext,
            });

            const aiMessage = {
                role: "assistant",
                content: reply,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, aiMessage]);

            // Auto-apply AI actions if the response contains file operations
            if (hasActionableContent(reply) && onApplyCode) {
                // Small delay to ensure message is rendered first
                setTimeout(() => {
                    onApplyCode(reply);
                }, 100);
            }
        } catch (err) {
            console.error("[PromptPanel handleSend error]", err);
            const errorMessage = {
                role: "assistant",
                content:
                    "There was an error talking to Gemini: " +
                    (err.message || String(err)),
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }

    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text);
    }

    // Check if AI message contains actionable content (code blocks or file commands)
    function hasActionableContent(content) {
        if (!content || typeof content !== "string") return false;

        // Check for file commands
        if (content.match(/AesopIDE (target|open) file:/i)) {
            return true;
        }

        // Check for fenced code blocks
        if (content.match(/```[\\s\\S]*?```/)) {
            return true;
        }

        return false;
    }

    // Render message content with clickable file links
    function renderMessageContent(content) {
        if (!content || typeof content !== "string") return content;

        // Pattern to match file paths (e.g., src/components/Header.tsx)
        const filePathPattern = /((?:[\w-]+\/)*[\w-]+\.\w+)/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = filePathPattern.exec(content)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push(content.substring(lastIndex, match.index));
            }

            // Add clickable file link
            const filePath = match[1];
            parts.push(
                <span
                    key={`file-${match.index}`}
                    className="file-link"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onApplyCode) {
                            onApplyCode(`AesopIDE open file: ${filePath}`);
                        }
                    }}
                    title={`Click to open ${filePath}`}
                >
                    {filePath}
                </span>
            );

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < content.length) {
            parts.push(content.substring(lastIndex));
        }

        return parts.length > 0 ? parts : content;
    }

    function renderMessage(message, index) {
        const isUser = message.role === "user";
        return (
            <div
                key={index}
                className={`message ${isUser ? "message-user" : "message-assistant"}`}
            >
                <div className="message-header">
                    <span className="message-role">
                        {isUser ? "👤 You" : "🤖 Assistant"}
                    </span>
                    <span className="message-time">
                        {message.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </span>
                </div>
                <div
                    className="message-content"
                    onDoubleClick={
                        message.role === "assistant"
                            ? () => copyToClipboard(message.content)
                            : undefined
                    }
                >
                    {renderMessageContent(message.content)}
                </div>
                {message.role === "assistant" && onApplyCode && hasActionableContent(message.content) && (
                    <button
                        className="prompt-apply-btn"
                        onClick={() => onApplyCode(message.content)}
                        title="Apply this response into a file"
                    >
                        Apply to file
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="prompt-panel">
            <div className="prompt-header">
                <div className="prompt-header-left">
                    <span className="prompt-title">✨ AI Assistant</span>
                </div>
                <div className="prompt-header-right">
                    <button className="prompt-close-btn" onClick={onClose} title="Close">
                        ✕
                    </button>
                </div>
            </div>

            <div className="prompt-messages scrollable">
                {messages.map((msg, idx) => renderMessage(msg, idx))}
                {isLoading && (
                    <div className="message message-assistant">
                        <div className="message-header">
                            <span className="message-role">🤖 Assistant</span>
                        </div>
                        <div className="message-content">
                            <div className="loading-dots">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="prompt-input-area">
                <textarea
                    ref={inputRef}
                    className="prompt-input"
                    placeholder="Ask me anything. Use Shift Enter for a new line."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                />
                <button
                    className="prompt-send-btn"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    title="Send message"
                >
                    {isLoading ? "⏳" : "📤"} Send
                </button>
            </div>
        </div>
    );
}
