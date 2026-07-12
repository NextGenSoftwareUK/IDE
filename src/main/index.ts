import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { MCPServerManager } from './services/MCPServerManager.js';
import { OASISAPIClient } from './services/OASISAPIClient.js';
import { Web6APIClient } from './services/Web6APIClient.js';
import { Web4APIClient, Web7APIClient, Web8APIClient, Web9APIClient, Web10APIClient } from './services/OASISLayerClients.js';
import { AgentRuntime } from './services/AgentRuntime.js';
import { FileSystemService } from './services/FileSystemService.js';
import { TerminalService, type TerminalType } from './services/TerminalService.js';
import { loadStoredAuth, saveAuth, clearStoredAuth } from './services/AuthStore.js';
import { ChatService } from './services/ChatService.js';
import { ClaudeAgentService, type ClaudeAgentEvent } from './services/ClaudeAgentService.js';
import { OpenServAgentService, type OpenServAgentEvent } from './services/OpenServAgentService.js';
import { SettingsService } from './services/SettingsService.js';
import { GitService } from './services/GitService.js';
import { StarWizardService } from './services/StarWizardService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let authUsername: string | undefined;
let authAvatarId: string | undefined;
let mcpManager: MCPServerManager;
let oasisClient: OASISAPIClient;
let web4Client: Web4APIClient;
let web6Client: Web6APIClient;
let web7Client: Web7APIClient;
let web8Client: Web8APIClient;
let web9Client: Web9APIClient;
let web10Client: Web10APIClient;
let agentRuntime: AgentRuntime;
let fileSystemService: FileSystemService;
let terminalService: TerminalService;
let chatService: ChatService;
let claudeAgentService: ClaudeAgentService;
let openServAgentService: OpenServAgentService;
let settingsService: SettingsService;
let gitService: GitService;
let starWizardService: StarWizardService;
const pendingConfirmations = new Map<string, (approved: boolean) => void>();

// Default terminal session IDs created at startup (before renderer asks for them)
let defaultOsSessionId: string | null = null;
let defaultStarSessionId: string | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1e1e'
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    terminalService.setMainWindow(null);
    mainWindow = null;
  });

  terminalService.setMainWindow(mainWindow);
}

