# ✏️ Drafts

A desktop writing app with an AI companion to help you write better.

https://github.com/user-attachments/assets/ff60d5f7-3bdc-4873-8057-094a569d2d8c

## Features

- **Clean Writing Interface** - Distraction-free editor with customizable fonts and spacing
- **AI Writing Companion** - Get suggestions, brainstorm ideas, and improve your writing
- **Project Management** - Organize your work into projects with multiple files
- **Themes** - Various themes (Letter, Rose, Ocean, and more)
- **Export Options** - Save as TXT, DOCX, or PDF

Built with Electron, React, TypeScript, LangChain

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
