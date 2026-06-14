import { forwardRef, useImperativeHandle, useState, useEffect, useRef } from 'react';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { jsPDF } from 'jspdf';
import { useEditorCommands } from './useEditorCommands';
import RichEditor, { RichEditorHandle } from './RichTextEditor';

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
  pendingSuggestion?: string | null;
  onAcceptSuggestion?: () => void;
  onRejectSuggestion?: () => void;
}

type FontFamily = 'crimson' | 'inter' | 'georgia' | 'times' | 'courier';
type FontSize = number;

const DraftEditor = forwardRef<RichEditorHandle, DraftEditorProps>(function DraftEditor({ 
  tabs, 
  activeTabId, 
  onTabChange, 
  onTabClose, 
  onContentChange,
  onTabRename,
  onNewTab,
  pendingSuggestion,
  onAcceptSuggestion,
  onRejectSuggestion
}, ref) {
  const activeTab = tabs.find(t => t.id === activeTabId);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  
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

  const editorRef = useRef<RichEditorHandle>(null);
  const commands = useEditorCommands(editorRef);

  useImperativeHandle(ref, () => ({
    focus() {
      editorRef.current?.focus();
    },
    getHTML() {
      return editorRef.current?.getHTML() ?? '';
    },
    getText() {
      return editorRef.current?.getText() ?? '';
    }
  }));

  // Check selection state when format menu opens
  useEffect(() => {
    if (showFormatMenu) {
      setHasSelection(commands.hasSelection());
    }
  }, [showFormatMenu]);

  // Update word and character count when content changes
  useEffect(() => {
    if (activeTab && editorRef.current) {
      const text = editorRef.current.getText();
      const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
      setWordCount(words);
      setCharCount(text.length);
    }
  }, [activeTab?.content]);

  const handleContentChange = (content: string) => {
    if (activeTab) {
      onContentChange(activeTab.id, content);
    }
  };

  const handleExport = () => {
    if (!activeTab || !editorRef.current) return;
    
    const text = editorRef.current.getText();
    const blob = new Blob([text], { type: 'text/plain' });
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
    if (!activeTab || !editorRef.current) return;
    
    try {
      const text = editorRef.current.getText();
      const doc = new Document({
        sections: [{
          properties: {},
          children: text.split('\n').map(line => 
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
    if (!activeTab || !editorRef.current) return;
    
    try {
      const text = editorRef.current.getText();
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      const lineHeight = 7;
      let yPosition = margin;
      
      const lines = doc.splitTextToSize(text, maxWidth);
      
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
                    Font Family {hasSelection && <span className="text-xs opacity-70">(applies to selection)</span>}
                  </label>
                  <div className="space-y-1">
                    {fontFamilies.map((font) => (
                      <button
                        key={font.id}
                        onClick={() => {
                          if (hasSelection) {
                            commands.setFontFamily(font.style);
                          } else {
                            setFontFamily(font.id);
                          }
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
                
                {/* Format Text Buttons */}
                <div className="mb-4">
                  <label 
                    className="block text-xs font-medium mb-2"
                    style={{ color: 'var(--sidebar-text)' }}
                  >
                    Text Formatting
                  </label>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button" 
                      onClick={commands.bold}
                      className="px-3 py-2 text-sm font-bold border rounded transition-colors"
                      style={{
                        background: 'var(--btn-secondary-bg)',
                        borderColor: 'var(--border-input)',
                        color: 'var(--sidebar-text)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-item-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'var(--btn-secondary-bg)'}
                      title="Bold"
                    >
                      B
                    </button>
                    <button 
                      type="button" 
                      onClick={commands.italic}
                      className="px-3 py-2 text-sm italic border rounded transition-colors"
                      style={{
                        background: 'var(--btn-secondary-bg)',
                        borderColor: 'var(--border-input)',
                        color: 'var(--sidebar-text)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-item-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'var(--btn-secondary-bg)'}
                      title="Italic"
                    >
                      I
                    </button>
                    <button 
                      type="button" 
                      onClick={commands.underline}
                      className="px-3 py-2 text-sm underline border rounded transition-colors"
                      style={{
                        background: 'var(--btn-secondary-bg)',
                        borderColor: 'var(--border-input)',
                        color: 'var(--sidebar-text)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-item-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'var(--btn-secondary-bg)'}
                      title="Underline"
                    >
                      U
                    </button>
                    <button 
                      type="button" 
                      onClick={commands.strike}
                      className="px-3 py-2 text-sm line-through border rounded transition-colors"
                      style={{
                        background: 'var(--btn-secondary-bg)',
                        borderColor: 'var(--border-input)',
                        color: 'var(--sidebar-text)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-item-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'var(--btn-secondary-bg)'}
                      title="Strikethrough"
                    >
                      S
                    </button>
                    <button 
                      type="button" 
                      onClick={() => commands.highlight('#fff3a0')}
                      className="px-3 py-2 text-sm border rounded transition-colors"
                      style={{
                        background: 'var(--btn-secondary-bg)',
                        borderColor: 'var(--border-input)',
                        color: 'var(--sidebar-text)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-item-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'var(--btn-secondary-bg)'}
                      title="Highlight"
                    >
                      🖍
                    </button>
                  </div>
                </div>

                {/* Font Size */}
                <div className="mb-4">
                  <label 
                    className="block text-xs font-medium mb-2 flex items-center justify-between"
                    style={{ color: 'var(--sidebar-text)' }}
                  >
                    <span>Font Size {hasSelection && <span className="text-xs opacity-70">(applies to selection)</span>}</span>
                    <span className="font-bold">{fontSize}px</span>
                  </label>
                  <input
                    type="range"
                    min="12"
                    max="32"
                    step="1"
                    value={fontSize}
                    onChange={(e) => {
                      const newSize = parseInt(e.target.value) as FontSize;
                      setFontSize(newSize);
                      if (hasSelection) {
                        commands.setFontSize(newSize);
                      }
                    }}
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
                    Line Spacing {hasSelection && <span className="text-xs opacity-70">(applies to selection)</span>}
                  </label>
                  <div className="space-y-1">
                    {lineHeights.map((lh) => (
                      <button
                        key={lh.value}
                        onClick={() => {
                          if (hasSelection) {
                            commands.setLineHeight(lh.value);
                          } else {
                            setLineHeight(lh.value);
                          }
                        }}
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
                  style={{ color: 'var(--sidebar-text)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-item-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  📄 Text (.txt)
                </button>
                <button
                  onClick={handleExportDocx}
                  className="w-full px-4 py-2 text-left text-sm transition-colors"
                  style={{ color: 'var(--sidebar-text)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-item-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  📘 Word (.docx)
                </button>
                <button
                  onClick={handleExportPdf}
                  className="w-full px-4 py-2 text-left text-sm transition-colors"
                  style={{ color: 'var(--sidebar-text)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sidebar-item-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  📕 PDF (.pdf)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <div className="h-full px-8 py-8 overflow-y-auto">
            {pendingSuggestion && (
              <div
                className="mb-6 border shadow-sm"
                style={{
                  background: 'var(--sidebar-bg)',
                  borderColor: 'var(--border-main)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div
                  className="px-4 py-3 border-b flex items-center justify-between gap-3"
                  style={{ borderColor: 'var(--border-main)' }}
                >
                  <div
                    className="text-sm font-medium"
                    style={{ color: 'var(--sidebar-text)' }}
                  >
                    Suggested continuation
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onRejectSuggestion}
                      className="px-3 py-1.5 text-sm border transition-colors"
                      style={{
                        background: 'var(--btn-secondary-bg)',
                        borderColor: 'var(--border-input)',
                        color: 'var(--sidebar-text)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={onAcceptSuggestion}
                      className="px-3 py-1.5 text-sm font-medium transition-colors"
                      style={{
                        background: 'var(--btn-primary-bg)',
                        color: 'var(--chat-user-text)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      Accept
                    </button>
                  </div>
                </div>
                <div
                  className="px-4 py-3 text-sm max-h-56 overflow-y-auto whitespace-pre-wrap"
                  style={{
                    color: 'var(--sidebar-text)',
                    lineHeight: 1.6
                  }}
                >
                  {pendingSuggestion}
                </div>
              </div>
            )}
            <RichEditor
              ref={editorRef}
              value={activeTab.content}
              onChange={handleContentChange}
              fontFamily={currentFontFamily?.style || fontFamilies[0].style}
              fontSize={fontSize}
              lineHeight={lineHeight}
              placeholder="Start writing your story here…"
              className="w-full"
            />
          </div>
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
});

export default DraftEditor;
