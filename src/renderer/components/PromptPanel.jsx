// src/renderer/components/PromptPanel.jsx
import React, { useState, useRef, useEffect } from "react";
import "../styles/prompt.css";
import { askGemini } from "../lib/gemini";
import { SYSTEM_PROMPT } from "../lib/ai/systemPrompt";
import { buildFileContext } from "../lib/codebase/context";
import parseToolCalls from "../lib/ai/toolParser";
import { executeTool } from "../lib/tools/framework";

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
            await processAiTurn(text, [...messages, userMessage]);
        } catch (err) {
            console.error("[PromptPanel handleSend error]", err);
            const errorMessage = {
                role: "assistant",
                content: "Error: " + (err.message || String(err)),
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }

    async function processAiTurn(userPrompt, history) {
        // Build context
        let fileContext = "";
        if (activeTab && activeTab.path) {
            fileContext = await buildFileContext(activeTab.path, codebaseIndex || [], {
                includeImports: true,
                includeImporters: true
            });
        }

        // 1. Send to AI
        const reply = await askGemini(userPrompt, {
            systemPrompt: SYSTEM_PROMPT,
            fileContext,
            // TODO: Pass history if askGemini supports it, currently it seems stateless per call
        });

        const aiMessage = {
            role: "assistant",
            content: reply,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);

        // 2. Check for tool calls
        const toolCalls = parseToolCalls(reply);
        if (toolCalls.length > 0) {
            // Execute tools
            for (const call of toolCalls) {
                const toolMsg = {
                    role: "tool",
                    content: `Executing tool: ${call.tool}...`,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, toolMsg]);

                try {
                    const result = await executeTool(call.tool, call.params);

                    // Auto-open file if created
                    if (call.tool === 'createTask' || call.tool === 'createPlan' || call.tool === 'writeFile') {
                        if (result && result.path && onApplyCode) {
                            // We use onApplyCode as a proxy to open files since it likely has access to app state
                            // Or better, we should pass an onOpenFile prop
                            // For now, let's assume the result message will prompt the user or we can try to trigger it
                        }
                    }

                    const resultMsg = {
                        role: "tool_result",
                        content: `Tool '${call.tool}' output:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, resultMsg]);

                    // 3. Send result back to AI (recursive)
                    // For now, we just append the result to the prompt and ask AI to continue
                    const followUpPrompt = `Tool '${call.tool}' returned:\n${JSON.stringify(result, null, 2)}\n\nPlease continue based on this result.`;

                    // Recursive call to process the tool result
                    // Note: In a real chat system we'd append to history, but here we just chain calls
                    const followUpReply = await askGemini(followUpPrompt, {
                        systemPrompt: SYSTEM_PROMPT,
                        fileContext,
                    });

                    const followUpMsg = {
                        role: "assistant",
                        content: followUpReply,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, followUpMsg]);

                    // Check if follow-up has more tools (limit recursion depth in real impl)
                    // For now, let's stop after one level to prevent loops

                } catch (err) {
                    const errorMsg = {
                        role: "tool_error",
                        content: `Tool '${call.tool}' failed: ${err.message}`,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, errorMsg]);
                }
            }
        }

        // Auto-apply if applicable (only for the final reply, but here we check the first one too)
        if (hasActionableContent(reply) && onApplyCode) {
            setTimeout(() => onApplyCode(reply), 100);
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
        const isTool = message.role === "tool";
        const isToolResult = message.role === "tool_result";
        const isToolError = message.role === "tool_error";

        let roleLabel = "🤖 Assistant";
        if (isUser) roleLabel = "👤 You";
        if (isTool) roleLabel = "🛠️ Tool";
        if (isToolResult) roleLabel = "📝 Result";
        if (isToolError) roleLabel = "⚠️ Error";

        // Parse tool content if it's a tool call
        let displayContent = message.content;
        if (isTool) {
            try {
                // Try to extract tool name from JSON
                const toolData = JSON.parse(message.content);
                if (toolData.tool) {
                    displayContent = `Executing tool: ${toolData.tool}...`;
                }
            } catch (e) {
                // If parsing fails, just show truncated content
                if (displayContent.length > 100) {
                    displayContent = displayContent.substring(0, 100) + "...";
                }
            }
        }

        const messageClass = `message ${isUser ? "message-user" :
            isTool ? "message-tool" :
                isToolResult ? "message-tool_result" :
                    isToolError ? "message-tool_error" :
                        "message-assistant"
            }`;

        return (
            <div key={index} className={messageClass}>
                <div className="message-header">
                    <span className="message-role">{roleLabel}</span>
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
                        message.role === "assistant" || message.role === "tool_result"
                            ? () => copyToClipboard(message.content)
                            : undefined
                    }
                >
                    {isTool ? (
                        <span style={{ fontStyle: 'italic' }}>{displayContent}</span>
                    ) : (
                        renderMessageContent(displayContent)
                    )}
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
