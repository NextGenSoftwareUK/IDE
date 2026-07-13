import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
import './ScriptsPanel.css';

interface RunState {
  id: string;
  script: string;
  output: string;
  running: boolean;
  exitCode: number | null;
}

export const ScriptsPanel: React.FC = () => {
  const { workspacePath } = useWorkspace();
  const { error: toastError } = useToast();
  const [scripts, setScripts] = useState<Record<string, string>>({});
  const [hasPackageJson, setHasPackageJson] = useState(false);
  const [runs, setRuns] = useState<RunState[]>([]);
  const [activeRun, setActiveRun] = useState<string | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  // Load package.json scripts whenever workspace changes
  useEffect(() => {
    if (!workspacePath) { setScripts({}); setHasPackageJson(false); return; }
    const pkgPath = workspacePath.replace(/\\/g, '/') + '/package.json';
    window.electronAPI?.readFile?.(pkgPath)
      .then((raw) => {
        const pkg = JSON.parse(raw);
        setScripts(pkg.scripts ?? {});
        setHasPackageJson(true);
      })
      .catch(() => { setScripts({}); setHasPackageJson(false); });
  }, [workspacePath]);

  // Subscribe to script output/done events
  useEffect(() => {
    const api = window.electronAPI;
    const unOut = api?.onScriptOutput?.((id, chunk) => {
      setRuns((prev) => prev.map((r) => r.id === id ? { ...r, output: r.output + chunk } : r));
    });
    const unDone = api?.onScriptDone?.((id, code) => {
      setRuns((prev) => prev.map((r) => r.id === id ? { ...r, running: false, exitCode: code } : r));
    });
    return () => { unOut?.(); unDone?.(); };
  }, []);

  // Auto-scroll output pane
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [runs]);

  const runScript = useCallback(async (name: string) => {
    if (!workspacePath) return;
    try {
      const id = await window.electronAPI?.scriptsRun?.(workspacePath, name);
      if (!id) return;
      const newRun: RunState = { id, script: name, output: `> npm run ${name}\n\n`, running: true, exitCode: null };
      setRuns((prev) => [newRun, ...prev].slice(0, 10));
      setActiveRun(id);
    } catch (e: any) {
      toastError(e.message ?? 'Failed to run script');
    }
  }, [workspacePath]);

  const killScript = useCallback(async (id: string) => {
    await window.electronAPI?.scriptsKill?.(id);
    setRuns((prev) => prev.map((r) => r.id === id ? { ...r, running: false, exitCode: -1 } : r));
  }, []);

  const clearRun = useCallback((id: string) => {
    setRuns((prev) => prev.filter((r) => r.id !== id));
    if (activeRun === id) setActiveRun(null);
  }, [activeRun]);

  const activeRunState = runs.find((r) => r.id === activeRun) ?? runs[0] ?? null;

  if (!workspacePath) {
    return <div className="scripts-panel"><p className="scripts-empty">Open a workspace to see npm scripts.</p></div>;
  }
  if (!hasPackageJson) {
    return <div className="scripts-panel"><p className="scripts-empty">No package.json found in this workspace.</p></div>;
  }

  const scriptNames = Object.keys(scripts);

  return (
    <div className="scripts-panel">
      <div className="scripts-list-section">
        <div className="scripts-section-header">npm scripts</div>
        {scriptNames.length === 0 && <p className="scripts-empty">No scripts defined in package.json.</p>}
        {scriptNames.map((name) => {
          const runningEntry = runs.find((r) => r.script === name && r.running);
          return (
            <div key={name} className="scripts-row">
              <div className="scripts-row-info">
                <span className="scripts-name">{name}</span>
                <span className="scripts-cmd">{scripts[name]}</span>
              </div>
              <div className="scripts-row-actions">
                {runningEntry ? (
                  <>
                    <span className="scripts-running-dot" />
                    <button
                      type="button"
                      className="scripts-btn scripts-btn-stop"
                      onClick={() => killScript(runningEntry.id)}
                      title="Kill"
                    >■</button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="scripts-btn scripts-btn-run"
                    onClick={() => runScript(name)}
                    title={`npm run ${name}`}
                  >▶</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {runs.length > 0 && (
        <div className="scripts-output-section">
          <div className="scripts-output-tabs">
            {runs.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`scripts-output-tab ${r.id === (activeRunState?.id) ? 'active' : ''}`}
                onClick={() => setActiveRun(r.id)}
              >
                {r.running && <span className="scripts-running-dot" />}
                {!r.running && <span className={`scripts-exit-dot ${r.exitCode === 0 ? 'ok' : 'err'}`} />}
                {r.script}
                <span
                  className="scripts-tab-close"
                  onClick={(e) => { e.stopPropagation(); clearRun(r.id); }}
                >×</span>
              </button>
            ))}
          </div>
          {activeRunState && (
            <pre ref={outputRef} className="scripts-output">{activeRunState.output}</pre>
          )}
        </div>
      )}
    </div>
  );
};
