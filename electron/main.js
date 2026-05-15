const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fsSync = require('fs');
const fs = fsSync.promises;
const mammoth = require('mammoth');

function loadEnvFile(filePath) {
  if (!fsSync.existsSync(filePath)) return;

  const env = fsSync.readFileSync(filePath, 'utf-8');
  for (const line of env.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(__dirname, '../.env'));

const { runAgent } = require('./agent/index.js');
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

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
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

// Helper function to convert plain text to HTML
function textToHtml(text) {
  if (!text) return '';
  
  // Split by newlines and wrap each paragraph in <p> tags
  const paragraphs = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => `<p>${line}</p>`)
    .join('');
  
  return paragraphs || '<p><br></p>';
}

// IPC Handlers

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

ipcMain.handle('load-documents', async (event, folderPath) => {
  try {
    console.log('Loading documents from:', folderPath);
    const files = await fs.readdir(folderPath);
    console.log('All files:', files);
    
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
            const textContent = await fs.readFile(filePath, 'utf-8');
            content = textToHtml(textContent);
          } else if (lowerFilename.endsWith('.docx')) {
            try {
              // Use mammoth to convert to HTML instead of plain text
              const result = await mammoth.convertToHtml({ path: filePath });
              content = result.value;
              
              // Log any warnings from mammoth
              if (result.messages.length > 0) {
                console.log(`Mammoth warnings for ${filename}:`, result.messages);
              }
            } catch (docxError) {
              console.error(`Error parsing .docx file ${filename}:`, docxError.message);
              // If .docx parsing fails, try reading as plain text
              try {
                const textContent = await fs.readFile(filePath, 'utf-8');
                content = textToHtml(`⚠️ Warning: This .docx file appears to be corrupted or invalid.\n\nAttempting to display raw content:\n\n${textContent}`);
              } catch (textError) {
                content = textToHtml(`❌ Error: Could not read ${filename}\n\nThis file appears to be corrupted or not a valid .docx file.\n\nPlease try:\n1. Opening it in Microsoft Word and re-saving it\n2. Converting it to .txt format\n3. Creating a new document and copying the content`);
              }
            }
          } else if (lowerFilename.endsWith('.doc')) {
            content = textToHtml(`# ${filename}\n\nOld .doc format is not supported. Please convert to .docx or .txt format.\n\nYou can edit this file here and it will be saved as plain text.`);
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
    
    const validDocuments = documents.filter(doc => doc !== null);
    console.log('Loaded documents:', validDocuments.length);
    return validDocuments;
  } catch (error) {
    console.error('Error loading documents:', error);
    throw error;
  }
});

ipcMain.handle('save-document', async (event, filePath, content) => {
  try {
    // Convert HTML back to plain text for saving
    // This strips all HTML tags
    const plainText = content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
    
    await fs.writeFile(filePath, plainText, 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Error saving document:', error);
    throw error;
  }
});

ipcMain.handle('create-document', async (event, folderPath, filename) => {
  try {
    if (!filename.includes('.')) {
      filename += '.txt';
    }
    
    const filePath = path.join(folderPath, filename);
    await fs.writeFile(filePath, '', 'utf-8');
    
    return {
      name: filename,
      path: filePath,
      content: '<p><br></p>', // Start with empty HTML paragraph
      modified: new Date(),
    };
  } catch (error) {
    console.error('Error creating document:', error);
    throw error;
  }
});

// Chat with AI - autosave ensures file is always current
ipcMain.handle('chat', async (event, message, context) => {
  try {
    console.log('Chat message:', message);
    
    const userId = context.userId || 'default-user';
    const projectPath = context.projectPath || '';
    const activeDocumentPath = context.currentDocument?.filePath || context.currentDocument?.path || '';
    const threadId = context.threadId || null;
    
    console.log('Agent context:', {
      userId,
      projectPath,
      activeDocumentPath,
      threadId
    });
    
    const result = await runAgent({
      message,
      userId,
      projectPath,
      activeDocumentPath,
      threadId
    });
    
    return result;
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

ipcMain.handle('get-recent-projects', async () => {
  try {
    return db.getRecentProjects(10);
  } catch (error) {
    console.error('Error getting recent projects:', error);
    return [];
  }
});

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

ipcMain.handle('get-conversation-history', async (event, threadId) => {
  try {
    return db.getConversationHistory(threadId, 50);
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return [];
  }
});

ipcMain.handle('get-project-conversations', async (event, projectPath) => {
  try {
    return db.getProjectConversations(projectPath);
  } catch (error) {
    console.error('Error getting project conversations:', error);
    return [];
  }
});

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
