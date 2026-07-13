import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
import './GitPanel.css';

interface GitFile { path: string; status: string; }
interface GitCommit { hash: string; message: string; author: string; date: string; }

type GitView = 'changes' | 'log' | 'diff';

const STATUS_LABELS: Record<string, string> = {
  M: 'modified', A: 'added', D: 'deleted', R: 'renamed',
  C: 'copied', U: 'unmerged', '?': 'untracked', '!': 'ignored',
};

const api = () => window.electronAPI;

function statusColor(s: string): string {
  if (s === 'M') return '#e3b341';
  if (s === 'A') return '#3fb950';
  if (s === 'D') return '#f85149';
  if (s === '?') return '#6a80a8';
  return '#a8bfd8';
}

export const GitPanel: React.FC = () => {
  const { workspacePath } = useWorkspace();
  const { success, error: toastError } = useToast();
  const [view, setView] = useState<GitView>('changes');
  const [files, setFiles] = useState<GitFile[]>([]);
  const [log, setLog] = useState<GitCommit[]>([]);
  const [diff, setDiff] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [commitMsg, setCommitMsg] = useState('');
  const [stagedFiles, setStagedFiles] = useState<Set<string>>(new Set());
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const dir = workspacePath;

  const refresh = useCallback(async () => {
    if (!dir) return;
    setLoading(true);
    try {
      const [statusResult, logResult] = await Promise.allSettled([
        api().gitStatus?.(dir) ?? Promise.resolve([]),
        api().gitLog?.(dir, 30) ?? Promise.resolve([]),
      ]);
      if (statusResult.status === 'fulfilled') setFiles(statusResult.value ?? []);
      if (logResult.status === 'fulfilled') setLog(logResult.value ?? []);
    } finally { setLoading(false); }
  }, [dir]);

  useEffect(() => { refresh(); }, [refresh]);

  const showDiff = useCallback(async (filePath: string) => {
    if (!dir) return;
    setSelectedFile(filePath);
    setView('diff');
    const d = await api().gitDiff?.(dir, filePath) ?? '';
    setDiff(d || '(no diff)');
  }, [dir]);

  const toggleStage = useCallback((filePath: string) => {
    setStagedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath); else next.add(filePath);
      return next;
    });
  }, []);

  const stageAll = useCallback(() => {
    setStagedFiles(new Set(files.map((f) => f.path)));
  }, [files]);

  const doCommit = useCallback(async () => {
    if (!dir || !commitMsg.trim() || stagedFiles.size === 0) return;
    setCommitting(true);
    setCommitResult(null);
    try {
      const result = await api().gitCommit?.(dir, commitMsg.trim(), [...stagedFiles]);
      if (result?.success) {
        setCommitMsg('');
        setStagedFiles(new Set());
        setCommitResult({ ok: true, msg: 'Committed successfully.' });
        success('Committed successfully');
        await refresh();
      } else {
        const msg = result?.error ?? 'Commit failed.';
        setCommitResult({ ok: false, msg });
        toastError(msg);
      }
    } finally { setCommitting(false); }
  }, [dir, commitMsg, stagedFiles, refresh]);

  if (!dir) {
    return (
      <div className="git-panel panel">
        <div className="panel-header">Git</div>
        <div className="git-empty">Open a workspace folder to use Git.</div>
      </div>
    );
  }

  return (
    <div className="git-panel panel">
      <div className="panel-header">
        <div className="git-tabs">
          {(['changes', 'log', 'diff'] as GitView[]).map((v) => (
            <button
              key={v}
              type="button"
              className={`git-tab ${view === v ? 'active' : ''}`}
              onClick={() => setView(v)}
            >
              {v === 'changes' ? `Changes${files.length ? ` (${files.length})` : ''}` : v === 'log' ? 'Log' : 'Diff'}
            </button>
          ))}
        </div>
        <button type="button" className="git-refresh-btn" onClick={refresh} disabled={loading} title="Refresh">
          {loading ? '⟳' : '↺'}
        </button>
      </div>

      {view === 'changes' && (
        <div className="git-changes-view">
          <div className="git-file-list">
            {files.length === 0 && <p className="git-empty-small">No changes.</p>}
            {files.map((f) => (
              <div
                key={f.path}
                className={`git-file-row ${stagedFiles.has(f.path) ? 'staged' : ''}`}
                onClick={() => showDiff(f.path)}
                title={`${STATUS_LABELS[f.status] ?? f.status}: ${f.path}`}
              >
                <input
                  type="checkbox"
                  checked={stagedFiles.has(f.path)}
                  onChange={(e) => { e.stopPropagation(); toggleStage(f.path); }}
                  className="git-file-checkbox"
                />
                <span className="git-file-status" style={{ color: statusColor(f.status) }}>
                  {f.status}
                </span>
                <span className="git-file-name">{f.path.replace(/\\/g, '/').split('/').pop()}</span>
                <span className="git-file-path">{f.path.replace(/\\/g, '/')}</span>
              </div>
            ))}
          </div>

          <div className="git-commit-area">
            {files.length > 0 && (
              <button type="button" className="git-stage-all-btn" onClick={stageAll}>
                Stage all ({files.length})
              </button>
            )}
            <textarea
              className="git-commit-input"
              placeholder="Commit message…"
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              rows={3}
            />
            <button
              type="button"
              className="git-commit-btn"
              disabled={committing || !commitMsg.trim() || stagedFiles.size === 0}
              onClick={doCommit}
            >
              {committing ? 'Committing…' : `Commit (${stagedFiles.size} files)`}
            </button>
            {commitResult && (
              <p className={`git-commit-result ${commitResult.ok ? 'ok' : 'err'}`}>
                {commitResult.msg}
              </p>
            )}
          </div>
        </div>
      )}

      {view === 'log' && (
        <div className="git-log-view">
          {log.length === 0 && <p className="git-empty-small">No commits yet.</p>}
          {log.map((c) => (
            <div key={c.hash} className="git-log-entry">
              <span className="git-log-hash">{c.hash}</span>
              <span className="git-log-msg">{c.message}</span>
              <span className="git-log-meta">{c.author} · {c.date.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      )}

      {view === 'diff' && (
        <div className="git-diff-view">
          {selectedFile && <div className="git-diff-filename">{selectedFile}</div>}
          <pre className="git-diff-content">{diff || 'Select a changed file to view its diff.'}</pre>
        </div>
      )}
    </div>
  );
};
