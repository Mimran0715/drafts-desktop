// 'use client';

import { ReactNode, useState } from 'react';
import { useTheme } from './ThemeContext';

interface PageLayoutProps {
  filesSidebar: ReactNode;
  editor: ReactNode;
  agentChat: ReactNode;
}

export default function PageLayout({ filesSidebar, editor, agentChat }: PageLayoutProps) {
  const [filesCollapsed, setFilesCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  const { theme, setTheme } = useTheme();

  const themes = [
    { id: 'warm', name: 'Letter', icon: '🖊️' },
    { id: 'dark', name: 'Dark', icon: '🌙' },
    { id: 'rose', name: 'Rose', icon: '🌹' },
    { id: 'forest', name: 'Forest', icon: '🌲' },
    { id: 'starry', name: 'Stars', icon: '⭐' },
    { id: 'lilac', name: 'Lavender', icon: '💜' },
    { id: 'monochrome', name: 'Mono', icon: '⚫' },
    { id: 'sepia', name: 'Sepia', icon: '⚫' },
    { id: 'sage', name: 'Sage', icon: '⚫' },
    { id: 'amber', name: 'Amber', icon: '⚫' },
    { id: 'cherry', name: 'Cherry Blossom', icon: '⚫' },
    { id: 'slate', name: 'Slate', icon: '⚫' },
    { id: 'ocean', name: 'Ocean', icon: '⚫' },
    { id: 'midnight', name: 'Midnight', icon: '⚫' },
    { id: 'espresso', name: 'Espresso', icon: '⚫' },
  ];

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--sidebar-bg)' }}>
      {/* Header */}
      <header 
        className="px-6 py-5 flex items-center justify-between shadow-sm"
        style={{ 
          background: 'var(--sidebar-bg)',
          color: 'var(--sidebar-text)'
        }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">✏️ Drafts</h1>
          <span className="text-sm font-medium" style={{ color: 'var(--sidebar-text-muted)' }}>
            Your AI writing companion
          </span>
        </div>
        
        {/* Settings and Profile Icons */}
        <div className="flex items-center gap-3">
          {/* Settings Icon */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all shadow-sm"
              style={{
                background: 'var(--btn-secondary-bg)',
                color: 'var(--sidebar-text)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--btn-secondary-hover)';
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--btn-secondary-bg)';
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
              }}
              title="Settings"
            >
              ⚙️
            </button>
            
            {showSettingsMenu && (
              <div 
                className="absolute right-0 mt-2 py-2 shadow-lg z-50 min-w-[220px]"
                style={{
                  background: 'var(--sidebar-bg)',
                  border: '1px solid var(--border-main)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                {/* Theme Section */}
                <div className="px-3 py-2">
                  <div 
                    className="text-xs font-semibold mb-2"
                    style={{ color: 'var(--sidebar-text-muted)' }}
                  >
                    THEME
                  </div>
                  {themes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTheme(t.id as any);
                      }}
                      className="w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2"
                      style={{
                        background: theme === t.id ? 'var(--sidebar-item-selected)' : 'transparent',
                        color: theme === t.id ? 'var(--chat-user-text)' : 'var(--sidebar-text)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                      onMouseEnter={(e) => {
                        if (theme !== t.id) {
                          e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (theme !== t.id) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <span>{t.icon}</span>
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
                
                <div className="border-t my-2" style={{ borderColor: 'var(--border-main)' }}></div>
                
                {/* View Options */}
                <div className="px-3 py-2">
                  <div 
                    className="text-xs font-semibold mb-2"
                    style={{ color: 'var(--sidebar-text-muted)' }}
                  >
                    VIEW
                  </div>
                  <button
                    onClick={() => {
                      setFilesCollapsed(!filesCollapsed);
                    }}
                    className="w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2"
                    style={{
                      color: 'var(--sidebar-text)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span>📁</span>
                    <span>{filesCollapsed ? 'Show Files' : 'Hide Files'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setChatCollapsed(!chatCollapsed);
                    }}
                    className="w-full px-3 py-2 text-left text-sm transition-colors flex items-center gap-2"
                    style={{
                      color: 'var(--sidebar-text)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span>💬</span>
                    <span>{chatCollapsed ? 'Show Chat' : 'Hide Chat'}</span>
                  </button>
                </div>
                
                <div className="border-t my-2" style={{ borderColor: 'var(--border-main)' }}></div>
                
                {/* Other Settings */}
                <button
                  className="w-full px-4 py-2 text-left text-sm transition-colors"
                  style={{ color: 'var(--sidebar-text)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  ⌨️ Keyboard Shortcuts
                </button>
                
                <button
                  className="w-full px-4 py-2 text-left text-sm transition-colors"
                  style={{ color: 'var(--sidebar-text)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  ℹ️ About
                </button>
              </div>
            )}
          </div>

          {/* Profile Icon */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-medium transition-all shadow-sm"
              style={{
                background: 'var(--btn-primary-bg)',
                color: 'var(--chat-user-text)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
              }}
              title="Profile & Account"
            >
              👤
            </button>
            
            {showProfileMenu && (
              <div 
                className="absolute right-0 mt-2 py-2 shadow-lg z-50 min-w-[200px]"
                style={{
                  background: 'var(--sidebar-bg)',
                  border: '1px solid var(--border-main)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-main)' }}>
                  <div className="font-medium text-sm" style={{ color: 'var(--sidebar-text)' }}>
                    User Name
                  </div>
                  <div className="text-xs" style={{ color: 'var(--sidebar-text-muted)' }}>
                    user@example.com
                  </div>
                </div>
                
                <button
                  className="w-full px-4 py-2 text-left text-sm transition-colors"
                  style={{ color: 'var(--sidebar-text)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  👤 Profile
                </button>
                
                <button
                  className="w-full px-4 py-2 text-left text-sm transition-colors"
                  style={{ color: 'var(--sidebar-text)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  💳 Subscription
                </button>
                
                <div className="border-t my-1" style={{ borderColor: 'var(--border-main)' }}></div>
                
                <button
                  className="w-full px-4 py-2 text-left text-sm transition-colors"
                  style={{ color: '#dc2626' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Three-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Files */}
        <aside 
          className={`border-r overflow-hidden transition-all duration-300 flex flex-col ${
            filesCollapsed ? 'w-12' : 'w-64'
          }`}
          style={{
            background: 'var(--sidebar-bg)',
            borderColor: 'var(--border-main)'
          }}
        >
          {filesCollapsed ? (
            <div className="h-full flex flex-col items-center py-4 gap-4">
              <button
                onClick={() => setFilesCollapsed(false)}
                className="transition-colors"
                style={{ color: 'var(--sidebar-text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--sidebar-text)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--sidebar-text-muted)'}
                title="Expand sidebar"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="text-xs rotate-90 whitespace-nowrap mt-8" style={{ color: 'var(--sidebar-text-muted)' }}>
                Files
              </div>
            </div>
          ) : (
            <>
              {/* Files Header with collapse button */}
              <div 
                className="flex items-center justify-between p-4 border-b"
                style={{ borderColor: 'var(--border-main)' }}
              >
                <h2 className="text-sm font-bold" style={{ color: 'var(--sidebar-text)' }}>Files</h2>
                <button
                  onClick={() => setFilesCollapsed(true)}
                  className="transition-colors"
                  style={{ color: 'var(--sidebar-text-muted)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--sidebar-text)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--sidebar-text-muted)'}
                  title="Collapse sidebar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
              
              {/* Files Content */}
              <div className="flex-1 overflow-hidden">
                {filesSidebar}
              </div>
            </>
          )}
        </aside>

        {/* Center - Editor */}
        <main 
          className="flex-1 overflow-y-auto"
          style={{ background: 'var(--editor-bg)' }}
        >
          {editor}
        </main>

        {/* Right Sidebar - Agent Chat */}
        <aside 
          className={`border-l overflow-hidden transition-all duration-300 ${
            chatCollapsed ? 'w-12' : 'w-96'
          }`}
          style={{
            background: 'var(--chat-bg)',
            borderColor: 'var(--border-main)'
          }}
        >
          {chatCollapsed ? (
            <div className="h-full flex flex-col items-center py-4 gap-4">
              <button
                onClick={() => setChatCollapsed(false)}
                className="transition-colors"
                style={{ color: 'var(--sidebar-text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--sidebar-text)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--sidebar-text-muted)'}
                title="Expand chat"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="text-xs rotate-90 whitespace-nowrap mt-8" style={{ color: 'var(--sidebar-text-muted)' }}>
                Chat
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <div 
                className="flex items-center justify-between p-4 border-b"
                style={{ borderColor: 'var(--border-main)' }}
              >
                <h2 className="text-sm font-bold" style={{ color: 'var(--sidebar-text)' }}>Chat</h2>
                <button
                  onClick={() => setChatCollapsed(true)}
                  className="transition-colors"
                  style={{ color: 'var(--sidebar-text-muted)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--sidebar-text)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--sidebar-text-muted)'}
                  title="Collapse chat"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {agentChat}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}