// preload/index.js
const { contextBridge, ipcRenderer } = require("electron");

// Custom Context Bridge setup for AesopIDE
contextBridge.exposeInMainWorld("aesop", {
    // -----------------------------------------------------------
    // CORE FILESYSTEM API
    // -----------------------------------------------------------
    fs: {
        readFile: (arg) => ipcRenderer.invoke("fs:readFile", arg),
        writeFile: (arg1, arg2) => ipcRenderer.invoke("fs:writeFile", arg1, arg2),
        readDir: (arg) => ipcRenderer.invoke("fs:readDir", arg),
        newFile: (arg) => ipcRenderer.invoke("fs:newFile", arg),
        newFolder: (arg) => ipcRenderer.invoke("fs:newFolder", arg),
    },

    // -----------------------------------------------------------
    // CORE PROJECT/APP STATE
    // -----------------------------------------------------------
    project: {
        getRoot: () => ipcRenderer.invoke("project:getRoot"),
        openFolder: () => ipcRenderer.invoke("project:openFolder"),
    },
    
    // -----------------------------------------------------------
    // AI PROMPT/LLM
    // -----------------------------------------------------------
    prompt: {
        send: (payload, options) => ipcRenderer.invoke("prompt:send", payload, options),
    },

    // -----------------------------------------------------------
    // PHASE 4.1: CONVERSATION HISTORY
    // -----------------------------------------------------------
    history: {
        save: (messages) => ipcRenderer.invoke("history:save", messages),
        load: () => ipcRenderer.invoke("history:load"),
    },

    // -----------------------------------------------------------
    // PHASE 4.2: PROJECT MEMORY (Local)
    // -----------------------------------------------------------
    memory: {
        save: (knowledge) => ipcRenderer.invoke("memory:save", knowledge),
        load: () => ipcRenderer.invoke("memory:load"),
    },

    // -----------------------------------------------------------
    // PHASE 4.2: GLOBAL MEMORY (Supabase)
    // -----------------------------------------------------------
    globalMemory: {
        load: () => ipcRenderer.invoke("globalMemory:load"),
        save: (knowledge) => ipcRenderer.invoke("globalMemory:save", knowledge),
    },
    
    // -----------------------------------------------------------
    // 🌟 PHASE 6: DOCUMENT INGESTION (NEW) - ADDED FIX
    // -----------------------------------------------------------
    ingestion: {
        document: (content, source) => ipcRenderer.invoke("ingestion:document", { content, source }),
    },

    // -----------------------------------------------------------
    // PHASE 3.4 & 5: TOOLS & COMMANDS
    // -----------------------------------------------------------
    tools: {
        // Command Execution
        runCommand: (command) => ipcRenderer.invoke("cmd:run", command),
        getCommandOutput: (id) => ipcRenderer.invoke("cmd:getOutput", id),
        killCommand: (id) => ipcRenderer.invoke("cmd:kill", id),
        // Codebase Search
        searchCode: (query, options) => ipcRenderer.invoke("codebase:search", { query, options }),
        findFiles: (pattern) => ipcRenderer.invoke("codebase:findFiles", { pattern }),
    },

    // -----------------------------------------------------------
    // GIT & VERSION CONTROL
    // -----------------------------------------------------------
    git: {
        diff: () => ipcRenderer.invoke("git:diff"),
        applyPatch: (patchContent) => ipcRenderer.invoke("git:applyPatch", patchContent),
    },

    // -----------------------------------------------------------
    // SUPABASE
    // -----------------------------------------------------------
    supabase: {
        test: () => ipcRenderer.invoke("supabase:test"),
    },
});