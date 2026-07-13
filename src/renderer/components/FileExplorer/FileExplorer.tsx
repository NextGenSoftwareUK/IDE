import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import type { TreeNode } from '../../contexts/WorkspaceContext';
import './FileExplorer.css';

// ── Context menu ──────────────────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  node: TreeNode;
}

function ContextMenu({
  menu,
  onClose,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
}: {
  menu: ContextMenuState;
  onClose: () => void;
  onNewFile: (node: TreeNode) => void;
  onNewFolder: (node: TreeNode) => void;
  onRename: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    ...(menu.node.isDirectory
      ? [
          { label: 'New File', action: () => onNewFile(menu.node) },
          { label: 'New Folder', action: () => onNewFolder(menu.node) },
          null,
        ]
      : []),
    { label: 'Rename', action: () => onRename(menu.node) },
    { label: 'Delete', action: () => onDelete(menu.node), danger: true },
  ];

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={i} className="ctx-separator" />
        ) : (
          <button
            key={item.label}
            type="button"
            className={`ctx-item${(item as any).danger ? ' ctx-danger' : ''}`}
            onClick={() => { item.action(); onClose(); }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}

// ── Inline rename input ───────────────────────────────────────────────────────

function InlineInput({
  defaultValue,
  onConfirm,
  onCancel,
}: {
  defaultValue: string;
  onConfirm: (val: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Select filename without extension
    const dotIdx = defaultValue.lastIndexOf('.');
    inputRef.current?.setSelectionRange(0, dotIdx > 0 ? dotIdx : defaultValue.length);
  }, [defaultValue]);

  return (
    <input
      ref={inputRef}
      className="inline-input"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); if (val.trim()) onConfirm(val.trim()); }
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => { if (val.trim()) onConfirm(val.trim()); else onCancel(); }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// ── Tree item ─────────────────────────────────────────────────────────────────

function FileTreeItem({
  node,
  openFile,
  onContextMenu,
  renamingPath,
  newItemParent,
  newItemType,
  onRenameConfirm,
  onNewItemConfirm,
  onEditCancel,
  level,
}: {
  node: TreeNode;
  openFile: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  renamingPath: string | null;
  newItemParent: string | null;
  newItemType: 'file' | 'folder' | null;
  onRenameConfirm: (node: TreeNode, name: string) => void;
  onNewItemConfirm: (parentPath: string, name: string, type: 'file' | 'folder') => void;
  onEditCancel: () => void;
  level: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.isDirectory && node.children && node.children.length > 0;
  const isNewItemTarget = node.isDirectory && node.path === newItemParent;

  // Auto-expand the folder receiving a new item
  useEffect(() => {
    if (isNewItemTarget) setExpanded(true);
  }, [isNewItemTarget]);

  const handleClick = () => {
    if (node.isDirectory) setExpanded((e) => !e);
    else openFile(node.path);
  };

  return (
    <div className="file-tree-item" style={{ paddingLeft: level * 12 + 4 }}>
      <div
        className={`file-tree-node ${node.isDirectory ? 'folder' : 'file'}`}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {node.isDirectory && (
          <span className="file-tree-chevron">{expanded ? '▾' : '▸'}</span>
        )}
        {!node.isDirectory && <span className="file-tree-chevron file-icon">·</span>}

        {renamingPath === node.path ? (
          <InlineInput
            defaultValue={node.name}
            onConfirm={(name) => onRenameConfirm(node, name)}
            onCancel={onEditCancel}
          />
        ) : (
          <span className="file-tree-name">{node.name}</span>
        )}
      </div>

      {node.isDirectory && expanded && (
        <div className="file-tree-children">
          {/* New item input inside this folder */}
          {isNewItemTarget && newItemType && (
            <div className="file-tree-item" style={{ paddingLeft: 12 + 4 }}>
              <div className="file-tree-node file">
                <span className="file-tree-chevron file-icon">·</span>
                <InlineInput
                  defaultValue={newItemType === 'file' ? 'newfile.ts' : 'new-folder'}
                  onConfirm={(name) => onNewItemConfirm(node.path, name, newItemType)}
                  onCancel={onEditCancel}
                />
              </div>
            </div>
          )}
          {hasChildren && node.children!.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              openFile={openFile}
              onContextMenu={onContextMenu}
              renamingPath={renamingPath}
              newItemParent={newItemParent}
              newItemType={newItemType}
              onRenameConfirm={onRenameConfirm}
              onNewItemConfirm={onNewItemConfirm}
              onEditCancel={onEditCancel}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface FileExplorerProps {
  onLoginClick?: () => void;
  onSettingsClick?: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ onLoginClick, onSettingsClick }) => {
  const { workspacePath, recentWorkspaces, tree, pickWorkspace, openWorkspace, openFile, refreshTree } = useWorkspace();
  const { loggedIn, username, logout } = useAuth();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [newItemParent, setNewItemParent] = useState<string | null>(null);
  const [newItemType, setNewItemType] = useState<'file' | 'folder' | null>(null);

  const closeEditing = useCallback(() => {
    setRenamingPath(null);
    setNewItemParent(null);
    setNewItemType(null);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  // Root-level context menu (right-click on blank area)
  const handleRootContextMenu = useCallback((e: React.MouseEvent) => {
    if (!workspacePath) return;
    e.preventDefault();
    const fakeRoot: TreeNode = { name: workspacePath.split(/[\\/]/).pop() ?? '', path: workspacePath, isDirectory: true };
    setContextMenu({ x: e.clientX, y: e.clientY, node: fakeRoot });
  }, [workspacePath]);

  const handleNewFile = useCallback((node: TreeNode) => {
    setNewItemParent(node.path);
    setNewItemType('file');
  }, []);

  const handleNewFolder = useCallback((node: TreeNode) => {
    setNewItemParent(node.path);
    setNewItemType('folder');
  }, []);

  const handleNewItemConfirm = useCallback(async (parentPath: string, name: string, type: 'file' | 'folder') => {
    const sep = parentPath.includes('\\') ? '\\' : '/';
    const fullPath = parentPath + sep + name;
    try {
      if (type === 'file') {
        await window.electronAPI?.createFile?.(fullPath);
        await refreshTree();
        openFile(fullPath);
      } else {
        await window.electronAPI?.createFolder?.(fullPath);
        await refreshTree();
      }
    } catch (e) { console.error(e); }
    closeEditing();
  }, [refreshTree, openFile, closeEditing]);

  const handleRename = useCallback((node: TreeNode) => {
    setRenamingPath(node.path);
  }, []);

  const handleRenameConfirm = useCallback(async (node: TreeNode, newName: string) => {
    const dir = node.path.replace(/[\\/][^\\/]+$/, '');
    const sep = node.path.includes('\\') ? '\\' : '/';
    const newPath = dir + sep + newName;
    try {
      await window.electronAPI?.renameFile?.(node.path, newPath);
      await refreshTree();
    } catch (e) { console.error(e); }
    closeEditing();
  }, [refreshTree, closeEditing]);

  const handleDelete = useCallback(async (node: TreeNode) => {
    const msg = node.isDirectory
      ? `Delete folder "${node.name}" and all its contents?`
      : `Delete "${node.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      await window.electronAPI?.deleteFile?.(node.path);
      await refreshTree();
    } catch (e) { console.error(e); }
  }, [refreshTree]);

  return (
    <div className="file-explorer panel">
      <div className="panel-header file-explorer-header">
        <span>Explorer</span>
        <div className="file-explorer-actions">
          {workspacePath && (
            <>
              <button type="button" className="icon-button" title="New File"
                onClick={() => { setNewItemParent(workspacePath); setNewItemType('file'); }}>
                +f
              </button>
              <button type="button" className="icon-button" title="New Folder"
                onClick={() => { setNewItemParent(workspacePath); setNewItemType('folder'); }}>
                +d
              </button>
            </>
          )}
          <button type="button" className="icon-button" onClick={refreshTree} title="Refresh">↻</button>
          <button type="button" className="open-folder-button" onClick={pickWorkspace}>Open folder</button>
        </div>
      </div>

      <div className="panel-content" onContextMenu={handleRootContextMenu}>
        <div className="file-tree">
          {!workspacePath ? (
            <div className="empty-state">
              <p>No folder open</p>
              <button type="button" className="open-folder-button" onClick={pickWorkspace}>
                Open folder
              </button>
              {recentWorkspaces.length > 0 && (
                <div className="recents-list">
                  <p className="recents-label">Recent</p>
                  {recentWorkspaces.map((r) => (
                    <button key={r} type="button" className="recent-item" title={r}
                      onClick={() => openWorkspace(r)}>
                      {r.replace(/\\/g, '/').split('/').pop()}
                      <span className="recent-path">{r}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* New item at root level */}
              {newItemParent === workspacePath && newItemType && (
                <div className="file-tree-item" style={{ paddingLeft: 4 }}>
                  <div className="file-tree-node file">
                    <span className="file-tree-chevron file-icon">·</span>
                    <InlineInput
                      defaultValue={newItemType === 'file' ? 'newfile.ts' : 'new-folder'}
                      onConfirm={(name) => handleNewItemConfirm(workspacePath, name, newItemType)}
                      onCancel={closeEditing}
                    />
                  </div>
                </div>
              )}
              {tree.length === 0 && newItemParent !== workspacePath && (
                <div className="empty-state"><p>Empty folder</p></div>
              )}
              {tree.map((node) => (
                <FileTreeItem
                  key={node.path}
                  node={node}
                  openFile={openFile}
                  onContextMenu={handleContextMenu}
                  renamingPath={renamingPath}
                  newItemParent={newItemParent}
                  newItemType={newItemType}
                  onRenameConfirm={handleRenameConfirm}
                  onNewItemConfirm={handleNewItemConfirm}
                  onEditCancel={closeEditing}
                  level={0}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onNewFile={handleNewFile}
          onNewFolder={handleNewFolder}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      )}

      <div className="file-explorer-footer">
        {loggedIn ? (
          <>
            <span className="file-explorer-identity" title={username}>{username ?? 'Logged in'}</span>
            <button type="button" className="footer-btn" onClick={() => logout()}>Log out</button>
          </>
        ) : (
          <button type="button" className="footer-btn" onClick={onLoginClick}>Log in to OASIS</button>
        )}
        <button type="button" className="footer-btn footer-btn-icon" onClick={onSettingsClick} title="Settings">⚙</button>
      </div>
    </div>
  );
};
