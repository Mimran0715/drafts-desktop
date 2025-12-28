const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Project management
  selectProjectFolder: () => ipcRenderer.invoke('select-project-folder'),
  
  // Document management
  loadDocuments: (folderPath) => ipcRenderer.invoke('load-documents', folderPath),
  saveDocument: (filePath, content) => ipcRenderer.invoke('save-document', filePath, content),
  createDocument: (folderPath, filename) => ipcRenderer.invoke('create-document', folderPath, filename),
  
  // AI chat
  chat: (message, context) => ipcRenderer.invoke('chat', message, context),
});