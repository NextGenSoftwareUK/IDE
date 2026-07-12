import React, { useState, useCallback } from 'react';
import { DiagnosticEntry } from '../../App';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './ProblemsPanel.css';

type Linter = 'tsc' | 'eslint';

interface GroupedDiagnostics {
  [file: string]: DiagnosticEntry[];
}

function groupByFile(diagnostics: DiagnosticEntry[]): GroupedDiagnostics {
  const g: GroupedDiagnostics = {};
  for (const d of diagnostics) {
    (g[d.file] ??= []).push(d);
  }
  return g;
}

function shortPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').slice(-2).join('/');
}

const SEVERITY_ICON: Record<string, string> = {
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

interface Props {
  onOpenFile?: (filePath: string, line: number) => void;
}

export const ProblemsPanel: React.FC<Props> = ({ onOpenFile }) => {
  const { workspacePath } = useWorkspace();
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeLinter, setActiveLinter] = useState<Linter>('tsc');

  const runLinter = useCallback(async (linter: Linter) => {
    if (!workspacePath) { setError('No workspace open'); return; }
    setRunning(true);
    setError(null);
    setActiveLinter(linter);
    try {
      const api = window.electronAPI;
      const result = linter === 'tsc'
        ? await api.diagnosticsRunTsc()
        : await api.diagnosticsRunEslint();
      if (result.error) setError(result.error);
      setDiagnostics(result.diagnostics as DiagnosticEntry[]);
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error');
    } finally {
      setRunning(false);
    }
  }, [workspacePath]);

  const grouped = groupByFile(diagnostics);
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warnCount = diagnostics.filter((d) => d.severity === 'warning').length;

  return (
    <div className="problems-panel">
      <div className="problems-toolbar">
        <span className="problems-counts">
          {errorCount > 0 && <span className="prob-count error">✕ {errorCount}</span>}
          {warnCount > 0 && <span className="prob-count warning">⚠ {warnCount}</span>}
          {diagnostics.length === 0 && !running && !error && (
            <span className="prob-count ok">No problems</span>
          )}
        </span>
        <div className="problems-actions">
          <button
            type="button"
            className={`prob-run-btn ${activeLinter === 'tsc' ? 'active' : ''}`}
            onClick={() => runLinter('tsc')}
            disabled={running}
          >
            {running && activeLinter === 'tsc' ? '⟳ Running tsc…' : 'Run tsc'}
          </button>
          <button
            type="button"
            className={`prob-run-btn ${activeLinter === 'eslint' ? 'active' : ''}`}
            onClick={() => runLinter('eslint')}
            disabled={running}
          >
            {running && activeLinter === 'eslint' ? '⟳ Running eslint…' : 'Run eslint'}
          </button>
          {diagnostics.length > 0 && (
            <button type="button" className="prob-clear-btn" onClick={() => setDiagnostics([])}>
              Clear
            </button>
          )}
        </div>
      </div>

      {error && <p className="problems-error">{error}</p>}

      {!running && diagnostics.length === 0 && !error && (
        <p className="problems-empty">
          {workspacePath
            ? 'Click "Run tsc" or "Run eslint" to check for problems.'
            : 'Open a workspace to run diagnostics.'}
        </p>
      )}

      <div className="problems-list">
        {Object.entries(grouped).map(([file, items]) => (
          <div key={file} className="prob-file-group">
            <div className="prob-file-header">
              <span className="prob-file-name">{shortPath(file)}</span>
              <span className="prob-file-count">{items.length}</span>
            </div>
            {items.map((d, i) => (
              <button
                key={i}
                type="button"
                className={`prob-item prob-${d.severity}`}
                onClick={() => onOpenFile?.(d.file, d.line)}
              >
                <span className="prob-icon">{SEVERITY_ICON[d.severity] ?? 'ℹ'}</span>
                <span className="prob-message">{d.message}</span>
                <span className="prob-location">{shortPath(d.file)}:{d.line}:{d.col}</span>
                <span className="prob-code">{d.code}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
