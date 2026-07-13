import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useToast } from './ToastContext';

export interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
  isDirectory: boolean;
}

export interface EditorTab {
  path: string;
  content: string;
  savedContent: string; // last saved version — dirty = content !== savedContent
}

interface WorkspaceContextValue {
  workspacePath: string | null;
  recentWorkspaces: string[];
  tree: TreeNode[];
  tabs: EditorTab[];
  activeTabPath: string | null;
  // derived convenience getters
  openFilePath: string | null;
  fileContent: string;
  dirty: boolean;
  // actions
  pickWorkspace: () => Promise<void>;
  openWorkspace: (dir: string) => Promise<void>;
  refreshTree: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  closeTab: (path: string) => void;
  setActiveTab: (path: string) => void;
  setFileContent: (content: string) => void;
  setDirty: (dirty: boolean) => void;
  save: () => Promise<void>;
  saveTab: (path: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { success, error: toastError } = useToast();
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabPath, setActiveTabPathState] = useState<string | null>(null);
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveSettingsRef = useRef<{ mode: string; delay: number }>({ mode: 'off', delay: 1500 });

  // Load auto-save settings and keep them in a ref (avoids re-creating setFileContent)
  useEffect(() => {
    const load = () => {
      window.electronAPI?.settingsGet?.().then((s) => {
        autoSaveSettingsRef.current = {
          mode: s?.EDITOR_AUTO_SAVE ?? 'off',
          delay: parseInt(s?.EDITOR_AUTO_SAVE_DELAY ?? '1500', 10) || 1500,
        };
      });
    };
    load();
    // Reload after settings save (crude but effective)
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  // Load recents and restore last workspace on mount
  useEffect(() => {
    window.electronAPI?.getRecents?.().then((r) => setRecentWorkspaces(r ?? []));
    window.electronAPI?.getWorkspacePath?.().then((p: string | null) => {
      if (p) {
        setWorkspacePath(p);
        window.electronAPI?.listTree?.().then((list: any[]) => setTree(list ?? []));
        window.electronAPI?.lspStart?.(p);
      }
    });
  }, []);

  const openWorkspace = useCallback(async (dir: string) => {
    await window.electronAPI?.setWorkspacePath?.(dir);
    setWorkspacePath(dir);
    const list = await window.electronAPI?.listTree?.() ?? [];
    setTree(list);
    setTabs([]);
    setActiveTabPathState(null);
    window.electronAPI?.getRecents?.().then((r) => setRecentWorkspaces(r ?? []));
  }, []);

  const pickWorkspace = useCallback(async () => {
    if (!window.electronAPI?.pickWorkspace) return;
    const path = await window.electronAPI.pickWorkspace();
    if (path) await openWorkspace(path);
  }, [openWorkspace]);

  const refreshTree = useCallback(async () => {
    if (!workspacePath || !window.electronAPI?.listTree) return;
    const list = await window.electronAPI.listTree();
    setTree(list ?? []);
  }, [workspacePath]);

  // Auto-refresh tree when the file watcher fires (debounced 400ms)
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onWorkspaceChanged) return;
    const unsub = api.onWorkspaceChanged(() => {
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
      refreshDebounceRef.current = setTimeout(() => { refreshTree(); }, 400);
    });
    return () => { unsub(); if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current); };
  }, [refreshTree]);

  const openFile = useCallback(async (path: string) => {
    // If already open, just switch to it
    setTabs((prev) => {
      const exists = prev.find((t) => t.path === path);
      if (exists) return prev;
      return prev; // will be updated after content loads
    });

    const existing = tabs.find((t) => t.path === path);
    if (existing) {
      setActiveTabPathState(path);
      return;
    }

    if (!window.electronAPI?.readFile) return;
    try {
      const content = await window.electronAPI.readFile(path);
      setTabs((prev) => {
        if (prev.find((t) => t.path === path)) {
          // Loaded while we were waiting — just activate
          return prev;
        }
        return [...prev, { path, content, savedContent: content }];
      });
      setActiveTabPathState(path);
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }, [tabs]);

  const closeTab = useCallback((path: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path);
      if (idx < 0) return prev;
      const next = prev.filter((_, i) => i !== idx);
      setActiveTabPathState((active) => {
        if (active !== path) return active;
        // Activate adjacent tab
        if (next.length === 0) return null;
        return next[Math.max(0, idx - 1)].path;
      });
      return next;
    });
  }, []);

  const setActiveTab = useCallback((path: string) => {
    setActiveTabPathState(path);
  }, []);

  const setFileContent = useCallback((content: string) => {
    setTabs((prev) =>
      prev.map((t) => t.path === activeTabPath ? { ...t, content } : t)
    );
    // Auto-save debounce
    if (autoSaveSettingsRef.current.mode === 'afterDelay' && activeTabPath) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      const path = activeTabPath;
      autoSaveTimerRef.current = setTimeout(() => {
        setTabs((prev) => {
          const tab = prev.find((t) => t.path === path);
          if (!tab || tab.content === tab.savedContent) return prev;
          window.electronAPI?.writeFile?.(path, tab.content).then(() => {
            setTabs((p) => p.map((t) => t.path === path ? { ...t, savedContent: t.content } : t));
          });
          return prev;
        });
      }, autoSaveSettingsRef.current.delay);
    }
  }, [activeTabPath]);

  // Legacy compat — mark a tab clean
  const setDirty = useCallback((_dirty: boolean) => {
    if (!_dirty && activeTabPath) {
      setTabs((prev) =>
        prev.map((t) => t.path === activeTabPath ? { ...t, savedContent: t.content } : t)
      );
    }
  }, [activeTabPath]);

  const saveTab = useCallback(async (path: string) => {
    const tab = tabs.find((t) => t.path === path);
    if (!tab || !window.electronAPI?.writeFile) return;
    try {
      await window.electronAPI.writeFile(path, tab.content);
      setTabs((prev) =>
        prev.map((t) => t.path === path ? { ...t, savedContent: t.content } : t)
      );
      const name = path.replace(/\\/g, '/').split('/').pop() ?? path;
      success(`Saved ${name}`);
    } catch (err) {
      console.error('Failed to save file:', err);
      toastError('Save failed');
    }
  }, [tabs]);

  const save = useCallback(async () => {
    if (activeTabPath) await saveTab(activeTabPath);
  }, [activeTabPath, saveTab]);

  // Derived convenience values for the active tab
  const activeTab = tabs.find((t) => t.path === activeTabPath) ?? null;
  const openFilePath = activeTab?.path ?? null;
  const fileContent = activeTab?.content ?? '';
  const dirty = activeTab ? activeTab.content !== activeTab.savedContent : false;

  const value: WorkspaceContextValue = {
    workspacePath,
    recentWorkspaces,
    tree,
    tabs,
    activeTabPath,
    openFilePath,
    fileContent,
    dirty,
    pickWorkspace,
    openWorkspace,
    refreshTree,
    openFile,
    closeTab,
    setActiveTab,
    setFileContent,
    setDirty,
    save,
    saveTab,
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
