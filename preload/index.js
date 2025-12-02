// preload/index.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aesop", {
  project: {
    getRoot: () => ipcRenderer.invoke("project:getRoot"),
    openFolder: () => ipcRenderer.invoke("project:openFolder"),
  },

  fs: {
    readDir: (relPath) => ipcRenderer.invoke("fs:readDir", relPath),
    readFile: (relPath) => ipcRenderer.invoke("fs:readFile", relPath),
    writeFile: (relPath, content) =>
      ipcRenderer.invoke("fs:writeFile", relPath, content),
    newFile: (relPath) => ipcRenderer.invoke("fs:newFile", relPath),
    newFolder: (relPath) => ipcRenderer.invoke("fs:newFolder", relPath),
  },

  git: {
    status: () => ipcRenderer.invoke("git:status"),
    commit: (message) => ipcRenderer.invoke("git:commit", message),
    push: () => ipcRenderer.invoke("git:push"),
    pull: () => ipcRenderer.invoke("git:pull"),
  },

    prompt: {
    send: (promptText, options = {}) =>
      ipcRenderer.invoke("prompt:send", {
        prompt: promptText,
        fileContext: options.fileContext || null,
        cursor: options.cursor || null,
      }),
  },

  supabase: {
    test: () => ipcRenderer.invoke("supabase:test"),
  },
});