app.whenReady().then(async () => {
  mcpManager = new MCPServerManager();
  oasisClient = new OASISAPIClient();
  web4Client = new Web4APIClient();
  web6Client = new Web6APIClient();
  web7Client = new Web7APIClient();
  web8Client = new Web8APIClient();
  web9Client = new Web9APIClient();
  web10Client = new Web10APIClient();
  agentRuntime = new AgentRuntime();
  fileSystemService = new FileSystemService();
  terminalService = new TerminalService();
  chatService = new ChatService();
  claudeAgentService = new ClaudeAgentService();
  openServAgentService = new OpenServAgentService();
  settingsService = new SettingsService();
  gitService = new GitService();
  starWizardService = new StarWizardService();

  const stored = await loadStoredAuth();
  if (stored?.token) {
    oasisClient.setAuthToken(stored.token);
    web4Client.setAuthToken(stored.token);
    web6Client.setAuthToken(stored.token);
    web7Client.setAuthToken(stored.token);
    web8Client.setAuthToken(stored.token);
    web9Client.setAuthToken(stored.token);
    web10Client.setAuthToken(stored.token);
    authUsername = stored.username;
    authAvatarId = stored.avatarId;
  }

  try {
    await mcpManager.startOASISMCP();
    console.log('[Main] OASIS MCP server started');
  } catch (error: any) {
    console.error('[Main] Failed to start MCP server:', error.message);
  }

  // Pre-create the two default terminal sessions so they're ready when the
  // renderer requests them. Store IDs; renderer fetches via terminal:get-defaults.
  try {
    defaultOsSessionId = terminalService.createSession(undefined, 'os');
    console.log('[Main] Default OS terminal created:', defaultOsSessionId);
  } catch (e: any) {
    console.error('[Main] Failed to create default OS terminal:', e.message);
  }

  try {
    defaultStarSessionId = terminalService.createSession(undefined, 'star');
    console.log('[Main] Default STAR CLI terminal created:', defaultStarSessionId);
  } catch (e: any) {
    console.warn('[Main] STAR CLI terminal not created:', e.message);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── MCP ──────────────────────────────────────────────────────────────────────

ipcMain.handle('mcp:list-tools', async () => {
  try { return await mcpManager.listTools('oasis-unified'); }
  catch { return []; }
});

ipcMain.handle('mcp:execute-tool', async (_, toolName: string, args: any) => {
  try { return await mcpManager.executeTool(toolName, args); }
  catch (e: any) { return { error: true, message: e.message }; }
});

ipcMain.handle('mcp:status', () => mcpManager.getServerStatus());

// ── OASIS Network health (all layers) ────────────────────────────────────────

ipcMain.handle('oasis:health-check', async () => oasisClient.healthCheck());

ipcMain.handle('oasis:network-status', async () => {
  const [web4, web6, web7, web8, web9, web10] = await Promise.allSettled([
    oasisClient.healthCheck(),
    web6Client.healthCheck(),
    web7Client.healthCheck(),
    web8Client.healthCheck(),
    web9Client.healthCheck(),
    web10Client.healthCheck(),
  ]);

  const extract = (r: PromiseSettledResult<any>) =>
    r.status === 'fulfilled' ? r.value : { status: 'unreachable', error: (r as any).reason?.message };

  return {
    web4: extract(web4),
    web6: extract(web6),
    web7: extract(web7),
    web8: extract(web8),
    web9: extract(web9),
    web10: extract(web10),
    mcpServer: mcpManager.getServerStatus(),
    starCLI: terminalService.isStarCLIAvailable(),
    timestamp: Date.now()
  };
});

// ── Agents ────────────────────────────────────────────────────────────────────

ipcMain.handle('agents:discover', async () => {
  try {
    const card = await web6Client.getAgentCard();
    const agents: any[] = [];
    if (card?.name) {
      agents.push({
        id: card.id ?? 'web6-agent',
        name: card.name,
        description: card.description,
        services: card.capabilities?.extensions ?? [],
        source: 'web6'
      });
    }
    const [fahrn, orch] = await Promise.allSettled([
      web6Client.fahrnGetAgents(),
      web6Client.orchestratorList()
    ]);
    if (fahrn.status === 'fulfilled') {
      for (const a of fahrn.value) agents.push({ ...a, source: 'fahrn' });
    }
    if (orch.status === 'fulfilled') {
      for (const a of orch.value) agents.push({ ...a, source: 'orchestrator' });
    }
    return agents;
  } catch { return []; }
});

ipcMain.handle('agents:invoke', async (_, agentId: string, task: string, context: any) => {
  try { return await agentRuntime.invokeAgent(agentId, task, context); }
  catch (e: any) { return { success: false, result: { error: e.message } }; }
});

// ── File System ───────────────────────────────────────────────────────────────

ipcMain.handle('fs:pick-workspace', async () => {
  try { return await fileSystemService.pickWorkspace(); }
  catch { return null; }
});
ipcMain.handle('fs:get-workspace-path', () => fileSystemService.getWorkspacePath());
ipcMain.handle('fs:list-tree', async (_, dir?: string) => {
  try { return await fileSystemService.listTree(dir); }
  catch { return []; }
});
ipcMain.handle('fs:read-file', (_, filePath: string) => fileSystemService.readFile(filePath));
ipcMain.handle('fs:write-file', (_, filePath: string, content: string) =>
  fileSystemService.writeFile(filePath, content));

// ── Terminal ──────────────────────────────────────────────────────────────────

ipcMain.handle('terminal:create', async (_, cwd?: string) =>
  terminalService.createSession(cwd, 'os'));

ipcMain.handle('terminal:create-typed', async (_, type: TerminalType, cwd?: string) =>
  terminalService.createSession(cwd, type));

ipcMain.handle('terminal:write', (_, sessionId: string, data: string) =>
  terminalService.write(sessionId, data));

ipcMain.handle('terminal:resize', (_, sessionId: string, cols: number, rows: number) =>
  terminalService.resize(sessionId, cols, rows));

ipcMain.handle('terminal:destroy', (_, sessionId: string) =>
  terminalService.destroy(sessionId));

ipcMain.handle('terminal:star-available', () => terminalService.isStarCLIAvailable());

/** Returns the two pre-created default session IDs (OS shell + STAR CLI). */
ipcMain.handle('terminal:get-defaults', () => ({
  osSessionId: defaultOsSessionId,
  starSessionId: defaultStarSessionId
}));

// ── Auth ──────────────────────────────────────────────────────────────────────

ipcMain.handle('auth:login', async (_, username: string, password: string) => {
  try {
    const result = await oasisClient.authenticateAvatar(username, password);
    authUsername = result.username ?? username;
    authAvatarId = result.avatarId;
    const token = result.token;
    // Propagate JWT to all layer clients
    web4Client.setAuthToken(token);
    web6Client.setAuthToken(token);
    web7Client.setAuthToken(token);
    web8Client.setAuthToken(token);
    web9Client.setAuthToken(token);
    web10Client.setAuthToken(token);
    await saveAuth({ token, username: authUsername, avatarId: authAvatarId });
    return { success: true, username: authUsername, avatarId: authAvatarId };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('auth:logout', async () => {
  oasisClient.clearAuthToken();
  web4Client.clearAuthToken();
  web6Client.clearAuthToken();
  web7Client.clearAuthToken();
  web8Client.clearAuthToken();
  web9Client.clearAuthToken();
  web10Client.clearAuthToken();
  authUsername = undefined;
  authAvatarId = undefined;
  await clearStoredAuth();
});

ipcMain.handle('auth:getStatus', () => ({
  loggedIn: !!oasisClient.getAuthToken(),
  username: authUsername,
  avatarId: authAvatarId
}));

// ── A2A Inbox (Web4) ──────────────────────────────────────────────────────────

ipcMain.handle('a2a:getPending', async () => {
  try { return await oasisClient.getPendingA2AMessages(); }
  catch { return []; }
});
ipcMain.handle('a2a:markProcessed', (_, messageId: string) =>
  oasisClient.markMessageProcessed(messageId));
ipcMain.handle('a2a:sendReply', (_, toAgentId: string, content: string, params?: Record<string, unknown>) =>
  oasisClient.sendA2AJsonRpc(toAgentId, 'service_request', { content, ...params }));

// ── Chat / local LLM ──────────────────────────────────────────────────────────

ipcMain.handle('chat:hasLLM', () => chatService.hasLLM());
ipcMain.handle('chat:complete', async (_, messages: Array<{ role: string; content: string }>) => {
  try {
    return await chatService.complete(messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>);
  } catch (e: any) { return { content: '', error: e.message }; }
});

// ── Web4 direct API ───────────────────────────────────────────────────────────

ipcMain.handle('web4:get-avatar', (_, avatarId: string) => web4Client.getAvatarById(avatarId));
ipcMain.handle('web4:get-karma', (_, avatarId: string) => web4Client.getKarma(avatarId));
ipcMain.handle('web4:get-nfts', (_, avatarId: string) => web4Client.getNFTs(avatarId));
ipcMain.handle('web4:get-wallet', (_, avatarId: string) => web4Client.getWallet(avatarId));
ipcMain.handle('web4:search-holons', (_, query: string, holonType?: string) =>
  web4Client.searchHolons(query, holonType));

// ── Web6 API ──────────────────────────────────────────────────────────────────

ipcMain.handle('web6:health-check', () => web6Client.healthCheck());

ipcMain.handle('web6:complete', async (_, request: any) => {
  try { return await web6Client.complete(request); }
  catch (e: any) { return { Error: e.message, IsError: true }; }
});

ipcMain.handle('web6:stream-complete', async (_, request: any) => {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return { error: 'No window' };
  const send = (ch: string, p: any) => { if (!win.isDestroyed()) win.webContents.send(ch, p); };
  await web6Client.streamComplete(
    request,
    (delta) => send('web6:stream-chunk', delta),
    (full) => send('web6:stream-done', full),
    (err) => send('web6:stream-error', err)
  );
  return { ok: true };
});

ipcMain.handle('web6:fahrn-solve', async (_, request: any) => {
  try { return await web6Client.fahrnSolve(request); }
  catch (e: any) { return { Error: e.message, IsError: true }; }
});

ipcMain.handle('web6:get-agent-card', () => web6Client.getAgentCard());
ipcMain.handle('web6:get-mcp-discovery', () => web6Client.getMcpDiscovery());
ipcMain.handle('web6:get-avatar-context', (_, avatarId: string) => web6Client.getAvatarContext(avatarId));
ipcMain.handle('web6:a2a-task-send', (_, task: any) => web6Client.a2aTaskSend(task));
ipcMain.handle('web6:a2a-task-get', (_, taskId: string) => web6Client.a2aTaskGet(taskId));
ipcMain.handle('web6:a2a-task-cancel', (_, taskId: string) => web6Client.a2aTaskCancel(taskId));

ipcMain.handle('web6:a2a-task-run', async (_, task: any) => {
  const win = mainWindow;
  const send = (p: any) => { if (win && !win.isDestroyed()) win.webContents.send('web6:a2a-task-update', p); };
  const { taskId, error } = await web6Client.a2aTaskSend(task);
  if (error || !taskId) return { error: error ?? 'No task ID returned' };
  send({ taskId, state: 'working' });
  const status = await web6Client.a2aTaskPoll(taskId, 120000);
  send({ taskId, state: status.State, result: status.Result, error: status.Error });
  return status;
});

ipcMain.handle('web6:fahrn-get-agents', () => web6Client.fahrnGetAgents());
ipcMain.handle('web6:orchestrator-list', () => web6Client.orchestratorList());
ipcMain.handle('web6:orchestrator-invoke', (_, agentId: string, task: string, input: any) =>
  web6Client.orchestratorInvoke(agentId, task, input));
ipcMain.handle('web6:memory-search', (_, query: string, avatarId?: string, limit?: number) =>
  web6Client.memorySearch(query, avatarId, limit));
ipcMain.handle('web6:list-openserv-models', () => web6Client.listOpenServModels());

// ── Web7 API ──────────────────────────────────────────────────────────────────

ipcMain.handle('web7:health-check', () => web7Client.healthCheck());
ipcMain.handle('web7:collective-consciousness', () => web7Client.getCollectiveConsciousnessStatus());
ipcMain.handle('web7:symbiosis', () => web7Client.getSymbiosisStatus());

// ── Web8 API ──────────────────────────────────────────────────────────────────

ipcMain.handle('web8:health-check', () => web8Client.healthCheck());
ipcMain.handle('web8:mesh-status', () => web8Client.getMeshStatus());
ipcMain.handle('web8:mesh-nodes', () => web8Client.getMeshNodes());

// ── Web9 API ──────────────────────────────────────────────────────────────────

ipcMain.handle('web9:health-check', () => web9Client.healthCheck());
ipcMain.handle('web9:singularity-status', () => web9Client.getSingularityStatus());

// ── Web10 API ─────────────────────────────────────────────────────────────────

ipcMain.handle('web10:health-check', () => web10Client.healthCheck());
ipcMain.handle('web10:get-source', () => web10Client.getSource());

// ── Claude coding agent ───────────────────────────────────────────────────────

ipcMain.handle('claude:has-agent', () => claudeAgentService.isAvailable());

ipcMain.handle('claude:run-task', async (_, task: string) => {
  const workspaceRoot = fileSystemService.getWorkspacePath();
  if (!workspaceRoot) return { success: false, summary: 'Open a workspace first.' };
  const send = (event: ClaudeAgentEvent) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('claude:event', event);
  };
  const requestConfirmation = (requestId: string, kind: 'write' | 'command', label: string, detail: string) =>
    new Promise<boolean>((resolve) => {
      pendingConfirmations.set(requestId, resolve);
      send({ type: 'confirm-request', requestId, kind, label, detail });
    });
  return claudeAgentService.runTask(task, { workspaceRoot, onEvent: send, requestConfirmation });
});

ipcMain.handle('claude:confirm-response', (_, requestId: string, approved: boolean) => {
  const resolve = pendingConfirmations.get(requestId);
  if (resolve) { resolve(approved); pendingConfirmations.delete(requestId); }
});

// ── OpenServ coding agent ─────────────────────────────────────────────────────

ipcMain.handle('openserv:has-agent', () => openServAgentService.isAvailable());
ipcMain.handle('openserv:list-models', () => openServAgentService.listModels());

ipcMain.handle('openserv:run-task', async (_, task: string, model?: string) => {
  const workspaceRoot = fileSystemService.getWorkspacePath();
  if (!workspaceRoot) return { success: false, summary: 'Open a workspace first.' };
  const send = (event: OpenServAgentEvent) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('openserv:event', event);
  };
  const requestConfirmation = (requestId: string, kind: 'write' | 'command', label: string, detail: string) =>
    new Promise<boolean>((resolve) => {
      pendingConfirmations.set(requestId, resolve);
      send({ type: 'confirm-request', requestId, kind, label, detail });
    });
  return openServAgentService.runTask(task, { workspaceRoot, model, onEvent: send, requestConfirmation });
});

ipcMain.handle('openserv:confirm-response', (_, requestId: string, approved: boolean) => {
  const resolve = pendingConfirmations.get(requestId);
  if (resolve) { resolve(approved); pendingConfirmations.delete(requestId); }
});

// ── Settings ──────────────────────────────────────────────────────────────────

ipcMain.handle('settings:get', () => settingsService.getAll());
ipcMain.handle('settings:save', async (_, settings: Record<string, string>) => {
  await settingsService.saveAll(settings);
  // Apply URL/key changes to live clients immediately
  if (settings.OASIS_API_URL) oasisClient.setBaseURL(settings.OASIS_API_URL);
  if (settings.OASIS_WEB6_URL) web6Client.setBaseURL(settings.OASIS_WEB6_URL);
  if (settings.OASIS_WEB6_API_KEY) web6Client.setApiKey(settings.OASIS_WEB6_API_KEY);
});

// ── File search ───────────────────────────────────────────────────────────────

ipcMain.handle('fs:search-files', async (_, query: string, dir?: string, extensions?: string[]) => {
  const root = dir ?? fileSystemService.getWorkspacePath();
  if (!root) return [];
  return fileSystemService.searchFiles(query, root, extensions);
});

// ── Git ───────────────────────────────────────────────────────────────────────

ipcMain.handle('git:status', async (_, dir: string) => gitService.status(dir));
ipcMain.handle('git:diff', async (_, dir: string, filePath?: string) => gitService.diff(dir, filePath));
ipcMain.handle('git:log', async (_, dir: string, limit?: number) => gitService.log(dir, limit));
ipcMain.handle('git:commit', async (_, dir: string, message: string, files: string[]) =>
  gitService.commit(dir, message, files));
ipcMain.handle('git:init', async (_, dir: string) => gitService.init(dir));

// ── STAR ODK wizard ───────────────────────────────────────────────────────────

ipcMain.handle('star:get-templates', () => starWizardService.getTemplates());
ipcMain.handle('star:new-app', async (_, name: string, templateType: string, outputDir: string) =>
  starWizardService.createApp(name, templateType, outputDir));
