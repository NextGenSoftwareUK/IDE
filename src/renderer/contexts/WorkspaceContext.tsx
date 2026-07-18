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
  pinned?: boolean;
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
  // tab history navigation
  navigateBack: () => void;
  navigateForward: () => void;
  // tab pinning
  togglePin: (path: string) => void;
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
  // Tab navigation history (ref-based to avoid stale closures)
  const tabsRef = useRef<EditorTab[]>([]);
  const tabHistoryRef = useRef<string[]>([]);
  const historyIdxRef = useRef(-1);
  const isHistoryNavRef = useRef(false);

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

  // Keep tabsRef in sync so callbacks can read current tabs without stale closures
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);


  // Auto-save all dirty tabs on window blur (onFocusChange mode)
  useEffect(() => {
    const handler = () => {
      if (autoSaveSettingsRef.current.mode !== 'onFocusChange') return;
      setTabs((prev) => {
        const dirty = prev.filter((t) => t.content !== t.savedContent);
        if (dirty.length === 0) return prev;
        dirty.forEach((t) => {
          window.electronAPI?.writeFile?.(t.path, t.content);
        });
        return prev.map((t) => t.content !== t.savedContent ? { ...t, savedContent: t.content } : t);
      });
    };
    window.addEventListener('blur', handler);
    return () => window.removeEventListener('blur', handler);
  }, []);

  // Auto-reload open tabs when an external process changes a file on disk
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onFileChanged) return;
    return api.onFileChanged((changedPath) => {
      const tab = tabsRef.current.find((t) => t.path === changedPath);
      if (!tab) return;
      // Only silently reload clean tabs; never clobber unsaved edits
      if (tab.content !== tab.savedContent) return;
      api.readFile?.(changedPath).then((newContent) => {
        if (newContent === tab.savedContent) return; // no actual change
        setTabs((prev) =>
          prev.map((t) =>
            t.path === changedPath ? { ...t, content: newContent, savedContent: newContent } : t
          )
        );
      }).catch(() => {});
    });
  }, []);

  // Load recents, restore workspace + tabs on mount
  useEffect(() => {
    window.electronAPI?.getRecents?.().then((r) => setRecentWorkspaces(r ?? []));

    // Try to restore persisted tabs first; fall back to bare workspace path
    window.electronAPI?.tabsGet?.().then(async (saved) => {
      const wsPath = saved?.workspacePath ?? null;
      if (!wsPath) {
        // No persisted tabs — just restore workspace path if main already has one
        const p = await window.electronAPI?.getWorkspacePath?.();
        if (p) {
          setWorkspacePath(p);
          window.electronAPI?.listTree?.().then((list: any[]) => setTree(list ?? []));
          window.electronAPI?.lspStart?.(p);
        }
        return;
      }
      // Restore workspace
      await window.electronAPI?.setWorkspacePath?.(wsPath);
      setWorkspacePath(wsPath);
      const list = await window.electronAPI?.listTree?.() ?? [];
      setTree(list);
      window.electronAPI?.lspStart?.(wsPath);

      // Restore tabs
      const paths = saved?.tabs ?? [];
      const metaMap = new Map((saved?.meta ?? []).map((m: { path: string; pinned?: boolean }) => [m.path, m]));
      const restored: EditorTab[] = [];
      for (const p of paths) {
        try {
          const content = await window.electronAPI?.readFile?.(p) ?? '';
          const pinned = metaMap.get(p)?.pinned ?? false;
          restored.push({ path: p, content, savedContent: content, ...(pinned ? { pinned: true } : {}) });
        } catch { /* file may have been deleted */ }
      }
      if (restored.length > 0) {
        setTabs(restored);
        const active = saved?.activeTab && restored.find((t) => t.path === saved.activeTab)
          ? saved.activeTab
          : restored[0].path;
        tabHistoryRef.current = [active];
        historyIdxRef.current = 0;
        setActiveTabPathState(active);
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
    window.electronAPI?.tabsSave?.(dir, [], null);
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

  const closeTab = useCallback((path: string, force = false) => {
    // Pinned tabs can't be closed unless forced
    if (!force) {
      const tab = tabsRef.current.find((t) => t.path === path);
      if (tab?.pinned) return;
    }
    // Remove closed path from history
    const cleanHist = tabHistoryRef.current.filter((p) => p !== path);
    tabHistoryRef.current = cleanHist;
    historyIdxRef.current = Math.min(historyIdxRef.current, cleanHist.length - 1);

    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path);
      if (idx < 0) return prev;
      const next = prev.filter((_, i) => i !== idx);
      setActiveTabPathState((active) => {
        if (active !== path) return active;
        if (next.length === 0) return null;
        return next[Math.max(0, idx - 1)].path;
      });
      return next;
    });
  }, []);

  const setActiveTab = useCallback((path: string) => {
    if (!isHistoryNavRef.current) {
      const hist = tabHistoryRef.current;
      const idx = historyIdxRef.current;
      const trimmed = hist.slice(0, idx + 1);
      if (trimmed[trimmed.length - 1] !== path) {
        const next = [...trimmed, path];
        tabHistoryRef.current = next;
        historyIdxRef.current = next.length - 1;
      }
    }
    setActiveTabPathState(path);
  }, []);

  const navigateBack = useCallback(() => {
    const idx = historyIdxRef.current;
    if (idx <= 0) return;
    const path = tabHistoryRef.current[idx - 1];
    if (!path) return;
    historyIdxRef.current = idx - 1;
    isHistoryNavRef.current = true;
    setActiveTabPathState(path);
    isHistoryNavRef.current = false;
  }, []);

  // oasis-open-file-line: open a file and jump to a line (used by TodoPanel)
  useEffect(() => {
    const handler = async (e: Event) => {
      const { path, line } = (e as CustomEvent<{ path: string; line: number }>).detail;
      await openFile(path);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('oasis-goto-line', { detail: line }));
      }, 150);
    };
    window.addEventListener('oasis-open-file-line', handler);
    return () => window.removeEventListener('oasis-open-file-line', handler);
  }, [openFile]);

  const navigateForward = useCallback(() => {
    const idx = historyIdxRef.current;
    const hist = tabHistoryRef.current;
    if (idx >= hist.length - 1) return;
    const path = hist[idx + 1];
    if (!path) return;
    historyIdxRef.current = idx + 1;
    isHistoryNavRef.current = true;
    setActiveTabPathState(path);
    isHistoryNavRef.current = false;
  }, []);

  const togglePin = useCallback((path: string) => {
    setTabs((prev) => {
      const updated = prev.map((t) => t.path === path ? { ...t, pinned: !t.pinned } : t);
      // Sort: pinned tabs first, preserving relative order within each group
      const pinned = updated.filter((t) => t.pinned);
      const unpinned = updated.filter((t) => !t.pinned);
      return [...pinned, ...unpinned];
    });
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

  // Persist tabs (including pinned state) whenever they change
  useEffect(() => {
    if (!workspacePath) return;
    const paths = tabs.map((t) => t.path);
    const meta = tabs.filter((t) => t.pinned).map((t) => ({ path: t.path, pinned: true }));
    window.electronAPI?.tabsSave?.(workspacePath, paths, activeTabPath, meta.length > 0 ? meta : undefined);
  }, [tabs, activeTabPath, workspacePath]);

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
    navigateBack,
    navigateForward,
    togglePin,
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
