import React, { useState, useCallback, useRef } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const SearchPanel: React.FC = () => {
  const { workspacePath, openFile } = useWorkspace();
  const { success, error: toastError } = useToast();
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [extFilter, setExtFilter] = useState('');
  const [excludeFilter, setExcludeFilter] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [replacing, setReplacing] = useState(false);
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
      const excl = excludeFilter.trim()
        ? excludeFilter.split(',').map((e) => e.trim())
        : undefined;
      const hits = await api().searchFiles?.(query, workspacePath ?? undefined, exts, excl) ?? [];
      setResults(hits);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, [query, extFilter, excludeFilter, workspacePath]);

  const runReplaceAll = useCallback(async () => {
    if (!query.trim() || results.length === 0) return;
    setReplacing(true);
    try {
      const uniqueFiles = [...new Set(results.map((r) => r.file))];
      let totalCount = 0;
      let fileCount = 0;
      const pattern = new RegExp(escapeRegex(query), 'g');

      for (const filePath of uniqueFiles) {
        try {
          const content = await api().readFile?.(filePath) ?? '';
          const matches = content.match(pattern);
          if (!matches) continue;
          const updated = content.replace(pattern, replacement);
          await api().writeFile?.(filePath, updated);
          totalCount += matches.length;
          fileCount++;
        } catch {}
      }

      success(`Replaced ${totalCount} occurrence${totalCount !== 1 ? 's' : ''} in ${fileCount} file${fileCount !== 1 ? 's' : ''}`);
      // Re-run search to reflect updated content
      await runSearch();
    } catch (e: any) {
      toastError('Replace failed: ' + (e?.message ?? 'unknown error'));
    } finally {
      setReplacing(false);
    }
  }, [query, replacement, results, runSearch, success, toastError]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') runSearch();
  };

  return (
    <div className="search-panel panel">
      <div className="panel-header">
        <span>Search</span>
        <button
          type="button"
          className="search-toggle-replace"
          title={showReplace ? 'Hide replace' : 'Show replace'}
          onClick={() => setShowReplace((v) => !v)}
        >
          {showReplace ? '▴' : '▾'} Replace
        </button>
      </div>
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
        {showReplace && (
          <input
            type="text"
            className="search-input"
            placeholder="Replace with…"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runReplaceAll(); }}
            spellCheck={false}
            autoComplete="off"
          />
        )}
        <div className="search-row2">
          <input
            type="text"
            className="search-input search-ext-input"
            placeholder="Files: ts,tsx,cs"
            value={extFilter}
            onChange={(e) => setExtFilter(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
          />
          <input
            type="text"
            className="search-input search-ext-input"
            placeholder="Exclude: dist,bin,obj"
            value={excludeFilter}
            onChange={(e) => setExcludeFilter(e.target.value)}
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
          {showReplace && (
            <button
              type="button"
              className="search-btn search-replace-btn"
              onClick={runReplaceAll}
              disabled={replacing || !query.trim() || results.length === 0}
              title={results.length === 0 ? 'Search first' : `Replace all in ${[...new Set(results.map((r) => r.file))].length} files`}
            >
              {replacing ? '…' : 'Replace All'}
            </button>
          )}
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
