// 'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface AgentChatProps {
  messages: Message[];
  onSend: (message: string, options: { modelName: string }) => void;
  isLoading?: boolean;
  selectedModel: string;
  availableModels: string[];
  onSelectedModelChange: (modelName: string) => void;
}

const CHAT_PLACEHOLDERS = [
  'What are we working on today?',
  'Dipping pens in ink…',
  'The words are waiting.',
  'Let’s see where the story takes us.',
  'Shall we begin?',
  'One sentence at a time.',
  'Let’s follow the thread.',
  'A blank page is waiting.',
  'What story are you telling today?',
  'Let’s make something worth keeping.',
];

function cleanChatOutput(content: string) {
  return content
    .replace(/^\s*\*\s+/gm, '- ')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\*/g, '');
}

export default function AgentChat({
  messages,
  onSend,
  isLoading,
  selectedModel,
  availableModels,
  onSelectedModelChange
}: AgentChatProps) {
  const [input, setInput] = useState('');
  const [placeholder] = useState(
    () => CHAT_PLACEHOLDERS[Math.floor(Math.random() * CHAT_PLACEHOLDERS.length)]
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSend(input, { modelName: selectedModel });
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="py-12 px-2">
            <p className="section-title mb-3">Assistant</p>
            <p className="text-sm mb-2" style={{ color: 'var(--sidebar-text)' }}>
              Ready for revision notes, scene options, and continuity checks.
            </p>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`chat-message max-w-[85%] px-4 py-3 shadow-sm ${message.role === 'user' ? 'user' : ''}`}
                style={{
                  background: message.role === 'user' ? 'var(--chat-user-bg)' : 'var(--chat-agent-bg)',
                  color: message.role === 'user' ? 'var(--chat-user-text)' : 'var(--chat-agent-text)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div 
                  className="text-xs mb-1"
                  style={{
                    color: message.role === 'user' ? 'var(--chat-user-text)' : 'var(--sidebar-text-muted)',
                    opacity: message.role === 'user' ? 0.8 : 1
                  }}
                >
                  {message.role === 'user' ? 'You' : 'Drafts'}
                </div>
                {message.role === 'agent' && message.isStreaming && !message.content ? (
                  <div 
                    className="flex items-center gap-1 text-sm"
                    style={{ color: 'var(--sidebar-text-muted)' }}
                  >
                    <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap">
                    {message.role === 'agent' ? cleanChatOutput(message.content) : message.content}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {/* Thinking indicator disabled while streaming chat output is active.
            Re-enable this block if you want the loading bubble back later.
        {isLoading && (
          <div className="flex justify-start">
            <div 
              className="rounded-lg px-4 py-2"
              style={{
                background: 'var(--chat-agent-bg)'
              }}
            >
              <div 
                className="flex items-center gap-2 text-sm"
                style={{ color: 'var(--sidebar-text-muted)' }}
              >
                <div className="flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                  <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                  <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
                </div>
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}
        */}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div 
        className="chat-composer p-4 border-t"
        style={{ borderColor: 'var(--border-main)' }}
      >
        <div className="flex items-center justify-end mb-3">
          <select
            value={selectedModel}
            onChange={(e) => onSelectedModelChange(e.target.value)}
            disabled={isLoading}
            className="text-xs border px-2 py-1 max-w-[160px]"
            style={{
              background: 'var(--editor-bg)',
              color: 'var(--editor-text)',
              borderColor: 'var(--border-input)',
              borderRadius: 'var(--radius-sm)'
            }}
            title="Ollama model"
          >
            {availableModels.map(model => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="flex-1 px-4 py-3 text-sm resize-none border focus:outline-none transition-all shadow-sm"
            style={{
              background: 'var(--editor-bg)',
              color: 'var(--editor-text)',
              borderColor: 'var(--border-input)',
              borderRadius: 'var(--radius-lg)'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--btn-primary-bg)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(180, 83, 9, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-input)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
            }}
            rows={3}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="primary-action px-4 font-semibold transition-all self-end text-sm"
            style={{
              background: (!input.trim() || isLoading) ? 'var(--btn-secondary-bg)' : 'var(--btn-primary-bg)',
              color: 'var(--chat-user-text)',
              cursor: (!input.trim() || isLoading) ? 'not-allowed' : 'pointer',
              borderRadius: 'var(--radius-md)'
            }}
            onMouseEnter={(e) => {
              if (input.trim() && !isLoading) {
                e.currentTarget.style.background = 'var(--btn-primary-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (input.trim() && !isLoading) {
                e.currentTarget.style.background = 'var(--btn-primary-bg)';
              }
            }}
          >
            Send
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--sidebar-text-muted)' }}>
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
      
      {/* <style jsx>{`
        textarea::placeholder {
          color: var(--editor-text-muted);
        }
      `}</style> */}
    </div>
  );
}
