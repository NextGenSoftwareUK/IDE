import React, { createContext, useCallback, useContext, useState } from 'react';

export interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
  isDirectory: boolean;
}

interface WorkspaceContextValue {
  workspacePath: string | null;
  tree: TreeNode[];
  openFilePath: string | null;
  fileContent: string;
  dirty: boolean;
  pickWorkspace: () => Promise<void>;
  refreshTree: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  setFileContent: (content: string) => void;
  setDirty: (dirty: boolean) => void;
  save: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [openFilePath, setOpenFilePath] = useState<string | null>(null);
  const [fileContent, setFileContentState] = useState<string>('');
  const [dirty, setDirty] = useState(false);

  const pickWorkspace = useCallback(async () => {
    if (!window.electronAPI?.pickWorkspace) return;
    const path = await window.electronAPI.pickWorkspace();
    if (path) {
      setWorkspacePath(path);
      const list = await window.electronAPI.listTree();
      setTree(list ?? []);
      setOpenFilePath(null);
      setFileContentState('');
      setDirty(false);
    }
  }, []);

  const refreshTree = useCallback(async () => {
    if (!workspacePath || !window.electronAPI?.listTree) return;
    const list = await window.electronAPI.listTree();
    setTree(list ?? []);
  }, [workspacePath]);

  const openFile = useCallback(async (path: string) => {
    if (!window.electronAPI?.readFile) return;
    try {
      const content = await window.electronAPI.readFile(path);
      setOpenFilePath(path);
      setFileContentState(content);
      setDirty(false);
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }, []);

  const setFileContent = useCallback((content: string) => {
    setFileContentState(content);
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    if (!openFilePath || !window.electronAPI?.writeFile) return;
    try {
      await window.electronAPI.writeFile(openFilePath, fileContent);
      setDirty(false);
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  }, [openFilePath, fileContent]);

  const value: WorkspaceContextValue = {
    workspacePath,
    tree,
    openFilePath,
    fileContent,
    dirty,
    pickWorkspace,
    refreshTree,
    openFile,
    setFileContent,
    setDirty,
    save,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
