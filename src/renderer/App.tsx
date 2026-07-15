import React, { useState, useEffect, useRef } from 'react';

export interface DiagnosticEntry {
  file: string;
  line: number;
  col: number;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}
import { Layout } from './components/Layout/Layout';
import { RightPanelStack } from './components/Layout/RightPanelStack';
import { SidebarHost } from './components/Layout/SidebarHost';
import { StartupWarning } from './components/Layout/StartupWarning';
import { ChatInterface } from './components/Chat/ChatInterface';
import { FileExplorer } from './components/FileExplorer/FileExplorer';
import { SplitEditor } from './components/Editor/SplitEditor';
import { OASISToolsPanel } from './components/OASISTools/OASISToolsPanel';
import { OASISNetworkPanel } from './components/OASISNetwork/OASISNetworkPanel';
import { AgentPanel } from './components/Agents/AgentPanel';
import { BottomPanel } from './components/BottomPanel/BottomPanel';
import { InboxPanel } from './components/Inbox/InboxPanel';
import { SearchPanel } from './components/Search/SearchPanel';
import { GitPanel } from './components/Git/GitPanel';
import { StarWizardPanel } from './components/StarWizard/StarWizardPanel';
import { SettingsModal } from './components/Settings/SettingsModal';
import { ThemeProvider } from './contexts/ThemeContext';
import { MCPProvider } from './contexts/MCPContext';
import { AgentProvider } from './contexts/AgentContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { AuthProvider } from './contexts/AuthContext';
import { LoginModal } from './components/Auth/LoginModal';
import { CommandPalette } from './components/CommandPalette/CommandPalette';
import { ToastProvider } from './contexts/ToastContext';
import { ShortcutsModal } from './components/Shortcuts/ShortcutsModal';
import { StatusBarProvider, useStatusBar } from './contexts/StatusBarContext';
import { StatusBar } from './components/StatusBar/StatusBar';
import { ActionPalette } from './components/ActionPalette/ActionPalette';
import { SymbolSearch } from './components/SymbolSearch/SymbolSearch';
import { OutlinePanel } from './components/Outline/OutlinePanel';

export interface OASISElectronAPI {
  // ── MCP ──────────────────────────────────────────────────────────────────────
  listTools: () => Promise<any[]>;
  executeTool: (toolName: string, args: any) => Promise<any>;
  mcpStatus: () => Promise<string>;

  // ── OASIS Network ─────────────────────────────────────────────────────────────
  healthCheck: () => Promise<any>;
  oasisNetworkStatus: () => Promise<{
    web4?: any; web6?: any; web7?: any; web8?: any; web9?: any; web10?: any;
    mcpServer?: string; starCLI?: boolean; timestamp?: number;
  }>;

  // ── Agents ────────────────────────────────────────────────────────────────────
  discoverAgents: () => Promise<any[]>;
  invokeAgent: (agentId: string, task: string, context: any) => Promise<any>;

