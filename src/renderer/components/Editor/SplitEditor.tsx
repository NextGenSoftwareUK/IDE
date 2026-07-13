import React, { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Editor } from './Editor';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './SplitEditor.css';

export const SplitEditor: React.FC = () => {
  const [split, setSplit] = useState(false);
  const { tabs, activeTabPath, setActiveTab } = useWorkspace();

  // Second pane: default to the second open tab, or same as first
  const [rightTabPath, setRightTabPath] = useState<string | null>(null);

  const effectiveRightPath = rightTabPath ?? (tabs.length > 1 ? tabs[1].path : activeTabPath);

  return (
    <div className="split-editor-root">
      <div className="split-editor-toolbar">
        <button
          type="button"
          className={`split-toggle ${split ? 'active' : ''}`}
          title={split ? 'Close split' : 'Split editor'}
          onClick={() => setSplit((s) => !s)}
        >
          ⊟
        </button>
      </div>
      {split ? (
        <PanelGroup direction="horizontal" autoSaveId="oasis-ide-split" className="split-panel-group">
          <Panel defaultSize={50} minSize={20} order={1}>
            <Editor paneId="left" />
          </Panel>
          <PanelResizeHandle className="split-resize-handle" />
          <Panel defaultSize={50} minSize={20} order={2}>
            <Editor
              paneId="right"
              overrideTabPath={effectiveRightPath ?? undefined}
              onTabChange={setRightTabPath}
              availableTabs={tabs}
            />
          </Panel>
        </PanelGroup>
      ) : (
        <Editor paneId="left" className="split-editor-single" />
      )}
    </div>
  );
};
