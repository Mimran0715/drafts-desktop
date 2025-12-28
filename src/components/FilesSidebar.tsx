// 'use client';

import { useState } from 'react';
import * as mammoth from 'mammoth';

interface ContextDoc {
  id: string;
  title: string;
  content: string;
  type: 'character' | 'plot' | 'worldbuilding' | 'other';
}

interface FilesSidebarProps {
  docs: ContextDoc[];
  onAdd: (doc: Omit<ContextDoc, 'id'>) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId?: string;
}

export default function FilesSidebar({ 
  docs, 
  onAdd, 
  onDelete, 
  onSelect,
  selectedId 
}: FilesSidebarProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newDoc, setNewDoc] = useState({
    title: '',
    content: '',
    type: 'character' as const
  });

  const handleAdd = () => {
    if (newDoc.title && newDoc.content) {
      onAdd(newDoc);
      setNewDoc({ title: '', content: '', type: 'character' });
      setIsAdding(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        let content = '';
        
        // Handle different file types
        if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
          // Word documents - use mammoth
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          content = result.value;
        } else {
          // Plain text files (.txt, .md)
          const arrayBuffer = await file.arrayBuffer();
          const decoder = new TextDecoder('utf-8');
          content = decoder.decode(arrayBuffer);
        }
        
        // Auto-detect type from filename
        let type: 'character' | 'plot' | 'worldbuilding' | 'other' = 'other';
        const lowerName = file.name.toLowerCase();
        if (lowerName.includes('character')) type = 'character';
        else if (lowerName.includes('plot') || lowerName.includes('outline')) type = 'plot';
        else if (lowerName.includes('world')) type = 'worldbuilding';
        
        onAdd({
          title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
          content: content,
          type: type
        });
      } catch (error) {
        console.error(`Failed to read ${file.name}:`, error);
        alert(`Failed to read ${file.name}. Make sure it's a valid .txt, .md, or .docx file.`);
      }
    }
    
    // Reset input
    e.target.value = '';
  };

  const typeColors = {
    character: 'bg-blue-500',
    plot: 'bg-green-500',
    worldbuilding: 'bg-purple-500',
    other: 'bg-gray-500'
  };

  const typeIcons = {
    character: '👤',
    plot: '📖',
    worldbuilding: '🌍',
    other: '📄'
  };

  return (
    <div className="h-full flex flex-col p-4">
      <div className="mb-3">
        <p className="text-xs" style={{ color: 'var(--sidebar-text-muted)' }}>
          Character notes, plot outlines, worldbuilding
        </p>
      </div>

      <div className="mb-4 space-y-2">
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="w-full px-4 py-2.5 font-medium transition-all shadow-sm"
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
          {isAdding ? '✕ Cancel' : '+ New Document'}
        </button>
        
        <label 
          htmlFor="file-upload"
          className="w-full px-4 py-2.5 font-medium transition-all cursor-pointer block text-center shadow-sm"
          style={{
            background: '#1d4ed8',
            color: '#ffffff',
            borderRadius: 'var(--radius-lg)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1e40af';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#1d4ed8';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
          }}
        >
          📤 Upload Files
        </label>
        <input
          type="file"
          multiple
          accept=".txt,.md,.doc,.docx"
          onChange={handleFileUpload}
          className="hidden"
          id="file-upload"
        />
      </div>

      {isAdding && (
        <div 
          className="mb-4 p-4 space-y-3 shadow-sm"
          style={{ 
            background: 'var(--sidebar-item-bg)',
            borderRadius: 'var(--radius-lg)'
          }}
        >
          <input
            type="text"
            placeholder="Title"
            value={newDoc.title}
            onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
            className="w-full p-3 border text-sm transition-all"
            style={{
              background: 'var(--editor-bg)',
              color: 'var(--editor-text)',
              borderColor: 'var(--border-input)',
              borderRadius: 'var(--radius-md)'
            }}
          />
          
          <select
            value={newDoc.type}
            onChange={(e) => setNewDoc({ ...newDoc, type: e.target.value as any })}
            className="w-full p-3 border text-sm transition-all"
            style={{
              background: 'var(--editor-bg)',
              color: 'var(--editor-text)',
              borderColor: 'var(--border-input)',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <option value="character">Character</option>
            <option value="plot">Plot</option>
            <option value="worldbuilding">Worldbuilding</option>
            <option value="other">Other</option>
          </select>

          <textarea
            placeholder="Content..."
            value={newDoc.content}
            onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
            className="w-full h-24 p-3 border text-sm resize-none transition-all"
            style={{
              background: 'var(--editor-bg)',
              color: 'var(--editor-text)',
              borderColor: 'var(--border-input)',
              borderRadius: 'var(--radius-md)'
            }}
          />
          
          <button
            onClick={handleAdd}
            disabled={!newDoc.title || !newDoc.content}
            className="w-full py-2.5 text-sm font-medium transition-all shadow-sm"
            style={{
              background: (!newDoc.title || !newDoc.content) ? 'var(--btn-secondary-bg)' : '#15803d',
              color: '#ffffff',
              cursor: (!newDoc.title || !newDoc.content) ? 'not-allowed' : 'pointer',
              borderRadius: 'var(--radius-md)'
            }}
            onMouseEnter={(e) => {
              if (newDoc.title && newDoc.content) {
                e.currentTarget.style.background = '#166534';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (newDoc.title && newDoc.content) {
                e.currentTarget.style.background = '#15803d';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            Add
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2">
        {docs.length === 0 ? (
          <div 
            className="text-center py-8 text-sm"
            style={{ color: 'var(--sidebar-text-muted)' }}
          >
            <div className="text-3xl mb-2">📚</div>
            <p>No documents yet</p>
          </div>
        ) : (
          docs.map(doc => (
            <div
              key={doc.id}
              onClick={() => onSelect(doc.id)}
              className="p-3 cursor-pointer transition-all shadow-sm"
              style={{
                background: selectedId === doc.id ? 'var(--sidebar-item-selected)' : 'var(--sidebar-item-bg)',
                color: selectedId === doc.id ? 'var(--chat-user-text)' : 'var(--sidebar-text)',
                borderRadius: 'var(--radius-lg)'
              }}
              onMouseEnter={(e) => {
                if (selectedId !== doc.id) {
                  e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedId !== doc.id) {
                  e.currentTarget.style.background = 'var(--sidebar-item-bg)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span 
                    className={`w-2 h-2 rounded-full shrink-0 ${typeColors[doc.type]}`}
                  ></span>
                  <span className="font-medium text-sm truncate">{doc.title}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(doc.id);
                  }}
                  className="text-xs ml-2 transition-colors"
                  style={{
                    color: selectedId === doc.id ? 'var(--chat-user-text)' : 'var(--sidebar-text-muted)',
                    opacity: selectedId === doc.id ? 0.8 : 1
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#dc2626';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = selectedId === doc.id ? 'var(--chat-user-text)' : 'var(--sidebar-text-muted)';
                  }}
                >
                  ✕
                </button>
              </div>
              <div 
                className="flex items-center gap-1 text-xs"
                style={{
                  color: selectedId === doc.id ? 'var(--chat-user-text)' : 'var(--sidebar-text-muted)',
                  opacity: selectedId === doc.id ? 0.8 : 1
                }}
              >
                <span>{typeIcons[doc.type]}</span>
                <span className="capitalize">{doc.type}</span>
              </div>
              <p 
                className="text-xs mt-1 line-clamp-2"
                style={{
                  color: selectedId === doc.id ? 'var(--chat-user-text)' : 'var(--sidebar-text-muted)',
                  opacity: selectedId === doc.id ? 0.8 : 1
                }}
              >
                {doc.content}
              </p>
            </div>
          ))
        )}
      </div>
      
      {/* <style jsx>{`
        input::placeholder,
        textarea::placeholder {
          color: var(--editor-text-muted);
        }
      `}</style> */}
    </div>
  );
}