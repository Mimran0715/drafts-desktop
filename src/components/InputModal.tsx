import { useState, useEffect, useRef } from 'react';

interface InputModalProps {
  isOpen: boolean;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export default function InputModal({
  isOpen,
  title,
  placeholder = '',
  defaultValue = '',
  onSubmit,
  onCancel
}: InputModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onCancel}
    >
      <div 
        className="p-6 shadow-2xl min-w-[400px]"
        style={{
          background: 'var(--sidebar-bg)',
          borderRadius: 'var(--radius-lg)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 
          className="text-lg font-semibold mb-4"
          style={{ color: 'var(--sidebar-text)' }}
        >
          {title}
        </h3>
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-4 py-3 border text-sm transition-all mb-4"
          style={{
            background: 'var(--editor-bg)',
            color: 'var(--editor-text)',
            borderColor: 'var(--border-input)',
            borderRadius: 'var(--radius-md)'
          }}
        />
        
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium transition-all"
            style={{
              background: 'var(--btn-secondary-bg)',
              color: 'var(--sidebar-text)',
              borderRadius: 'var(--radius-md)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--btn-secondary-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--btn-secondary-bg)';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="px-4 py-2 text-sm font-medium transition-all"
            style={{
              background: value.trim() ? 'var(--btn-primary-bg)' : 'var(--btn-secondary-bg)',
              color: value.trim() ? 'var(--chat-user-text)' : 'var(--sidebar-text-muted)',
              cursor: value.trim() ? 'pointer' : 'not-allowed',
              borderRadius: 'var(--radius-md)'
            }}
            onMouseEnter={(e) => {
              if (value.trim()) {
                e.currentTarget.style.background = 'var(--btn-primary-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (value.trim()) {
                e.currentTarget.style.background = 'var(--btn-primary-bg)';
              }
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}