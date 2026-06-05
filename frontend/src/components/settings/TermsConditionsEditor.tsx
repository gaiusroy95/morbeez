import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
};

function countWords(html: string) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return { words: 0, chars: 0 };
  return { words: text.split(' ').filter(Boolean).length, chars: text.length };
}

export function TermsConditionsEditor({ value, onChange, disabled }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState(() => countWords(value));

  useEffect(() => {
    const el = editorRef.current;
    if (!el || el.innerHTML === value) return;
    el.innerHTML = value || '';
    setStats(countWords(value));
  }, [value]);

  const sync = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? '';
    onChange(html);
    setStats(countWords(html));
  }, [onChange]);

  function exec(cmd: string, arg?: string) {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
    sync();
  }

  function insertLink() {
    if (disabled) return;
    const url = window.prompt('Enter URL');
    if (url) exec('createLink', url);
  }

  return (
    <div className="terms-editor">
      <div className="terms-editor-header">
        <div className="terms-editor-header-icon" aria-hidden>
          📄
        </div>
        <div>
          <h3 className="terms-editor-title">Terms &amp; Conditions</h3>
          <p className="terms-editor-subtitle">
            Shown on quotations and invoices. Use headings and lists for clarity.
          </p>
        </div>
      </div>

      <div className="terms-editor-toolbar" role="toolbar" aria-label="Formatting">
        <button type="button" disabled={disabled} onClick={() => exec('bold')} title="Bold">
          <strong>B</strong>
        </button>
        <button type="button" disabled={disabled} onClick={() => exec('italic')} title="Italic">
          <em>I</em>
        </button>
        <button type="button" disabled={disabled} onClick={() => exec('underline')} title="Underline">
          <span style={{ textDecoration: 'underline' }}>U</span>
        </button>
        <span className="terms-editor-toolbar-sep" />
        <button type="button" disabled={disabled} onClick={() => exec('insertUnorderedList')} title="Bullet list">
          • List
        </button>
        <button type="button" disabled={disabled} onClick={() => exec('insertOrderedList')} title="Numbered list">
          1. List
        </button>
        <span className="terms-editor-toolbar-sep" />
        <button type="button" disabled={disabled} onClick={insertLink} title="Link">
          Link
        </button>
        <button type="button" disabled={disabled} onClick={() => exec('removeFormat')} title="Clear formatting">
          Clear
        </button>
      </div>

      <div
        ref={editorRef}
        className="terms-editor-body"
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        data-placeholder="Write your terms and conditions here…"
        onInput={sync}
        onBlur={sync}
      />

      <div className="terms-editor-footer">
        Words: {stats.words} · Characters: {stats.chars}
      </div>
    </div>
  );
}
