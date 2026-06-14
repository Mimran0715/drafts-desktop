import { useState, useEffect, useRef } from 'react';
import { ThemeProvider } from './components/ThemeContext';
import PageLayout from './components/PageLayout';
import FilesSidebar from './components/FilesSidebar';
import DraftEditor from './components/DraftEditor';
import AgentChat from './components/AgentChat';
import InputModal from './components/InputModal';
import type { RichEditorHandle } from './components/RichTextEditor';
import './globals.css';

declare global {
  interface Window {
    electronAPI: {
      selectProjectFolder: () => Promise<string | null>;
      loadDocuments: (folderPath: string) => Promise<any[]>;
      saveDocument: (filePath: string, content: string) => Promise<any>;
      createDocument: (folderPath: string, filename: string) => Promise<any>;
      chat: (message: string, context: any) => Promise<any>;
      chatStream?: (message: string, context: any, streamId: string) => Promise<any>;
      onChatStreamChunk?: (callback: (payload: { streamId: string; chunk: string }) => void) => () => void;
      getOllamaModels?: () => Promise<string[]>;
      getRecentProjects: () => Promise<any[]>;
      addRecentProject: (projectId: string, name: string, projectPath: string) => Promise<any>;
      getConversationHistory: (threadId: string) => Promise<any[]>;
      getProjectConversations: (projectPath: string) => Promise<any[]>;
      getPreference: (key: string, defaultValue?: any) => Promise<any>;
      setPreference: (key: string, value: any) => Promise<any>;
    };
  }
}

interface Tab {
  id: string;
  title: string;
  content: string;
  filePath?: string;
  isDirty?: boolean;
}

interface Project {
  id: string;
  name: string;
  path: string;
}

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  hasGeneratedText?: boolean;
}

const STREAM_CHARS_PER_TICK = 2;
const STREAM_TICK_MS = 45;
const LAST_PROJECT_KEY = 'lastProject';
const RAG_ENABLED_KEY = 'ragEnabled';
const SELECTED_MODEL_KEY = 'selectedOllamaModel';
const DEFAULT_OLLAMA_MODEL = 'llama3.1';
const SUPPORTED_OLLAMA_MODELS = ['llama3.1', 'llama3.2'];

function getFolderName(folderPath: string) {
  return folderPath.split('/').pop() || folderPath.split('\\').pop() || 'Untitled';
}

