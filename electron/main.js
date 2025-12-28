const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // In development, load from Vite dev server
  // In production, load the built files
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

// Select a project folder
ipcMain.handle('select-project-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Project Folder',
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
});

// List all markdown files in a folder
ipcMain.handle('load-documents', async (event, folderPath) => {
  try {
    const files = await fs.readdir(folderPath);
    const mdFiles = files.filter(file => file.endsWith('.md'));
    
    const documents = await Promise.all(
      mdFiles.map(async (filename) => {
        const filePath = path.join(folderPath, filename);
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);
        
        return {
          name: filename,
          path: filePath,
          content,
          modified: stats.mtime,
        };
      })
    );
    
    return documents;
  } catch (error) {
    console.error('Error loading documents:', error);
    throw error;
  }
});

// Save a document
ipcMain.handle('save-document', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Error saving document:', error);
    throw error;
  }
});

// Create a new document
ipcMain.handle('create-document', async (event, folderPath, filename) => {
  try {
    if (!filename.endsWith('.md')) {
      filename += '.md';
    }
    
    const filePath = path.join(folderPath, filename);
    await fs.writeFile(filePath, '', 'utf-8');
    
    return {
      name: filename,
      path: filePath,
      content: '',
      modified: new Date(),
    };
  } catch (error) {
    console.error('Error creating document:', error);
    throw error;
  }
});

// Chat with AI (placeholder - you'll add LangGraph here)
ipcMain.handle('chat', async (event, message, context) => {
  try {
    // TODO: Implement LangGraph/Ollama integration here
    // For now, return a placeholder response
    
    console.log('Chat message:', message);
    console.log('Context files:', context?.files?.length || 0);
    
    return {
      response: "AI response will go here once you integrate LangGraph/Ollama",
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('Error in chat:', error);
    throw error;
  }
});