const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('supabase', {
  getProjects: () => ipcRenderer.invoke('supabase:getProjects'),
  createProject: (name) => ipcRenderer.invoke('supabase:createProject', name),
  rpc: (fn, params) => ipcRenderer.invoke('supabase:rpc', { fn, params })
});
