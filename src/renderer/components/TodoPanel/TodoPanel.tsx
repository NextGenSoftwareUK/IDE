import React, { useCallback, useEffect, useState } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './TodoPanel.css';

const MARKERS = ['TODO', 'FIXME', 'HACK', 'NOTE', 'XXX'] as const;
type Marker = typeof MARKERS[number];

interface TodoItem {
  path: string;
  line: number;
  marker: Marker;
  text: string;
}

const MARKER_RE = new RegExp(`//\\s*(${MARKERS.join('|')})[:!]?\\s*(.*)`, 'i');

function parseTodos(filePath: string, content: string): TodoItem[] {
  const items: TodoItem[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = MARKER_RE.exec(lines[i]);
    if (m) {
      items.push({
        path: filePath,
        line: i + 1,
        marker: m[1].toUpperCase() as Marker,
        text: m[2].trim(),
      });
    }
  }
  return items;
}

const MARKER_COLOR: Record<Marker, string> = {
  TODO:  '#7dd3fc',
  FIXME: '#f87171',
  HACK:  '#fbbf24',
  NOTE:  '#86efac',
  XXX:   '#f87171',
};

export const TodoPanel: React.FC = () => {
  const { workspacePath } = useWorkspace();
  const [items, setItems] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Marker | 'ALL'>('ALL');

  const scan = useCallback(async () => {
    if (!workspacePath) return;
    setLoading(true);
    try {
      const tree = await window.electronAPI?.listTree?.(workspacePath) ?? [];
      const SOURCE_EXTS = new Set(['ts','tsx','js','jsx','cs','py','css','scss','html','json','md','sh','yaml','yml']);
      const allPaths: string[] = [];
      const collect = (nodes: any[]) => {
        for (const n of nodes) {
          if (n.type === 'file') {
            const ext = n.name.split('.').pop()?.toLowerCase() ?? '';
            if (SOURCE_EXTS.has(ext)) allPaths.push(n.path);
          } else if (n.children) {
            collect(n.children);
          }
        }
      };
      collect(tree);

      const results: TodoItem[] = [];
      await Promise.all(
        allPaths.map(async (p) => {
          try {
            const content = await window.electronAPI?.readFile?.(p) ?? '';
            results.push(...parseTodos(p, content));
          } catch {}
        })
      );
      results.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
      setItems(results);
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  useEffect(() => { scan(); }, [scan]);

  const jump = useCallback((item: TodoItem) => {
    window.dispatchEvent(new CustomEvent('oasis-open-file-line', { detail: { path: item.path, line: item.line } }));
  }, []);

  const visible = filter === 'ALL' ? items : items.filter((i) => i.marker === filter);

  const counts = MARKERS.reduce((acc, m) => {
    acc[m] = items.filter((i) => i.marker === m).length;
    return acc;
  }, {} as Record<Marker, number>);

  const fileName = (p: string) => p.replace(/\\/g, '/').split('/').pop() ?? p;
  const relPath = (p: string) => {
    const rel = workspacePath ? p.replace(workspacePath, '').replace(/^[/\\]/, '') : p;
    return rel.replace(/\\/g, '/');
  };

  return (
    <div className="todo-panel">
      <div className="todo-header">
        <div className="todo-filters">
          <button type="button" className={`todo-filter ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>
            All <span className="todo-count">{items.length}</span>
          </button>
          {MARKERS.map((m) => counts[m] > 0 && (
            <button key={m} type="button" className={`todo-filter todo-filter--${m.toLowerCase()} ${filter === m ? 'active' : ''}`} onClick={() => setFilter(m)}>
              {m} <span className="todo-count">{counts[m]}</span>
            </button>
          ))}
        </div>
        <button type="button" className="todo-refresh" onClick={scan} title="Rescan workspace" disabled={loading}>↺</button>
      </div>

      {loading && <p className="todo-empty">Scanning…</p>}
      {!loading && visible.length === 0 && (
        <p className="todo-empty">{workspacePath ? 'No items found.' : 'Open a workspace to scan.'}</p>
      )}

      <div className="todo-list">
        {visible.map((item, i) => (
          <button key={i} type="button" className="todo-item" onClick={() => jump(item)}>
            <span className="todo-marker" style={{ color: MARKER_COLOR[item.marker] }}>{item.marker}</span>
            <span className="todo-text">{item.text || '(no description)'}</span>
            <span className="todo-loc" title={item.path}>{fileName(item.path)}:{item.line}</span>
            <span className="todo-rel">{relPath(item.path)}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
