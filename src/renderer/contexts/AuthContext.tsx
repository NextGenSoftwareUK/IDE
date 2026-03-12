import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface AuthState {
  loggedIn: boolean;
  username?: string;
  avatarId?: string;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ loggedIn: false });

  const refreshStatus = useCallback(async () => {
    if (!window.electronAPI?.authGetStatus) return;
    const status = await window.electronAPI.authGetStatus();
    setState({
      loggedIn: status.loggedIn,
      username: status.username,
      avatarId: status.avatarId
    });
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const login = useCallback(async (username: string, password: string) => {
    if (typeof window.electronAPI?.authLogin !== 'function') {
      return {
        success: false,
        error: 'App bridge not ready. Quit OASIS IDE completely and open it again, then try logging in.'
      };
    }
    const result = await window.electronAPI.authLogin(username, password);
    if (result.success) {
      setState({ loggedIn: true, username: result.username ?? username, avatarId: result.avatarId });
      return { success: true };
    }
    return { success: false, error: result.error ?? 'Login failed' };
  }, []);

  const logout = useCallback(async () => {
    if (!window.electronAPI?.authLogout) return;
    await window.electronAPI.authLogout();
    setState({ loggedIn: false });
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    refreshStatus
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
