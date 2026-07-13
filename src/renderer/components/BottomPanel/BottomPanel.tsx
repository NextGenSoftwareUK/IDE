import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TerminalPanel } from '../Terminal/TerminalPanel';
import { ProblemsPanel } from '../Problems/ProblemsPanel';
import { ScriptsPanel } from '../Scripts/ScriptsPanel';
import './BottomPanel.css';

type BottomTabId = 'terminal' | 'scripts' | 'output' | 'problems' | 'debug';

interface OutputEntry {
  ts: number;
  kind: 'tool-call' | 'tool-result' | 'info';
  text: string;
}

const TABS: { id: BottomTabId; label: string }[] = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'scripts', label: 'Scripts' },
  { id: 'output', label: 'Output' },
  { id: 'problems', label: 'Problems' },
  { id: 'debug', label: 'Debug Console' },
];

export const BottomPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<BottomTabId>('terminal');
  const [outputLog, setOutputLog] = useState<OutputEntry[]>([]);
  const [unreadOutput, setUnreadOutput] = useState(0);
  const outputEndRef = useRef<HTMLDivElement>(null);

  const appendOutput = useCallback((entry: OutputEntry) => {
    setOutputLog((prev) => [...prev.slice(-500), entry]);
    setUnreadOutput((n) => n + 1);
  }, []);

  // Subscribe to MCP tool events from the chat tool-use loop
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;
    const unCall = api.onWeb6ToolCall?.((tcs: any[]) => {
      for (const tc of tcs) {
        appendOutput({ ts: Date.now(), kind: 'tool-call', text: `→ ${tc.name ?? tc.Name}(${JSON.stringify(tc.arguments ?? tc.Arguments ?? {}).slice(0, 200)})` });
      }
    });
    const unResult = api.onWeb6ToolResult?.((r: { name: string; result: any }) => {
      appendOutput({ ts: Date.now(), kind: 'tool-result', text: `← ${r.name}: ${JSON.stringify(r.result)?.slice(0, 300)}` });
    });
    return () => { unCall?.(); unResult?.(); };
  }, [appendOutput]);

  useEffect(() => {
    if (activeTab === 'output') {
      setUnreadOutput(0);
      outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, outputLog]);

  return (
    <div className="bottom-panel-wrapper">
      <div className="bottom-panel-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`bottom-panel-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'output' && unreadOutput > 0 && activeTab !== 'output' && (
              <span className="bottom-tab-badge">{unreadOutput}</span>
            )}
          </button>
        ))}
      </div>
      <div className="bottom-panel-content">
        {activeTab === 'terminal' && <TerminalPanel />}
        {activeTab === 'scripts' && <ScriptsPanel />}
        {activeTab === 'output' && (
          <div className="output-panel">
            {outputLog.length === 0 ? (
              <p className="output-empty">MCP tool calls and results will appear here when the AI uses tools.</p>
            ) : (
              <div className="output-log">
                {outputLog.map((e, i) => (
                  <div key={i} className={`output-entry output-${e.kind}`}>
                    <span className="output-ts">{new Date(e.ts).toLocaleTimeString()}</span>
                    <pre className="output-text">{e.text}</pre>
                  </div>
                ))}
                <div ref={outputEndRef} />
              </div>
            )}
            {outputLog.length > 0 && (
              <button type="button" className="output-clear-btn" onClick={() => setOutputLog([])}>Clear</button>
            )}
          </div>
        )}
        {activeTab === 'problems' && <ProblemsPanel />}
        {activeTab === 'debug' && (
          <div className="bottom-panel-placeholder">
            <p>Debug console output will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};
