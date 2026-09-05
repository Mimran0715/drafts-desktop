const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fsSync = require('fs');
const fs = fsSync.promises;
const mammoth = require('mammoth');
const { Document, Packer, Paragraph, TextRun } = require('docx');

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

const { runAgent } = require('./ai/index.js');
const { getChromaStatus } = require('./ai/vectorStore.js');
const { startChromaServer, stopChromaServer } = require('./ai/chromaServer.js');
const db = require('./database.js');

let mainWindow;
const DEFAULT_OLLAMA_MODEL = 'llama-writer';
const SUPPORTED_OLLAMA_MODELS = ['llama-writer', 'llama3.1'];

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

app.whenReady().then(async () => {
  db.getDatabase();
  console.log('Database initialized');

  try {
    const chromaResult = await startChromaServer(app);
    if (chromaResult.started) {
      console.log('Chroma vector store ready');
    } else if (chromaResult.alreadyRunning) {
      console.log('Using existing Chroma server');
    } else if (chromaResult.reason === 'auto-start-disabled') {
      console.log('Expecting an external Chroma server');
    } else if (chromaResult.error) {
      const fallbackMessage = process.env.HASH_KEYWORD_FALLBACK_ENABLED === 'true'
        ? 'keyword search fallback will be used'
        : 'hybrid RAG will be unavailable because fallback is disabled';
      console.warn(`Chroma unavailable (${chromaResult.error}); ${fallbackMessage}`);
    }
  } catch (error) {
    console.warn('Failed to start Chroma server:', error.message);
  }

  createWindow();
});

app.on('before-quit', () => {
  stopChromaServer();
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

function invalidDocxHtml(filename) {
  return textToHtml(`⚠️ ${filename} is empty or not a valid .docx file yet.\n\nIf this is a new file, start writing and autosave will repair it as a real Word document. If it came from another app, open it in Word or Pages and re-save it as .docx.`);
}

function htmlToPlainText(content) {
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

async function writeDocx(filePath, plainText) {
  const lines = plainText.split(/\r?\n/);
  const doc = new Document({
    sections: [{
      properties: {},
      children: lines.length > 0
        ? lines.map(line => new Paragraph({
            children: [new TextRun(line || ' ')],
          }))
        : [new Paragraph({ children: [new TextRun(' ')] })],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(filePath, buffer);
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

const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.docx', '.doc']);

function isHidden(filename) {
  return filename.startsWith('.');
}

function isSupportedDocument(filename) {
  if (isHidden(filename)) return false;
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

ipcMain.handle('load-documents', async (event, folderPath) => {
  try {
    console.log('Loading documents from:', folderPath);
    const files = await fs.readdir(folderPath);
    console.log('All files:', files);

    const supportedFiles = files.filter(isSupportedDocument);
    console.log('Supported files:', supportedFiles);

    const documents = await Promise.all(
      supportedFiles.map(async (filename) => {
        const filePath = path.join(folderPath, filename);
        let content = '';

        try {
          const stats = await fs.stat(filePath);
          if (stats.isDirectory()) return null;

          const ext = path.extname(filename).toLowerCase();

          if (ext === '.md' || ext === '.txt') {
            const textContent = await fs.readFile(filePath, 'utf-8');
            content = textToHtml(textContent);
          } else if (ext === '.docx') {
            if (stats.size === 0) {
              console.warn(`Skipping empty .docx file ${filename}`);
              content = invalidDocxHtml(filename);
            } else {
              try {
                const result = await mammoth.convertToHtml({ path: filePath });
                content = result.value;
                if (result.messages.length > 0) {
                  console.log(`Mammoth warnings for ${filename}:`, result.messages);
                }
              } catch (docxError) {
                console.error(`Error parsing .docx file ${filename}:`, docxError.message);
                content = invalidDocxHtml(filename);
              }
            }
          } else if (ext === '.doc') {
            content = textToHtml(`# ${filename}\n\nOld .doc format is not supported. Please convert to .docx or .txt format.\n\nYou can edit this file here and it will be saved as plain text.`);
          }

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
    const plainText = htmlToPlainText(content);
    const lowerFilePath = filePath.toLowerCase();

    if (lowerFilePath.endsWith('.docx')) {
      await writeDocx(filePath, plainText);
    } else {
      await fs.writeFile(filePath, plainText, 'utf-8');
    }

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
    if (filename.toLowerCase().endsWith('.docx')) {
      await writeDocx(filePath, '');
    } else {
      await fs.writeFile(filePath, '', 'utf-8');
    }
    
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
      threadId,
      liveContent: context.liveContent || null,
      ragEnabled: !!context.ragEnabled,
      modelName: context.modelName || DEFAULT_OLLAMA_MODEL
    });
    
    return result;
  } catch (error) {
    console.error('Error in chat:', error);
    
    if (error.message?.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
      return {
        response: "⚠️ Could not connect to Ollama. Please make sure:\n1. Ollama is installed (https://ollama.ai)\n2. Ollama is running (run 'ollama serve' in terminal)\n3. The 'llama-writer' model is available in Ollama",
        timestamp: new Date(),
      };
    }
    
    return {
      response: `Error: ${error.message || 'Failed to get AI response.'}`,
      timestamp: new Date(),
    };
  }
});

ipcMain.handle('chat-stream', async (event, message, context, streamId) => {
  try {
    console.log('Chat message:', message);
    
    const userId = context.userId || 'default-user';
    const projectPath = context.projectPath || '';
    const activeDocumentPath = context.currentDocument?.filePath || context.currentDocument?.path || '';
    const threadId = context.threadId || null;
    const safeStreamId = streamId || `stream_${Date.now()}`;
    
    console.log('Agent context:', {
      userId,
      projectPath,
      activeDocumentPath,
      threadId,
      streamId: safeStreamId
    });
    
    const result = await runAgent({
      message,
      userId,
      projectPath,
      activeDocumentPath,
      threadId,
      liveContent: context.liveContent || null,
      ragEnabled: !!context.ragEnabled,
      modelName: context.modelName || DEFAULT_OLLAMA_MODEL,
      onToken: (chunk) => {
        if (chunk) {
          event.sender.send('chat-stream-chunk', {
            streamId: safeStreamId,
            chunk
          });
        }
      }
    });
    
    return result;
  } catch (error) {
    console.error('Error in streaming chat:', error);
    
    if (error.message?.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
      return {
        response: "⚠️ Could not connect to Ollama. Please make sure:\n1. Ollama is installed (https://ollama.ai)\n2. Ollama is running (run 'ollama serve' in terminal)\n3. The 'llama-writer' model is available in Ollama",
        timestamp: new Date(),
      };
    }
    
    return {
      response: `Error: ${error.message || 'Failed to get AI response.'}`,
      timestamp: new Date(),
    };
  }
});

ipcMain.handle('get-ollama-models', async () => {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags');
    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`);
    }

    const data = await response.json();
    const installedModels = Array.isArray(data.models)
      ? data.models.map(model => model.name).filter(Boolean)
      : [];
    const models = SUPPORTED_OLLAMA_MODELS.filter(model => (
      installedModels.some(installed => installed === model || installed === `${model}:latest`)
    ));

    return models.length > 0 ? models : SUPPORTED_OLLAMA_MODELS;
  } catch (error) {
    console.error('Error loading Ollama models:', error.message);
    return SUPPORTED_OLLAMA_MODELS;
  }
});

ipcMain.handle('get-chroma-status', async () => {
  return getChromaStatus();
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
