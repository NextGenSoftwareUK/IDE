import React, { useState, useCallback, useRef } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './SearchPanel.css';

interface SearchResult {
  file: string;
  line: number;
  preview: string;
}

const api = () => window.electronAPI;

function basename(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;
}

function shortenPath(filePath: string, root?: string | null): string {
  if (root && filePath.startsWith(root)) {
    return filePath.slice(root.length).replace(/^[\\/]/, '');
  }
  return filePath;
}

export const SearchPanel: React.FC = () => {
  const { workspacePath, openFile } = useWorkspace();
  const [query, setQuery] = useState('');
  const [extFilter, setExtFilter] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(false);
    try {
      const exts = extFilter.trim()
        ? extFilter.split(',').map((e) => e.trim().replace(/^\./, ''))
        : undefined;
      const hits = await api().searchFiles?.(query, workspacePath ?? undefined, exts) ?? [];
      setResults(hits);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, [query, extFilter, workspacePath]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') runSearch();
  };

  return (
    <div className="search-panel panel">
      <div className="panel-header">Search</div>
      <div className="search-bar-area">
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search in workspace…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
        />
        <div className="search-row2">
          <input
            type="text"
            className="search-input search-ext-input"
            placeholder="Filter: ts,tsx,cs"
            value={extFilter}
            onChange={(e) => setExtFilter(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
          />
          <button
            type="button"
            className="search-btn"
            onClick={runSearch}
            disabled={loading || !query.trim()}
          >
            {loading ? '…' : 'Search'}
          </button>
        </div>
      </div>

      <div className="search-results">
        {!workspacePath && !searched && (
          <p className="search-empty">Open a workspace folder first.</p>
        )}
        {searched && results.length === 0 && (
          <p className="search-empty">No matches found.</p>
        )}
        {results.map((r, i) => (
          <div
            key={i}
            className="search-result-item"
            onClick={() => openFile(r.file)}
            title={r.file}
          >
            <div className="search-result-header">
              <span className="search-result-file">{basename(r.file)}</span>
              <span className="search-result-line">:{r.line}</span>
              <span className="search-result-path">{shortenPath(r.file, workspacePath)}</span>
            </div>
            <pre className="search-result-preview">{r.preview}</pre>
          </div>
        ))}
        {results.length === 500 && (
          <p className="search-cap">Showing first 500 matches — refine your query.</p>
        )}
      </div>
    </div>
  );
};
