// preload/index.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aesop", {
    project: {
        getRoot: () => ipcRenderer.invoke("project:getRoot"),
        openFolder: () => ipcRenderer.invoke("project:openFolder"),
    },

    fs: {
        readDir: (dir) => ipcRenderer.invoke("fs:readDir", { dir }),
        readFile: (filePath) => ipcRenderer.invoke("fs:readFile", { filePath }),
        writeFile: (filePath, content) =>
            ipcRenderer.invoke("fs:writeFile", { filePath, content }),
        newFile: (filePath) => ipcRenderer.invoke("fs:newFile", { filePath }),
        newFolder: (dir) => ipcRenderer.invoke("fs:newFolder", { dir }),
    },

    git: {
        status: () => ipcRenderer.invoke("git:status"),
        commit: (message) => ipcRenderer.invoke("git:commit", message),
        push: () => ipcRenderer.invoke("git:push"),
        pull: () => ipcRenderer.invoke("git:pull"),
        // NEW IPC: Phase 5.1
        diff: () => ipcRenderer.invoke("git:diff"),
        applyPatch: (patchContent) => ipcRenderer.invoke("git:applyPatch", patchContent),
    },

    prompt: {
        send: (promptText, options = {}) =>
            ipcRenderer.invoke("prompt:send", {
                prompt: promptText,                         // user text
                systemPrompt: options.systemPrompt || "",   // global agent rules
                fileContext: options.fileContext || null,   // open file content
                cursor: options.cursor || null,             // future use
            }),
    },

    supabase: {
        test: () => ipcRenderer.invoke("supabase:test"),
    },
    
    tools: {
        // Expose codebase search handlers
        searchCode: (query, options) => ipcRenderer.invoke("codebase:search", { query, options }),
        findFiles: (pattern) => ipcRenderer.invoke("codebase:findFiles", { pattern }),

        // Expose terminal command handlers
        runCommand: (command) => ipcRenderer.invoke("cmd:run", command),
        getCommandOutput: (id) => ipcRenderer.invoke("cmd:getOutput", id),
        killCommand: (id) => ipcRenderer.invoke("cmd:kill", id),
    },

    // Phase 4.1: History management
    history: {
        save: (messages) => ipcRenderer.invoke("history:save", messages),
        load: () => ipcRenderer.invoke("history:load"),
    },
    
    // Phase 4.2: Memory management
    memory: {
        save: (knowledge) => ipcRenderer.invoke("memory:save", knowledge),
        load: () => ipcRenderer.invoke("memory:load"),
    }
});