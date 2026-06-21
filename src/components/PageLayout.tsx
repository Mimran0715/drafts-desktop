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
    { id: 'warm', name: 'Letter', swatch: '#e4dfd2' },
    { id: 'dark', name: 'Dark', swatch: '#1c1917' },
    { id: 'rose', name: 'Rose', swatch: '#EEC8CF' },
    { id: 'sage', name: 'Sage', swatch: '#c8d5b9' },
    { id: 'ocean', name: 'Ocean', swatch: '#2c5f7c' },
    { id: 'midnight', name: 'Midnight', swatch: '#1a1f3a' },
  ];

  return (
    <div className="app-shell h-screen flex flex-col">
      {/* Header */}
      <header 
        className="app-header px-4 py-3 flex items-center justify-between"
        style={{ 
          background: 'var(--sidebar-bg)',
          color: 'var(--sidebar-text)'
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="brand-mark" aria-hidden>D</span>
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold tracking-tight leading-5">Drafts</h1>
            <span className="kicker block truncate">Writing desk</span>
          </div>
        </div>
        
        {/* Settings and Profile Icons */}
        <div className="flex items-center gap-3">
          {/* Settings Icon */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="icon-button"
              title="Settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.3 4.6c.4-1.5 2.9-1.5 3.4 0l.2.9a1.8 1.8 0 0 0 2.5 1.1l.8-.4c1.4-.8 3.1 1 2.3 2.3l-.4.8a1.8 1.8 0 0 0 1.1 2.5l.9.2c1.5.4 1.5 2.9 0 3.4l-.9.2a1.8 1.8 0 0 0-1.1 2.5l.4.8c.8 1.4-1 3.1-2.3 2.3l-.8-.4a1.8 1.8 0 0 0-2.5 1.1l-.2.9c-.4 1.5-2.9 1.5-3.4 0l-.2-.9a1.8 1.8 0 0 0-2.5-1.1l-.8.4c-1.4.8-3.1-1-2.3-2.3l.4-.8a1.8 1.8 0 0 0-1.1-2.5l-.9-.2c-1.5-.4-1.5-2.9 0-3.4l.9-.2a1.8 1.8 0 0 0 1.1-2.5l-.4-.8c-.8-1.4 1-3.1 2.3-2.3l.8.4a1.8 1.8 0 0 0 2.5-1.1l.2-.9Z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
              </svg>
            </button>
            
            {showSettingsMenu && (
              <div 
                className="menu-surface absolute right-0 mt-2 py-2 z-50 min-w-[220px]"
              >
                {/* Theme Section */}
                <div className="px-3 py-2">
                  <div 
                    className="section-title mb-2"
                  >
                    Theme
                  </div>
                  {themes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTheme(t.id as any);
                      }}
                      className="menu-button text-sm transition-colors flex items-center gap-2"
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
                      <span
                        className="inline-block w-3 h-3 border"
                        style={{ background: t.swatch, borderColor: 'var(--border-input)', borderRadius: '999px' }}
                      />
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
                
                <div className="border-t my-2" style={{ borderColor: 'var(--border-main)' }}></div>
                
                {/* View Options */}
                <div className="px-3 py-2">
                  <div 
                    className="section-title mb-2"
                  >
                    View
                  </div>
                  <button
                    onClick={() => {
                      setFilesCollapsed(!filesCollapsed);
                    }}
                    className="menu-button text-sm transition-colors flex items-center gap-2"
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
                    <span>{filesCollapsed ? 'Show Files' : 'Hide Files'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setChatCollapsed(!chatCollapsed);
                    }}
                    className="menu-button text-sm transition-colors flex items-center gap-2"
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
                    <span>{chatCollapsed ? 'Show Chat' : 'Hide Chat'}</span>
                  </button>
                </div>
                
                <div className="border-t my-2" style={{ borderColor: 'var(--border-main)' }}></div>
                
                {/* Other Settings */}
                <button
                  className="menu-button text-sm transition-colors"
                  style={{ color: 'var(--sidebar-text)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  Keyboard shortcuts
                </button>
                
                <button
                  className="menu-button text-sm transition-colors"
                  style={{ color: 'var(--sidebar-text)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  About
                </button>
              </div>
            )}
          </div>

          {/* Profile Icon */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="icon-button"
              title="Profile & Account"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 21a8 8 0 0 0-16 0" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
              </svg>
            </button>
            
            {showProfileMenu && (
              <div 
                className="menu-surface absolute right-0 mt-2 py-2 z-50 min-w-[200px]"
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
                  className="menu-button text-sm transition-colors"
                  style={{ color: 'var(--sidebar-text)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  Profile
                </button>
                
                {/* <button
                  className="menu-button text-sm transition-colors"
                  style={{ color: 'var(--sidebar-text)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  💳 Subscription
                </button> */}
                
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
                  Sign out
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
                <h2 className="section-title" style={{ color: 'var(--sidebar-text-muted)' }}>Files</h2>
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
                <h2 className="section-title" style={{ color: 'var(--sidebar-text-muted)' }}>Assistant</h2>
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
