// src/renderer/components/PromptPanel.jsx
import React, { useState, useRef, useEffect } from "react";
import "../styles/prompt.css";
import { askGemini } from "../lib/gemini";
import { SYSTEM_PROMPT } from "../lib/ai/systemPrompt";
import { buildFileContext } from "../lib/codebase/context";
import parseToolCalls from "../lib/ai/toolParser";
import { executeTool } from "../lib/tools/framework";


// UPDATED PROPS: Added onOpenCommand
export default function PromptPanel({ onClose, onApplyCode, onOpenCommand, activeTab, rootPath, codebaseIndex }) {
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
    
    // NEW HELPER: For consistent message logging in the chat
    const appendMessage = (role, content) => {
        const newMessage = {
            role,
            content,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newMessage]);
    };

    async function handleSend() {
        if (!input.trim() || isLoading) return;

        const text = input;
        
        // -----------------------------------------------------------
        // NEW LOGIC START: INTERCEPT RENDERER-SIDE OPEN COMMANDS
        // -----------------------------------------------------------
        const OPEN_COMMAND_REGEX = /^(?:bring up|open|show|display)\s+(.+?)$/i;
        const match = text.trim().match(OPEN_COMMAND_REGEX);

        if (match && onOpenCommand) {
            // Extract the token (the 'X' in "bring up X") and clean up any trailing "file" or "files"
            const token = match[1].trim().replace(/\s+file(s)?$/i, '').trim(); 
            
            // 1. Display user message immediately
            appendMessage("user", text);
            setInput("");
            setIsLoading(true);

            // 2. Execute the multi-step open command logic in App.jsx
            // onOpenCommand handles findFiles, readFile, setActivePath, and appends the final clean message
            await onOpenCommand(token, appendMessage);
            
            setIsLoading(false);
            return; // EXIT: Command handled, prevent sending to AI.
        }
        // -----------------------------------------------------------
        // NEW LOGIC END
        // -----------------------------------------------------------


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
                // Check if tool is one we want to suppress verbose JSON output for
                const isFileOp = ['writeFile', 'readFile', 'findFiles', 'createTask', 'readTask', 'createPlan', 'readPlan'].includes(call.tool);
                
                const toolMsg = {
                    role: "tool",
                    content: `Executing tool: ${call.tool}...`,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, toolMsg]);


                try {
                    const result = await executeTool(call.tool, call.params);
                    
                    // Auto-open file if created or read (Existing logic, modified for clarity)
                    if (['createTask', 'readTask', 'createPlan', 'readPlan', 'writeFile', 'readFile'].includes(call.tool)) {
                        // Determine path from result or params
                        let path = null;
                        if (result && result.path) path = result.path;
                        else if (call.params && call.params.path) path = call.params.path;
                        
                        // Special case for task/plan tools that imply a specific path
                        if (!path) {
                            if (call.tool.includes('Task')) path = '.aesop/task.md';
                            if (call.tool.includes('Plan')) path = '.aesop/implementation_plan.md';
                        } else {
                            // If path is provided but missing .aesop prefix for task files, add it
                            if ((path === 'task.md' || path === '/task.md') && call.tool.includes('Task')) {
                                path = '.aesop/task.md';
                            }
                            if ((path === 'implementation_plan.md' || path === '/implementation_plan.md') && call.tool.includes('Plan')) {
                                path = '.aesop/implementation_plan.md';
                            }
                        }


                        // onOpenFile is NOT passed to PromptPanel, but handleApplyCode's openFileByPath achieves the same goal
                        if (path && onApplyCode) { 
                            // Simulate the open action by passing a dummy AI response to onApplyCode
                            setTimeout(() => onApplyCode(`AesopIDE open file: ${path}`), 100);
                        }
                    }


                    // -----------------------------------------------------------
                    // NEW LOGIC: TOOL RESULT SUPPRESSION
                    // -----------------------------------------------------------
                    let resultMsg;
                    if (isFileOp) {
                        // Hide raw JSON for core file/plan operations (Fix 2)
                        resultMsg = {
                            role: "tool_result",
                            content: `Tool **'${call.tool}'** executed successfully.`,
                            timestamp: new Date()
                        };
                    } else {
                        // Keep verbose JSON for other tools (like complex file search or git commands)
                        resultMsg = {
                            role: "tool_result",
                            content: `Tool '${call.tool}' output:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
                            timestamp: new Date()
                        };
                    }
                    setMessages(prev => [...prev, resultMsg]);
                    // -----------------------------------------------------------


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
            // We just set this message when calling the tool in handleSend, so no parsing needed
        }
        
        // Clean up tool result content for display in the chat window
        if (isToolResult) {
            // Check if it's the suppressed message we added in processAiTurn
            if (displayContent.startsWith("Tool **")) {
                // Keep the clean message
            } else {
                // If it's a full JSON dump (e.g., from git status), just show a summary
                displayContent = `Tool result received.`;
            }
        }


        const messageClass = `message ${isUser ?
            "message-user" :
            isTool ?
                "message-tool" :
                isToolResult ?
                    "message-tool_result" :
                    isToolError ?
                        "message-tool_error" :
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
                <div 
                    className="prompt-header-right">
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