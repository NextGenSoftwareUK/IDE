import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './StatusBar.css';

interface StatusBarProps {
  cursorLine?: number;
  cursorCol?: number;
  lspReady?: boolean;
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

export function StatusBar({ cursorLine = 1, cursorCol = 1, lspReady = false }: StatusBarProps) {
  const { workspacePath, activeTabPath } = useWorkspace();
  const [branch, setBranch] = useState<string>('');

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
      </div>
      <div className="status-bar__right">
        <span className="status-bar__item">{lang}</span>
        <span className="status-bar__item status-bar__cursor">
          Ln {cursorLine}, Col {cursorCol}
        </span>
      </div>
    </div>
  );
}
