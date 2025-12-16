// src/renderer/components/PromptPanel.jsx
import React, { useState, useRef, useEffect } from "react";
import "../styles/prompt.css";
import { askGemini, askGeminiStream } from "../lib/gemini";
import { SYSTEM_PROMPT } from "../lib/ai/systemPrompt";
import { buildFileContext } from "../lib/codebase/context";
import parseToolCalls from "../lib/ai/toolParser";
import { executeTool } from "../lib/tools/framework";
import ContextMenu from "./ContextMenu";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Mermaid from './Mermaid';
import ThinkingBlock from './ThinkingBlock';
import '../styles/markdown.css';


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
    const messagesContainerRef = useRef(null); // <-- ADDED REF

    const [promptContextMenu, setPromptContextMenu] = useState(null);

    // NEW STATE: For Project Knowledge (Local)
    const [projectKnowledge, setProjectKnowledge] = useState({});

    // 🌟 NEW STATE: For Global Knowledge (Supabase/Cloud)
    const [globalKnowledge, setGlobalKnowledge] = useState({});

    // Phase 16: Live Web Search mode (off | auto | always)
    const [searchMode, setSearchMode] = useState('auto'); // Default: auto (smart mode)

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
    // PHASE 4.2: PROJECT MEMORY LOAD (Local .aesop)
    // -----------------------------------------------------------

    // Load project knowledge on initial mount and whenever rootPath changes
    useEffect(() => {
        async function loadKnowledge() {
            if (!rootPath) {
                setProjectKnowledge({});
                return;
            }
            try {
                // Assuming window.aesop.memory.load() is the local project memory
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
    // 🌟 NEW EFFECT: GLOBAL MEMORY LOAD (Cloud Supabase)
    // -----------------------------------------------------------

    // Load global knowledge once on mount
    useEffect(() => {
        async function loadGlobalKnowledge() {
            try {
                // Assuming window.aesop.globalMemory.load() calls Supabase
                const result = await window.aesop.globalMemory.load();
                if (result.ok && result.knowledge) {
                    setGlobalKnowledge(result.knowledge);
                } else {
                    setGlobalKnowledge({});
                }
            } catch (err) {
                console.error("Failed to load global developer insights:", err);
                setGlobalKnowledge({});
            }
        }

        loadGlobalKnowledge();
    }, []); // Empty dependency array means this runs only once on component mount


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
            // Check if the user wants to save to GLOBAL memory (not yet implemented as a tool, but we can intercept)
            // For now, assume this function only saves to local project knowledge (projectKnowledge)
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

    function handlePromptContextMenu(e) {
        // CRITICAL FIX: Always prevent the default context menu to ensure our custom one is reliable.
        e.preventDefault();

        const textarea = inputRef.current;
        // Determine if text is selected to enable Cut/Copy
        const hasSelection = textarea && textarea.selectionStart !== textarea.selectionEnd;

        const items = [
            {
                label: 'Cut',
                icon: '✂️',
                shortcut: 'Ctrl+X',
                disabled: !hasSelection,
                onClick: () => {
                    document.execCommand('cut');
                }
            },
            {
                label: 'Copy',
                icon: '📋',
                shortcut: 'Ctrl+C',
                disabled: !hasSelection,
                onClick: () => {
                    document.execCommand('copy');
                }
            },
            {
                label: 'Paste',
                icon: '📄',
                shortcut: 'Ctrl+V',
                onClick: () => {
                    document.execCommand('paste');
                }
            },
            { separator: true },
            {
                label: 'Clear',
                icon: '🗑️',
                onClick: () => {
                    setInput('');
                }
            },
            {
                label: 'Select All',
                icon: '🔲',
                shortcut: 'Ctrl+A',
                onClick: () => {
                    if (textarea) {
                        textarea.select();
                    }
                }
            }
        ];

        setPromptContextMenu({ x: e.clientX, y: e.clientY, items });
    }

    // <-- ADDED MESSAGE CONTEXT HANDLER -->
    function handleMessageContextMenu(e) {
        // CRITICAL FIX: Always prevent the default context menu
        e.preventDefault();

        // This targets the text that the user might have selected in the message content
        const selectedText = window.getSelection().toString();
        const hasSelection = selectedText.length > 0;

        const items = [
            {
                label: 'Copy Selected Text',
                icon: '📋',
                disabled: !hasSelection,
                onClick: () => {
                    // Rely on the browser's native copy command for selected text
                    document.execCommand('copy');
                }
            }
        ];

        setPromptContextMenu({ x: e.clientX, y: e.clientY, items });
    }
    // <-- END MESSAGE CONTEXT HANDLER -->


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
            knowledgeContext = JSON.stringify(projectKnowledge, null, 2);
        }

        // 🌟 NEW: Serialize global knowledge for AI context
        let globalKnowledgeContext = "";
        if (globalKnowledge && Object.keys(globalKnowledge).length > 0) {
            globalKnowledgeContext = JSON.stringify(globalKnowledge, null, 2);
        }

        // Phase 16: Determine if search should be enabled based on mode
        let enableSearch = false;
        if (searchMode === 'always') {
            enableSearch = true;
            console.log('[Search Mode] Always on - search enabled');
        } else if (searchMode === 'auto') {
            // Smart mode: Check RAG first, enable search only if knowledge gap
            if (!window.aesop?.ingestion?.query) {
                console.warn('[Auto Search Mode] RAG API not available, enabling search');
                enableSearch = true;
            } else {
                try {
                    const ragResults = await window.aesop.ingestion.query(userPrompt);
                    // Enable search if RAG has < 3 relevant results
                    enableSearch = !ragResults.ok || !ragResults.results || ragResults.results.length < 3;
                    console.log(`[Auto Search Mode] RAG results: ${ragResults.results?.length || 0}, enabling search: ${enableSearch}`);
                } catch (err) {
                    console.warn('[Auto Search Mode] RAG query failed, enabling search as fallback:', err.message);
                    enableSearch = true;
                }
            }
        } else {
            console.log('[Search Mode] Off - search disabled');
        }
        // If searchMode === 'off', enableSearch stays false





        // 1. Send to AI (Streaming)
        // Create a placeholder message for the AI response
        const placeholderId = Date.now().toString();
        const initialAiMessage = {
            role: "assistant",
            content: "", // Start empty
            timestamp: new Date(),
            id: placeholderId
        };
        setMessages((prev) => [...prev, initialAiMessage]);

        let reply = "";
        try {
            reply = await askGeminiStream(userPrompt, {
                systemPrompt: SYSTEM_PROMPT,
                fileContext,
                // Pass the entire history array for continuous context (Phase 4.1)
                history: history,
                // NEW: Pass both knowledge contexts
                knowledgeContext: knowledgeContext,
                globalKnowledgeContext: globalKnowledgeContext, // 🌟 NEW PROP
                enableSearch: enableSearch // Phase 16: Computed from searchMode
            }, (chunk, accumulated) => {
                // Update the last message (which is our placeholder) with new content
                setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant') {
                        lastMsg.content = accumulated;
                    }
                    return newMessages;
                });
            });
        } catch (streamErr) {
            console.error("Streaming failed:", streamErr);
            reply = "Error during streaming: " + streamErr.message;
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                lastMsg.content = reply;
                return newMessages;
            });
        }


        // 2. Check for tool calls
        const toolCalls = parseToolCalls(reply);
        if (toolCalls.length > 0) {

            // Create a "Thinking" block message to group all tool executions
            const thinkingMsg = {
                role: "thinking", // Custom role for our component
                content: "Processing tool calls...",
                steps: [], // Will populate with execution steps
                isFinished: false,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, thinkingMsg]);

            const updateThinkingStep = (stepIndex, update) => {
                setMessages(prev => {
                    const newMessages = [...prev];
                    // Find our thinking message (it should be the last one or close to it)
                    // We search from the end
                    for (let i = newMessages.length - 1; i >= 0; i--) {
                        if (newMessages[i].role === 'thinking' && !newMessages[i].isFinished) {
                            const steps = [...newMessages[i].steps];
                            steps[stepIndex] = { ...steps[stepIndex], ...update };
                            newMessages[i] = { ...newMessages[i], steps };
                            break;
                        }
                    }
                    return newMessages;
                });
            };

            const addThinkingStep = (step) => {
                setMessages(prev => {
                    const newMessages = [...prev];
                    for (let i = newMessages.length - 1; i >= 0; i--) {
                        if (newMessages[i].role === 'thinking' && !newMessages[i].isFinished) {
                            const steps = [...newMessages[i].steps, step];
                            newMessages[i] = { ...newMessages[i], steps };
                            break;
                        }
                    }
                    return newMessages;
                });
                return 0; // In a real implementation we might need the index, but for now we just append
            };

            const finishThinking = () => {
                setMessages(prev => {
                    const newMessages = [...prev];
                    for (let i = newMessages.length - 1; i >= 0; i--) {
                        if (newMessages[i].role === 'thinking' && !newMessages[i].isFinished) {
                            newMessages[i] = { ...newMessages[i], isFinished: true };
                            break;
                        }
                    }
                    return newMessages;
                });
            }


            // Execute tools
            // We'll collect results to send back to AI
            const toolResults = [];

            for (let i = 0; i < toolCalls.length; i++) {
                const call = toolCalls[i];

                // Add pending step
                // Ideally we get the index from the state, but since setState is async, we can just rely on the loop index + accumulated steps if we were doing parallel.
                // Since this loop is sequential await, the 'steps' array length will match 'i'.
                addThinkingStep({
                    tool: call.tool,
                    description: `Executing ${call.tool}...`,
                    status: 'pending',
                    result: null
                });

                try {
                    const result = await executeTool(call.tool, call.params);

                    // Auto-open file if created or read (keeping existing logic)
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
                            setTimeout(() => onApplyCode(`AesopIDE open file: ${path}`), 100);
                        }
                    }

                    // Update step to success
                    updateThinkingStep(i, {
                        status: 'success',
                        description: `Executed ${call.tool}`,
                        result: result // Store result for display in the block
                    });

                    // Add to results for AI context
                    toolResults.push({
                        role: "tool_result",
                        content: `Tool '${call.tool}' output:\n${JSON.stringify(result)}`, // Keep it compact for prompt
                        timestamp: new Date()
                    });

                } catch (err) {
                    // Update step to error
                    updateThinkingStep(i, {
                        status: 'error',
                        description: `Failed: ${err.message}`,
                        result: { error: err.message }
                    });

                    toolResults.push({
                        role: "tool_error",
                        content: `Tool '${call.tool}' failed: ${err.message}`,
                        timestamp: new Date()
                    });
                }
            }

            finishThinking();

            // 3. Send results back to AI (recursive)
            // We combine all tool results into one prompt update
            if (toolResults.length > 0) {
                const followUpPrompt = `Tools executed. Results:\n${JSON.stringify(toolResults.map(r => r.content), null, 2)}\n\nPlease continue.`;

                // Create placeholder for follow-up
                const followUpPlaceholder = {
                    role: "assistant",
                    content: "",
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, followUpPlaceholder]);

                const followUpReply = await askGeminiStream(followUpPrompt, {
                    systemPrompt: SYSTEM_PROMPT,
                    fileContext,
                    history: [...history, { role: "assistant", content: reply }, ...toolResults], // Add all tool results to history
                    knowledgeContext: knowledgeContext,
                    globalKnowledgeContext: globalKnowledgeContext
                }, (chunk, accumulated) => {
                    setMessages((prev) => {
                        const newMessages = [...prev];
                        const lastMsg = newMessages[newMessages.length - 1];
                        if (lastMsg && lastMsg.role === 'assistant') {
                            lastMsg.content = accumulated;
                        }
                        return newMessages;
                    });
                });
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


    // Replaced renderMessageContent logic with ReactMarkdown in renderMessage

    function renderMessage(message, index) {
        if (!message) return null;

        // Custom rendering for "Thinking" blocks
        if (message.role === 'thinking') {
            return (
                <ThinkingBlock
                    key={index}
                    steps={message.steps}
                    isFinished={message.isFinished}
                />
            );
        }

        const isTool = message.role === "tool";
        const isToolResult = message.role === "tool_result";
        const isToolError = message.role === "tool_error";
        const isUser = message.role === "user";

        // Cleanup deprecated legacy logic for raw tool display
        // ...

        let roleLabel = "🤖 Assistant";
        if (isUser) roleLabel = "👤 You";
        if (isToolResult) roleLabel = "📝 Result";
        if (isToolError) roleLabel = "⚠️ Error";
        if (isTool) roleLabel = "🛠️ Tool";

        // Define displayContent to fix reference error
        let displayContent = message.content;

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
                    className="message-content markdown-body" // Added markdown-body class
                    onDoubleClick={
                        message.role === "assistant" || message.role === "tool_result"
                            ? () => copyToClipboard(message.content)
                            : undefined
                    }
                >
                    {isTool ? (
                        <span style={{ fontStyle: 'italic' }}>{displayContent}</span>
                    ) : (
                        <ReactMarkdown
                            children={displayContent}
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ node, inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '')
                                    const language = match ? match[1] : ''

                                    if (!inline && language === 'mermaid') {
                                        return <Mermaid chart={String(children).replace(/\n$/, '')} />
                                    }

                                    return !inline && match ? (
                                        <pre className={className}>
                                            <code className={className} {...props}>
                                                {children}
                                            </code>
                                        </pre>
                                    ) : (
                                        <code className={className} {...props}>
                                            {children}
                                        </code>
                                    )
                                },
                                // Intercept links to handle file clicks
                                a({ node, children, href, ...props }) {
                                    // If it looks like a file path, handle it
                                    // This regex is basic, might need refinement based on context
                                    // But markdown links to files usually look like [label](path)
                                    // We can just rely on the onClick behavior
                                    return (
                                        <a href={href} onClick={(e) => {
                                            e.preventDefault();
                                            // Check if it's a file path we can open
                                            // For now simpler to just let it be a link or 
                                            // if onApplyCode handles "open file" we could try that
                                            // But for safety let's leave default behavior or implement
                                            // explicit file link handling if needed.
                                            // The previous regex parsed plain text paths. 
                                            // ReactMarkdown won't auto-linkify plain text paths unless formatted as links.
                                            // We might lose "auto-linkification" of plain text paths with this change,
                                            // but we gain proper markdown rendering.
                                            // To restore file clicking for plain text, we'd need a remark plugin or processing.
                                            // For now, assume users/AI use proper links or file paths are in code blocks.
                                            if (onApplyCode && href && !href.startsWith('http')) {
                                                onApplyCode(`AesopIDE open file: ${href}`);
                                            } else if (href && href.startsWith('http')) {
                                                window.open(href, '_blank');
                                            }
                                        }} {...props}>
                                            {children}
                                        </a>
                                    )
                                }
                            }}
                        />
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
                    <label className="search-mode-selector" title="Live search mode">
                        🔍
                        <select value={searchMode} onChange={(e) => setSearchMode(e.target.value)}>
                            <option value="off">Off</option>
                            <option value="auto">Auto</option>
                            <option value="always">Always</option>
                        </select>
                    </label>
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


            <div
                className="prompt-messages scrollable"
                ref={messagesContainerRef} // <-- ATTACHED REF
                onContextMenu={handleMessageContextMenu} // <-- ATTACHED HANDLER
            >
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
                    onContextMenu={handlePromptContextMenu}
                    placeholder="Ask me anything. Use Shift Enter for a new line."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
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
            {promptContextMenu && (
                <ContextMenu
                    x={promptContextMenu.x}
                    y={promptContextMenu.y}
                    items={promptContextMenu.items}
                    onClose={() => setPromptContextMenu(null)}
                />
            )}
        </div>
    );
}