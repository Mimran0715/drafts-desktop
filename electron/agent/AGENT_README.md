# Multi-Node Agent Architecture for Electron

This is your converted TypeScript agent system, now working with Electron, Ollama, and SQLite.

## 📁 File Structure

```
electron/
├── agent/
│   ├── index.js          # Main entry point (replaces agent.js)
│   ├── state.js          # Agent state management
│   ├── graph.js          # Agent workflow orchestration
│   ├── nodes.js          # Three nodes: understand → execute → respond
│   ├── tools.js          # Tools: search, analyze, generate, ask
│   └── checkpointer.js   # SQLite-based conversation checkpointing
├── database.js           # SQLite database (conversations, preferences, projects)
└── main.js               # Updated Electron main process
```

## 🔄 Agent Flow

### Three-Node Architecture

```
User Message
    ↓
[UNDERSTAND NODE]  ← Analyzes intent, categorizes request
    ↓
[EXECUTE NODE]     ← Runs appropriate tools based on intent
    ↓
[RESPOND NODE]     ← Synthesizes gathered info into response
    ↓
AI Response
```

### Node Details

#### 1. **Understand Node** (`nodes.js`)
- **Purpose**: Analyze user's message to determine what they want
- **Output**: Intent category (search, analyze, generate, question, conversational)
- **Example**: "Tell me about Sarah" → `search: User wants to find character information`

#### 2. **Execute Node** (`nodes.js`)
- **Purpose**: Run appropriate tools based on understood intent
- **Tools Available**:
  - `searchContext()` - Search across all project documents
  - `analyzeDraft()` - Provide feedback on writing
  - `generateText()` - Create new content
  - `askQuestion()` - Request clarification
- **Output**: Gathered information from tools

#### 3. **Respond Node** (`nodes.js`)
- **Purpose**: Create helpful response using gathered information
- **Output**: Final AI message to user

## 🛠️ Tools (`tools.js`)

### searchContext(query, projectPath)
- Searches all `.md` and `.txt` files in project
- Returns relevant excerpts with context
- Ranks by relevance score

### analyzeDraft(documentPath, projectPath)
- Analyzes the active document
- Provides:
  - Strengths
  - Areas for improvement
  - Specific suggestions
  - Overall assessment

### generateText(request, projectPath, activeDocumentPath)
- Generates new content based on request
- Uses active document + project context
- Maintains style consistency

### askQuestion(context)
- Generates clarifying questions when intent is unclear

## 💾 Checkpointing (`checkpointer.js`)

### What Changed from PostgreSQL

**Before (Web App)**:
- Used `@langchain/langgraph-checkpoint-postgres`
- Stored conversation state in PostgreSQL
- Required database connection string

**After (Desktop App)**:
- SQLite-based checkpointing
- Stores conversation state locally
- No external database needed

### Functions

```javascript
saveCheckpoint(threadId, state)        // Save conversation state
getLatestCheckpoint(threadId)          // Load last checkpoint
getThreadCheckpoints(threadId, limit)  // Get checkpoint history
cleanupOldCheckpoints(keepCount)       // Maintain checkpoint size
```

## 🗄️ Database Schema

### Checkpoints Table
```sql
CREATE TABLE checkpoints (
  thread_id TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  parent_checkpoint_id TEXT,
  state_data TEXT NOT NULL,  -- JSON serialized state
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (thread_id, checkpoint_id)
)
```

### Conversations Table (existing)
```sql
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

## 🔧 How to Use

### Basic Usage

```javascript
const { runAgent } = require('./agent/index.js');

const result = await runAgent({
  message: "Tell me about the main character",
  userId: "user123",
  projectPath: "/path/to/project",
  activeDocumentPath: "/path/to/project/chapter1.txt",
  threadId: "thread_abc123"  // Optional, auto-generated if not provided
});

console.log(result.response);      // AI's response
console.log(result.userIntent);    // Understood intent
console.log(result.gatheredInfo);  // Information from tools
```

### From Electron IPC Handler (already implemented in main.js)

```javascript
ipcMain.handle('chat', async (event, message, context) => {
  const result = await runAgent({
    message,
    userId: context.userId || 'default-user',
    projectPath: context.projectPath,
    activeDocumentPath: context.currentDocument?.path,
    threadId: context.threadId
  });
  
  return result;
});
```

## 🆚 Key Differences from Web App

| Feature | Web App (TypeScript) | Desktop App (JavaScript) |
|---------|---------------------|-------------------------|
| **Language** | TypeScript | JavaScript (Node.js) |
| **Database** | PostgreSQL + Prisma | SQLite (better-sqlite3) |
| **Checkpointing** | PostgresSaver | Custom SQLite checkpointer |
| **File Access** | API endpoints + DB | Direct filesystem access |
| **State Management** | LangGraph StateGraph | LangGraph StateGraph + SQLite checkpoints |
| **Document Storage** | PostgreSQL tables | Local filesystem |

## 🚀 Migration Benefits

1. **No External Dependencies**: Everything runs locally
2. **Faster**: Direct file system access, no HTTP overhead
3. **Simpler**: No need for database migrations or API setup
4. **Portable**: User data travels with the app
5. **Offline**: Works without internet connection

## 📝 Example Conversations

### Search Example
```
User: "What's Sarah's motivation?"
↓
Understand: search - looking for character information
↓
Execute: searchContext("Sarah motivation", projectPath)
↓
Respond: "Based on your notes, Sarah is motivated by..."
```

### Analysis Example
```
User: "Review my latest chapter"
↓
Understand: analyze - wants feedback on writing
↓
Execute: analyzeDraft(activeDocumentPath, projectPath)
↓
Respond: "This chapter has strong dialogue... Consider..."
```

### Generation Example
```
User: "Continue this scene"
↓
Understand: generate - wants to write more content
↓
Execute: generateText("continue scene", projectPath, activeDoc)
↓
Respond: [Generated continuation]
```

## 🔮 Future Enhancements

- [ ] Add memory system (long-term facts about project)
- [ ] Implement RAG with vector embeddings
- [ ] Add more specialized tools (outline generation, character sheets)
- [ ] Support for image analysis (character art, scene sketches)
- [ ] Export conversations to markdown
- [ ] Collaborative features (shared projects)

## 🐛 Debugging

Enable detailed logging by checking console output:
- `🧠` = Understanding phase
- `⚙️` = Execution phase  
- `💬` = Response phase
- `🔍` = Search tool
- `📝` = Analysis tool
- `✍️` = Generation tool

## 📚 Dependencies

Make sure these are in your `package.json`:

```json
{
  "dependencies": {
    "@langchain/ollama": "^0.1.0",
    "@langchain/core": "^0.3.0",
    "better-sqlite3": "^11.0.0",
    "mammoth": "^1.8.0"
  }
}
```

## ✅ Testing Checklist

- [ ] Ollama is running (`ollama serve`)
- [ ] Model is downloaded (`ollama pull llama3.1`)
- [ ] Project folder selected
- [ ] Documents load correctly
- [ ] Agent responds to questions
- [ ] Conversation history persists
- [ ] Checkpoints save and load

---

**You now have a full multi-node agent system running locally on desktop! 🎉**
