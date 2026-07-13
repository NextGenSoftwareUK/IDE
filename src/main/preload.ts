import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // ── MCP ────────────────────────────────────────────────────────────────────
  listTools: () => ipcRenderer.invoke('mcp:list-tools'),
  executeTool: (toolName: string, args: any) => ipcRenderer.invoke('mcp:execute-tool', toolName, args),
  mcpStatus: () => ipcRenderer.invoke('mcp:status'),

  // ── OASIS network ──────────────────────────────────────────────────────────
  healthCheck: () => ipcRenderer.invoke('oasis:health-check'),
  /** Returns health status for Web4–Web10, MCP server, and STAR CLI. */
  oasisNetworkStatus: () => ipcRenderer.invoke('oasis:network-status'),

  // ── Agents ─────────────────────────────────────────────────────────────────
  discoverAgents: () => ipcRenderer.invoke('agents:discover'),
  invokeAgent: (agentId: string, task: string, context: any) =>
    ipcRenderer.invoke('agents:invoke', agentId, task, context),

  // ── File System ────────────────────────────────────────────────────────────
  pickWorkspace: () => ipcRenderer.invoke('fs:pick-workspace'),
  getWorkspacePath: () => ipcRenderer.invoke('fs:get-workspace-path'),
  setWorkspacePath: (dir: string) => ipcRenderer.invoke('fs:set-workspace-path', dir),
  listTree: (dir?: string) => ipcRenderer.invoke('fs:list-tree', dir),
  readFile: (path: string) => ipcRenderer.invoke('fs:read-file', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:write-file', path, content),
  onWorkspaceChanged: (cb: () => void) => {
    const h = () => cb();
    ipcRenderer.on('fs:workspace-changed', h);
    return () => ipcRenderer.removeListener('fs:workspace-changed', h);
  },

  // ── Auth ───────────────────────────────────────────────────────────────────
  authLogin: (username: string, password: string) => ipcRenderer.invoke('auth:login', username, password),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  authGetStatus: () => ipcRenderer.invoke('auth:getStatus'),

  // ── Chat / local LLM ───────────────────────────────────────────────────────
  chatHasLLM: () => ipcRenderer.invoke('chat:hasLLM'),
  chatComplete: (messages: Array<{ role: string; content: string }>) =>
    ipcRenderer.invoke('chat:complete', messages),

  // ── Web4 direct ────────────────────────────────────────────────────────────
  web4GetAvatar: (avatarId: string) => ipcRenderer.invoke('web4:get-avatar', avatarId),
  web4GetKarma: (avatarId: string) => ipcRenderer.invoke('web4:get-karma', avatarId),
  web4GetNFTs: (avatarId: string) => ipcRenderer.invoke('web4:get-nfts', avatarId),
  web4GetWallet: (avatarId: string) => ipcRenderer.invoke('web4:get-wallet', avatarId),
  web4SearchHolons: (query: string, holonType?: string) =>
    ipcRenderer.invoke('web4:search-holons', query, holonType),

  // ── Web6 API ───────────────────────────────────────────────────────────────
  web6HealthCheck: () => ipcRenderer.invoke('web6:health-check'),
  web6Complete: (request: any) => ipcRenderer.invoke('web6:complete', request),
  web6StreamComplete: (request: any) => ipcRenderer.invoke('web6:stream-complete', request),
  web6FahrnSolve: (request: any) => ipcRenderer.invoke('web6:fahrn-solve', request),
  web6GetAgentCard: () => ipcRenderer.invoke('web6:get-agent-card'),
  web6FahrnGetAgents: () => ipcRenderer.invoke('web6:fahrn-get-agents'),
  web6OrchestratorList: () => ipcRenderer.invoke('web6:orchestrator-list'),
  web6OrchestratorInvoke: (agentId: string, task: string, input: any) =>
    ipcRenderer.invoke('web6:orchestrator-invoke', agentId, task, input),
  web6GetAvatarContext: (avatarId: string) => ipcRenderer.invoke('web6:get-avatar-context', avatarId),
  web6A2ATaskRun: (task: any) => ipcRenderer.invoke('web6:a2a-task-run', task),
  web6A2ATaskSend: (task: any) => ipcRenderer.invoke('web6:a2a-task-send', task),
  web6A2ATaskGet: (taskId: string) => ipcRenderer.invoke('web6:a2a-task-get', taskId),
  web6A2ATaskCancel: (taskId: string) => ipcRenderer.invoke('web6:a2a-task-cancel', taskId),
  web6MemorySearch: (query: string, avatarId?: string, limit?: number) =>
    ipcRenderer.invoke('web6:memory-search', query, avatarId, limit),
  web6GetMcpDiscovery: () => ipcRenderer.invoke('web6:get-mcp-discovery'),
  web6ListOpenservModels: () => ipcRenderer.invoke('web6:list-openserv-models'),
  web6CompleteWithTools: (request: any) => ipcRenderer.invoke('web6:complete-with-tools', request),
  onWeb6ToolCall: (cb: (toolCalls: any[]) => void) => {
    const h = (_: unknown, d: any[]) => cb(d);
    ipcRenderer.on('web6:tool-call', h);
    return () => ipcRenderer.removeListener('web6:tool-call', h);
  },
  onWeb6ToolResult: (cb: (result: { name: string; result: any }) => void) => {
    const h = (_: unknown, d: any) => cb(d);
    ipcRenderer.on('web6:tool-result', h);
    return () => ipcRenderer.removeListener('web6:tool-result', h);
  },

  // ── Web7 API ───────────────────────────────────────────────────────────────
  web7HealthCheck: () => ipcRenderer.invoke('web7:health-check'),
  web7CollectiveConsciousness: () => ipcRenderer.invoke('web7:collective-consciousness'),
  web7Symbiosis: () => ipcRenderer.invoke('web7:symbiosis'),

  // ── Web8 API ───────────────────────────────────────────────────────────────
  web8HealthCheck: () => ipcRenderer.invoke('web8:health-check'),
  web8MeshStatus: () => ipcRenderer.invoke('web8:mesh-status'),
  web8MeshNodes: () => ipcRenderer.invoke('web8:mesh-nodes'),

  // ── Web9 API ───────────────────────────────────────────────────────────────
  web9HealthCheck: () => ipcRenderer.invoke('web9:health-check'),
  web9SingularityStatus: () => ipcRenderer.invoke('web9:singularity-status'),

  // ── Web10 API ──────────────────────────────────────────────────────────────
  web10HealthCheck: () => ipcRenderer.invoke('web10:health-check'),
  web10GetSource: () => ipcRenderer.invoke('web10:get-source'),

  // ── Web6 event listeners ───────────────────────────────────────────────────
  onWeb6StreamChunk: (cb: (delta: string) => void) => {
    const h = (_: unknown, d: string) => cb(d);
    ipcRenderer.on('web6:stream-chunk', h);
    return () => ipcRenderer.removeListener('web6:stream-chunk', h);
  },
  onWeb6StreamDone: (cb: (full: string) => void) => {
    const h = (_: unknown, f: string) => cb(f);
    ipcRenderer.on('web6:stream-done', h);
    return () => ipcRenderer.removeListener('web6:stream-done', h);
  },
  onWeb6StreamError: (cb: (err: string) => void) => {
    const h = (_: unknown, e: string) => cb(e);
    ipcRenderer.on('web6:stream-error', h);
    return () => ipcRenderer.removeListener('web6:stream-error', h);
  },
  onWeb6A2ATaskUpdate: (cb: (update: any) => void) => {
    const h = (_: unknown, u: any) => cb(u);
    ipcRenderer.on('web6:a2a-task-update', h);
    return () => ipcRenderer.removeListener('web6:a2a-task-update', h);
  },

  // ── Claude coding agent ────────────────────────────────────────────────────
  claudeHasAgent: () => ipcRenderer.invoke('claude:has-agent'),
  claudeRunTask: (task: string) => ipcRenderer.invoke('claude:run-task', task),
  claudeConfirmResponse: (requestId: string, approved: boolean) =>
    ipcRenderer.invoke('claude:confirm-response', requestId, approved),
  onClaudeEvent: (cb: (event: any) => void) => {
    const h = (_: unknown, e: any) => cb(e);
    ipcRenderer.on('claude:event', h);
    return () => ipcRenderer.removeListener('claude:event', h);
  },

  // ── OpenServ coding agent ──────────────────────────────────────────────────
  openservHasAgent: () => ipcRenderer.invoke('openserv:has-agent'),
  openservListModels: () => ipcRenderer.invoke('openserv:list-models'),
  openservRunTask: (task: string, model?: string) => ipcRenderer.invoke('openserv:run-task', task, model),
  openservConfirmResponse: (requestId: string, approved: boolean) =>
    ipcRenderer.invoke('openserv:confirm-response', requestId, approved),
  onOpenservEvent: (cb: (event: any) => void) => {
    const h = (_: unknown, e: any) => cb(e);
    ipcRenderer.on('openserv:event', h);
    return () => ipcRenderer.removeListener('openserv:event', h);
  },

  // ── A2A Inbox (Web4 legacy) ───────────────────────────────────────────────
  a2aGetPending: () => ipcRenderer.invoke('a2a:getPending'),
  a2aMarkProcessed: (messageId: string) => ipcRenderer.invoke('a2a:markProcessed', messageId),
  a2aSendReply: (toAgentId: string, content: string, params?: Record<string, unknown>) =>
    ipcRenderer.invoke('a2a:sendReply', toAgentId, content, params),

  // ── Terminal ──────────────────────────────────────────────────────────────
  terminalCreate: (cwd?: string) => ipcRenderer.invoke('terminal:create', cwd),
  terminalCreateTyped: (type: 'os' | 'star', cwd?: string) =>
    ipcRenderer.invoke('terminal:create-typed', type, cwd),
  terminalWrite: (sessionId: string, data: string) =>
    ipcRenderer.invoke('terminal:write', sessionId, data),
  terminalResize: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', sessionId, cols, rows),
  terminalDestroy: (sessionId: string) => ipcRenderer.invoke('terminal:destroy', sessionId),
  terminalStarAvailable: () => ipcRenderer.invoke('terminal:star-available'),
  /** Returns { osSessionId, starSessionId } for the two default terminals. */
  terminalGetDefaults: () => ipcRenderer.invoke('terminal:get-defaults'),
  onTerminalData: (cb: (sessionId: string, data: string) => void) => {
    const h = (_: unknown, p: { sessionId: string; data: string }) => cb(p.sessionId, p.data);
    ipcRenderer.on('terminal:data', h);
    return () => ipcRenderer.removeListener('terminal:data', h);
  },
  onTerminalExit: (cb: (sessionId: string) => void) => {
    const h = (_: unknown, p: { sessionId: string }) => cb(p.sessionId);
    ipcRenderer.on('terminal:exit', h);
    return () => ipcRenderer.removeListener('terminal:exit', h);
  },

  // ── File search ───────────────────────────────────────────────────────────
  searchFiles: (query: string, dir?: string, extensions?: string[]) =>
    ipcRenderer.invoke('fs:search-files', query, dir, extensions),
  getRecents: () => ipcRenderer.invoke('fs:get-recents'),
  createFile: (filePath: string) => ipcRenderer.invoke('fs:create-file', filePath),
  createFolder: (folderPath: string) => ipcRenderer.invoke('fs:create-folder', folderPath),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
  deleteFile: (filePath: string) => ipcRenderer.invoke('fs:delete', filePath),

  // ── Settings ──────────────────────────────────────────────────────────────
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSave: (settings: Record<string, string>) => ipcRenderer.invoke('settings:save', settings),

  // ── Git ───────────────────────────────────────────────────────────────────
  gitStatus: (dir: string) => ipcRenderer.invoke('git:status', dir),
  gitDiff: (dir: string, filePath?: string) => ipcRenderer.invoke('git:diff', dir, filePath),
  gitLog: (dir: string, limit?: number) => ipcRenderer.invoke('git:log', dir, limit),
  gitCommit: (dir: string, message: string, files: string[]) =>
    ipcRenderer.invoke('git:commit', dir, message, files),
  gitInit: (dir: string) => ipcRenderer.invoke('git:init', dir),
  gitCurrentBranch: (dir: string) => ipcRenderer.invoke('git:current-branch', dir),
  gitListBranches: (dir: string) => ipcRenderer.invoke('git:list-branches', dir),
  gitCheckout: (dir: string, branch: string) => ipcRenderer.invoke('git:checkout', dir, branch),
  gitCreateBranch: (dir: string, branch: string) => ipcRenderer.invoke('git:create-branch', dir, branch),

  // ── Tab persistence ─────────────────────────────────────────────────────
  tabsGet: () => ipcRenderer.invoke('tabs:get'),
  tabsSave: (workspacePath: string, tabs: string[], activeTab: string | null) =>
    ipcRenderer.invoke('tabs:save', workspacePath, tabs, activeTab),

  // ── STAR ODK wizard ───────────────────────────────────────────────────────
  starGetTemplates: () => ipcRenderer.invoke('star:get-templates'),
  starNewApp: (name: string, templateType: string, outputDir: string) =>
    ipcRenderer.invoke('star:new-app', name, templateType, outputDir),

  // ── Diagnostics ───────────────────────────────────────────────────────────
  diagnosticsRunTsc: () => ipcRenderer.invoke('diagnostics:run-tsc'),
  diagnosticsRunEslint: () => ipcRenderer.invoke('diagnostics:run-eslint'),

  // ── LSP ───────────────────────────────────────────────────────────────────
  lspStart: (workspaceRoot: string) => ipcRenderer.invoke('lsp:start', workspaceRoot),
  lspStop: () => ipcRenderer.invoke('lsp:stop'),
  lspOpenDocument: (uri: string, languageId: string, text: string) =>
    ipcRenderer.invoke('lsp:open-document', uri, languageId, text),
  lspChangeDocument: (uri: string, text: string, version: number) =>
    ipcRenderer.invoke('lsp:change-document', uri, text, version),
  lspCloseDocument: (uri: string) => ipcRenderer.invoke('lsp:close-document', uri),
  lspCompletion: (uri: string, line: number, character: number) =>
    ipcRenderer.invoke('lsp:completion', uri, line, character),
  lspHover: (uri: string, line: number, character: number) =>
    ipcRenderer.invoke('lsp:hover', uri, line, character),
  lspDefinition: (uri: string, line: number, character: number) =>
    ipcRenderer.invoke('lsp:definition', uri, line, character),
  onLspDiagnostics: (cb: (params: any) => void) => {
    const h = (_: unknown, p: any) => cb(p);
    ipcRenderer.on('lsp:diagnostics', h);
    return () => ipcRenderer.removeListener('lsp:diagnostics', h);
  },

  // ── Window ────────────────────────────────────────────────────────────────
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
});
