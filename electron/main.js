const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const mammoth = require('mammoth');
const { runSimpleAgent } = require('./agent.js');
const db = require('./database.js');

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

app.whenReady().then(() => {
  // Initialize database on startup
  db.getDatabase();
  console.log('Database initialized');
  
  createWindow();
});

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
    console.log('Loading documents from:', folderPath);
    const files = await fs.readdir(folderPath);
    console.log('All files:', files);
    
    // Support multiple file types: .md, .txt, .docx, .doc
    const supportedFiles = files.filter(file => {
      const ext = file.toLowerCase();
      return ext.endsWith('.md') || ext.endsWith('.txt') || ext.endsWith('.docx') || ext.endsWith('.doc');
    });
    console.log('Supported files:', supportedFiles);
    
    const documents = await Promise.all(
      supportedFiles.map(async (filename) => {
        const filePath = path.join(folderPath, filename);
        let content = '';
        
        try {
          const lowerFilename = filename.toLowerCase();
          
          if (lowerFilename.endsWith('.md') || lowerFilename.endsWith('.txt')) {
            // Plain text files - read directly
            content = await fs.readFile(filePath, 'utf-8');
          } else if (lowerFilename.endsWith('.docx')) {
            // Word .docx files - use mammoth to extract text
            const result = await mammoth.extractRawText({ path: filePath });
            content = result.value;
          } else if (lowerFilename.endsWith('.doc')) {
            // Old Word .doc files - just show a message (mammoth doesn't support .doc)
            content = `# ${filename}\n\nOld .doc format is not supported. Please convert to .docx or .txt format.\n\nYou can edit this file here and it will be saved as plain text.`;
          }
          
          const stats = await fs.stat(filePath);
          
          return {
            name: filename,
            path: filePath,
            content,
            modified: stats.mtime,
          };
        } catch (error) {
          console.error(`Error reading file ${filename}:`, error);
          return null;
        }
      })
    );
    
    // Filter out any failed reads
    const validDocuments = documents.filter(doc => doc !== null);
    
    console.log('Loaded documents:', validDocuments);
    return validDocuments;
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
    // Add .txt extension if no extension provided
    if (!filename.includes('.')) {
      filename += '.txt';
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

// Chat with AI using LangChain + Ollama
ipcMain.handle('chat', async (event, message, context) => {
  try {
    console.log('Chat message:', message);
    console.log('Context:', context);
    
    // Generate thread ID if not provided
    const threadId = context.threadId || `thread_${Date.now()}`;
    const projectPath = context.projectPath || 'no-project';
    
    // Save user message to database
    db.saveMessage(projectPath, threadId, 'user', message);
    
    const response = await runSimpleAgent(message, context);
    
    // Save agent response to database
    db.saveMessage(projectPath, threadId, 'agent', response);
    
    console.log('Agent response:', response);
    
    return {
      response: response,
      threadId: threadId,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('Error in chat:', error);
    
    if (error.message?.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
      return {
        response: "⚠️ Could not connect to Ollama. Please make sure:\n1. Ollama is installed (https://ollama.ai)\n2. Ollama is running (run 'ollama serve' in terminal)\n3. Try running 'ollama pull llama3.1' to download the model",
        timestamp: new Date(),
      };
    }
    
    return {
      response: `Error: ${error.message || 'Failed to get AI response.'}`,
      timestamp: new Date(),
    };
  }
});

// Get recent projects
ipcMain.handle('get-recent-projects', async () => {
  try {
    return db.getRecentProjects(10);
  } catch (error) {
    console.error('Error getting recent projects:', error);
    return [];
  }
});

// Add/update recent project
ipcMain.handle('add-recent-project', async (event, projectId, name, projectPath) => {
  try {
    db.addRecentProject(projectId, name, projectPath);
    db.updateProjectLastOpened(projectPath);
    return { success: true };
  } catch (error) {
    console.error('Error adding recent project:', error);
    throw error;
  }
});

// Get conversation history
ipcMain.handle('get-conversation-history', async (event, threadId) => {
  try {
    return db.getConversationHistory(threadId, 50);
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return [];
  }
});

// Get project conversations
ipcMain.handle('get-project-conversations', async (event, projectPath) => {
  try {
    return db.getProjectConversations(projectPath);
  } catch (error) {
    console.error('Error getting project conversations:', error);
    return [];
  }
});

// Preferences
ipcMain.handle('get-preference', async (event, key, defaultValue) => {
  try {
    return db.getPreference(key, defaultValue);
  } catch (error) {
    console.error('Error getting preference:', error);
    return defaultValue;
  }
});

ipcMain.handle('set-preference', async (event, key, value) => {
  try {
    db.setPreference(key, value);
    return { success: true };
  } catch (error) {
    console.error('Error setting preference:', error);
    throw error;
  }
});