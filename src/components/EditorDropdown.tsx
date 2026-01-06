import { ReactNode, useState, useRef, useEffect } from 'react';

interface EditorDropdownProps {
  label: ReactNode;
  children: ReactNode;
  minWidth?: number;
}

export default function EditorDropdown({
  label,
  children,
  minWidth = 160
}: EditorDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="px-3 py-2 text-sm border rounded-md"
        style={{
          background: 'var(--btn-secondary-bg)',
          borderColor: 'var(--border-input)',
          color: 'var(--editor-toolbar-text)'
        }}
      >
        {label} ▾
      </button>

      {open && (
        <div
          className="absolute top-full mt-2 z-50 p-2 shadow-lg"
          style={{
            minWidth,
            background: 'var(--sidebar-bg)',
            border: '1px solid var(--border-main)',
            borderRadius: 'var(--radius-md)'
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