function AppContent() {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<string | null>(null);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([DEFAULT_OLLAMA_MODEL]);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_OLLAMA_MODEL);
  
  // Autosave refs
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const editorRef = useRef<RichEditorHandle>(null);
  const streamQueueRef = useRef('');
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamMessageIdRef = useRef<string | null>(null);

  const rememberProject = async (project: Project) => {
    setCurrentProject(project);
    setMessages([]);
    setThreadId(null);
    setPendingSuggestion(null);

    try {
      await window.electronAPI.addRecentProject(project.id, project.name, project.path);
      await window.electronAPI.setPreference(LAST_PROJECT_KEY, project);
    } catch (error) {
      console.error('Error remembering project:', error);
    }
  };

  const stopStreamReveal = () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    streamQueueRef.current = '';
    streamMessageIdRef.current = null;
  };

  const ensureStreamReveal = (messageId: string) => {
    streamMessageIdRef.current = messageId;
    if (streamIntervalRef.current) return;

    streamIntervalRef.current = setInterval(() => {
      const activeMessageId = streamMessageIdRef.current;
      if (!activeMessageId) {
        stopStreamReveal();
        return;
      }

      const nextChunk = streamQueueRef.current.slice(0, STREAM_CHARS_PER_TICK);
      streamQueueRef.current = streamQueueRef.current.slice(STREAM_CHARS_PER_TICK);

      if (nextChunk) {
        setMessages(msgs => msgs.map(msg =>
          msg.id === activeMessageId
            ? { ...msg, content: msg.content + nextChunk }
            : msg
        ));
      }

      if (!streamQueueRef.current) {
        clearInterval(streamIntervalRef.current!);
        streamIntervalRef.current = null;
      }
    }, STREAM_TICK_MS);
  };

  useEffect(() => {
    if (currentProject) {
      loadProjectDocuments();
    } else {
      setTabs([]);
      setActiveTabId('');
    }
  }, [currentProject]);

  useEffect(() => {
    let isCancelled = false;

    const restorePreferences = async () => {
      if (!window.electronAPI) return;

      try {
        const [savedProject, savedRagEnabled] = await Promise.all([
          window.electronAPI.getPreference(LAST_PROJECT_KEY, null),
          window.electronAPI.getPreference(RAG_ENABLED_KEY, false)
        ]);
        const savedModel = await window.electronAPI.getPreference(SELECTED_MODEL_KEY, DEFAULT_OLLAMA_MODEL);
        const models = window.electronAPI.getOllamaModels
          ? await window.electronAPI.getOllamaModels()
          : [DEFAULT_OLLAMA_MODEL];

        if (isCancelled) return;

        setRagEnabled(!!savedRagEnabled);
        const nextModels = models.filter(model => SUPPORTED_OLLAMA_MODELS.includes(model));
        const nextSelectedModel = nextModels.includes(savedModel)
          ? savedModel
          : DEFAULT_OLLAMA_MODEL;
        setAvailableModels(nextModels);
        setSelectedModel(nextSelectedModel);

        if (savedProject?.path) {
          const project: Project = {
            id: savedProject.id || Date.now().toString(),
            name: savedProject.name || getFolderName(savedProject.path),
            path: savedProject.path
          };

          setCurrentProject(project);
        }
      } catch (error) {
        console.error('Error restoring preferences:', error);
      }
    };

    restorePreferences();

    return () => {
      isCancelled = true;
    };
  }, []);

  const loadProjectDocuments = async () => {
    if (!currentProject) return;
    
    try {
      console.log('Loading documents from:', currentProject.path);
      const documents = await window.electronAPI.loadDocuments(currentProject.path);
      console.log('Loaded documents:', documents);
      
      const newTabs: Tab[] = documents.map(doc => ({
        id: doc.path,
        title: doc.name,
        content: doc.content,
        filePath: doc.path,
        isDirty: false
      }));
      
      console.log('Created tabs:', newTabs);
      setTabs(newTabs);
      if (newTabs.length > 0) {
        setActiveTabId(newTabs[0].id);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      alert('Failed to load documents from folder');
    }
  };

  const handleCreateProject = async () => {
    console.log('Create project clicked');
    
    if (!window.electronAPI) {
      alert('Electron API not available. Make sure you are running in Electron.');
      return;
    }
    
    try {
      const path = await window.electronAPI.selectProjectFolder();
      console.log('Selected path:', path);
      if (!path) return;

      const folderName = getFolderName(path);
    
      const newProject: Project = {
        id: Date.now().toString(),
        name: folderName,
        path: path
      };

      await rememberProject(newProject);
      
      try {
        const welcomeDoc = await window.electronAPI.createDocument(path, 'Welcome.md');
        const welcomeContent = '<p>Welcome to your new writing project!</p><p>Start writing here...</p>';
        const welcomeTab: Tab = {
          id: welcomeDoc.path,
          title: welcomeDoc.name,
          content: welcomeContent,
          filePath: welcomeDoc.path,
          isDirty: true
        };
        
        setTabs([welcomeTab]);
        setActiveTabId(welcomeTab.id);
        
        await window.electronAPI.saveDocument(welcomeDoc.path, welcomeContent);
      } catch (error) {
        console.error('Error creating welcome document:', error);
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project');
    }
  };

  const handleOpenProject = async () => {
    console.log('Open project clicked');
    
    if (!window.electronAPI) {
      alert('Electron API not available. Make sure you are running in Electron.');
      return;
    }
    
    try {
      const path = await window.electronAPI.selectProjectFolder();
      console.log('Selected path:', path);
      if (!path) return;

      const folderName = getFolderName(path);
      
      const newProject: Project = {
        id: Date.now().toString(),
        name: folderName,
        path: path
      };

      await rememberProject(newProject);
    } catch (error) {
      console.error('Error opening project:', error);
      alert('Failed to open project');
    }
  };

  const handleSelectRecentProject = async (project: Project) => {
    console.log('Selected recent project:', project);
    
    try {
      await rememberProject(project);
    } catch (error) {
      console.error('Error selecting recent project:', error);
      alert('Failed to open project');
    }
  };

  const handleNewTab = async () => {
    console.log('New tab clicked');
    
    if (!currentProject) {
      alert('Please open or create a project first');
      return;
    }
    
    if (!window.electronAPI) {
      alert('Electron API not available. Make sure you are running in Electron.');
      return;
    }

    setShowFileModal(true);
  };

  const handleFileModalSubmit = async (filename: string) => {
    setShowFileModal(false);
    
    if (!currentProject || !filename) return;

    try {
      console.log('Creating document:', filename, 'in', currentProject.path);
      const newDoc = await window.electronAPI.createDocument(currentProject.path, filename);
      console.log('Created document:', newDoc);
      
      const newTab: Tab = {
        id: newDoc.path,
        title: newDoc.name,
        content: '<p><br></p>',
        filePath: newDoc.path,
        isDirty: false
      };

      setTabs([...tabs, newTab]);
      setActiveTabId(newTab.id);
    } catch (error) {
      console.error('Error creating document:', error);
      alert('Failed to create document');
    }
  };

  const handleTabClose = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.isDirty) {
      if (!confirm('You have unsaved changes. Close anyway?')) {
        return;
      }
    }

    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId && newTabs.length > 0) {
      setActiveTabId(newTabs[0].id);
    }
  };

  // Autosave function
  const autosave = async (tabId: string, content: string, filePath: string) => {
    if (isSavingRef.current) return;
    
    try {
      isSavingRef.current = true;
      await window.electronAPI.saveDocument(filePath, content);
      
      // Mark as saved
      setTabs(prevTabs => prevTabs.map(t => 
        t.id === tabId ? { ...t, isDirty: false } : t
      ));
      
      console.log('✅ Autosaved:', filePath.split('/').pop());
    } catch (error) {
      console.error('❌ Autosave failed:', error);
    } finally {
      isSavingRef.current = false;
    }
  };

  const handleContentChange = (tabId: string, content: string) => {
    // Update state immediately for responsive typing
    const updatedTabs = tabs.map(tab => 
      tab.id === tabId 
        ? { ...tab, content, isDirty: true }
        : tab
    );
    setTabs(updatedTabs);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Find the tab to save
    const tab = updatedTabs.find(t => t.id === tabId);
    if (!tab?.filePath) return;

    // Debounced autosave - save 1 second after user stops typing
    saveTimeoutRef.current = setTimeout(() => {
      autosave(tabId, content, tab.filePath!);
    }, 1000);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
    };
  }, []);

  // Save immediately when switching tabs
  useEffect(() => {
    const previousTab = tabs.find(t => t.isDirty);
    if (previousTab?.filePath && previousTab.id !== activeTabId) {
      // Clear timeout and save immediately
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      autosave(previousTab.id, previousTab.content, previousTab.filePath);
    }
  }, [activeTabId]);

  const handleTabRename = (tabId: string, newTitle: string) => {
    setTabs(tabs.map(tab => 
      tab.id === tabId ? { ...tab, title: newTitle } : tab
    ));
  };

  const handleRagEnabledChange = async (enabled: boolean) => {
    setRagEnabled(enabled);

    try {
      await window.electronAPI.setPreference(RAG_ENABLED_KEY, enabled);
    } catch (error) {
      console.error('Error saving RAG preference:', error);
    }
  };

  const handleSelectedModelChange = async (modelName: string) => {
    setSelectedModel(modelName);

    try {
      await window.electronAPI.setPreference(SELECTED_MODEL_KEY, modelName);
    } catch (error) {
      console.error('Error saving selected model:', error);
    }
  };

  const handleChatSend = async (message: string, options: { ragEnabled: boolean; modelName: string }) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(msgs => [...msgs, userMessage]);
      setIsLoading(true);
      let agentMessageId = '';
      let unsubscribeStream: (() => void) | undefined;
      stopStreamReveal();

      try {
      // Get active document
      const activeTab = tabs.find(t => t.id === activeTabId);
      
      // Get live content from editor (most up-to-date)
      const liveContent = activeTab && editorRef.current ? {
        name: activeTab.title,
        content: editorRef.current.getText(), // Get plain text for agent
        path: activeTab.filePath || activeTab.id
      } : null;

      // Prepare context
      const context = {
        currentDocument: activeTab ? {
          title: activeTab.title,
          filePath: activeTab.filePath,
          path: activeTab.filePath
        } : null,
        projectPath: currentProject?.path,
        threadId: threadId,
        liveContent: liveContent, // Pass live editor content
        ragEnabled: options.ragEnabled,
        modelName: options.modelName
      };

      console.log('Sending to agent:', context);

      agentMessageId = (Date.now() + 1).toString();
      const streamId = `stream_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      let hasStreamedContent = false;

      const placeholderMessage: Message = {
        id: agentMessageId,
        role: 'agent',
        content: '',
        timestamp: new Date()
      };

      setMessages(msgs => [...msgs, placeholderMessage]);

      if (window.electronAPI.chatStream && window.electronAPI.onChatStreamChunk) {
        unsubscribeStream = window.electronAPI.onChatStreamChunk((payload) => {
          if (payload.streamId !== streamId || !payload.chunk) return;
          hasStreamedContent = true;
          streamQueueRef.current += payload.chunk;
          ensureStreamReveal(agentMessageId);
        });
      }

      const response = window.electronAPI.chatStream
        ? await window.electronAPI.chatStream(message, context, streamId)
        : await window.electronAPI.chat(message, context);
      
      // Store thread ID for conversation continuity
      if (response.threadId) {
        setThreadId(response.threadId);
      }
      
      setMessages(msgs => msgs.map(msg =>
        msg.id === agentMessageId
          ? {
              ...msg,
              content: hasStreamedContent ? msg.content : response.response || "I'm here to help with your writing!",
              hasGeneratedText: !!response.generatedText
            }
          : msg
      ));

      // If there's generated text, show it as a suggestion
      if (response.generatedText) {
        console.log('📝 Received generated text from agent');
        setPendingSuggestion(response.generatedText);
      }

    } catch (error) {
      console.error('Chat error:', error);
      stopStreamReveal();
      setMessages(msgs => {
        if (agentMessageId && msgs.some(msg => msg.id === agentMessageId)) {
          return msgs.map(msg =>
            msg.id === agentMessageId
              ? { ...msg, content: "Sorry, I encountered an error. Please try again." }
              : msg
          );
        }

        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date()
        };
        return [...msgs, errorMessage];
      });
    } finally {
      unsubscribeStream?.();
      setIsLoading(false);
    }
  };

  const handleAcceptSuggestion = () => {
    if (!pendingSuggestion || !activeTabId) return;

    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    console.log('✅ Accepting suggestion');

    // Convert plain text suggestion to HTML paragraphs
    const htmlSuggestion = pendingSuggestion
      .split('\n\n')
      .filter(p => p.trim())
      .map(p => `<p>${p.trim()}</p>`)
      .join('');

    // Append to current content
    const newContent = activeTab.content + htmlSuggestion;

    // Update tab content
    handleContentChange(activeTab.id, newContent);

    // Clear suggestion
    setPendingSuggestion(null);
  };

  const handleRejectSuggestion = () => {
    console.log('❌ Rejecting suggestion');
    setPendingSuggestion(null);
  };

  return (
    <>
      <PageLayout
        filesSidebar={
          <FilesSidebar
            currentProject={currentProject}
            tabs={tabs}
            activeTabId={activeTabId}
            onOpenProject={handleOpenProject}
            onCreateProject={handleCreateProject}
            onNewFile={handleNewTab}
            onTabChange={setActiveTabId}
            onSelectRecentProject={handleSelectRecentProject}
          />
        }
        editor={
          <DraftEditor
            tabs={tabs}
            activeTabId={activeTabId}
            onTabChange={setActiveTabId}
            onTabClose={handleTabClose}
            onContentChange={handleContentChange}
            onTabRename={handleTabRename}
            onNewTab={handleNewTab}
            pendingSuggestion={pendingSuggestion}
            onAcceptSuggestion={handleAcceptSuggestion}
            onRejectSuggestion={handleRejectSuggestion}
            ref={editorRef}
          />
        }
        agentChat={
          <AgentChat
            messages={messages}
            onSend={handleChatSend}
            isLoading={isLoading}
            ragEnabled={ragEnabled}
            onRagEnabledChange={handleRagEnabledChange}
            selectedModel={selectedModel}
            availableModels={availableModels}
            onSelectedModelChange={handleSelectedModelChange}
          />
        }
      />
      
      <InputModal
        isOpen={showFileModal}
        title="Create New File"
        placeholder="Enter filename (e.g., Chapter 1)"
        onSubmit={handleFileModalSubmit}
        onCancel={() => setShowFileModal(false)}
      />
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
