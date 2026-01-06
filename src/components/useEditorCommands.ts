import { RefObject } from 'react';
import { RichEditorHandle } from './RichTextEditor';

/**
 * Centralized formatting + selection commands
 * Keeps DraftEditor clean and future-proof.
 */
export function useEditorCommands(
  editorRef: RefObject<RichEditorHandle | null>
) {
  /* -----------------------------
     Internal helpers
  ------------------------------ */

  const focusEditor = () => {
    editorRef.current?.focus();
  };

  const exec = (command: string, value?: string) => {
    focusEditor();
    document.execCommand(command, false, value);
  };

  /* -----------------------------
     Text formatting
  ------------------------------ */

  const bold = () => exec('bold');
  const italic = () => exec('italic');
  const underline = () => exec('underline');
  const strike = () => exec('strikeThrough');

  /* -----------------------------
     Highlight / color
  ------------------------------ */

  const highlight = (color = '#fff3a0') => {
    // Some browsers require backColor instead
    try {
      exec('hiliteColor', color);
    } catch {
      exec('backColor', color);
    }
  };

  const clearHighlight = () => {
    exec('hiliteColor', 'transparent');
  };

  /* -----------------------------
     Font styling (for selected text)
  ------------------------------ */

  const setFontFamily = (fontFamily: string) => {
    exec('fontName', fontFamily);
  };

  const setFontSize = (size: number) => {
    // execCommand fontSize uses values 1-7, but we can use CSS instead
    focusEditor();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    const span = document.createElement('span');
    span.style.fontSize = `${size}px`;
    
    try {
      range.surroundContents(span);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (error) {
      console.warn('Could not set font size:', error);
    }
  };

  const setLineHeight = (lineHeight: number) => {
    focusEditor();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    const span = document.createElement('span');
    span.style.lineHeight = lineHeight.toString();
    
    try {
      range.surroundContents(span);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (error) {
      console.warn('Could not set line height:', error);
    }
  };

  /* -----------------------------
     Selection helpers (VERY useful for AI)
  ------------------------------ */

  const getSelectionText = (): string => {
    const sel = window.getSelection();
    return sel ? sel.toString() : '';
  };

  const hasSelection = (): boolean => {
    const sel = window.getSelection();
    return !!sel && !sel.isCollapsed;
  };

  /* -----------------------------
     Wrapping utilities
     (for annotations, comments later)
  ------------------------------ */

  const wrapSelection = (tag: string, className?: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    const wrapper = document.createElement(tag);
    if (className) wrapper.className = className;

    try {
      range.surroundContents(wrapper);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (error) {
      console.warn('Could not wrap selection:', error);
    }
  };

  /* -----------------------------
     Public API
  ------------------------------ */

  return {
    // Formatting
    bold,
    italic,
    underline,
    strike,

    // Highlighting
    highlight,
    clearHighlight,

    // Font styling
    setFontFamily,
    setFontSize,
    setLineHeight,

    // Selection
    getSelectionText,
    hasSelection,

    // Advanced (future AI / comments)
    wrapSelection,
  };
}