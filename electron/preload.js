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
  
  // Database - Recent projects
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
  addRecentProject: (projectId, name, projectPath) => ipcRenderer.invoke('add-recent-project', projectId, name, projectPath),
  
  // Database - Conversations
  getConversationHistory: (threadId) => ipcRenderer.invoke('get-conversation-history', threadId),
  getProjectConversations: (projectPath) => ipcRenderer.invoke('get-project-conversations', projectPath),
  
  // Database - Preferences
  getPreference: (key, defaultValue) => ipcRenderer.invoke('get-preference', key, defaultValue),
  setPreference: (key, value) => ipcRenderer.invoke('set-preference', key, value),
});