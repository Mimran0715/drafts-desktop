import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef
} from 'react';

export interface RichEditorHandle {
  focus: () => void;
  getHTML: () => string;
  getText: () => string;
}

interface RichEditorProps {
  value: string; // HTML content
  onChange: (html: string) => void;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  placeholder?: string;
  className?: string;
}

const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(
  (
    {
      value,
      onChange,
      fontFamily,
      fontSize,
      lineHeight,
      placeholder = 'Start writing your story here…',
      className
    },
    ref
  ) => {
    const editorRef = useRef<HTMLDivElement | null>(null);

    /* -----------------------------
       Expose safe editor methods
    ------------------------------ */
    useImperativeHandle(ref, () => ({
      focus() {
        editorRef.current?.focus();
      },
      getHTML() {
        return editorRef.current?.innerHTML ?? '';
      },
      getText() {
        return editorRef.current?.innerText ?? '';
      }
    }));

    /* -----------------------------
       Sync external value → editor
       (prevents cursor jumps)
    ------------------------------ */
    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;

      if (el.innerHTML !== value) {
        el.innerHTML = value || '';
      }
    }, [value]);

    /* -----------------------------
       Input handler
    ------------------------------ */
    const handleInput = () => {
      if (!editorRef.current) return;
      onChange(editorRef.current.innerHTML);
    };

    /* -----------------------------
       Placeholder handling
    ------------------------------ */
    const showPlaceholder =
      !value || value === '<br>' || value === '<div><br></div>';

    return (
      <div className="relative w-full h-full">
        {showPlaceholder && (
          <div
            className="pointer-events-none absolute top-0 left-0 p-1 select-none"
            style={{
              color: 'var(--sidebar-text-muted)',
              fontFamily,
              fontSize,
              lineHeight
            }}
          >
            {placeholder}
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          onInput={handleInput}
          className={className}
          style={{
            minHeight: '100%',
            outline: 'none',
            whiteSpace: 'pre-wrap',
            fontFamily,
            fontSize,
            lineHeight,
            color: 'var(--editor-text)',
            background: 'var(--editor-bg)'
          }}
        />
      </div>
    );
  }
);

RichEditor.displayName = 'RichEditor';

export default RichEditor;
