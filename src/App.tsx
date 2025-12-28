import { useState } from 'react';
import './App.css';

// Extend Window interface to include our Electron API
declare global {
  interface Window {
    electronAPI: {
      selectProjectFolder: () => Promise<string | null>;
      loadDocuments: (folderPath: string) => Promise<any[]>;
      saveDocument: (filePath: string, content: string) => Promise<any>;
      createDocument: (folderPath: string, filename: string) => Promise<any>;
      chat: (message: string, context: any) => Promise<any>;
    };
  }
}

function App() {
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [currentDoc, setCurrentDoc] = useState<any>(null);
  const [content, setContent] = useState('');

  const handleSelectProject = async () => {
    const path = await window.electronAPI.selectProjectFolder();
    if (path) {
      setProjectPath(path);
      const docs = await window.electronAPI.loadDocuments(path);
      setDocuments(docs);
    }
  };

  const handleSelectDocument = (doc: any) => {
    setCurrentDoc(doc);
    setContent(doc.content);
  };

  const handleSave = async () => {
    if (currentDoc) {
      await window.electronAPI.saveDocument(currentDoc.path, content);
      alert('Saved!');
    }
  };

  const handleCreateNew = async () => {
    if (projectPath) {
      const filename = prompt('Enter filename:');
      if (filename) {
        const newDoc = await window.electronAPI.createDocument(projectPath, filename);
        setDocuments([...documents, newDoc]);
        setCurrentDoc(newDoc);
        setContent('');
      }
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>Drafts - AI Writing Assistant</h1>
      
      {!projectPath ? (
        <div>
          <button onClick={handleSelectProject} style={{ padding: '10px 20px', fontSize: '16px' }}>
            Open Project Folder
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '20px' }}>
          {/* Sidebar */}
          <div style={{ width: '250px', borderRight: '1px solid #ccc', paddingRight: '20px' }}>
            <h3>Project: {projectPath.split('/').pop()}</h3>
            <button onClick={handleCreateNew} style={{ marginBottom: '10px', width: '100%' }}>
              + New Document
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {documents.map((doc) => (
                <button
                  key={doc.path}
                  onClick={() => handleSelectDocument(doc)}
                  style={{
                    textAlign: 'left',
                    padding: '8px',
                    background: currentDoc?.path === doc.path ? '#e0e0e0' : 'white',
                    border: '1px solid #ccc',
                    cursor: 'pointer'
                  }}
                >
                  {doc.name}
                </button>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div style={{ flex: 1 }}>
            {currentDoc ? (
              <>
                <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <h2 style={{ margin: 0 }}>{currentDoc.name}</h2>
                  <button onClick={handleSave}>Save</button>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  style={{
                    width: '100%',
                    height: '500px',
                    padding: '10px',
                    fontSize: '14px',
                    fontFamily: 'monospace'
                  }}
                />
              </>
            ) : (
              <p>Select a document to start writing</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;