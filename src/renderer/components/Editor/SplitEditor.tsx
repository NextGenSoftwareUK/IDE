import React, { useState, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Editor } from './Editor';
import { MarkdownPreview } from '../MarkdownPreview/MarkdownPreview';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './SplitEditor.css';

export const SplitEditor: React.FC = () => {
  const [split, setSplit] = useState(false);
  const [mdPreview, setMdPreview] = useState(false);
  const { tabs, activeTabPath, setActiveTab } = useWorkspace();

  const isMarkdown = activeTabPath?.match(/\.(md|mdx|markdown)$/i) != null;

  // Auto-close preview when switching away from a markdown file
  useEffect(() => {
    if (!isMarkdown) setMdPreview(false);
  }, [isMarkdown]);

  // Ctrl+Shift+V toggles markdown preview
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        if (isMarkdown) setMdPreview((v) => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isMarkdown]);

  // Second pane: default to the second open tab, or same as first
  const [rightTabPath, setRightTabPath] = useState<string | null>(null);

  const effectiveRightPath = rightTabPath ?? (tabs.length > 1 ? tabs[1].path : activeTabPath);

  const showPreview = mdPreview && isMarkdown;

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
        {isMarkdown && (
          <button
            type="button"
            className={`split-toggle ${showPreview ? 'active' : ''}`}
            title={showPreview ? 'Close preview (Ctrl+Shift+V)' : 'Open markdown preview (Ctrl+Shift+V)'}
            onClick={() => setMdPreview((v) => !v)}
          >
            👁
          </button>
        )}
      </div>
      {split ? (
        <PanelGroup direction="horizontal" autoSaveId="oasis-ide-split" className="split-panel-group">
          <Panel defaultSize={showPreview ? 34 : 50} minSize={20} order={1}>
            <Editor paneId="left" />
          </Panel>
          <PanelResizeHandle className="split-resize-handle" />
          <Panel defaultSize={showPreview ? 33 : 50} minSize={20} order={2}>
            <Editor
              paneId="right"
              overrideTabPath={effectiveRightPath ?? undefined}
              onTabChange={setRightTabPath}
              availableTabs={tabs}
            />
          </Panel>
          {showPreview && (
            <>
              <PanelResizeHandle className="split-resize-handle" />
              <Panel defaultSize={33} minSize={20} order={3}>
                <MarkdownPreview onClose={() => setMdPreview(false)} />
              </Panel>
            </>
          )}
        </PanelGroup>
      ) : showPreview ? (
        <PanelGroup direction="horizontal" autoSaveId="oasis-ide-md-preview" className="split-panel-group">
          <Panel defaultSize={55} minSize={20} order={1}>
            <Editor paneId="left" className="split-editor-single" />
          </Panel>
          <PanelResizeHandle className="split-resize-handle" />
          <Panel defaultSize={45} minSize={20} order={2}>
            <MarkdownPreview onClose={() => setMdPreview(false)} />
          </Panel>
        </PanelGroup>
      ) : (
        <Editor paneId="left" className="split-editor-single" />
      )}
    </div>
  );
};
