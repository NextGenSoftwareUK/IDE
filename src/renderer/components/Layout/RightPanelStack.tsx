import React, { ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import './RightPanelStack.css';

interface RightPanelStackProps {
  children: ReactNode;
}

/**
 * Right column: four vertically resizable sections (Chat, Inbox, OASIS Tools, OASIS Network).
 */
export const RightPanelStack: React.FC<RightPanelStackProps> = ({ children }) => {
  const arr = React.Children.toArray(children);
  const [chat, inbox, tools, network] = [arr[0], arr[1], arr[2], arr[3]];

  return (
    <div className="right-panel-stack-wrapper">
      <PanelGroup direction="vertical" autoSaveId="oasis-ide-right-stack">
        <Panel defaultSize={40} minSize={15} maxSize={65} order={1}>
          <div className="right-panel-section">{chat}</div>
        </Panel>
        <PanelResizeHandle className="right-panel-resize-handle" />
        <Panel defaultSize={20} minSize={10} maxSize={40} order={2}>
          <div className="right-panel-section">{inbox}</div>
        </Panel>
        <PanelResizeHandle className="right-panel-resize-handle" />
        <Panel defaultSize={20} minSize={10} maxSize={45} order={3}>
          <div className="right-panel-section">{tools}</div>
        </Panel>
        <PanelResizeHandle className="right-panel-resize-handle" />
        <Panel defaultSize={20} minSize={10} maxSize={45} order={4}>
          <div className="right-panel-section">{network}</div>
        </Panel>
      </PanelGroup>
    </div>
  );
};
