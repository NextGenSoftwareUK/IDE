import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DiagnosticEntry } from '../../App';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './ProblemsPanel.css';

type Linter = 'tsc' | 'eslint';
type Source = 'lsp' | 'linter';

interface LspDiag {
  uri: string;
  file: string;
  line: number;
  col: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
}

interface GroupedDiagnostics {
  [file: string]: Array<DiagnosticEntry | LspDiag>;
}

function lspSevLabel(sev: number): 'error' | 'warning' | 'info' {
  if (sev === 1) return 'error';
  if (sev === 2) return 'warning';
  return 'info';
}

function uriToPath(uri: string): string {
  try {
    return decodeURIComponent(uri.replace(/^file:\/\/\/?/, '').replace(/\//g, '\\'));
  } catch { return uri; }
}

function groupByFile(items: Array<DiagnosticEntry | LspDiag>): GroupedDiagnostics {
  const g: GroupedDiagnostics = {};
  for (const d of items) {
    (g[d.file] ??= []).push(d);
  }
  return g;
}

function shortPath(filePath: string, root?: string | null): string {
  if (root) {
    const rel = filePath.startsWith(root)
      ? filePath.slice(root.length).replace(/^[\\/]/, '')
      : filePath;
    return rel || filePath.replace(/\\/g, '/').split('/').slice(-2).join('/');
  }
  return filePath.replace(/\\/g, '/').split('/').slice(-2).join('/');
}

const SEVERITY_ICON: Record<string, string> = { error: '✕', warning: '⚠', info: 'ℹ' };

interface Props {
  onOpenFile?: (filePath: string, line: number) => void;
}

export const ProblemsPanel: React.FC<Props> = ({ onOpenFile }) => {
  const { workspacePath } = useWorkspace();
  const [source, setSource] = useState<Source>('lsp');
  const [lspDiags, setLspDiags] = useState<LspDiag[]>([]);
  const [linterDiags, setLinterDiags] = useState<DiagnosticEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [linterError, setLinterError] = useState<string | null>(null);
  const [activeLinter, setActiveLinter] = useState<Linter>('tsc');
  const lspMapRef = useRef<Map<string, LspDiag[]>>(new Map());

  // Subscribe to live LSP diagnostics
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onLspDiagnostics) return;
    return api.onLspDiagnostics((params: { uri: string; diagnostics: any[] }) => {
      const file = uriToPath(params.uri);
      const items: LspDiag[] = params.diagnostics.map((d: any) => ({
        uri: params.uri,
        file,
        line: d.range.start.line + 1,
        col: d.range.start.character + 1,
        message: d.message,
        severity: lspSevLabel(d.severity),
        code: d.code?.toString(),
      }));
      lspMapRef.current.set(params.uri, items);
      const all: LspDiag[] = [];
      lspMapRef.current.forEach((v) => all.push(...v));
      setLspDiags(all);
    });
  }, []);

  const runLinter = useCallback(async (linter: Linter) => {
    if (!workspacePath) { setLinterError('No workspace open'); return; }
    setRunning(true);
    setLinterError(null);
    setActiveLinter(linter);
    setSource('linter');
    try {
      const api = window.electronAPI;
      const result = linter === 'tsc'
        ? await api.diagnosticsRunTsc()
        : await api.diagnosticsRunEslint();
      if (result.error) setLinterError(result.error);
      setLinterDiags(result.diagnostics as DiagnosticEntry[]);
    } catch (e: any) {
      setLinterError(e?.message ?? 'Unknown error');
    } finally {
      setRunning(false);
    }
  }, [workspacePath]);

  const displayed = source === 'lsp' ? lspDiags : linterDiags;
  const grouped = groupByFile(displayed);
  const errorCount = displayed.filter((d) => d.severity === 'error').length;
  const warnCount = displayed.filter((d) => d.severity === 'warning').length;
  const infoCount = displayed.filter((d) => d.severity === 'info').length;

  const lspErrorCount = lspDiags.filter((d) => d.severity === 'error').length;
  const lspWarnCount = lspDiags.filter((d) => d.severity === 'warning').length;

  return (
    <div className="problems-panel">
      <div className="problems-toolbar">
        <div className="prob-source-tabs">
          <button
            type="button"
            className={`prob-source-tab ${source === 'lsp' ? 'active' : ''}`}
            onClick={() => setSource('lsp')}
          >
            LSP
            {lspErrorCount > 0 && <span className="prob-tab-badge prob-tab-badge--error">{lspErrorCount}</span>}
            {lspErrorCount === 0 && lspWarnCount > 0 && <span className="prob-tab-badge prob-tab-badge--warn">{lspWarnCount}</span>}
          </button>
          <button
            type="button"
            className={`prob-source-tab ${source === 'linter' ? 'active' : ''}`}
            onClick={() => setSource('linter')}
          >
            Linter
          </button>
        </div>

        <span className="problems-counts">
          {errorCount > 0 && <span className="prob-count error">✕ {errorCount}</span>}
          {warnCount > 0 && <span className="prob-count warning">⚠ {warnCount}</span>}
          {infoCount > 0 && <span className="prob-count info">ℹ {infoCount}</span>}
          {displayed.length === 0 && !running && !linterError && source === 'lsp' && (
            <span className="prob-count ok">No problems</span>
          )}
        </span>

        {source === 'linter' && (
          <div className="problems-actions">
            <button
              type="button"
              className={`prob-run-btn ${activeLinter === 'tsc' ? 'active' : ''}`}
              onClick={() => runLinter('tsc')}
              disabled={running}
            >
              {running && activeLinter === 'tsc' ? '⟳ Running…' : 'tsc'}
            </button>
            <button
              type="button"
              className={`prob-run-btn ${activeLinter === 'eslint' ? 'active' : ''}`}
              onClick={() => runLinter('eslint')}
              disabled={running}
            >
              {running && activeLinter === 'eslint' ? '⟳ Running…' : 'eslint'}
            </button>
            {linterDiags.length > 0 && (
              <button type="button" className="prob-clear-btn" onClick={() => setLinterDiags([])}>Clear</button>
            )}
          </div>
        )}

        {source === 'lsp' && lspDiags.length > 0 && (
          <button type="button" className="prob-clear-btn" onClick={() => { lspMapRef.current.clear(); setLspDiags([]); }}>
            Clear
          </button>
        )}
      </div>

      {linterError && source === 'linter' && <p className="problems-error">{linterError}</p>}

      {displayed.length === 0 && !running && (
        <p className="problems-empty">
          {source === 'lsp'
            ? (workspacePath ? 'No LSP diagnostics — open files to get live errors.' : 'Open a workspace to see live diagnostics.')
            : (workspacePath ? 'Click tsc or eslint to run a full workspace check.' : 'Open a workspace to run diagnostics.')}
        </p>
      )}

      <div className="problems-list">
        {Object.entries(grouped).map(([file, items]) => (
          <div key={file} className="prob-file-group">
            <div className="prob-file-header" title={file}>
              <span className="prob-file-name">{shortPath(file, workspacePath)}</span>
              <span className="prob-file-count">{items.length}</span>
            </div>
            {items.map((d, i) => (
              <button
                key={i}
                type="button"
                className={`prob-item prob-${d.severity}`}
                onClick={() => onOpenFile?.(d.file, d.line)}
                title={d.message}
              >
                <span className="prob-icon">{SEVERITY_ICON[d.severity] ?? 'ℹ'}</span>
                <span className="prob-message">{d.message}</span>
                <span className="prob-location">:{d.line}:{d.col}</span>
                {d.code && <span className="prob-code">{d.code}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