  // ── File System ───────────────────────────────────────────────────────────────
  pickWorkspace: () => Promise<string | null>;
  getWorkspacePath: () => Promise<string | null>;
  setWorkspacePath: (dir: string) => Promise<string>;
  listTree: (dir?: string) => Promise<any[]>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  searchFiles: (query: string, dir?: string, extensions?: string[]) => Promise<Array<{ file: string; line: number; preview: string }>>;
  getRecents: () => Promise<string[]>;
  createFile: (filePath: string) => Promise<void>;
  createFolder: (folderPath: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;
  deleteFile: (filePath: string) => Promise<void>;
  onWorkspaceChanged: (cb: () => void) => () => void;
  onFileChanged: (cb: (filePath: string) => void) => () => void;

  // ── Auth ──────────────────────────────────────────────────────────────────────
  authLogin: (username: string, password: string) => Promise<{ success: boolean; username?: string; avatarId?: string; error?: string }>;
  authLogout: () => Promise<void>;
  authGetStatus: () => Promise<{ loggedIn: boolean; username?: string; avatarId?: string }>;

  // ── Chat / local LLM ─────────────────────────────────────────────────────────
  chatHasLLM: () => Promise<boolean>;
  chatComplete: (messages: Array<{ role: string; content: string }>) => Promise<{ content: string; error?: string }>;

  // ── Web4 direct ───────────────────────────────────────────────────────────────
  web4GetAvatar: (avatarId: string) => Promise<any>;
  web4GetKarma: (avatarId: string) => Promise<any>;
  web4GetNFTs: (avatarId: string) => Promise<any>;
  web4GetWallet: (avatarId: string) => Promise<any>;
  web4SearchHolons: (query: string, holonType?: string) => Promise<any[]>;

  // ── Web6 API ──────────────────────────────────────────────────────────────────
  web6HealthCheck: () => Promise<any>;
  web6Complete: (request: any) => Promise<any>;
  web6StreamComplete: (request: any) => Promise<{ ok: boolean; error?: string }>;
  web6FahrnSolve: (request: any) => Promise<any>;
  web6GetAgentCard: () => Promise<any>;
  web6FahrnGetAgents: () => Promise<any[]>;
  web6OrchestratorList: () => Promise<any[]>;
  web6OrchestratorInvoke: (agentId: string, task: string, input: any) => Promise<any>;
  web6GetAvatarContext: (avatarId: string) => Promise<any>;
  web6A2ATaskRun: (task: any) => Promise<any>;
  web6A2ATaskSend: (task: any) => Promise<{ taskId?: string; error?: string }>;
  web6A2ATaskGet: (taskId: string) => Promise<any>;
  web6A2ATaskCancel: (taskId: string) => Promise<any>;
  web6MemorySearch: (query: string, avatarId?: string, limit?: number) => Promise<any[]>;
  web6GetMcpDiscovery: () => Promise<any>;
  web6ListOpenservModels: () => Promise<any[]>;
  web6CompleteWithTools: (request: any) => Promise<{ content?: string; meta?: any; rounds?: number; error?: string }>;
  onWeb6ToolCall: (cb: (toolCalls: any[]) => void) => () => void;
  onWeb6ToolResult: (cb: (result: { name: string; result: any }) => void) => () => void;

  // ── Web7 API ──────────────────────────────────────────────────────────────────
  web7HealthCheck: () => Promise<any>;
  web7CollectiveConsciousness: () => Promise<any>;
  web7Symbiosis: () => Promise<any>;

  // ── Web8 API ──────────────────────────────────────────────────────────────────
  web8HealthCheck: () => Promise<any>;
  web8MeshStatus: () => Promise<any>;
  web8MeshNodes: () => Promise<any[]>;

  // ── Web9 API ──────────────────────────────────────────────────────────────────
  web9HealthCheck: () => Promise<any>;
  web9SingularityStatus: () => Promise<any>;

  // ── Web10 API ─────────────────────────────────────────────────────────────────
  web10HealthCheck: () => Promise<any>;
  web10GetSource: () => Promise<any>;

  // ── Web6 event listeners ──────────────────────────────────────────────────────
  onWeb6StreamChunk: (cb: (delta: string) => void) => () => void;
  onWeb6StreamDone: (cb: (full: string) => void) => () => void;
  onWeb6StreamError: (cb: (err: string) => void) => () => void;
  onWeb6A2ATaskUpdate: (cb: (update: any) => void) => () => void;

  // ── Claude coding agent ───────────────────────────────────────────────────────
  claudeHasAgent: () => Promise<boolean>;
  claudeRunTask: (task: string) => Promise<any>;
  claudeConfirmResponse: (requestId: string, approved: boolean) => Promise<void>;
  onClaudeEvent: (cb: (event: any) => void) => () => void;

  // ── OpenServ coding agent ─────────────────────────────────────────────────────
  openservHasAgent: () => Promise<boolean>;
  openservListModels: () => Promise<any[]>;
  openservRunTask: (task: string, model?: string) => Promise<any>;
  openservConfirmResponse: (requestId: string, approved: boolean) => Promise<void>;
  onOpenservEvent: (cb: (event: any) => void) => () => void;

  // ── A2A Inbox (Web4 legacy) ───────────────────────────────────────────────────
  a2aGetPending: () => Promise<any[]>;
  a2aMarkProcessed: (messageId: string) => Promise<void>;
  a2aSendReply: (toAgentId: string, content: string, params?: Record<string, unknown>) => Promise<any>;

  // ── Terminal ──────────────────────────────────────────────────────────────────
  terminalCreate: (cwd?: string) => Promise<string>;
  terminalCreateTyped: (type: 'os' | 'star', cwd?: string) => Promise<string>;
  terminalWrite: (sessionId: string, data: string) => Promise<void>;
  terminalResize: (sessionId: string, cols: number, rows: number) => Promise<void>;
  terminalDestroy: (sessionId: string) => Promise<void>;
  terminalStarAvailable: () => Promise<boolean>;
  terminalGetDefaults: () => Promise<{ osSessionId: string | null; starSessionId: string | null }>;
  onTerminalData: (callback: (sessionId: string, data: string) => void) => () => void;
  onTerminalExit: (callback: (sessionId: string) => void) => () => void;

  // ── Settings ──────────────────────────────────────────────────────────────────
  settingsGet: () => Promise<Record<string, string>>;
  settingsSave: (settings: Record<string, string>) => Promise<void>;

  // ── Git ───────────────────────────────────────────────────────────────────────
  gitStatus: (dir: string) => Promise<Array<{ path: string; status: string }>>;
  gitDiff: (dir: string, filePath?: string) => Promise<string>;
  gitLog: (dir: string, limit?: number) => Promise<Array<{ hash: string; message: string; author: string; date: string }>>;
  gitCommit: (dir: string, message: string, files: string[]) => Promise<{ success: boolean; error?: string }>;
  gitInit: (dir: string) => Promise<{ success: boolean; error?: string }>;
  gitFileOriginal: (dir: string, filePath: string) => Promise<string>;
  gitBlame: (dir: string, filePath: string) => Promise<Array<{ line: number; hash: string; author: string; summary: string; timestamp: number }>>;
  shellReveal: (filePath: string) => Promise<void>;
  gitCurrentBranch: (dir: string) => Promise<string>;
  gitListBranches: (dir: string) => Promise<Array<{ name: string; current: boolean }>>;
  gitCheckout: (dir: string, branch: string) => Promise<{ success: boolean; error?: string }>;
  gitCreateBranch: (dir: string, branch: string) => Promise<{ success: boolean; error?: string }>;
  tabsGet: () => Promise<{ workspacePath: string; tabs: string[]; activeTab: string | null } | null>;
  tabsSave: (workspacePath: string, tabs: string[], activeTab: string | null) => Promise<void>;

  // ── Scripts runner ────────────────────────────────────────────────────────────
  scriptsRun: (dir: string, script: string) => Promise<string>;
  scriptsKill: (id: string) => Promise<void>;
  onScriptOutput: (cb: (id: string, chunk: string) => void) => () => void;
  onScriptDone: (cb: (id: string, code: number) => void) => () => void;

  // ── STAR ODK wizard ───────────────────────────────────────────────────────────
  starNewApp: (name: string, templateType: string, outputDir: string) => Promise<{ success: boolean; path?: string; output?: string; error?: string }>;
  starGetTemplates: () => Promise<Array<{ id: string; name: string; description: string }>>;

  // ── Diagnostics ───────────────────────────────────────────────────────────────
  diagnosticsRunTsc: () => Promise<{ diagnostics: DiagnosticEntry[]; error?: string }>;
  diagnosticsRunEslint: () => Promise<{ diagnostics: DiagnosticEntry[]; error?: string }>;

  // ── LSP ───────────────────────────────────────────────────────────────────────
  lspStart: (workspaceRoot: string) => Promise<void>;
  lspStop: () => Promise<void>;
  lspOpenDocument: (uri: string, languageId: string, text: string) => Promise<void>;
  lspChangeDocument: (uri: string, text: string, version: number) => Promise<void>;
  lspCloseDocument: (uri: string) => Promise<void>;
  lspCompletion: (uri: string, line: number, character: number) => Promise<any>;
  lspHover: (uri: string, line: number, character: number) => Promise<any>;
  lspDefinition: (uri: string, line: number, character: number) => Promise<any>;
  lspWorkspaceSymbols: (query: string) => Promise<any[]>;
  lspDocumentSymbols: (uri: string) => Promise<any[]>;
  lspSignatureHelp: (uri: string, line: number, character: number) => Promise<any>;
  lspReferences: (uri: string, line: number, character: number) => Promise<any[]>;
  lspRename: (uri: string, line: number, character: number, newName: string) => Promise<any>;
  lspCodeAction: (uri: string, range: any, context: any) => Promise<any[]>;
  lspApplyWorkspaceEdit: (workspaceEdit: any) => Promise<string[]>;
  onLspDiagnostics: (cb: (params: { uri: string; diagnostics: any[] }) => void) => () => void;

  // ── Window ────────────────────────────────────────────────────────────────────
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: OASISElectronAPI;
  }
}

