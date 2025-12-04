const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('supabase', {
  getProjects: () => ipcRenderer.invoke('supabase:getProjects'),
  createProject: (name) => ipcRenderer.invoke('supabase:createProject', name),
  rpc: (fn, params) => ipcRenderer.invoke('supabase:rpc', { fn, params })
});

contextBridge.exposeInMainWorld('aesop', {
  fs: {
    readDir: (path) => ipcRenderer.invoke('fs:readDir', path),
    readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path, content) => ipcRenderer.invoke('fs:writeFile', path, content),
    newFile: (path) => ipcRenderer.invoke('fs:newFile', path),
    newFolder: (path) => ipcRenderer.invoke('fs:newFolder', path),
    deleteFile: (path) => ipcRenderer.invoke('fs:deleteFile', path)
  }
});