import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './TerminalPanel.css';

const XTERM_OPTIONS = {
  theme: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#d4d4d4',
    cursorAccent: '#1e1e1e',
    selectionBackground: '#264f78',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#e5e5e5',
  },
  fontFamily: "'Fira Code', 'Consolas', monospace",
  fontSize: 13,
  cursorBlink: true,
};

interface TerminalInstanceProps {
  sessionId: string;
  isActive: boolean;
  registerClear: (fn: (() => void) | null) => void;
}

const TerminalInstance: React.FC<TerminalInstanceProps> = ({
  sessionId,
  isActive,
  registerClear,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current || !window.electronAPI) return;

    const term = new XTerm(XTERM_OPTIONS as any);
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const unsub =
      window.electronAPI.onTerminalData?.((sid, data) => {
        if (sid === sessionId) term.write(data);
      }) ?? null;

    term.onData((data) => {
      window.electronAPI?.terminalWrite?.(sessionId, data);
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (sessionId) {
        window.electronAPI?.terminalResize?.(sessionId, term.cols, term.rows);
      }
    });
    resizeObserver.observe(containerRef.current);
    fitAddon.fit();

    return () => {
      resizeObserver.disconnect();
      unsub?.();
      window.electronAPI?.terminalDestroy?.(sessionId);
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      registerClear(null);
    };
  }, [sessionId]);

  useEffect(() => {
    if (isActive && termRef.current) {
      registerClear(() => termRef.current?.clear());
      return () => registerClear(null);
    }
  }, [isActive, registerClear]);

  return <div ref={containerRef} className="terminal-instance" />;
};

export const TerminalPanel: React.FC = () => {
  const { workspacePath } = useWorkspace();
  const cwd = workspacePath ?? undefined;

  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const clearRef = useRef<(() => void) | null>(null);
  const registerClear = useCallback((fn: (() => void) | null) => {
    clearRef.current = fn;
  }, []);

  // Create first terminal on mount (or retry when no sessions)
  useEffect(() => {
    if (!window.electronAPI?.terminalCreate) {
      setTerminalError('Terminal not available');
      return;
    }
    if (sessionIds.length > 0 && retryKey === 0) return;
    setTerminalError(null);
    window.electronAPI.terminalCreate(cwd).then(
      (id: string) => {
        setSessionIds((prev) => (prev.length === 0 ? [id] : prev));
        setActiveId((prev) => prev ?? id);
      },
      (err: Error) => {
        setTerminalError(
          err?.message || 'Shell failed to start (e.g. node-pty). Try: npm rebuild node-pty'
        );
      }
    );
  }, [cwd, retryKey, sessionIds.length]);

  const addTerminal = useCallback(() => {
    if (!window.electronAPI?.terminalCreate) return;
    setTerminalError(null);
    window.electronAPI.terminalCreate(cwd).then(
      (id: string) => {
        setSessionIds((prev) => [...prev, id]);
        setActiveId(id);
      },
      (err: Error) => {
        setTerminalError(err?.message || 'Failed to create terminal');
      }
    );
  }, [cwd]);

  const killTerminal = useCallback((id: string) => {
    setSessionIds((prev) => {
      const next = prev.filter((s) => s !== id);
      setActiveId((current) => (current === id ? next[0] ?? null : current));
      return next;
    });
  }, []);

  const clearActive = useCallback(() => {
    clearRef.current?.();
  }, []);

  const startTerminal = useCallback(() => {
    setSessionIds([]);
    setActiveId(null);
    setTerminalError(null);
    setRetryKey((k) => k + 1);
  }, []);

  return (
    <div className="terminal-panel">
      <div className="terminal-panel-header">
        <div className="terminal-tabs">
          {sessionIds.map((id, i) => (
            <div
              key={id}
              className={`terminal-tab ${activeId === id ? 'active' : ''}`}
            >
              <button
                type="button"
                className="terminal-tab-label"
                onClick={() => setActiveId(id)}
              >
                Terminal {i + 1}
              </button>
              <button
                type="button"
                className="terminal-tab-kill"
                onClick={() => killTerminal(id)}
                title="Kill terminal"
                aria-label="Kill terminal"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="terminal-btn-new"
            onClick={addTerminal}
            title="New terminal"
          >
            +
          </button>
        </div>
        <div className="terminal-toolbar">
          {workspacePath && (
            <span className="terminal-cwd" title={workspacePath}>
              {workspacePath}
            </span>
          )}
          <button
            type="button"
            className="terminal-btn-clear"
            onClick={clearActive}
            title="Clear"
          >
            Clear
          </button>
          {terminalError && (
            <button
              type="button"
              className="terminal-retry"
              onClick={startTerminal}
            >
              Retry
            </button>
          )}
        </div>
      </div>
      {terminalError && sessionIds.length === 0 ? (
        <div className="terminal-panel-error">
          <p className="terminal-error-title">Terminal couldn’t start</p>
          <p>{terminalError}</p>
          <p className="terminal-hint">
            You don’t need to install a separate terminal — the IDE uses your system shell (e.g. zsh).
            This error usually means the <strong>node-pty</strong> addon must be rebuilt for Electron.
          </p>
          <p className="terminal-hint">
            In a normal terminal, from the <strong>OASIS-IDE</strong> folder, run:
          </p>
          <p className="terminal-command">
            <code>npm run rebuild:terminal</code>
          </p>
          <p className="terminal-hint">
            Then quit and reopen OASIS IDE and try again.
          </p>
          <p className="terminal-hint terminal-hint-sub">
            If rebuild fails with <em>No module named &apos;distutils&apos;</em> (Python 3.12+), run:{' '}
            <code>python3 -m pip install setuptools</code>, then run <code>npm run rebuild:terminal</code> again.
          </p>
          <button
            type="button"
            className="terminal-retry-btn"
            onClick={startTerminal}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="terminal-panel-content">
          {sessionIds.map((id) => (
            <div
              key={id}
              className="terminal-instance-wrap"
              style={{ display: activeId === id ? 'block' : 'none' }}
            >
              <TerminalInstance
                sessionId={id}
                isActive={activeId === id}
                registerClear={registerClear}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