function AppInner() {
  const { cursorLine, cursorCol, lspReady, eol, indentType, indentSize, errorCount, warningCount } = useStatusBar();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPalette, setShowPalette] = useState(false);   // Ctrl+P  — file picker
  const [showActions, setShowActions] = useState(false);   // Ctrl+Shift+P — command palette
  const [showSymbols, setShowSymbols] = useState(false);  // Ctrl+Shift+O — symbol search
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const chordPendingRef = useRef(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

      if (e.key === 'Escape' && zenMode) { setZenMode(false); return; }

      if (chordPendingRef.current) {
        chordPendingRef.current = false;
        if (e.key.toLowerCase() === 'z') { e.preventDefault(); setZenMode((v) => !v); return; }
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        chordPendingRef.current = true;
        setTimeout(() => { chordPendingRef.current = false; }, 1500);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setShowActions((v) => !v);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setShowSymbols((v) => !v);
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setShowPalette((v) => !v);
      }
      if (e.key === '?' && !inInput && !e.ctrlKey && !e.metaKey) {
        setShowShortcuts((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zenMode]);

  return (
    <WorkspaceProvider>
      {zenMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary, #0a1628)' }}>
          <SplitEditor />
          <button
            type="button"
            onClick={() => setZenMode(false)}
            style={{
              position: 'fixed', bottom: 12, right: 16,
              background: 'rgba(10,22,40,0.85)', border: '1px solid #1a3a5c',
              color: '#6a80a8', fontSize: 11, padding: '3px 10px',
              borderRadius: 4, cursor: 'pointer', zIndex: 9999,
            }}
            title="Exit Zen Mode"
          >
            Esc — Exit Zen Mode
          </button>
        </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Layout>
          <SidebarHost
            explorer={<FileExplorer
              onLoginClick={() => setShowLoginModal(true)}
              onSettingsClick={() => setShowSettings(true)}
            />}
            search={<SearchPanel />}
            git={<GitPanel />}
            outline={<OutlinePanel />}
            star={<StarWizardPanel />}
          />
          <SplitEditor />
          <RightPanelStack>
            <ChatInterface />
            <InboxPanel />
            <OASISToolsPanel />
            <OASISNetworkPanel />
          </RightPanelStack>
          <BottomPanel />
          <AgentPanel />
        </Layout>
        <StatusBar
          cursorLine={cursorLine} cursorCol={cursorCol} lspReady={lspReady}
          eol={eol} indentType={indentType} indentSize={indentSize}
          errorCount={errorCount} warningCount={warningCount}
          onEolChange={(e) => window.dispatchEvent(new CustomEvent('oasis-set-eol', { detail: e }))}
          onIndentChange={(t, s) => window.dispatchEvent(new CustomEvent('oasis-set-indent', { detail: { type: t, size: s } }))}
        />
      </div>
      )}
      <StartupWarning />
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showPalette && <CommandPalette onClose={() => setShowPalette(false)} />}
      {showActions && (
        <ActionPalette
          onClose={() => setShowActions(false)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenSymbols={() => setShowSymbols(true)}
          onOpenFiles={() => setShowPalette(true)}
          onOpenShortcuts={() => setShowShortcuts(true)}
          onToggleZen={() => setZenMode((v) => !v)}
        />
      )}
      {showSymbols && <SymbolSearch onClose={() => setShowSymbols(false)} />}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </WorkspaceProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <MCPProvider>
          <AgentProvider>
            <AuthProvider>
              <StatusBarProvider>
                <AppInner />
              </StatusBarProvider>
            </AuthProvider>
          </AgentProvider>
        </MCPProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
