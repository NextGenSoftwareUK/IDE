import React, { useState, useEffect } from 'react';

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

function App() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setShowPalette((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <ThemeProvider>
      <MCPProvider>
        <AgentProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <Layout>
                <SidebarHost
                  explorer={<FileExplorer
                    onLoginClick={() => setShowLoginModal(true)}
                    onSettingsClick={() => setShowSettings(true)}
                  />}
                  search={<SearchPanel />}
                  git={<GitPanel />}
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
              <StartupWarning />
              {showLoginModal && (
                <LoginModal onClose={() => setShowLoginModal(false)} />
              )}
              {showSettings && (
                <SettingsModal onClose={() => setShowSettings(false)} />
              )}
              {showPalette && (
                <CommandPalette onClose={() => setShowPalette(false)} />
              )}
            </WorkspaceProvider>
          </AuthProvider>
        </AgentProvider>
      </MCPProvider>
    </ThemeProvider>
  );
}

export default App;
