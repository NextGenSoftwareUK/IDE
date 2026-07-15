import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './ReferencesPanel.css';

interface RefLocation {
  uri: string;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
}

interface RefsResult {
  symbol: string;
  locations: RefLocation[];
}

// Global event bus so the editor can push results into this panel
const listeners = new Set<(r: RefsResult | null) => void>();
export function pushReferences(result: RefsResult | null) {
  listeners.forEach((fn) => fn(result));
}

function uriToPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\/\//, '').replace(/\//g, '\\'));
}

function basename(p: string) {
  return p.replace(/\\/g, '/').split('/').pop() ?? p;
}

function relPath(absPath: string, workspacePath: string | null): string {
  if (!workspacePath) return absPath;
  const rel = absPath.replace(workspacePath, '').replace(/^[/\\]/, '');
  return rel || absPath;
}

export const ReferencesPanel: React.FC = () => {
  const { workspacePath, openFile, setActiveTab } = useWorkspace();
  const [result, setResult] = useState<RefsResult | null>(null);

  useEffect(() => {
    listeners.add(setResult);
    return () => { listeners.delete(setResult); };
  }, []);

  const jumpTo = useCallback(async (loc: RefLocation) => {
    const filePath = uriToPath(loc.uri);
    await openFile(filePath);
    setTimeout(() => {
      const line = loc.range.start.line + 1;
      window.dispatchEvent(new CustomEvent('oasis-goto-line', { detail: line }));
    }, 150);
  }, [openFile]);

  if (!result) {
    return (
      <div className="refs-panel">
        <p className="refs-empty">Press <kbd>Shift+F12</kbd> on a symbol to find all references.</p>
      </div>
    );
  }

  // Group by file
  const byFile = new Map<string, RefLocation[]>();
  for (const loc of result.locations) {
    const key = uriToPath(loc.uri);
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key)!.push(loc);
  }

  return (
    <div className="refs-panel">
      <div className="refs-header">
        <span className="refs-symbol">{result.symbol}</span>
        <span className="refs-count">{result.locations.length} reference{result.locations.length !== 1 ? 's' : ''}</span>
        <button type="button" className="refs-clear" onClick={() => setResult(null)} title="Clear">✕</button>
      </div>
      <div className="refs-list">
        {[...byFile.entries()].map(([filePath, locs]) => (
          <div key={filePath} className="refs-file-group">
            <div className="refs-file-header" title={filePath}>
              <span className="refs-file-name">{basename(filePath)}</span>
              <span className="refs-file-rel">{relPath(filePath, workspacePath)}</span>
              <span className="refs-file-count">{locs.length}</span>
            </div>
            {locs.map((loc, i) => (
              <button
                key={i}
                type="button"
                className="refs-location"
                onClick={() => jumpTo(loc)}
              >
                <span className="refs-line-num">:{loc.range.start.line + 1}</span>
                <span className="refs-col-num">:{loc.range.start.character + 1}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
