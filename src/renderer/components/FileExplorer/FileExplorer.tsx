import React, { useState } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import type { TreeNode } from '../../contexts/WorkspaceContext';
import './FileExplorer.css';

function FileTreeItem({
  node,
  openFile,
  level = 0,
}: {
  node: TreeNode;
  openFile: (path: string) => void;
  level?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.isDirectory && node.children && node.children.length > 0;

  const handleClick = () => {
    if (node.isDirectory) {
      setExpanded((e) => !e);
    } else {
      openFile(node.path);
    }
  };

  return (
    <div className="file-tree-item" style={{ paddingLeft: level * 12 + 4 }}>
      <div
        className={`file-tree-node ${node.isDirectory ? 'folder' : 'file'}`}
        onClick={handleClick}
      >
        {node.isDirectory && (
          <span className="file-tree-chevron">{expanded ? '▼' : '▶'}</span>
        )}
        {!node.isDirectory && <span className="file-tree-chevron file-icon">📄</span>}
        <span className="file-tree-name">{node.name}</span>
      </div>
      {node.isDirectory && expanded && hasChildren && (
        <div className="file-tree-children">
          {node.children!.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              openFile={openFile}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileExplorerProps {
  onLoginClick?: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ onLoginClick }) => {
  const { workspacePath, tree, pickWorkspace, openFile, refreshTree } = useWorkspace();
  const { loggedIn, username, logout } = useAuth();

  return (
    <div className="file-explorer panel">
      <div className="panel-header file-explorer-header">
        <span>Explorer</span>
        <div className="file-explorer-actions">
          <button
            type="button"
            className="icon-button"
            onClick={refreshTree}
            title="Refresh"
          >
            ↻
          </button>
          <button
            type="button"
            className="open-folder-button"
            onClick={pickWorkspace}
          >
            Open folder
          </button>
        </div>
      </div>
      <div className="panel-content">
        <div className="file-tree">
          {!workspacePath ? (
            <div className="empty-state">
              <p>No folder open</p>
              <p className="hint">Open a folder to get started</p>
              <button
                type="button"
                className="open-folder-button"
                onClick={pickWorkspace}
              >
                Open folder
              </button>
            </div>
          ) : tree.length === 0 ? (
            <div className="empty-state">
              <p>Empty folder</p>
            </div>
          ) : (
            tree.map((node) => (
              <FileTreeItem key={node.path} node={node} openFile={openFile} />
            ))
          )}
        </div>
      </div>
      <div className="file-explorer-footer">
        {loggedIn ? (
          <>
            <span className="file-explorer-identity" title={username}>
              {username ?? 'Logged in'}
            </span>
            <button type="button" className="footer-btn" onClick={() => logout()}>
              Log out
            </button>
          </>
        ) : (
          <button type="button" className="footer-btn" onClick={onLoginClick}>
            Log in to OASIS
          </button>
        )}
      </div>
    </div>
  );
};
