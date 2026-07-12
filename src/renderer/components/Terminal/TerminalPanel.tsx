import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './TerminalPanel.css';

const XTERM_OPTIONS = {
  theme: {
    background: '#0d1117',
    foreground: '#c9d1d9',
    cursor: '#58a6ff',
    cursorAccent: '#0d1117',
    selectionBackground: '#264f78',
    black: '#000000', red: '#ff7b72', green: '#3fb950',
    yellow: '#d29922', blue: '#58a6ff', magenta: '#bc8cff',
    cyan: '#39c5cf', white: '#b1bac4',
    brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364',
    brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd', brightWhite: '#f0f6fc',
  },
  fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
  fontSize: 13,
  cursorBlink: true,
  scrollback: 5000,
};

type SessionType = 'os' | 'star';

interface TabInfo {
  sessionId: string;
  type: SessionType;
  label: string;
  isDefault: boolean;
}

function makeLabel(type: SessionType, count: number): string {
  return type === 'star' ? `STAR CLI${count > 1 ? ` ${count}` : ''}` : `Shell ${count}`;
}

// ── TerminalInstance ──────────────────────────────────────────────────────────

interface TerminalInstanceProps {
  sessionId: string;
  isActive: boolean;
  registerClear: (fn: (() => void) | null) => void;
}

const TerminalInstance: React.FC<TerminalInstanceProps> = ({ sessionId, isActive, registerClear }) => {
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

    const unsubData = window.electronAPI.onTerminalData?.((sid, data) => {
      if (sid === sessionId) term.write(data);
    }) ?? null;

    const unsubExit = window.electronAPI.onTerminalExit?.((sid) => {
      if (sid === sessionId) term.write('\r\n\x1b[31m[process exited]\x1b[0m\r\n');
    }) ?? null;

    term.onData((data) => {
      window.electronAPI?.terminalWrite?.(sessionId, data);
    });

    const ro = new ResizeObserver(() => {
      fitAddon.fit();
      window.electronAPI?.terminalResize?.(sessionId, term.cols, term.rows);
    });
    ro.observe(containerRef.current);
    fitAddon.fit();

    return () => {
      ro.disconnect();
      unsubData?.();
      unsubExit?.();
      window.electronAPI?.terminalDestroy?.(sessionId);
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      registerClear(null);
    };
  }, [sessionId]);

  useEffect(() => {
    if (isActive && termRef.current) {
      fitAddonRef.current?.fit();
      registerClear(() => termRef.current?.clear());
      return () => registerClear(null);
    }
  }, [isActive, registerClear]);

  return <div ref={containerRef} className="terminal-instance" />;
};

// ── TerminalPanel ─────────────────────────────────────────────────────────────

