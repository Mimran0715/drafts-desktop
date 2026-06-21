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
        className="flex border-b p-2 gap-1"
        style={{ 
          background: 'var(--sidebar-bg)',
          borderColor: 'var(--border-main)'
        }}
      >
        <button
          onClick={() => setView('projects')}
          className="flex-1 py-2 px-3 text-xs font-semibold transition-colors relative tab-button"
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
          Projects
          {view === 'projects' && (
            <div 
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ background: 'var(--btn-primary-bg)' }}
            ></div>
          )}
        </button>
        <button
          onClick={() => setView('files')}
          className="flex-1 py-2 px-3 text-xs font-semibold transition-colors relative tab-button"
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
          Files
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
              <p className="section-title mb-4">Projects</p>
            </div>

            <div className="space-y-2 mb-4">
              <button
                onClick={onCreateProject}
                className="primary-action w-full px-3 py-3 font-medium transition-all text-left"
                style={{
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--chat-user-text)',
                  borderRadius: 'var(--radius-md)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--btn-primary-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--btn-primary-bg)';
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="brand-mark !w-7 !h-7 !text-base">+</span>
                  <div>
                    <div className="font-semibold text-sm">New project</div>
                    <div className="text-xs opacity-80">Create a workspace</div>
                  </div>
                </div>
              </button>

              <button
                onClick={onOpenProject}
                className="secondary-action w-full px-3 py-3 font-medium transition-all text-left"
                style={{
                  background: 'var(--btn-secondary-bg)',
                  color: 'var(--sidebar-text)',
                  borderRadius: 'var(--radius-md)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--btn-secondary-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--btn-secondary-bg)';
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="brand-mark !w-7 !h-7 !text-base">O</span>
                  <div>
                    <div className="font-semibold text-sm">Open project</div>
                    <div className="text-xs opacity-80">Open an existing folder</div>
                  </div>
                </div>
              </button>
            </div>

            {/* Recent Projects List */}
            <div className="flex-1 overflow-y-auto">
              <div 
                className="section-title mb-2"
              >
                Recent projects
              </div>

              {recentProjects.length === 0 ? (
                <div 
                  className="text-center py-8 px-4"
                  style={{ 
                    background: 'var(--sidebar-item-bg)',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <p 
                    className="text-xs"
                    style={{ color: 'var(--sidebar-text-muted)' }}
                  >
                    Create or open a project to start a draft.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentProjects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => handleSelectRecentProject(project)}
                      className={`panel-list-button w-full px-3 py-3 text-left transition-all ${currentProject?.path === project.path ? 'is-active' : ''}`}
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
                    className="section-title mb-1"
                    style={{ color: 'var(--sidebar-text-muted)' }}
                  >
                    Current project
                  </div>
                  <h3 
                    className="font-bold text-sm truncate"
                    style={{ color: 'var(--sidebar-text)' }}
                    title={currentProject.name}
                  >
                    {currentProject.name}
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
                  className="primary-action w-full px-3 py-2 text-sm font-medium transition-all"
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
                  New file
                </button>
              </div>

              {/* Files List */}
              <div className="flex-1 overflow-y-auto p-4">
                <div 
                  className="section-title mb-2"
                >
                  Files ({tabs.length})
                </div>
                
                {tabs.length === 0 ? (
                  <div 
                    className="text-center py-8 px-4"
                    style={{ 
                      background: 'var(--sidebar-item-bg)',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    <p 
                      className="text-xs"
                      style={{ color: 'var(--sidebar-text-muted)' }}
                    >
                      Use New file to create your first draft.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {tabs.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`panel-list-button w-full px-3 py-2.5 text-left transition-all ${activeTabId === tab.id ? 'is-active' : ''}`}
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
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: activeTabId === tab.id ? 'var(--accent-soft)' : 'var(--accent)' }} />
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
                  Go to projects
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
