import React, { createContext, useCallback, useContext, useState } from 'react';

interface StatusBarState {
  cursorLine: number;
  cursorCol: number;
  lspReady: boolean;
  eol: 'LF' | 'CRLF';
  indentType: 'spaces' | 'tabs';
  indentSize: number;
}

interface StatusBarContextValue extends StatusBarState {
  setCursor: (line: number, col: number) => void;
  setLspReady: (ready: boolean) => void;
  setEol: (eol: 'LF' | 'CRLF') => void;
  setIndent: (type: 'spaces' | 'tabs', size: number) => void;
}

const StatusBarContext = createContext<StatusBarContextValue | null>(null);

export function StatusBarProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StatusBarState>({
    cursorLine: 1, cursorCol: 1, lspReady: false,
    eol: 'LF', indentType: 'spaces', indentSize: 2,
  });

  const setCursor = useCallback((line: number, col: number) => {
    setState((s) => ({ ...s, cursorLine: line, cursorCol: col }));
  }, []);

  const setLspReady = useCallback((ready: boolean) => {
    setState((s) => ({ ...s, lspReady: ready }));
  }, []);

  const setEol = useCallback((eol: 'LF' | 'CRLF') => {
    setState((s) => ({ ...s, eol }));
  }, []);

  const setIndent = useCallback((indentType: 'spaces' | 'tabs', indentSize: number) => {
    setState((s) => ({ ...s, indentType, indentSize }));
  }, []);

  return (
    <StatusBarContext.Provider value={{ ...state, setCursor, setLspReady, setEol, setIndent }}>
      {children}
    </StatusBarContext.Provider>
  );
}

export function useStatusBar() {
  const ctx = useContext(StatusBarContext);
  if (!ctx) throw new Error('useStatusBar must be used within StatusBarProvider');
  return ctx;
}
