# ✏️ Drafts

A desktop writing app with an AI companion to help you write better.

https://github.com/user-attachments/assets/ff60d5f7-3bdc-4873-8057-094a569d2d8c

## Features

- **Clean Writing Interface** - Distraction-free editor with customizable fonts and spacing
- **AI Writing Companion** - Get suggestions, brainstorm ideas, and improve your writing
- **Project Management** - Organize your work into projects with multiple files
- **Themes** - Various themes (Letter, Rose, Ocean, and more)
- **Export Options** - Save as TXT, DOCX, or PDF
- **Streaming Chat** - Companion responses stream into chat with a simple loading state
- **Project Context Toggle** - Optional keyword-based RAG retrieves relevant snippets from project files
- **Ollama Model Picker** - Select supported local models, currently `llama3.1` or `llama3.2`
- **Editor Suggestions** - Generated continuations appear in the editor with Accept/Reject controls
- **Session Restore** - Reopens the last project automatically between app launches

Built with Electron, React, TypeScript, LangChain, and LangGraph.

## Current AI workflow

- Uses a simple LangGraph flow: understand → execute tools → respond.
- Uses heuristic routing first for common requests like analyze, continue, search, and review.
- Supports `.md`, `.txt`, and `.docx` project files, with safer handling for empty or invalid `.docx` files.
- Keeps generated draft prose separate from chat commentary so only writing text is inserted into the editor.
- Stores preferences such as last project, RAG toggle, and selected model in the local SQLite database.

## LangSmith tracing

Agent tracing is instrumented with LangSmith and is off by default. To enable traces
for the Electron agent workflow, create a local `.env` file:

```env
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=your_langsmith_api_key
LANGSMITH_PROJECT=drafts-desktop
```

Then run the app normally, for example:

```bash
npm run electron:dev
```

Traces include the high-level agent graph, intent understanding, tool execution,
response synthesis, document search, draft analysis, and text generation spans.
