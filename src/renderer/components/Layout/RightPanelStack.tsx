import React, { ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import './RightPanelStack.css';

interface RightPanelStackProps {
  children: ReactNode;
}

/**
 * Right column: three vertically resizable sections (Chat, Inbox, OASIS Tools).
 */
export const RightPanelStack: React.FC<RightPanelStackProps> = ({ children }) => {
  const arr = React.Children.toArray(children);
  const [chat, inbox, tools] = [arr[0], arr[1], arr[2]];

  return (
    <div className="right-panel-stack-wrapper">
      <PanelGroup direction="vertical" autoSaveId="oasis-ide-right-stack">
        <Panel defaultSize={45} minSize={15} maxSize={70} order={1}>
          <div className="right-panel-section">{chat}</div>
        </Panel>
        <PanelResizeHandle className="right-panel-resize-handle" />
        <Panel defaultSize={25} minSize={10} maxSize={45} order={2}>
          <div className="right-panel-section">{inbox}</div>
        </Panel>
        <PanelResizeHandle className="right-panel-resize-handle" />
        <Panel defaultSize={30} minSize={15} maxSize={55} order={3}>
          <div className="right-panel-section">{tools}</div>
        </Panel>
      </PanelGroup>
    </div>
  );
};
