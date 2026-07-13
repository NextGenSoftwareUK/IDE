import React, { useCallback, useEffect, useState } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './OutlinePanel.css';

const KIND_ICON: Record<number, string> = {
  1: '📄', 2: '📦', 3: '📦', 4: '📦', 5: '⬡',
  6: 'ƒ', 7: '⊕', 8: '⊕', 9: '⬡', 10: '⊞',
  11: '◇', 12: 'ƒ', 13: '○', 14: '●', 22: '⊞',
  23: '⬡', 24: '⚡', 25: '±', 26: 'T',
};
const KIND_CLASS: Record<number, string> = {
  5: 'kind-class', 9: 'kind-class', 11: 'kind-interface',
  12: 'kind-function', 6: 'kind-function',
  13: 'kind-var', 14: 'kind-const',
  7: 'kind-prop', 8: 'kind-prop',
};

function fileUri(p: string): string {
  return 'file:///' + p.replace(/\\/g, '/');
}

interface DocSymbol {
  name: string;
  kind: number;
  range: { start: { line: number; character: number } };
  children?: DocSymbol[];
}

interface SymbolNodeProps {
  sym: DocSymbol;
  depth: number;
  onJump: (line: number) => void;
}

const SymbolNode: React.FC<SymbolNodeProps> = ({ sym, depth, onJump }) => {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = sym.children && sym.children.length > 0;
  const icon = KIND_ICON[sym.kind] ?? '•';
  const kindCls = KIND_CLASS[sym.kind] ?? '';

  return (
    <div className="outline-node">
      <button
        type="button"
        className="outline-row"
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => {
          if (hasChildren) setOpen((v) => !v);
          onJump(sym.range.start.line + 1);
        }}
      >
        <span className="outline-arrow">{hasChildren ? (open ? '▾' : '▸') : ' '}</span>
        <span className={`outline-icon ${kindCls}`}>{icon}</span>
        <span className="outline-name">{sym.name}</span>
      </button>
      {hasChildren && open && sym.children!.map((child, i) => (
        <SymbolNode key={i} sym={child} depth={depth + 1} onJump={onJump} />
      ))}
    </div>
  );
};

export const OutlinePanel: React.FC = () => {
  const { activeTabPath } = useWorkspace();
  const [symbols, setSymbols] = useState<DocSymbol[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async (path: string) => {
    const uri = fileUri(path);
    setLoading(true);
    setError('');
    try {
      const raw = await window.electronAPI?.lspDocumentSymbols?.(uri) ?? [];
      // LSP returns DocumentSymbol[] (with children) or SymbolInformation[] (flat)
      // Detect by presence of `range` vs `location`
      if (raw.length > 0 && raw[0].location) {
        // SymbolInformation[] — flat list, no nesting
        setSymbols(raw.map((s: any) => ({
          name: s.name,
          kind: s.kind,
          range: s.location.range,
          children: [],
        })));
      } else {
        setSymbols(raw);
      }
    } catch {
      setError('LSP not ready');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeTabPath) { setSymbols([]); return; }
    // Debounce slightly — LSP needs the file open first
    const id = setTimeout(() => refresh(activeTabPath), 400);
    return () => clearTimeout(id);
  }, [activeTabPath, refresh]);

  const jumpToLine = useCallback((line: number) => {
    window.dispatchEvent(new CustomEvent('oasis-goto-line', { detail: line }));
  }, []);

  if (!activeTabPath) {
    return <div className="outline-panel"><p className="outline-empty">Open a file to see its outline.</p></div>;
  }

  return (
    <div className="outline-panel">
      <div className="outline-header">
        <span>Outline</span>
        <button type="button" className="outline-refresh-btn" onClick={() => activeTabPath && refresh(activeTabPath)} title="Refresh">↺</button>
      </div>
      {loading && <p className="outline-empty">Loading…</p>}
      {!loading && error && <p className="outline-empty">{error}</p>}
      {!loading && !error && symbols.length === 0 && (
        <p className="outline-empty">No symbols found. Save the file or wait for LSP to index it.</p>
      )}
      <div className="outline-tree">
        {symbols.map((s, i) => (
          <SymbolNode key={i} sym={s} depth={0} onJump={jumpToLine} />
        ))}
      </div>
    </div>
  );
};
