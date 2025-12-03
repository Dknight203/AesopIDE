// src/renderer/components/PromptPanel.jsx
import React, { useState, useRef, useEffect } from "react";
import "../styles/prompt.css";
import { askGemini } from "../lib/gemini";

export default function PromptPanel({ onClose, onApplyCode, activeTab, rootPath }) {
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

    const systemPrompt =
        "You are the built in assistant inside AesopIDE, a local code editor. " +
        "You can see an optional 'fileContext' string that contains the path and contents of a file. " +
        "Use that context to answer questions and propose concrete edits.\\n\\n" +
        "When you want to CREATE or EDIT a file, follow this exact format:\\n\\n" +
        "1. A short natural language summary of the planned changes for the user.\\n" +
        "2. A line that starts with: AesopIDE target file: relative/path/to/file.ext\\n" +
        "3. A single fenced code block containing the FULL contents of that file.\\n\\n" +
        "Example (editing a React header component):\\n\\n" +
        "I will make the header sticky, fix the mobile layout, and update the navigation links.\\n" +
        "AesopIDE target file: src/components/Header.tsx\\n" +
        "```tsx\\n" +
        "// updated file content here\\n" +
        "```\\n\\n" +
        "For planning tasks like designing a new app, you may pick a markdown plan file, " +
        "for example: AesopIDE target file: plans/diet-tracker.md and then provide the full plan as markdown.\\n\\n" +
        "If you are only answering a question and do not need to modify any file, you may respond normally without the AesopIDE line or code block.\\n\\n" +
        "To simply OPEN a file for the user to view in the editor without changing it, respond with a line that starts with:\\n" +
        "AesopIDE open file: relative/path/to/file.ext\\n" +
        "For an open file action, do not include any fenced code block that would overwrite the file content.";

    async function buildFileContext(promptText) {
        // If there is an active tab, use that as context
        if (activeTab && activeTab.path) {
            return (
                "Root: " +
                (rootPath || "(unknown)") +
                "\\nActive file: " +
                activeTab.path +
                "\\n\\n" +
                (activeTab.content || "")
            );
        }

        // Fallback: if the user typed something that looks like a file path, try loading it
        const fileMatch = promptText.match(
            /([\\w./-]+?\\.(md|txt|js|jsx|ts|tsx|json|css|html))/i
        );
        if (fileMatch && fileMatch[1]) {
            const relPath = fileMatch[1];
            if (
                window.aesop &&
                window.aesop.fs &&
                typeof window.aesop.fs.readFile === "function"
            ) {
                try {
                    const content = await window.aesop.fs.readFile(relPath);
                    return (
                        "Root: " +
                        (rootPath || "(unknown)") +
                        "\\nRequested file: " +
                        relPath +
                        "\\n\\n" +
                        (content || "")
                    );
                } catch (err) {
                    console.error("[PromptPanel] Failed to read file from prompt:", err);
                }
            }
        }

        return null;
    }

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
            const fileContext = await buildFileContext(text);

            const reply = await askGemini(text, {
                systemPrompt,
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
