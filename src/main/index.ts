import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { MCPServerManager } from './services/MCPServerManager.js';
import { OASISAPIClient } from './services/OASISAPIClient.js';
import { AgentRuntime } from './services/AgentRuntime.js';
import { FileSystemService } from './services/FileSystemService.js';
import { TerminalService } from './services/TerminalService.js';
import { loadStoredAuth, saveAuth, clearStoredAuth } from './services/AuthStore.js';
import { ChatService } from './services/ChatService.js';
import { ClaudeAgentService, type ClaudeAgentEvent } from './services/ClaudeAgentService.js';
import { OpenServAgentService, type OpenServAgentEvent } from './services/OpenServAgentService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Default OASIS IDE Assistant agent ID. Override with env OASIS_IDE_ASSISTANT_AGENT_ID when backend registers the agent. */
const DEFAULT_IDE_ASSISTANT_AGENT_ID = process.env.OASIS_IDE_ASSISTANT_AGENT_ID || 'oasis-ide-assistant';

let mainWindow: BrowserWindow | null = null;
let authUsername: string | undefined;
let authAvatarId: string | undefined;
let mcpManager: MCPServerManager;
let oasisClient: OASISAPIClient;
let agentRuntime: AgentRuntime;
let fileSystemService: FileSystemService;
let terminalService: TerminalService;
let chatService: ChatService;
let claudeAgentService: ClaudeAgentService;
let openServAgentService: OpenServAgentService;
const pendingConfirmations = new Map<string, (approved: boolean) => void>();

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

  // Load app
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
  // Initialize services
  mcpManager = new MCPServerManager();
  oasisClient = new OASISAPIClient();
  agentRuntime = new AgentRuntime();
  fileSystemService = new FileSystemService();
  terminalService = new TerminalService();
  chatService = new ChatService();
  claudeAgentService = new ClaudeAgentService();
  openServAgentService = new OpenServAgentService();

  const stored = await loadStoredAuth();
  if (stored?.token) {
    oasisClient.setAuthToken(stored.token);
    authUsername = stored.username;
    authAvatarId = stored.avatarId;
  }

  // Start OASIS MCP server
  try {
    await mcpManager.startOASISMCP();
    console.log('[Main] OASIS MCP server started');
  } catch (error: any) {
    console.error('[Main] Failed to start MCP server:', error);
    console.error('[Main] Error details:', error.message);
    // Don't throw - let the app start even if MCP fails
    // The UI will show an error state
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('mcp:list-tools', async () => {
  try {
    return await mcpManager.listTools('oasis-unified');
  } catch (error: any) {
    console.error('[IPC] List tools error:', error);
    return [];
  }
});

ipcMain.handle('mcp:execute-tool', async (_, toolName: string, args: any) => {
  try {
    return await mcpManager.executeTool(toolName, args);
  } catch (error: any) {
    console.error('[IPC] Execute tool error:', error);
    return { error: true, message: error.message };
  }
});

ipcMain.handle('oasis:health-check', async () => {
  try {
    return await oasisClient.healthCheck();
  } catch (error: any) {
    return { status: 'unhealthy', error: error.message };
  }
});

ipcMain.handle('agents:discover', async (_, serviceName?: string) => {
  try {
    return await oasisClient.discoverAgents(serviceName);
  } catch (error: any) {
    console.error('[IPC] Discover agents error:', error);
    return [];
  }
});

ipcMain.handle('agents:invoke', async (_, agentId: string, task: string, context: any) => {
  try {
    return await agentRuntime.invokeAgent(agentId, task, context);
  } catch (error: any) {
    return { success: false, result: { error: error.message } };
  }
});

// File system
ipcMain.handle('fs:pick-workspace', async () => {
  try {
    return await fileSystemService.pickWorkspace();
  } catch (error: any) {
    console.error('[IPC] Pick workspace error:', error);
    return null;
  }
});

ipcMain.handle('fs:get-workspace-path', async () => {
  return fileSystemService.getWorkspacePath();
});

ipcMain.handle('fs:list-tree', async (_, dir?: string) => {
  try {
    return await fileSystemService.listTree(dir);
  } catch (error: any) {
    console.error('[IPC] List tree error:', error);
    return [];
  }
});

ipcMain.handle('fs:read-file', async (_, filePath: string) => {
  try {
    return await fileSystemService.readFile(filePath);
  } catch (error: any) {
    console.error('[IPC] Read file error:', error);
    throw error;
  }
});

ipcMain.handle('fs:write-file', async (_, filePath: string, content: string) => {
  try {
    await fileSystemService.writeFile(filePath, content);
  } catch (error: any) {
    console.error('[IPC] Write file error:', error);
    throw error;
  }
});

// Terminal
ipcMain.handle('terminal:create', async (_, cwd?: string) => {
  try {
    return terminalService.createSession(cwd);
  } catch (error: any) {
    console.error('[IPC] Terminal create error:', error);
    throw error;
  }
});

ipcMain.handle('terminal:write', (_, sessionId: string, data: string) => {
  terminalService.write(sessionId, data);
});

ipcMain.handle('terminal:resize', (_, sessionId: string, cols: number, rows: number) => {
  terminalService.resize(sessionId, cols, rows);
});

ipcMain.handle('terminal:destroy', (_, sessionId: string) => {
  terminalService.destroy(sessionId);
});

// Auth
ipcMain.handle('auth:login', async (_, username: string, password: string) => {
  try {
    const result = await oasisClient.authenticateAvatar(username, password);
    authUsername = result.username ?? username;
    authAvatarId = result.avatarId;
    await saveAuth({
      token: result.token,
      username: authUsername,
      avatarId: authAvatarId
    });
    return { success: true, username: authUsername, avatarId: authAvatarId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:logout', async () => {
  oasisClient.clearAuthToken();
  authUsername = undefined;
  authAvatarId = undefined;
  await clearStoredAuth();
});

ipcMain.handle('auth:getStatus', async () => {
  const token = oasisClient.getAuthToken();
  return {
    loggedIn: !!token,
    username: authUsername,
    avatarId: authAvatarId
  };
});

// A2A Inbox (uses auth token from oasisClient)
ipcMain.handle('a2a:getPending', async () => {
  try {
    return await oasisClient.getPendingA2AMessages();
  } catch (error: any) {
    console.error('[IPC] Get pending A2A error:', error);
    return [];
  }
});

ipcMain.handle('a2a:markProcessed', async (_, messageId: string) => {
  try {
    await oasisClient.markMessageProcessed(messageId);
  } catch (error: any) {
    console.error('[IPC] Mark processed error:', error);
    throw error;
  }
});

ipcMain.handle('a2a:sendReply', async (_, toAgentId: string, content: string, params?: Record<string, unknown>) => {
  try {
    return await oasisClient.sendA2AJsonRpc(toAgentId, 'service_request', {
      content: content,
      ...params
    });
  } catch (error: any) {
    console.error('[IPC] Send reply error:', error);
    throw error;
  }
});

// Chat / LLM
ipcMain.handle('chat:hasLLM', async () => chatService.hasLLM());
ipcMain.handle('chat:complete', async (_, messages: Array<{ role: string; content: string }>) => {
  try {
    return await chatService.complete(messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>);
  } catch (error: any) {
    console.error('[IPC] Chat complete error:', error);
    return { content: '', error: error.message };
  }
});

// Chat with OASIS agent (IDE assistant)
ipcMain.handle('chat:getDefaultAssistantAgentId', () => DEFAULT_IDE_ASSISTANT_AGENT_ID);
ipcMain.handle('chat:agent', async (
  _,
  agentId: string,
  message: string,
  conversationId?: string,
  history?: Array<{ role: string; content: string }>,
  fromAvatarId?: string
) => {
  try {
    return await oasisClient.chatWithAgent(agentId, message, {
      conversationId,
      history: history ?? [],
      fromAvatarId
    });
  } catch (error: any) {
    console.error('[IPC] Chat agent error:', error);
    return { content: '', error: error.message };
  }
});

// Claude (Sonnet 4.6 via OpenServ) agentic coding assistant — works on the open workspace
ipcMain.handle('claude:has-agent', () => claudeAgentService.isAvailable());

ipcMain.handle('claude:run-task', async (_, task: string) => {
  const workspaceRoot = fileSystemService.getWorkspacePath();
  if (!workspaceRoot) {
    return { success: false, summary: 'Open a folder/workspace before using the Claude agent.' };
  }

  const send = (event: ClaudeAgentEvent) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('claude:event', event);
    }
  };

  const requestConfirmation = (
    requestId: string,
    kind: 'write' | 'command',
    label: string,
    detail: string
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      pendingConfirmations.set(requestId, resolve);
      send({ type: 'confirm-request', requestId, kind, label, detail });
    });
  };

  return claudeAgentService.runTask(task, { workspaceRoot, onEvent: send, requestConfirmation });
});

