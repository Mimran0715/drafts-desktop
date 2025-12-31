import { useState, useEffect } from 'react';
import { ThemeProvider } from './components/ThemeContext';
import PageLayout from './components/PageLayout';
import FilesSidebar from './components/FilesSidebar';
import DraftEditor from './components/DraftEditor';
import AgentChat from './components/AgentChat';
import InputModal from './components/InputModal';
import './globals.css';

// Extend Window interface
declare global {
  interface Window {
    electronAPI: {
      selectProjectFolder: () => Promise<string | null>;
      loadDocuments: (folderPath: string) => Promise<any[]>;
      saveDocument: (filePath: string, content: string) => Promise<any>;
      createDocument: (folderPath: string, filename: string) => Promise<any>;
      chat: (message: string, context: any) => Promise<any>;
      // Database APIs
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
}

function AppContent() {
  // Project state
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  // Tabs/Editor
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');

  // Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modal state
  const [showFileModal, setShowFileModal] = useState(false);

  // Load documents when project changes
  useEffect(() => {
    if (currentProject) {
      loadProjectDocuments();
    } else {
      setTabs([]);
      setActiveTabId('');
    }
  }, [currentProject]);

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

  // Project handlers
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

      const folderName = path.split('/').pop() || path.split('\\').pop() || 'Untitled';
    
          const newProject: Project = {
        id: Date.now().toString(),
        name: folderName,
        path: path
      };

      setCurrentProject(newProject);
      
      // Create a welcome document
      try {
        const welcomeDoc = await window.electronAPI.createDocument(path, 'Welcome.md');
        const welcomeTab: Tab = {
          id: welcomeDoc.path,
          title: welcomeDoc.name,
          content: 'Welcome to your new writing project!\n\nStart writing here...',
          filePath: welcomeDoc.path,
          isDirty: true
        };
        
        setTabs([welcomeTab]);
        setActiveTabId(welcomeTab.id);
        
        // Auto-save the welcome content
        await window.electronAPI.saveDocument(welcomeDoc.path, welcomeTab.content);
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

          const folderName = path.split('/').pop() || path.split('\\').pop() || 'Untitled';
      
      const newProject: Project = {
        id: Date.now().toString(),
        name: folderName,
        path: path
      };

      setCurrentProject(newProject);
    } catch (error) {
      console.error('Error opening project:', error);
      alert('Failed to open project');
    }
  };

  const handleSelectRecentProject = async (project: Project) => {
    console.log('Selected recent project:', project);
    
    try {
      // Update last opened time
      await window.electronAPI.addRecentProject(project.id, project.name, project.path);
      
      setCurrentProject(project);
    } catch (error) {
      console.error('Error selecting recent project:', error);
      alert('Failed to open project');
    }
  };

  // Tab handlers
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

    // Show modal instead of prompt
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
        content: '',
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

  const handleContentChange = async (tabId: string, content: string) => {
    // Update state immediately for responsive typing
    const updatedTabs = tabs.map(tab => 
      tab.id === tabId 
        ? { ...tab, content, isDirty: true }
        : tab
    );
    setTabs(updatedTabs);
  };

  // Separate auto-save effect with debouncing
  useEffect(() => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.isDirty || !tab.filePath) return;

    // Debounce: save after 1 second of no typing
    const timeoutId = setTimeout(async () => {
      try {
        await window.electronAPI.saveDocument(tab.filePath!, tab.content);
        // Mark as saved
        setTabs(prevTabs => prevTabs.map(t => 
          t.id === tab.id ? { ...t, isDirty: false } : t
        ));
        console.log('Auto-saved:', tab.title);
      } catch (error) {
        console.error('Error auto-saving:', error);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [tabs, activeTabId]);

  const handleTabRename = (tabId: string, newTitle: string) => {
    setTabs(tabs.map(tab => 
      tab.id === tabId ? { ...tab, title: newTitle } : tab
    ));
  };

  // Chat handlers
  const handleChatSend = async (message: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages([...messages, userMessage]);
    setIsLoading(true);

    try {
      // Prepare context for AI
      const context = {
        currentDocument: tabs.find(t => t.id === activeTabId),
        allDocuments: tabs,
        projectPath: currentProject?.path
      };

      // Call AI (placeholder for now)
      const response = await window.electronAPI.chat(message, context);
      
      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: response.response || "I'm here to help with your writing! (AI integration coming soon)",
        timestamp: new Date()
      };

      setMessages(msgs => [...msgs, agentMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      };
      setMessages(msgs => [...msgs, errorMessage]);
    } finally {
      setIsLoading(false);
    }
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
          />
        }
        agentChat={
          <AgentChat
            messages={messages}
            onSend={handleChatSend}
            isLoading={isLoading}
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