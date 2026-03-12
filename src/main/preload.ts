import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // MCP
  listTools: () => ipcRenderer.invoke('mcp:list-tools'),
  executeTool: (toolName: string, args: any) => 
    ipcRenderer.invoke('mcp:execute-tool', toolName, args),
  
  // OASIS API
  healthCheck: () => ipcRenderer.invoke('oasis:health-check'),
  
  // Agents
  discoverAgents: (serviceName?: string) => 
    ipcRenderer.invoke('agents:discover', serviceName),
  invokeAgent: (agentId: string, task: string, context: any) =>
    ipcRenderer.invoke('agents:invoke', agentId, task, context),
  
  // File System
  pickWorkspace: () => ipcRenderer.invoke('fs:pick-workspace'),
  getWorkspacePath: () => ipcRenderer.invoke('fs:get-workspace-path'),
  listTree: (dir?: string) => ipcRenderer.invoke('fs:list-tree', dir),
  readFile: (path: string) => ipcRenderer.invoke('fs:read-file', path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('fs:write-file', path, content),

  // Auth
  authLogin: (username: string, password: string) =>
    ipcRenderer.invoke('auth:login', username, password),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  authGetStatus: () => ipcRenderer.invoke('auth:getStatus'),

  // Chat / LLM
  chatHasLLM: () => ipcRenderer.invoke('chat:hasLLM'),
  chatComplete: (messages: Array<{ role: string; content: string }>) =>
    ipcRenderer.invoke('chat:complete', messages),
  chatGetDefaultAssistantAgentId: () => ipcRenderer.invoke('chat:getDefaultAssistantAgentId'),
  chatWithAgent: (
    agentId: string,
    message: string,
    conversationId?: string,
    history?: Array<{ role: string; content: string }>,
    fromAvatarId?: string
  ) =>
    ipcRenderer.invoke('chat:agent', agentId, message, conversationId, history, fromAvatarId),

  // A2A Inbox
  a2aGetPending: () => ipcRenderer.invoke('a2a:getPending'),
  a2aMarkProcessed: (messageId: string) =>
    ipcRenderer.invoke('a2a:markProcessed', messageId),
  a2aSendReply: (toAgentId: string, content: string, params?: Record<string, unknown>) =>
    ipcRenderer.invoke('a2a:sendReply', toAgentId, content, params),

  // Terminal
  terminalCreate: (cwd?: string) => ipcRenderer.invoke('terminal:create', cwd),
  terminalWrite: (sessionId: string, data: string) =>
    ipcRenderer.invoke('terminal:write', sessionId, data),
  terminalResize: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', sessionId, cols, rows),
  terminalDestroy: (sessionId: string) =>
    ipcRenderer.invoke('terminal:destroy', sessionId),
  onTerminalData: (callback: (sessionId: string, data: string) => void) => {
    const handler = (_: unknown, payload: { sessionId: string; data: string }) =>
      callback(payload.sessionId, payload.data);
    ipcRenderer.on('terminal:data', handler);
    return () => ipcRenderer.removeListener('terminal:data', handler);
  },

  // Window
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
});
