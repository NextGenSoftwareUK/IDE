import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './SymbolSearch.css';

// LSP SymbolKind numbers → labels
const KIND_LABELS: Record<number, string> = {
  1: 'File', 2: 'Module', 3: 'Namespace', 4: 'Package', 5: 'Class',
  6: 'Method', 7: 'Property', 8: 'Field', 9: 'Constructor', 10: 'Enum',
  11: 'Interface', 12: 'Function', 13: 'Variable', 14: 'Constant',
  15: 'String', 16: 'Number', 17: 'Boolean', 18: 'Array', 19: 'Object',
  20: 'Key', 21: 'Null', 22: 'EnumMember', 23: 'Struct', 24: 'Event',
  25: 'Operator', 26: 'TypeParameter',
};

const KIND_ICONS: Record<number, string> = {
  5: '⬡', 6: '⬡', 9: '⬡',   // class-like
  12: 'ƒ', 11: '◇',           // function, interface
  13: '○', 14: '●',           // var, const
  7: '⊕', 8: '⊕',            // property, field
  10: '⊞', 22: '⊞',          // enum
};

function kindIcon(k: number): string { return KIND_ICONS[k] ?? '•'; }
function kindLabel(k: number): string { return KIND_LABELS[k] ?? 'Symbol'; }

function uriToPath(uri: string): string {
  return uri.replace(/^file:\/\/\//, '').replace(/\//g, '\\');
}

interface SymbolItem {
  name: string;
  kind: number;
  containerName?: string;
  filePath: string;
  fileName: string;
  line: number;
  character: number;
}

interface Props { onClose: () => void; }

export const SymbolSearch: React.FC<Props> = ({ onClose }) => {
  const { openFile } = useWorkspace();
  const [query, setQuery] = useState('@');
  const [symbols, setSymbols] = useState<SymbolItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const search = useCallback((q: string) => {
    const trimmed = q.startsWith('@') ? q.slice(1) : q;
    setLoading(true);
    window.electronAPI?.lspWorkspaceSymbols?.(trimmed).then((raw) => {
      const items: SymbolItem[] = (raw ?? []).slice(0, 60).map((s: any) => {
        const loc = s.location ?? {};
        const uri: string = loc.uri ?? '';
        const fp = uriToPath(uri);
        const parts = fp.replace(/\\/g, '/').split('/');
        return {
          name: s.name,
          kind: s.kind ?? 0,
          containerName: s.containerName,
          filePath: fp,
          fileName: parts[parts.length - 1],
          line: (loc.range?.start?.line ?? 0) + 1,
          character: loc.range?.start?.character ?? 0,
        };
      });
      setSymbols(items);
      setSelected(0);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 200);
  }, [query, search]);

  const pick = useCallback((item: SymbolItem) => {
    openFile(item.filePath);
    onClose();
  }, [openFile, onClose]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, symbols.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (symbols[selected]) pick(symbols[selected]); }
  }, [symbols, selected, pick, onClose]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${selected}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  return (
    <div className="ss-backdrop" onClick={onClose}>
      <div className="ss-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKey}>
        <div className="ss-input-row">
          <span className="ss-at">@</span>
          <input
            ref={inputRef}
            className="ss-input"
            placeholder="Search symbols…"
            value={query.startsWith('@') ? query.slice(1) : query}
            onChange={(e) => setQuery('@' + e.target.value)}
          />
          {loading && <span className="ss-spinner">⟳</span>}
          <kbd className="ss-esc">Esc</kbd>
        </div>
        <div className="ss-list" ref={listRef}>
          {!loading && symbols.length === 0 && (
            <p className="ss-empty">No symbols found — open files first so the LSP can index them.</p>
          )}
          {symbols.map((s, i) => (
            <button
              key={`${s.filePath}:${s.line}:${s.name}`}
              type="button"
              data-idx={i}
              className={`ss-item ${i === selected ? 'ss-selected' : ''}`}
              onClick={() => pick(s)}
              onMouseEnter={() => setSelected(i)}
            >
              <span className="ss-icon" data-kind={s.kind}>{kindIcon(s.kind)}</span>
              <span className="ss-name">{s.name}</span>
              {s.containerName && <span className="ss-container">{s.containerName}</span>}
              <span className="ss-meta">{s.fileName}:{s.line}</span>
              <span className="ss-kind">{kindLabel(s.kind)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
