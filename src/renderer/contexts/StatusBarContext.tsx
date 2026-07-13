import React, { createContext, useCallback, useContext, useState } from 'react';

interface StatusBarState {
  cursorLine: number;
  cursorCol: number;
  lspReady: boolean;
}

interface StatusBarContextValue extends StatusBarState {
  setCursor: (line: number, col: number) => void;
  setLspReady: (ready: boolean) => void;
}

const StatusBarContext = createContext<StatusBarContextValue | null>(null);

export function StatusBarProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StatusBarState>({ cursorLine: 1, cursorCol: 1, lspReady: false });

  const setCursor = useCallback((line: number, col: number) => {
    setState((s) => ({ ...s, cursorLine: line, cursorCol: col }));
  }, []);

  const setLspReady = useCallback((ready: boolean) => {
    setState((s) => ({ ...s, lspReady: ready }));
  }, []);

  return (
    <StatusBarContext.Provider value={{ ...state, setCursor, setLspReady }}>
      {children}
    </StatusBarContext.Provider>
  );
}

export function useStatusBar() {
  const ctx = useContext(StatusBarContext);
  if (!ctx) throw new Error('useStatusBar must be used within StatusBarProvider');
  return ctx;
}
