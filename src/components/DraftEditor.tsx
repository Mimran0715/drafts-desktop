import { useState, useEffect } from 'react';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { jsPDF } from 'jspdf';

interface Tab {
  id: string;
  title: string;
  content: string;
  isDirty?: boolean;
}

interface DraftEditorProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onContentChange: (tabId: string, content: string) => void;
  onTabRename?: (tabId: string, newTitle: string) => void;
  onNewTab: () => void;
}

type FontFamily = 'crimson' | 'inter' | 'georgia' | 'times' | 'courier';
type FontSize = number;

export default function DraftEditor({ 
  tabs, 
  activeTabId, 
  onTabChange, 
  onTabClose, 
  onContentChange,
  onTabRename,
  onNewTab 
}: DraftEditorProps) {
  const activeTab = tabs.find(t => t.id === activeTabId);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  
  // Formatting states
  const [fontFamily, setFontFamily] = useState<FontFamily>('crimson');
  const [fontSize, setFontSize] = useState<FontSize>(18);
  const [lineHeight, setLineHeight] = useState<number>(1.8);

  const fontFamilies: { id: FontFamily; name: string; style: string }[] = [
    { id: 'crimson', name: 'Crimson Pro', style: "'Crimson Pro', Georgia, serif" },
    { id: 'inter', name: 'Inter', style: "'Inter', -apple-system, sans-serif" },
    { id: 'georgia', name: 'Georgia', style: "Georgia, serif" },
    { id: 'times', name: 'Times New Roman', style: "'Times New Roman', Times, serif" },
    { id: 'courier', name: 'Courier New', style: "'Courier New', Courier, monospace" },
  ];

  const lineHeights = [
    { value: 1.4, label: 'Compact' },
    { value: 1.6, label: 'Normal' },
    { value: 1.8, label: 'Relaxed' },
    { value: 2.0, label: 'Loose' },
  ];

  useEffect(() => {
    if (activeTab) {
      const words = activeTab.content.trim().split(/\s+/).filter(w => w.length > 0).length;
      setWordCount(words);
      setCharCount(activeTab.content.length);
    }
  }, [activeTab]);

  const handleContentChange = (content: string) => {
    if (activeTab) {
      onContentChange(activeTab.id, content);
    }
  };

  const handleExport = () => {
    if (!activeTab) return;
    
    const blob = new Blob([activeTab.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeTab.title || 'Untitled'}.txt`;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportDocx = async () => {
    if (!activeTab) return;
    
    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: activeTab.content.split('\n').map(line => 
            new Paragraph({
              children: [new TextRun(line || ' ')],
            })
          ),
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${activeTab.title || 'Untitled'}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting DOCX:', error);
      alert('Failed to export as DOCX. Please try TXT format instead.');
    }
    setShowExportMenu(false);
  };

  const handleExportPdf = async () => {
    if (!activeTab) return;
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      const lineHeight = 7;
      let yPosition = margin;
      
      const lines = doc.splitTextToSize(activeTab.content, maxWidth);
      
      for (let i = 0; i < lines.length; i++) {
        if (yPosition + lineHeight > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(lines[i], margin, yPosition);
        yPosition += lineHeight;
      }
      
      doc.save(`${activeTab.title || 'Untitled'}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export as PDF. Please try TXT format instead.');
    }
    setShowExportMenu(false);
  };

  const handleStartRename = () => {
    if (activeTab) {
      setRenameValue(activeTab.title);
      setIsRenaming(true);
    }
  };

  const handleRenameSubmit = () => {
    if (activeTab && renameValue.trim() && onTabRename) {
      onTabRename(activeTab.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setRenameValue('');
  };

  const handleRenameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  const currentFontFamily = fontFamilies.find(f => f.id === fontFamily);

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--editor-bg)' }}>
      {/* Tab Bar */}
      <div 
        className="border-b flex items-center overflow-x-auto"
        style={{
          background: 'var(--sidebar-bg)',
          borderColor: 'var(--border-main)'
        }}
      >
        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="group flex items-center gap-2 px-4 py-2 border-r cursor-pointer transition-colors min-w-0"
            style={{
              background: tab.id === activeTabId ? 'var(--editor-bg)' : 'var(--sidebar-bg)',
              borderColor: 'var(--border-main)',
              color: tab.id === activeTabId ? 'var(--editor-toolbar-text, var(--sidebar-text))' : 'var(--sidebar-text-muted)'
            }}
            onMouseEnter={(e) => {
              if (tab.id !== activeTabId) {
                e.currentTarget.style.background = 'var(--sidebar-item-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (tab.id !== activeTabId) {
                e.currentTarget.style.background = 'var(--sidebar-bg)';
              }
            }}
          >
            <span className={`text-sm truncate max-w-[150px] ${tab.isDirty ? 'italic' : ''}`}>
              {tab.title}
              {tab.isDirty && ' •'}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--sidebar-text-muted)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--editor-toolbar-text, var(--sidebar-text))'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--sidebar-text-muted)'}
            >
              ✕
            </button>
          </div>
        ))}
        
        <button
          onClick={onNewTab}
          className="px-3 py-2 transition-colors"
          style={{ color: 'var(--sidebar-text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--sidebar-text)';
            e.currentTarget.style.background = 'var(--sidebar-item-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--sidebar-text-muted)';
            e.currentTarget.style.background = 'transparent';
          }}
          title="New tab"
        >
          +
        </button>
      </div>

      {/* Toolbar */}
      <div 
        className="border-b px-6 py-3 flex items-center justify-between"
        style={{
          background: 'var(--editor-toolbar-bg)',
          borderColor: 'var(--border-main)'
        }}
      >
        <div className="flex items-center gap-4">
          {/* File name with rename */}
          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyPress}
              onBlur={handleRenameSubmit}
              autoFocus
              className="px-2 py-1 text-sm font-medium border transition-all"
              style={{
                background: 'var(--editor-bg)',
                color: 'var(--editor-toolbar-text, var(--sidebar-text))',
                borderColor: 'var(--btn-primary-bg)',
                borderRadius: 'var(--radius-sm)',
                minWidth: '150px'
              }}
            />
          ) : (
            <button
              onClick={handleStartRename}
              className="px-2 py-1 text-sm font-medium transition-all hover:opacity-70"
              style={{
                color: 'var(--editor-toolbar-text, var(--sidebar-text))',
                borderRadius: 'var(--radius-sm)'
              }}
              title="Click to rename"
            >
              📄 {activeTab?.title || 'Untitled'}
            </button>
          )}
          
          <span style={{ color: 'var(--sidebar-text-muted)' }}>·</span>
          
          <div 
            className="flex items-center gap-4 text-sm"
            style={{ color: 'var(--editor-toolbar-text, var(--sidebar-text))' }}
          >
            <span>{wordCount} words</span>
            <span>·</span>
            <span>{charCount} characters</span>
            {activeTab?.isDirty && (
              <>
                <span>·</span>
                <span style={{ color: 'var(--btn-primary-bg)' }}>Unsaved changes</span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          {/* Format Menu */}
          <div className="relative">
            <button 
              onClick={() => setShowFormatMenu(!showFormatMenu)}
              className="px-4 py-2 text-sm border font-medium transition-all shadow-sm"
              style={{
                background: 'var(--btn-secondary-bg)',
                borderColor: 'var(--border-input)',
                color: 'var(--editor-toolbar-text, var(--sidebar-text))',
                borderRadius: 'var(--radius-md)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--btn-secondary-hover)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--btn-secondary-bg)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              🔤 Format
            </button>
            
            {showFormatMenu && (
              <div 
                className="absolute top-full right-0 mt-2 py-3 px-4 shadow-lg z-50 min-w-[280px]"
                style={{
                  background: 'var(--sidebar-bg)',
                  border: '1px solid var(--border-main)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                {/* Font Family */}
                <div className="mb-4">
                  <label 
                    className="block text-xs font-medium mb-2"
                    style={{ color: 'var(--sidebar-text)' }}
                  >
                    Font Family
                  </label>
                  <div className="space-y-1">
                    {fontFamilies.map((font) => (
                      <button
                        key={font.id}
                        onClick={() => {
                          setFontFamily(font.id);
                        }}
                        className="w-full px-3 py-2 text-left text-sm transition-colors"
                        style={{
                          background: fontFamily === font.id ? 'var(--sidebar-item-selected)' : 'transparent',
                          color: fontFamily === font.id ? 'var(--chat-user-text)' : 'var(--sidebar-text)',
                          borderRadius: 'var(--radius-md)',
                          fontFamily: font.style
                        }}
                        onMouseEnter={(e) => {
                          if (fontFamily !== font.id) {
                            e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (fontFamily !== font.id) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        {font.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size */}
                <div className="mb-4">
                  <label 
                    className="block text-xs font-medium mb-2 flex items-center justify-between"
                    style={{ color: 'var(--sidebar-text)' }}
                  >
                    <span>Font Size</span>
                    <span className="font-bold">{fontSize}px</span>
                  </label>
                  <input
                    type="range"
                    min="12"
                    max="32"
                    step="1"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value) as FontSize)}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, var(--btn-primary-bg) 0%, var(--btn-primary-bg) ${((fontSize - 12) / 20) * 100}%, var(--sidebar-item-bg) ${((fontSize - 12) / 20) * 100}%, var(--sidebar-item-bg) 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--sidebar-text-muted)' }}>
                    <span>12px</span>
                    <span>32px</span>
                  </div>
                </div>

                {/* Line Height */}
                <div>
                  <label 
                    className="block text-xs font-medium mb-2"
                    style={{ color: 'var(--sidebar-text)' }}
                  >
                    Line Spacing
                  </label>
                  <div className="space-y-1">
                    {lineHeights.map((lh) => (
                      <button
                        key={lh.value}
                        onClick={() => setLineHeight(lh.value)}
                        className="w-full px-3 py-2 text-left text-sm transition-colors"
                        style={{
                          background: lineHeight === lh.value ? 'var(--sidebar-item-selected)' : 'transparent',
                          color: lineHeight === lh.value ? 'var(--chat-user-text)' : 'var(--sidebar-text)',
                          borderRadius: 'var(--radius-md)'
                        }}
                        onMouseEnter={(e) => {
                          if (lineHeight !== lh.value) {
                            e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (lineHeight !== lh.value) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        {lh.label} ({lh.value})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export Menu */}
          <div className="relative">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-4 py-2 text-sm border font-medium transition-all shadow-sm"
              style={{
                background: 'var(--btn-secondary-bg)',
                borderColor: 'var(--border-input)',
                color: 'var(--editor-toolbar-text, var(--sidebar-text))',
                borderRadius: 'var(--radius-md)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--btn-secondary-hover)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--btn-secondary-bg)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Export ▾
            </button>
            
            {showExportMenu && (
              <div 
                className="absolute top-full right-0 mt-2 py-2 shadow-lg z-50 min-w-[140px]"
                style={{
                  background: 'var(--sidebar-bg)',
                  border: '1px solid var(--border-main)',
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <button
                  onClick={handleExport}
                  className="w-full px-4 py-2 text-left text-sm transition-colors"
                  style={{
                    color: 'var(--sidebar-text)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  📄 Text (.txt)
                </button>
                <button
                  onClick={handleExportDocx}
                  className="w-full px-4 py-2 text-left text-sm transition-colors"
                  style={{
                    color: 'var(--sidebar-text)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  📘 Word (.docx)
                </button>
                <button
                  onClick={handleExportPdf}
                  className="w-full px-4 py-2 text-left text-sm transition-colors"
                  style={{
                    color: 'var(--sidebar-text)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--sidebar-item-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  📕 PDF (.pdf)
                </button>
              </div>
            )}
          </div>
          
          <button 
            onClick={() => activeTab && onContentChange(activeTab.id, '')}
            className="px-4 py-2 text-sm border font-medium transition-all shadow-sm"
            style={{
              background: 'var(--btn-secondary-bg)',
              borderColor: 'var(--border-input)',
              color: 'var(--editor-toolbar-text, var(--sidebar-text))',
              borderRadius: 'var(--radius-md)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--btn-secondary-hover)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--btn-secondary-bg)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab ? (
          <textarea
            value={activeTab.content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Start writing your story here...

Select any text and ask your AI companion for help."
            className="w-full h-full resize-none border-none outline-none"
            style={{ 
              minHeight: '100%',
              background: 'var(--editor-bg)',
              color: 'var(--editor-text)',
              fontFamily: currentFontFamily?.style,
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight.toString()
            }}
          />
        ) : (
          <div 
            className="flex items-center justify-center h-full"
            style={{ color: 'var(--sidebar-text-muted)' }}
          >
            <div className="text-center">
              <div className="text-4xl mb-3">📝</div>
              <p>No tab open. Click + to create a new draft.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}