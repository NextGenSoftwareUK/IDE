import React, { ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const childrenArray = React.Children.toArray(children);
  // [0] Explorer, [1] Editor, [2] Right panel (stack or single), [3] BottomPanel, [4] AgentPanel

  return (
    <div className="layout">
      <PanelGroup direction="vertical" autoSaveId="oasis-ide-vertical">
        {/* Main area: Explorer | Editor | Right */}
        <Panel defaultSize={70} minSize={25} order={1} className="layout-main-panel">
          <PanelGroup direction="horizontal" autoSaveId="oasis-ide-horizontal">
            <Panel defaultSize={15} minSize={10} maxSize={35} order={1}>
              {childrenArray[0]}
            </Panel>
            <PanelResizeHandle className="layout-resize-handle layout-resize-handle-h" />
            <Panel defaultSize={60} minSize={30} order={2}>
              {childrenArray[1]}
            </Panel>
            <PanelResizeHandle className="layout-resize-handle layout-resize-handle-h" />
            <Panel defaultSize={25} minSize={15} maxSize={45} order={3}>
              {childrenArray[2]}
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle className="layout-resize-handle layout-resize-handle-v" />
        {/* Bottom: Terminal (tabs) + Agents - draggable to resize */}
        <Panel defaultSize={30} minSize={10} maxSize={85} order={2} className="layout-bottom-panel">
          <div className="bottom-panel">
            {childrenArray.slice(3)}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
};
