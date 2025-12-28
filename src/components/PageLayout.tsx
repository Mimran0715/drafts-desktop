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
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  
  const { theme, setTheme } = useTheme();

  const themes = [
    { id: 'warm', name: 'Letter', icon: '🖊️' },
    { id: 'dark', name: 'Dark', icon: '🌙' },
    { id: 'rose', name: 'Rose', icon: '🌹' },
    { id: 'forest', name: 'Forest', icon: '🌲' },
    { id: 'starry', name: 'Stars', icon: '⭐' },
    { id: 'lilac', name: 'Lavender', icon: '💜' },
    { id: 'monochrome', name: 'Mono', icon: '⚫' },
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
        
        <div className="flex gap-2">
          <div className="relative">
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="px-4 py-2.5 text-sm font-medium transition-all shadow-sm"
              style={{
                background: 'var(--btn-secondary-bg)',
                color: 'var(--sidebar-text)',
                borderRadius: 'var(--radius-md)'
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
              🎨 Theme
            </button>
            
            {showThemeMenu && (
              <div 
                className="absolute right-0 mt-2 py-2 shadow-lg z-50 min-w-[180px]"
                style={{
                  background: 'var(--sidebar-bg)',
                  border: '1px solid var(--border-main)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                {themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTheme(t.id as any);
                      setShowThemeMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2"
                    style={{
                      background: theme === t.id ? 'var(--sidebar-item-selected)' : 'transparent',
                      color: theme === t.id ? 'var(--chat-user-text)' : 'var(--sidebar-text)'
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
            )}
          </div>
          
          <button
            onClick={() => setFilesCollapsed(!filesCollapsed)}
            className="px-4 py-2.5 text-sm font-medium transition-all shadow-sm"
            style={{
              background: 'var(--btn-secondary-bg)',
              color: 'var(--sidebar-text)',
              borderRadius: 'var(--radius-md)'
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
            {filesCollapsed ? '📂 Show Files' : '📂 Hide Files'}
          </button>
          <button
            onClick={() => setChatCollapsed(!chatCollapsed)}
            className="px-4 py-2.5 text-sm font-medium transition-all shadow-sm"
            style={{
              background: 'var(--btn-secondary-bg)',
              color: 'var(--sidebar-text)',
              borderRadius: 'var(--radius-md)'
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
            {chatCollapsed ? '💬 Show Chat' : '💬 Hide Chat'}
          </button>
        </div>
      </header>

      {/* Three-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Files */}
        <aside 
          className={`border-r overflow-hidden transition-all duration-300 ${
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
            <div className="h-full flex flex-col">
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
              <div className="flex-1 overflow-hidden">
                {filesSidebar}
              </div>
            </div>
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