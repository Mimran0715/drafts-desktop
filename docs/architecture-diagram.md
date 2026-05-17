# Drafts Desktop Architecture

## Runtime Interaction Diagram

```mermaid
flowchart LR
  User["Writer"] --> UI["React renderer\nsrc/App.tsx\nAgentChat + editor + files sidebar"]

  subgraph Renderer["Renderer process"]
    UI --> Editor["Draft editor\nbuilds liveContent from editorRef.getText()"]
    UI --> API["window.electronAPI\nelectron/preload.js"]
  end

  API -->|ipcRenderer.invoke| IPC["Electron IPC channels"]

  subgraph Main["Electron main process"]
    IPC --> MainHandlers["ipcMain handlers\nelectron/main.js"]
    MainHandlers --> FileOps["Project/document filesystem ops\nload/save/create documents"]
    MainHandlers --> RunAgent["runAgent()\nelectron/agent/index.js\nmessage + project/document/thread"]
    MainHandlers --> DBApi["database.js API\nrecent projects, preferences,\nconversation history"]
  end

  FileOps <--> ProjectFiles[("Project folder\n.md / .txt / .docx / .doc")]
  DBApi <--> SQLite[("SQLite app.db\nbetter-sqlite3\nElectron userData path")]

  RunAgent --> SaveUser["save user message"]
  SaveUser --> Conversations[("conversations table")]
  Conversations --> SQLite

  RunAgent --> AgentGraph["Agent graph runner\nelectron/agent/graph.js"]

  subgraph Agent["Agent workflow"]
    AgentGraph --> LoadCheckpoint["getLatestCheckpoint(threadId)"]
    LoadCheckpoint --> Checkpoints[("checkpoints table")]
    Checkpoints --> SQLite

    LoadCheckpoint --> Understand["understandNode\nintent classification"]
    Understand --> Ckpt1["saveCheckpoint()"]
    Ckpt1 --> Checkpoints

    Understand --> Execute["executeNode\nselect tools by intent"]
    Execute --> Tools["Agent tools\nsearchContext\nanalyzeDraft\ngenerateText\naskQuestion"]
    Tools <--> ProjectFiles
    Tools --> Ckpt2["saveCheckpoint()"]
    Ckpt2 --> Checkpoints

    Execute --> Respond["respondNode\nfinal response or generatedText"]
    Respond --> Ckpt3["saveCheckpoint()"]
    Ckpt3 --> Checkpoints
  end

  Understand --> LangChain["LangChain messages\nHumanMessage / AIMessage / SystemMessage"]
  Respond --> LangChain
  Tools --> LangChain

  LangChain --> Ollama["ChatOllama\n@langchain/ollama\nmodel: llama3.1"]
  Ollama <--> OllamaServer["Local Ollama service\nollama serve"]

  Respond --> SaveAgent["save agent response"]
  SaveAgent --> Conversations
  SaveAgent --> IPC
  IPC --> API
  API --> UI
  UI --> Suggestion["Optional generatedText suggestion\naccept appends into editor"]
```

## Agent Flow

```mermaid
sequenceDiagram
  participant UI as React UI
  participant IPC as Electron IPC
  participant Main as main.js
  participant Agent as runAgent()
  participant Graph as graph.js
  participant DB as SQLite app.db
  participant LLM as Ollama llama3.1
  participant FS as Project files

  UI->>IPC: electronAPI.chat(message, context)
  IPC->>Main: ipcMain.handle("chat")
  Main->>Agent: runAgent({message, projectPath, activeDocumentPath, threadId})
  Agent->>DB: INSERT conversations(role="user")
  Agent->>Graph: runAgentGraph(initialState, {threadId})
  Graph->>DB: SELECT latest checkpoint
  Graph->>LLM: understandNode intent prompt
  Graph->>DB: INSERT checkpoint after understand
  Graph->>FS: tools read project/active documents when needed
  Graph->>LLM: analyze/generate/respond prompts when needed
  Graph->>DB: INSERT checkpoint after execute
  Graph->>LLM: respondNode final response prompt
  Graph->>DB: INSERT final checkpoint
  Graph-->>Agent: final state + optional generatedText
  Agent->>DB: INSERT conversations(role="agent")
  Agent-->>Main: response payload
  Main-->>UI: response, threadId, userIntent, gatheredInfo, generatedText
```

## SQLite Tables

```mermaid
erDiagram
  projects {
    TEXT id PK
    TEXT name
    TEXT path UK
    TIMESTAMP last_opened
    TIMESTAMP created_at
  }

  preferences {
    TEXT key PK
    TEXT value
    TIMESTAMP updated_at
  }

  conversations {
    INTEGER id PK
    TEXT project_path
    TEXT thread_id
    TEXT role
    TEXT content
    TIMESTAMP created_at
  }

  checkpoints {
    TEXT thread_id PK
    TEXT checkpoint_id PK
    TEXT parent_checkpoint_id
    TEXT state_data
    TIMESTAMP created_at
  }

  conversations }o--|| projects : "project_path references path by convention"
  checkpoints }o--o{ conversations : "same thread_id"
  checkpoints ||--o| checkpoints : "parent_checkpoint_id chain"
```

## Key Notes

- UI entry point: `src/App.tsx` builds chat context from the active tab, current project, `threadId`, and live editor text.
- Bridge layer: `electron/preload.js` exposes safe `window.electronAPI` methods; `electron/main.js` owns IPC handlers.
- Live editor content caveat: `src/App.tsx` includes `liveContent` in the chat context, and the agent state/tools are prepared to use it, but the current `electron/main.js` chat handler does not forward `context.liveContent` into `runAgent()`.
- Agent entry point: `electron/agent/index.js` saves the user message, creates initial LangChain `HumanMessage` state, runs the graph, then saves the agent response.
- Agent orchestration: `electron/agent/graph.js` compiles a LangGraph `StateGraph` for `understandNode -> executeNode -> respondNode` and checkpoints after each node.
- LangChain/Ollama: `electron/agent/nodes.js` and `electron/agent/tools.js` use `@langchain/core/messages` and `ChatOllama` from `@langchain/ollama` with the `llama3.1` model.
- LangGraph: `@langchain/langgraph` is installed, and `graph.js` uses a compiled `StateGraph` with annotated state channels for messages, intent, gathered info, generated text, and iteration count.
- Database: `electron/database.js` uses `better-sqlite3`, stores `app.db` in Electron's `app.getPath("userData")`, and enables WAL mode.
- Checkpointer table: `electron/agent/checkpointer.js` creates `checkpoints(thread_id, checkpoint_id, parent_checkpoint_id, state_data, created_at)` with primary key `(thread_id, checkpoint_id)` and index `idx_checkpoints_thread_created`.
