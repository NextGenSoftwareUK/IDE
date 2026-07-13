import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './CommandPalette.css';

interface FileResult {
  path: string;
  name: string;
  dir: string;
}

function flattenTree(nodes: any[], results: FileResult[] = []): FileResult[] {
  for (const n of nodes) {
    if (!n.isDirectory) {
      const parts = n.path.replace(/\\/g, '/').split('/');
      results.push({ path: n.path, name: parts[parts.length - 1], dir: parts.slice(0, -1).join('/') });
    }
    if (n.children) flattenTree(n.children, results);
  }
  return results;
}

function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function fuzzyScore(query: string, target: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  // Exact match scores highest
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  return 30;
}

interface Props {
  onClose: () => void;
}

export const CommandPalette: React.FC<Props> = ({ onClose }) => {
  const { tree, openFile } = useWorkspace();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FileResult[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allFiles = React.useMemo(() => flattenTree(tree), [tree]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const filtered = allFiles
      .filter((f) => fuzzyMatch(query, f.name) || fuzzyMatch(query, f.path))
      .sort((a, b) => fuzzyScore(query, b.name) - fuzzyScore(query, a.name))
      .slice(0, 50);
    setResults(filtered);
    setSelected(0);
  }, [query, allFiles]);

  const pick = useCallback(
    (file: FileResult) => {
      openFile(file.path);
      onClose();
    },
    [openFile, onClose],
  );

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selected]) pick(results[selected]);
      }
    },
    [results, selected, pick, onClose],
  );

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  function highlight(text: string, q: string): React.ReactNode {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="cp-highlight">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  return (
    <div className="cp-backdrop" onClick={onClose}>
      <div className="cp-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKey}>
        <div className="cp-input-row">
          <span className="cp-icon">⌕</span>
          <input
            ref={inputRef}
            className="cp-input"
            placeholder="Go to file…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="cp-esc">Esc</kbd>
        </div>
        <div className="cp-list" ref={listRef}>
          {results.length === 0 && (
            <p className="cp-empty">{query ? 'No matching files' : 'No files in workspace'}</p>
          )}
          {results.map((f, i) => (
            <button
              key={f.path}
              type="button"
              data-idx={i}
              className={`cp-item ${i === selected ? 'cp-selected' : ''}`}
              onClick={() => pick(f)}
              onMouseEnter={() => setSelected(i)}
            >
              <span className="cp-item-name">{highlight(f.name, query)}</span>
              <span className="cp-item-dir">{f.dir}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
