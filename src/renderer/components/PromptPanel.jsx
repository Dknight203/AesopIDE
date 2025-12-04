// src/renderer/components/PromptPanel.jsx
import React, { useState, useRef, useEffect } from "react";
import "../styles/prompt.css";
import { askGemini } from "../lib/gemini";
import { SYSTEM_PROMPT } from "../lib/ai/systemPrompt";
import { buildFileContext } from "../lib/codebase/context";
import parseToolCalls from "../lib/ai/toolParser";
import { executeTool } from "../lib/tools/framework";


export default function PromptPanel({ onClose, onApplyCode, onOpenCommand, activeTab, rootPath, codebaseIndex, initialPrompt, onClearInitialPrompt }) {
    // Initialize state with a standard welcome message
    const initialMessage = {
        role: "assistant",
        content:
            "Hello. I am your AI assistant inside AesopIDE. Ask me about your code or project and I will help.",
        timestamp: new Date(),
    };

    const [messages, setMessages] = useState([initialMessage]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // NEW STATE: For Project Knowledge
    const [projectKnowledge, setProjectKnowledge] = useState({});

    // NEW EFFECT: Handle initial prompt injection from the parent
    useEffect(() => {
        if (initialPrompt) {
            setInput(initialPrompt);
            inputRef.current?.focus();

            // Clear the state in the parent component immediately after consumption
            if (onClearInitialPrompt) {
                onClearInitialPrompt();
            }
        }
    }, [initialPrompt, onClearInitialPrompt]);


    // -----------------------------------------------------------
    // PHASE 4.2: PROJECT MEMORY LOAD
    // -----------------------------------------------------------

    // Load project knowledge on initial mount and whenever rootPath changes
    useEffect(() => {
        async function loadKnowledge() {
            if (!rootPath) {
                setProjectKnowledge({});
                return;
            }
            try {
                const result = await window.aesop.memory.load();
                if (result.ok && result.knowledge) {
                    setProjectKnowledge(result.knowledge);
                } else {
                    setProjectKnowledge({});
                }
            } catch (err) {
                console.error("Failed to load project knowledge:", err);
                setProjectKnowledge({});
            }
        }

        loadKnowledge();
    }, [rootPath]);


    // -----------------------------------------------------------
    // PHASE 4.1: HISTORY LOADING & SAVING
    // -----------------------------------------------------------

    // Load history on initial mount and whenever rootPath changes (i.e., new project loaded)
    useEffect(() => {
        async function loadHistory() {
            try {
                const result = await window.aesop.history.load();
                if (result.ok && result.messages && result.messages.length > 0) {
                    // Only use saved history if it's not just the welcome message
                    setMessages(result.messages);
                } else {
                    setMessages([initialMessage]); // Fallback to welcome message
                }
            } catch (err) {
                console.error("Failed to load conversation history:", err);
                setMessages([initialMessage]); // Use default on error
            }
        }

        if (rootPath) {
            loadHistory();
        }
    }, [rootPath]); // Re-run when project root changes

    // Save history whenever messages change, debounce to avoid writing too often
    useEffect(() => {
        const handler = setTimeout(() => {
            if (messages.length > 1) { // Only save after the welcome message is gone
                window.aesop.history.save(messages).catch(err => {
                    console.error("Failed to save conversation history:", err);
                });
            }
        }, 500);

        return () => clearTimeout(handler); // Cleanup on unmount or before next effect run
    }, [messages]);


    // Scroll to bottom on message change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Focus input when terminal is visible
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Helper function used by App.jsx's autoOpenFileAndMessage
    const appendMessage = (role, content) => {
        const newMessage = {
            role,
            content,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newMessage]);
    };

    /**
     * Attempts to save project knowledge if the user message matches a save pattern.
     * @param {string} userText The text from the user input.
     * @returns {Promise<boolean>} True if a memory save was attempted, false otherwise.
     */
    async function handleMemorySave(userText) {
        // --- START FIX: Use two regexes for flexible command parsing ---
        // 1. Verb first: (remember|note|...) [that] [:,|-] (CONTENT)
        const SAVE_STARTING_REGEX = 
            /^(?:remember|keep in mind|note|memorize)\s*(?:that)?\s*(?::|,|-)?\s*(.*)$/i;
        // 2. Verb last: (CONTENT) [.,|] (remember this|note this|...)
        const SAVE_TRAILING_REGEX = 
            /^(.*)(?:,\s*|\.\s*)\s*(?:remember this|keep this in mind|note this|memorize this)\s*\.?$/i;

        let contentToSave = null;
        let match = userText.trim().match(SAVE_STARTING_REGEX);

        if (match && match[1] && match[1].trim().length > 0) {
            contentToSave = match[1].trim();
        } else {
            match = userText.trim().match(SAVE_TRAILING_REGEX);
            if (match && match[1] && match[1].trim().length > 0) {
                contentToSave = match[1].trim();
            }
        }
        
        if (!contentToSave) return false; // No content found or no match

        const knowledgeKey = "custom_instructions";
        const newKnowledgeValue = contentToSave.replace(/\.$/, ''); // Remove trailing dot

        const updatedKnowledge = {
            ...projectKnowledge,
            [knowledgeKey]: newKnowledgeValue,
        };

        const userMessage = {
            role: "user",
            content: userText,
            timestamp: new Date(),
        };
        // Add user message immediately
        setMessages((prev) => [...prev, userMessage]); 
        setInput("");
        
        try {
            await window.aesop.memory.save(updatedKnowledge);
            setProjectKnowledge(updatedKnowledge);

            const confirmationMessage = {
                role: "assistant",
                content: `Acknowledged. I've saved the following project knowledge: **${newKnowledgeValue}**.\n\nI will use this information when responding to your future requests.`,
                timestamp: new Date(),
            };
            
            // Add confirmation message
            setMessages((prev) => [...prev, confirmationMessage]); 
            return true; // Memory saved successfully

        } catch (err) {
            console.error("Memory save failed:", err);
            const errorMessage = {
                role: "assistant",
                content: `Error saving knowledge: ${err.message || String(err)}`,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            return true; // Still handle the message, but with an error
        }
    }


    async function handleSend() {
        if (!input.trim() || isLoading) return;

        const text = input;

        // 1. Intercept Memory Save command
        const isMemoryRequest = await handleMemorySave(text);
        if (isMemoryRequest) {
            return; // Exit if the command was handled by memory save
        }
        
        // INTERCEPT RENDERER-SIDE OPEN COMMANDS (existing logic)
        const OPEN_COMMAND_REGEX = /^(?:bring up|open|show|display)\s+(.+?)$/i;
        const match = text.trim().match(OPEN_COMMAND_REGEX);

        if (match && onOpenCommand) {
            const token = match[1].trim().replace(/\s+file(s)?$/i, '').trim();

            appendMessage("user", text);
            setInput("");
            setIsLoading(true);

            await onOpenCommand(token, appendMessage);

            setIsLoading(false);
            return; // EXIT: Command handled locally.
        }


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

    // NEW: Clear chat history
    async function handleNewChat() {
        if (confirm("Start a new chat? This will clear the current history.")) {
            setMessages([initialMessage]);
            // Clear history in backend
            try {
                await window.aesop.history.save([initialMessage]);
            } catch (err) {
                console.error("Failed to clear history:", err);
            }
            // Clear any pending initial prompt when starting a new chat
            if (onClearInitialPrompt) {
                onClearInitialPrompt();
            }
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

        // NEW: Serialize project knowledge for AI context
        let knowledgeContext = "";
        if (projectKnowledge && Object.keys(projectKnowledge).length > 0) {
            knowledgeContext = "PROJECT KNOWLEDGE:\n" + JSON.stringify(projectKnowledge, null, 2) + "\n\n";
        }


        // 1. Send to AI
        const reply = await askGemini(userPrompt, {
            systemPrompt: SYSTEM_PROMPT,
            fileContext,
            // Pass the entire history array for continuous context (Phase 4.1)
            history: history,
            // NEW: Pass knowledge context to be prepended to prompt
            knowledgeContext: knowledgeContext
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
                const isFileOp = ['writeFile', 'readFile', 'findFiles', 'createTask', 'readTask', 'createPlan', 'readPlan'].includes(call.tool);

                const toolMsg = {
                    role: "tool",
                    content: `Executing tool: ${call.tool}...`,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, toolMsg]);


                try {
                    const result = await executeTool(call.tool, call.params);

                    // Auto-open file if created or read
                    if (['createTask', 'readTask', 'createPlan', 'readPlan', 'writeFile', 'readFile'].includes(call.tool)) {
                        let path = null;
                        if (result && result.path) path = result.path;
                        else if (call.params && call.params.path) path = call.params.path;

                        if (!path) {
                            if (call.tool.includes('Task')) path = '.aesop/task.md';
                            if (call.tool.includes('Plan')) path = '.aesop/implementation_plan.md';
                        } else {
                            if ((path === 'task.md' || path === '/task.md') && call.tool.includes('Task')) {
                                path = '.aesop/task.md';
                            }
                            if ((path === 'implementation_plan.md' || path === '/implementation_plan.md') && call.tool.includes('Plan')) {
                                path = '.aesop/implementation_plan.md';
                            }
                        }


                        if (path && onApplyCode) {
                            // This sends an IPC command to open the file after it's been written
                            setTimeout(() => onApplyCode(`AesopIDE open file: ${path}`), 100);
                        }
                    }


                    // TOOL RESULT SUPPRESSION
                    let resultMsg;
                    if (isFileOp) {
                        resultMsg = {
                            role: "tool_result",
                            content: `Tool **'${call.tool}'** executed successfully.`,
                            timestamp: new Date()
                        };
                    } else {
                        resultMsg = {
                            role: "tool_result",
                            content: `Tool '${call.tool}' output:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
                            timestamp: new Date()
                        };
                    }
                    setMessages(prev => [...prev, resultMsg]);


                    // 3. Send result back to AI (recursive)
                    const followUpPrompt = `Tool '${call.tool}' returned:\n${JSON.stringify(result, null, 2)}\n\nPlease continue based on this result.`;
                    const followUpReply = await askGemini(followUpPrompt, {
                        systemPrompt: SYSTEM_PROMPT,
                        fileContext,
                        history: [...history, aiMessage, resultMsg], // Pass updated history to recursive call
                        knowledgeContext: knowledgeContext // NEW: Pass context to recursive call
                    });
                    const followUpMsg = {
                        role: "assistant",
                        content: followUpReply,
                        timestamp: new Date()
                    };
                    setMessages(prev => [...prev, followUpMsg]);


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


        // Auto-apply if applicable
        if (hasActionableContent(reply) && onApplyCode) {
            // This is the call that initiates the Plan Review Modal when the user clicks 'Apply to file'
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
        if (content.match(/```[\s\S]*?```/)) {
            return true;
        }
        
        // FIX: Explicitly check for an executable JSON array, which is the true actionable content for plan execution.
        // This regex detects the start of a tool call array: [ { "tool": "..."
        // The /s flag allows '.' to match newlines.
        if (content.match(/\[\s*\{[^}]*?"tool"\s*:\s*".*?"/s)) {
            return true;
        }


        return false;
    }


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

        // Use a concise message for tool actions that don't need raw content exposed
        let displayContent = message.content;
        if (isToolResult && displayContent.includes('Tool **')) {
            // This handles the generic suppressed message
        } else if (isToolResult && displayContent.includes('Tool ')) {
            // This attempts to clean up the content for better display in the log
            displayContent = displayContent.replace(/Tool '.*?' output:\n```json\n/, '').replace(/\n```/g, '');
            if (displayContent.length > 200) {
                displayContent = displayContent.substring(0, 200) + '... (truncated JSON)';
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
                    <button className="prompt-new-chat-btn" onClick={handleNewChat} title="New Chat">
                        ➕ New Chat
                    </button>
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