ipcMain.handle('claude:confirm-response', (_, requestId: string, approved: boolean) => {
  const resolve = pendingConfirmations.get(requestId);
  if (resolve) {
    resolve(approved);
    pendingConfirmations.delete(requestId);
  }
});

// OpenServ agentic coding assistant — same workspace tool loop as the Claude agent above,
// but driven through the OpenAI SDK so it can run any model in the SERV catalog.
ipcMain.handle('openserv:has-agent', () => openServAgentService.isAvailable());

ipcMain.handle('openserv:list-models', () => openServAgentService.listModels());

ipcMain.handle('openserv:run-task', async (_, task: string, model?: string) => {
  const workspaceRoot = fileSystemService.getWorkspacePath();
  if (!workspaceRoot) {
    return { success: false, summary: 'Open a folder/workspace before using the OpenServ agent.' };
  }

  const send = (event: OpenServAgentEvent) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('openserv:event', event);
    }
  };

  const requestConfirmation = (
    requestId: string,
    kind: 'write' | 'command',
    label: string,
    detail: string
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      pendingConfirmations.set(requestId, resolve);
      send({ type: 'confirm-request', requestId, kind, label, detail });
    });
  };

  return openServAgentService.runTask(task, { workspaceRoot, model, onEvent: send, requestConfirmation });
});

ipcMain.handle('openserv:confirm-response', (_, requestId: string, approved: boolean) => {
  const resolve = pendingConfirmations.get(requestId);
  if (resolve) {
    resolve(approved);
    pendingConfirmations.delete(requestId);
  }
});
