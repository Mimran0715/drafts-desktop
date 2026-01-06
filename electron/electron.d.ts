export interface Project {
  id: string;
  name: string;
  path: string;
  last_opened?: string;
}

export interface Document {
  name: string;
  path: string;
  content: string;
  modified: Date;
}

export interface ChatContext {
  userId?: string;
  projectPath?: string;
  currentDocument?: {
    filePath?: string;
    path?: string;
  };
  threadId?: string | null;
}

export interface ChatResponse {
  response: string;
  timestamp: Date;
  threadId?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ConversationThread {
  thread_id: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
}

declare global {
  interface Window {
    electronAPI: {
      // Project management
      selectProjectFolder: () => Promise<string | null>;
      
      // Document management
      loadDocuments: (folderPath: string) => Promise<Document[]>;
      saveDocument: (filePath: string, content: string) => Promise<{ success: boolean }>;
      createDocument: (folderPath: string, filename: string) => Promise<Document>;
      
      // AI chat
      chat: (message: string, context: ChatContext) => Promise<ChatResponse>;
      
      // Database - Recent projects
      getRecentProjects: () => Promise<Project[]>;
      addRecentProject: (projectId: string, name: string, projectPath: string) => Promise<{ success: boolean }>;
      
      // Database - Conversations
      getConversationHistory: (threadId: string) => Promise<ConversationMessage[]>;
      getProjectConversations: (projectPath: string) => Promise<ConversationThread[]>;
      
      // Database - Preferences
      getPreference: <T = any>(key: string, defaultValue?: T) => Promise<T>;
      setPreference: (key: string, value: any) => Promise<{ success: boolean }>;
    };
  }
}

export {};