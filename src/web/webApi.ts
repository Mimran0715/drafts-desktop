type DirectoryHandle = FileSystemDirectoryHandle & {
  values: () => AsyncIterableIterator<FileSystemFileHandle>
}

type WebProject = { id: string; name: string; path: string; last_opened?: string }
type CachedDocument = { name: string; path: string; content: string; modified: string }

const directoryHandles = new Map<string, DirectoryHandle>()
const RECENTS_KEY = 'drafts-web-projects'
const PREFERENCES_KEY = 'drafts-web-preferences'

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || '') as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

function documentKey(projectPath: string) {
  return `drafts-web-documents:${projectPath}`
}

function textToHtml(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.split(/\r?\n/).map(line => `<p>${line || '<br>'}</p>`).join('')
}

function htmlToText(html: string) {
  const container = document.createElement('div')
  container.innerHTML = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div)>/gi, '\n')
  return (container.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}

function getCachedDocuments(projectPath: string): CachedDocument[] {
  return readJson<CachedDocument[]>(documentKey(projectPath), [])
}

async function chooseDirectory() {
  const picker = (window as typeof window & {
    showDirectoryPicker?: (options?: { mode: 'readwrite' }) => Promise<DirectoryHandle>
  }).showDirectoryPicker

  if (!picker) {
    const name = window.prompt('Name this browser-based writing project', 'My novel')?.trim()
    if (!name) return null
    return `browser://${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`
  }

  try {
    const handle = await picker({ mode: 'readwrite' })
    const projectPath = `browser://${handle.name}-${Date.now()}`
    directoryHandles.set(projectPath, handle)
    return projectPath
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null
    throw error
  }
}

async function loadDocuments(projectPath: string) {
  const handle = directoryHandles.get(projectPath)
  if (!handle) return getCachedDocuments(projectPath)

  const documents: CachedDocument[] = []
  for await (const entry of handle.values()) {
    if (entry.kind !== 'file' || !/\.(md|txt|docx|doc)$/i.test(entry.name)) continue
    const file = await entry.getFile()
    const content = /\.(md|txt)$/i.test(entry.name)
      ? textToHtml(await file.text())
      : textToHtml(`${entry.name} is available in the desktop app. Browser editing currently supports .md and .txt files.`)
    documents.push({
      name: entry.name,
      path: `${projectPath}/${entry.name}`,
      content,
      modified: file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString()
    })
  }
  writeJson(documentKey(projectPath), documents)
  return documents
}

async function saveDocument(filePath: string, content: string) {
  const separator = filePath.lastIndexOf('/')
  const projectPath = filePath.slice(0, separator)
  const filename = filePath.slice(separator + 1)
  const documents = getCachedDocuments(projectPath)
  const next = documents.some(doc => doc.path === filePath)
    ? documents.map(doc => doc.path === filePath ? { ...doc, content, modified: new Date().toISOString() } : doc)
    : [...documents, { name: filename, path: filePath, content, modified: new Date().toISOString() }]
  writeJson(documentKey(projectPath), next)

  const handle = directoryHandles.get(projectPath)
  if (handle && /\.(md|txt)$/i.test(filename)) {
    const fileHandle = await handle.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(htmlToText(content))
    await writable.close()
  }
  return { success: true }
}

async function createDocument(projectPath: string, requestedName: string) {
  const name = requestedName.includes('.') ? requestedName : `${requestedName}.txt`
  const document = {
    name,
    path: `${projectPath}/${name}`,
    content: '<p><br></p>',
    modified: new Date().toISOString()
  }
  await saveDocument(document.path, document.content)
  return document
}

export function installWebApi() {
  if (window.electronAPI) return

  window.electronAPI = {
    selectProjectFolder: chooseDirectory,
    loadDocuments,
    saveDocument,
    createDocument,
    chat: async (message, context) => {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'The writing assistant is unavailable')
      return payload
    },
    getOllamaModels: async () => {
      const response = await fetch('/api/models')
      if (!response.ok) return []
      return (await response.json()).models
    },
    getDefaultOllamaModel: async () => {
      const response = await fetch('/api/models')
      if (!response.ok) return 'gemma4:31b'
      return (await response.json()).defaultModel
    },
    getChromaStatus: async () => ({
      available: false,
      host: 'web',
      port: 0,
      error: 'Web projects use in-request document search instead of Chroma.',
      embeddingMode: 'keyword',
      semanticSearch: false
    }),
    getRecentProjects: async () => readJson<WebProject[]>(RECENTS_KEY, []),
    addRecentProject: async (id, name, path) => {
      const projects = readJson<WebProject[]>(RECENTS_KEY, [])
      const project = { id, name, path, last_opened: new Date().toISOString() }
      writeJson(RECENTS_KEY, [project, ...projects.filter(item => item.path !== path)].slice(0, 10))
      return { success: true }
    },
    getConversationHistory: async () => [],
    getProjectConversations: async () => [],
    getPreference: async (key, defaultValue) => readJson<Record<string, unknown>>(PREFERENCES_KEY, {})[key] ?? defaultValue,
    setPreference: async (key, value) => {
      const preferences = readJson<Record<string, unknown>>(PREFERENCES_KEY, {})
      writeJson(PREFERENCES_KEY, { ...preferences, [key]: value })
      return { success: true }
    }
  }
}
