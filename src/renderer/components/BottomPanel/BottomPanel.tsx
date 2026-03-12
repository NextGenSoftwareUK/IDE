import React, { useState } from 'react';
import { TerminalPanel } from '../Terminal/TerminalPanel';
import './BottomPanel.css';

type BottomTabId = 'terminal' | 'output' | 'problems' | 'debug';

const TABS: { id: BottomTabId; label: string }[] = [
  { id: 'terminal', label: 'Terminal' },
  { id: 'output', label: 'Output' },
  { id: 'problems', label: 'Problems' },
  { id: 'debug', label: 'Debug Console' },
];

export const BottomPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<BottomTabId>('terminal');

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
          </button>
        ))}
      </div>
      <div className="bottom-panel-content">
        {activeTab === 'terminal' && <TerminalPanel />}
        {activeTab === 'output' && (
          <div className="bottom-panel-placeholder">
            <p>Output from build and tasks will appear here.</p>
          </div>
        )}
        {activeTab === 'problems' && (
          <div className="bottom-panel-placeholder">
            <p>Problems and errors will appear here.</p>
          </div>
        )}
        {activeTab === 'debug' && (
          <div className="bottom-panel-placeholder">
            <p>Debug console output will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};
