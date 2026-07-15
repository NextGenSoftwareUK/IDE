import React, { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './StatusBar.css';

interface StatusBarProps {
  cursorLine?: number;
  cursorCol?: number;
  lspReady?: boolean;
  eol?: 'LF' | 'CRLF';
  indentType?: 'spaces' | 'tabs';
  indentSize?: number;
  errorCount?: number;
  warningCount?: number;
  onEolChange?: (eol: 'LF' | 'CRLF') => void;
  onIndentChange?: (type: 'spaces' | 'tabs', size: number) => void;
}

function languageFromPath(p: string | null): string {
  if (!p) return 'Plain Text';
  const ext = p.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TSX', js: 'JavaScript', jsx: 'JSX',
    cs: 'C#', json: 'JSON', md: 'Markdown', html: 'HTML',
    css: 'CSS', scss: 'SCSS', py: 'Python', yaml: 'YAML', yml: 'YAML',
    txt: 'Plain Text', xml: 'XML', sh: 'Shell', ps1: 'PowerShell',
  };
  return map[ext] ?? (ext.toUpperCase() || 'Plain Text');
}

const INDENT_SIZES = [2, 4, 8];

export function StatusBar({
  cursorLine = 1, cursorCol = 1, lspReady = false,
  eol = 'LF', indentType = 'spaces', indentSize = 2,
  errorCount = 0, warningCount = 0,
  onEolChange, onIndentChange,
}: StatusBarProps) {
  const { workspacePath, activeTabPath } = useWorkspace();
  const [branch, setBranch] = useState<string>('');
  const [indentMenu, setIndentMenu] = useState(false);
  const indentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!workspacePath) { setBranch(''); return; }
    let cancelled = false;
    const refresh = () => {
      window.electronAPI?.gitCurrentBranch?.(workspacePath).then((b) => {
        if (!cancelled) setBranch(b || '');
      });
    };
    refresh();
    const id = setInterval(refresh, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, [workspacePath]);

  // Close indent menu on outside click
  useEffect(() => {
    if (!indentMenu) return;
    const handler = (e: MouseEvent) => {
      if (indentRef.current && !indentRef.current.contains(e.target as Node)) setIndentMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [indentMenu]);

  const lang = languageFromPath(activeTabPath);

  return (
    <div className="status-bar">
      <div className="status-bar__left">
        {branch && (
          <span className="status-bar__item status-bar__branch" title="Git branch">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.75 2.5a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0zm.75 2.25a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5zM4.25 13.5a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0zM5 15.75a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5zM5 3.75A2.25 2.25 0 1 1 5 8.25a2.25 2.25 0 0 1 0-4.5zm0 1.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z"/>
              <path d="M5 7.25v.5A5.25 5.25 0 0 0 10.25 13h1.5a2.25 2.25 0 0 0-2.25-2.25H9A3.75 3.75 0 0 1 5.25 7.75V7.25H5z"/>
            </svg>
            {branch}
          </span>
        )}
        <span className="status-bar__item status-bar__lsp" title="LSP status">
          <span className={`status-bar__dot ${lspReady ? 'status-bar__dot--ready' : 'status-bar__dot--loading'}`} />
          {lspReady ? 'LSP ready' : 'LSP loading'}
        </span>
        {lspReady && (errorCount > 0 || warningCount > 0) && (
          <span className="status-bar__item status-bar__diag" title={`${errorCount} error${errorCount !== 1 ? 's' : ''}, ${warningCount} warning${warningCount !== 1 ? 's' : ''}`}>
            {errorCount > 0 && <span className="status-bar__diag-errors">✗ {errorCount}</span>}
            {warningCount > 0 && <span className="status-bar__diag-warnings">⚠ {warningCount}</span>}
          </span>
        )}
      </div>

      <div className="status-bar__right">
        {/* Indent picker */}
        <div ref={indentRef} className="status-bar__indent-wrap">
          <button
            type="button"
            className="status-bar__item status-bar__btn"
            title="Indentation — click to change"
            onClick={() => setIndentMenu((v) => !v)}
          >
            {indentType === 'spaces' ? `Spaces: ${indentSize}` : `Tab Size: ${indentSize}`}
          </button>
          {indentMenu && (
            <div className="status-bar__menu">
              <div className="status-bar__menu-header">Indent using spaces</div>
              {INDENT_SIZES.map((n) => (
                <button key={n} type="button" className={`status-bar__menu-item ${indentType === 'spaces' && indentSize === n ? 'active' : ''}`}
                  onClick={() => { onIndentChange?.('spaces', n); setIndentMenu(false); }}>
                  {n} spaces
                </button>
              ))}
              <div className="status-bar__menu-header">Indent using tabs</div>
              {INDENT_SIZES.map((n) => (
                <button key={n} type="button" className={`status-bar__menu-item ${indentType === 'tabs' && indentSize === n ? 'active' : ''}`}
                  onClick={() => { onIndentChange?.('tabs', n); setIndentMenu(false); }}>
                  Tab width: {n}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* EOL toggle */}
        <button
          type="button"
          className="status-bar__item status-bar__btn"
          title={`Line endings: ${eol} — click to toggle`}
          onClick={() => onEolChange?.(eol === 'LF' ? 'CRLF' : 'LF')}
        >
          {eol}
        </button>

        <span className="status-bar__item">{lang}</span>
        <span className="status-bar__item status-bar__cursor">
          Ln {cursorLine}, Col {cursorCol}
        </span>
      </div>
    </div>
  );
}
