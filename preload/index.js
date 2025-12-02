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
    commit: (message) => ipcRenderer.invoke("git:commit", { message }),
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
