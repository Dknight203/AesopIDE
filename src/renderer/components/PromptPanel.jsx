// src/renderer/components/PromptPanel.jsx
import React, { useState, useRef, useEffect } from "react";
import "../styles/prompt.css";

export default function PromptPanel({ onClose }) {
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content: "Hello! I'm your AI assistant. How can I help you with your code today?",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = {
            role: "user",
            content: input,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        // Simulate AI response (replace with actual API call)
        setTimeout(() => {
            const aiMessage = {
                role: "assistant",
                content: `I received your message: "${input}"\n\nThis is a placeholder response. Connect this to your AI service (Gemini, etc.) to get real responses.\n\nExample code:\n\`\`\`javascript\nfunction example() {\n  console.log("Hello from AI!");\n}\n\`\`\``,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, aiMessage]);
            setIsLoading(false);
        }, 1000);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    const renderMessage = (message, index) => {
        const isUser = message.role === "user";
        const isCode = message.content.includes("```");

        return (
            <div key={index} className={`message ${isUser ? "message-user" : "message-assistant"}`}>
                <div className="message-header">
                    <span className="message-role">
                        {isUser ? "👤 You" : "🤖 Assistant"}
                    </span>
                    <span className="message-time">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
                <div className="message-content">
                    {isCode ? renderCodeContent(message.content) : message.content}
                </div>
            </div>
        );
    };

    const renderCodeContent = (content) => {
        const parts = content.split(/(```[\s\S]*?```)/g);
        return parts.map((part, idx) => {
            if (part.startsWith("```")) {
                const code = part.replace(/```(\w+)?\n?/g, "").replace(/```$/g, "");
                const language = part.match(/```(\w+)/)?.[1] || "text";
                return (
                    <div key={idx} className="code-block">
                        <div className="code-block-header">
                            <span className="code-language">{language}</span>
                            <button
                                className="code-copy-btn"
                                onClick={() => copyToClipboard(code)}
                                title="Copy code"
                            >
                                📋 Copy
                            </button>
                        </div>
                        <pre className="code-pre">
                            <code>{code}</code>
                        </pre>
                    </div>
                );
            }
            return <p key={idx} className="message-text">{part}</p>;
        });
    };

    return (
        <div className="prompt-panel">
            <div className="prompt-header">
                <div className="prompt-header-left">
                    <span className="prompt-title">✨ AI Assistant</span>
                </div>
                <div className="prompt-header-right">
                    <button
                        className="prompt-action-btn"
                        onClick={() => setMessages([])}
                        title="Clear conversation"
                    >
                        🗑️
                    </button>
                    <button
                        className="prompt-close-btn"
                        onClick={onClose}
                        title="Close"
                    >
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
                    placeholder="Ask me anything... (Shift+Enter for new line)"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                />
                <button
                    className="prompt-send-btn"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    title="Send message (Enter)"
                >
                    {isLoading ? "⏳" : "📤"} Send
                </button>
            </div>
        </div>
    );
}
