import { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  path: string;
  last_opened?: string;
}

interface Tab {
  id: string;
  title: string;
  content: string;
  filePath?: string;
  isDirty?: boolean;
}

interface FilesSidebarProps {
  currentProject: Project | null;
  tabs: Tab[];
  activeTabId: string;
  onOpenProject: () => void;
  onCreateProject: () => void;
  onNewFile: () => void;
  onTabChange: (tabId: string) => void;
  onSelectRecentProject: (project: Project) => void;
}

export default function FilesSidebar({ 
  currentProject,
  tabs,
  activeTabId,
  onOpenProject,
  onCreateProject,
  onNewFile,
  onTabChange,
  onSelectRecentProject
}: FilesSidebarProps) {
  const [view, setView] = useState<'projects' | 'files'>('projects');
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);

  // Load recent projects on mount
  useEffect(() => {
    loadRecentProjects();
  }, []);

  // Switch to files tab when project is selected
  useEffect(() => {
    if (currentProject) {
      setView('files');
    }
  }, [currentProject]);

  const loadRecentProjects = async () => {
    try {
      const projects = await window.electronAPI.getRecentProjects();
      setRecentProjects(projects);
    } catch (error) {
      console.error('Error loading recent projects:', error);
    }
  };

  const handleSelectRecentProject = (project: Project) => {
    onSelectRecentProject(project);
    setView('files');
  };

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--sidebar-bg)' }}>
      {/* Tab Switcher */}
      <div 
        className="flex border-b"
        style={{ 
          background: 'var(--sidebar-bg)',
          borderColor: 'var(--border-main)'
        }}
      >
        <button
          onClick={() => setView('projects')}
          className="flex-1 py-3 px-4 text-sm font-medium transition-colors relative tab-button"
          style={{
            color: view === 'projects' ? 'var(--sidebar-text)' : 'var(--sidebar-text-muted)'
          }}
          onMouseEnter={(e) => {
            if (view !== 'projects') {
              e.currentTarget.style.background = 'var(--sidebar-item-hover)';
            }
          }}
          onMouseLeave={(e) => {
            if (view !== 'projects') {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          📁 Projects
          {view === 'projects' && (
            <div 
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ background: 'var(--btn-primary-bg)' }}
            ></div>
          )}
        </button>
        <button
          onClick={() => setView('files')}
          className="flex-1 py-3 px-4 text-sm font-medium transition-colors relative tab-button"
          style={{
            color: view === 'files' ? 'var(--sidebar-text)' : 'var(--sidebar-text-muted)'
          }}
          onMouseEnter={(e) => {
            if (view !== 'files') {
              e.currentTarget.style.background = 'var(--sidebar-item-hover)';
            }
          }}
          onMouseLeave={(e) => {
            if (view !== 'files') {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          📄 Files
          {view === 'files' && (
            <div 
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ background: 'var(--btn-primary-bg)' }}
            ></div>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {view === 'projects' ? (
          // PROJECTS VIEW
          <div className="h-full flex flex-col p-4">
            <div className="mb-4">
              <p className="text-xs mb-4" style={{ color: 'var(--sidebar-text-muted)' }}>
                Manage your writing projects
              </p>
            </div>

            <div className="space-y-2 mb-4">
              <button
                onClick={onCreateProject}
                className="w-full px-4 py-3 font-medium transition-all shadow-sm text-left"
                style={{
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--chat-user-text)',
                  borderRadius: 'var(--radius-lg)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--btn-primary-hover)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--btn-primary-bg)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📝</span>
                  <div>
                    <div className="font-semibold">New Project</div>
                    <div className="text-xs opacity-80">Create a new writing project</div>
                  </div>
                </div>
              </button>

              <button
                onClick={onOpenProject}
                className="w-full px-4 py-3 font-medium transition-all shadow-sm text-left"
                style={{
                  background: 'var(--btn-secondary-bg)',
                  color: 'var(--sidebar-text)',
                  borderRadius: 'var(--radius-lg)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--btn-secondary-hover)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--btn-secondary-bg)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📂</span>
                  <div>
                    <div className="font-semibold">Open Project</div>
                    <div className="text-xs opacity-80">Open an existing folder</div>
                  </div>
                </div>
              </button>
            </div>

            {/* Recent Projects List */}
            <div className="flex-1 overflow-y-auto">
              <div 
                className="text-xs font-semibold mb-2"
                style={{ color: 'var(--sidebar-text-muted)' }}
              >
                RECENT PROJECTS
              </div>

              {recentProjects.length === 0 ? (
                <div 
                  className="text-center py-8 px-4"
                  style={{ 
                    background: 'var(--sidebar-item-bg)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <div className="text-3xl mb-2">📁</div>
                  <p 
                    className="text-xs"
                    style={{ color: 'var(--sidebar-text-muted)' }}
                  >
                    No recent projects. Create or open one to get started!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentProjects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => handleSelectRecentProject(project)}
                      className="w-full px-3 py-3 text-left transition-all"
                      style={{
                        background: currentProject?.path === project.path 
                          ? 'var(--sidebar-item-selected)' 
                          : 'var(--sidebar-item-bg)',
                        color: currentProject?.path === project.path 
                          ? 'var(--chat-user-text)' 
                          : 'var(--sidebar-text)',
                        borderRadius: 'var(--radius-md)'
                      }}
                      onMouseEnter={(e) => {
                        if (currentProject?.path !== project.path) {
                          e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentProject?.path !== project.path) {
                          e.currentTarget.style.background = 'var(--sidebar-item-bg)';
                        }
                      }}
                    >
                      <div className="font-medium text-sm mb-1">{project.name}</div>
                      <div 
                        className="text-xs truncate"
                        style={{ 
                          color: currentProject?.path === project.path 
                            ? 'var(--chat-user-text)' 
                            : 'var(--sidebar-text-muted)',
                          opacity: currentProject?.path === project.path ? 0.8 : 1
                        }}
                      >
                        {project.path}
                      </div>
                      {project.last_opened && (
                        <div 
                          className="text-xs mt-1"
                          style={{ 
                            color: currentProject?.path === project.path 
                              ? 'var(--chat-user-text)' 
                              : 'var(--sidebar-text-muted)',
                            opacity: 0.7
                          }}
                        >
                          Last opened: {new Date(project.last_opened).toLocaleDateString()}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          // FILES VIEW
          currentProject ? (
            <div className="h-full flex flex-col">
              {/* Project Header */}
              <div 
                className="p-4 border-b"
                style={{
                  background: 'var(--sidebar-bg)',
                  borderColor: 'var(--border-main)'
                }}
              >
                <div className="mb-3">
                  <div 
                    className="text-xs mb-1"
                    style={{ color: 'var(--sidebar-text-muted)' }}
                  >
                    Current Project
                  </div>
                  <h3 
                    className="font-bold text-sm truncate"
                    style={{ color: 'var(--sidebar-text)' }}
                    title={currentProject.name}
                  >
                    📁 {currentProject.name}
                  </h3>
                  <p 
                    className="text-xs truncate mt-1"
                    style={{ color: 'var(--sidebar-text-muted)' }}
                    title={currentProject.path}
                  >
                    {currentProject.path}
                  </p>
                </div>

                <button
                  onClick={onNewFile}
                  className="w-full px-3 py-2 text-sm font-medium transition-all shadow-sm"
                  style={{
                    background: 'var(--btn-primary-bg)',
                    color: 'var(--chat-user-text)',
                    borderRadius: 'var(--radius-md)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--btn-primary-hover)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--btn-primary-bg)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  + New File
                </button>
              </div>

              {/* Files List */}
              <div className="flex-1 overflow-y-auto p-4">
                <div 
                  className="text-xs font-semibold mb-2"
                  style={{ color: 'var(--sidebar-text-muted)' }}
                >
                  FILES ({tabs.length})
                </div>
                
                {tabs.length === 0 ? (
                  <div 
                    className="text-center py-8 px-4"
                    style={{ 
                      background: 'var(--sidebar-item-bg)',
                      borderRadius: 'var(--radius-lg)'
                    }}
                  >
                    <div className="text-3xl mb-2">📄</div>
                    <p 
                      className="text-xs"
                      style={{ color: 'var(--sidebar-text-muted)' }}
                    >
                      No files yet. Click "New File" to create your first draft.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {tabs.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className="w-full px-3 py-2.5 text-left transition-all"
                        style={{
                          background: activeTabId === tab.id 
                            ? 'var(--sidebar-item-selected)' 
                            : 'var(--sidebar-item-bg)',
                          color: activeTabId === tab.id 
                            ? 'var(--chat-user-text)' 
                            : 'var(--sidebar-text)',
                          borderRadius: 'var(--radius-md)'
                        }}
                        onMouseEnter={(e) => {
                          if (activeTabId !== tab.id) {
                            e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (activeTabId !== tab.id) {
                            e.currentTarget.style.background = 'var(--sidebar-item-bg)';
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">📄</span>
                          <span className="flex-1 text-sm font-medium truncate">
                            {tab.title}
                          </span>
                          {tab.isDirty && (
                            <span 
                              className="text-xs"
                              style={{
                                color: activeTabId === tab.id 
                                  ? 'var(--chat-user-text)' 
                                  : 'var(--btn-primary-bg)',
                                opacity: activeTabId === tab.id ? 0.8 : 1
                              }}
                            >
                              •
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // No project selected in Files view
            <div className="h-full flex items-center justify-center p-8 text-center">
              <div>
                <div className="text-4xl mb-3">📂</div>
                <p 
                  className="text-sm mb-2"
                  style={{ color: 'var(--sidebar-text-muted)' }}
                >
                  No project selected
                </p>
                <button
                  onClick={() => setView('projects')}
                  className="text-sm font-medium transition-colors"
                  style={{ color: 'var(--btn-primary-bg)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--btn-primary-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--btn-primary-bg)';
                  }}
                >
                  → Go to Projects
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}