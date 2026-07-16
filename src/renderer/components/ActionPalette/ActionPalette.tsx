import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
import './ActionPalette.css';

export interface PaletteAction {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  category?: string;
  run: () => void;
}

interface Props {
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenSymbols: () => void;
  onOpenFiles: () => void;
  onOpenShortcuts: () => void;
  onToggleZen: () => void;
}

function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) if (t[i] === q[qi]) qi++;
  return qi === q.length;
}

export const ActionPalette: React.FC<Props> = ({
  onClose, onOpenSettings, onOpenSymbols, onOpenFiles, onOpenShortcuts, onToggleZen,
}) => {
  const { save, workspacePath } = useWorkspace();
  const { success, error: toastError } = useToast();
  const [query, setQuery] = useState('>');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const actions: PaletteAction[] = [
    { id: 'file.save', label: 'File: Save', shortcut: 'Ctrl+S', category: 'File',
      run: () => { save(); onClose(); } },
    { id: 'file.open', label: 'File: Go to File…', description: 'Fuzzy-search and open any workspace file', shortcut: 'Ctrl+P', category: 'File',
      run: () => { onClose(); onOpenFiles(); } },
    { id: 'file.symbols', label: 'Go to Symbol in Workspace…', description: 'Search functions, classes, and variables', shortcut: 'Ctrl+Shift+O', category: 'Navigate',
      run: () => { onClose(); onOpenSymbols(); } },
    { id: 'view.settings', label: 'Preferences: Open Settings', shortcut: 'Ctrl+,', category: 'Preferences',
      run: () => { onClose(); onOpenSettings(); } },
    { id: 'view.shortcuts', label: 'Help: Keyboard Shortcuts', shortcut: '?', category: 'Help',
      run: () => { onClose(); onOpenShortcuts(); } },
    { id: 'git.refresh', label: 'Git: Refresh Status', category: 'Git',
      run: () => { window.electronAPI?.gitStatus?.(workspacePath ?? '').then(() => success('Git refreshed')); onClose(); } },
    { id: 'editor.format', label: 'Format Document', description: 'Auto-format using the LSP formatter', shortcut: 'Ctrl+Shift+I', category: 'Editor',
      run: () => { window.dispatchEvent(new CustomEvent('oasis-format-document')); onClose(); } },
    { id: 'lsp.restart', label: 'Developer: Restart Language Server', category: 'Developer',
      run: () => {
        window.electronAPI?.lspStop?.().then(() => {
          if (workspacePath) window.electronAPI?.lspStart?.(workspacePath);
          success('Language server restarted');
        });
        onClose();
      }},
    { id: 'window.reload', label: 'Developer: Reload Window', category: 'Developer',
      run: () => { onClose(); setTimeout(() => window.location.reload(), 100); } },
    { id: 'view.zen', label: 'View: Toggle Zen Mode', description: 'Collapse all panels, focus the editor', shortcut: 'Ctrl+K Z', category: 'View',
      run: () => { onClose(); onToggleZen(); } },
    { id: 'view.mdpreview', label: 'View: Toggle Markdown Preview', description: 'Side-by-side preview for .md files', shortcut: 'Ctrl+Shift+V', category: 'View',
      run: () => { onClose(); document.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, shiftKey: true, key: 'V', bubbles: true })); } },
    { id: 'window.minimize', label: 'Window: Minimize', category: 'Window',
      run: () => { window.electronAPI?.minimize?.(); onClose(); } },
    { id: 'window.maximize', label: 'Window: Toggle Maximize', category: 'Window',
      run: () => { window.electronAPI?.maximize?.(); onClose(); } },
  ];

  const q = query.startsWith('>') ? query.slice(1).trim() : query.trim();
  const filtered = actions.filter((a) =>
    fuzzyMatch(q, a.label) || (a.category && fuzzyMatch(q, a.category))
  );

  useEffect(() => { setSelected(0); }, [q]);

  const pick = useCallback((a: PaletteAction) => { a.run(); }, []);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[selected]) pick(filtered[selected]); }
  }, [filtered, selected, pick, onClose]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${selected}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  return (
    <div className="ap-backdrop" onClick={onClose}>
      <div className="ap-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKey}>
        <div className="ap-input-row">
          <span className="ap-chevron">›</span>
          <input
            ref={inputRef}
            className="ap-input"
            placeholder="Type a command…"
            value={query.startsWith('>') ? query.slice(1) : query}
            onChange={(e) => setQuery('>' + e.target.value)}
          />
          <kbd className="ap-esc">Esc</kbd>
        </div>
        <div className="ap-list" ref={listRef}>
          {filtered.length === 0 && <p className="ap-empty">No commands match</p>}
          {filtered.map((a, i) => (
            <button
              key={a.id}
              type="button"
              data-idx={i}
              className={`ap-item ${i === selected ? 'ap-selected' : ''}`}
              onClick={() => pick(a)}
              onMouseEnter={() => setSelected(i)}
            >
              <span className="ap-label">{a.label}</span>
              {a.description && <span className="ap-desc">{a.description}</span>}
              {a.shortcut && <kbd className="ap-shortcut">{a.shortcut}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