export const TerminalPanel: React.FC = () => {
  const { workspacePath } = useWorkspace();
  const cwd = workspacePath ?? undefined;

  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starAvailable, setStarAvailable] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const clearRef = useRef<(() => void) | null>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);

  // Track per-type counts for label numbering
  const typeCountsRef = useRef<Record<SessionType, number>>({ os: 0, star: 0 });

  const registerClear = useCallback((fn: (() => void) | null) => {
    clearRef.current = fn;
  }, []);

  // Check STAR availability
  useEffect(() => {
    window.electronAPI?.terminalStarAvailable?.()
      .then((ok: boolean) => setStarAvailable(ok))
      .catch(() => setStarAvailable(false));
  }, []);

  // Load the two pre-created default sessions
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api.terminalGetDefaults?.().then(({ osSessionId, starSessionId }: { osSessionId: string | null; starSessionId: string | null }) => {
      const initialTabs: TabInfo[] = [];

      if (osSessionId) {
        typeCountsRef.current.os = 1;
        initialTabs.push({ sessionId: osSessionId, type: 'os', label: 'Shell 1', isDefault: true });
      }
      if (starSessionId) {
        typeCountsRef.current.star = 1;
        initialTabs.push({ sessionId: starSessionId, type: 'star', label: 'STAR CLI', isDefault: true });
      }

      if (initialTabs.length > 0) {
        setTabs(initialTabs);
        setActiveId(initialTabs[0].sessionId);
      } else {
        // Fallback: create an OS terminal manually
        spawnTerminal('os');
      }
    }).catch(() => {
      spawnTerminal('os');
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close the "new terminal" menu when clicking outside
  useEffect(() => {
    if (!showNewMenu) return;
    const handler = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNewMenu]);

  const spawnTerminal = useCallback(async (type: SessionType) => {
    const api = window.electronAPI;
    if (!api) return;
    setError(null);
    setShowNewMenu(false);
    try {
      const sessionId: string = await api.terminalCreateTyped(type, cwd);
      typeCountsRef.current[type] += 1;
      const label = makeLabel(type, typeCountsRef.current[type]);
      setTabs((prev) => [...prev, { sessionId, type, label, isDefault: false }]);
      setActiveId(sessionId);
    } catch (e: any) {
      setError(e.message ?? 'Failed to create terminal');
    }
  }, [cwd]);

  const closeTab = useCallback((sessionId: string, isDefault: boolean) => {
    if (isDefault) {
      // Warn but still allow closing
      if (!window.confirm('Close this default terminal? You can open a new one with the + button.')) return;
    }
    setTabs((prev) => {
      const next = prev.filter((t) => t.sessionId !== sessionId);
      setActiveId((cur) => cur === sessionId ? (next[0]?.sessionId ?? null) : cur);
      return next;
    });
  }, []);

  const clearActive = useCallback(() => clearRef.current?.(), []);

  const retrySetup = useCallback(() => {
    setError(null);
    spawnTerminal('os');
  }, [spawnTerminal]);

  return (
    <div className="terminal-panel">
      <div className="terminal-panel-header">
        <div className="terminal-tabs">
          {tabs.map((tab) => (
            <div key={tab.sessionId} className={`terminal-tab ${activeId === tab.sessionId ? 'active' : ''} tab-${tab.type}`}>
              <button type="button" className="terminal-tab-label" onClick={() => setActiveId(tab.sessionId)}>
                {tab.type === 'star' && <span className="tab-star-icon">✦</span>}
                {tab.label}
              </button>
              <button
                type="button"
                className="terminal-tab-kill"
                onClick={() => closeTab(tab.sessionId, tab.isDefault)}
                title="Close"
              >
                ×
              </button>
            </div>
          ))}

          {/* New terminal button with dropdown */}
          <div className="terminal-new-wrap" ref={newMenuRef}>
            <button
              type="button"
              className="terminal-btn-new"
              onClick={() => setShowNewMenu((v) => !v)}
              title="New terminal"
            >
              +
            </button>
            {showNewMenu && (
              <div className="terminal-new-menu">
                <button type="button" onClick={() => spawnTerminal('os')}>
                  <span>⬛</span> OS Shell
                </button>
                <button
                  type="button"
                  onClick={() => spawnTerminal('star')}
                  disabled={!starAvailable}
                  title={starAvailable ? undefined : 'STAR CLI not found — build the STAR ODK or set OASIS_STAR_CLI_PATH'}
                >
                  <span>✦</span> STAR CLI
                  {!starAvailable && <span className="menu-unavailable"> (unavailable)</span>}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="terminal-toolbar">
          {workspacePath && (
            <span className="terminal-cwd" title={workspacePath}>
              {workspacePath.length > 40 ? '…' + workspacePath.slice(-38) : workspacePath}
            </span>
          )}
          <button type="button" className="terminal-btn-clear" onClick={clearActive} title="Clear">
            Clear
          </button>
        </div>
      </div>

      {error && tabs.length === 0 ? (
        <div className="terminal-panel-error">
          <p className="terminal-error-title">Terminal couldn't start</p>
          <p>{error}</p>
          <p className="terminal-hint">
            This usually means <strong>node-pty</strong> needs rebuilding for Electron.
          </p>
          <p className="terminal-command"><code>npm run rebuild:terminal</code></p>
          <button type="button" className="terminal-retry-btn" onClick={retrySetup}>Retry</button>
        </div>
      ) : (
        <div className="terminal-panel-content">
          {tabs.map((tab) => (
            <div
              key={tab.sessionId}
              className="terminal-instance-wrap"
              style={{ display: activeId === tab.sessionId ? 'flex' : 'none' }}
            >
              <TerminalInstance
                sessionId={tab.sessionId}
                isActive={activeId === tab.sessionId}
                registerClear={registerClear}
              />
            </div>
          ))}
          {tabs.length === 0 && !error && (
            <div className="terminal-empty">
              <p>No terminal sessions.</p>
              <button type="button" onClick={() => spawnTerminal('os')}>Open Shell</button>
              {starAvailable && (
                <button type="button" onClick={() => spawnTerminal('star')}>Open STAR CLI</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
