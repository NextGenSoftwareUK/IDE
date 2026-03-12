import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface MCPServerConnection {
  client: Client;
  transport: StdioClientTransport;
  status: 'running' | 'stopped' | 'error';
  tools: any[];
}

/**
 * Resolve path to the OASIS MCP server entry script.
 * - OASIS_MCP_SERVER_PATH: explicit path to dist/src/index.js (for external repo or custom install)
 * - Else: monorepo layout OASIS-IDE/.../services/ -> ../../../../MCP/dist/src/index.js
 */
function getMCPServerPath(): string {
  const envPath = process.env.OASIS_MCP_SERVER_PATH;
  if (envPath && envPath.trim()) {
    return path.resolve(envPath.trim());
  }
  return path.join(__dirname, '../../../../MCP/dist/src/index.js');
}

export class MCPServerManager {
  private servers: Map<string, MCPServerConnection> = new Map();
  private mcpServerPath: string;

  constructor() {
    this.mcpServerPath = getMCPServerPath();

    if (!fs.existsSync(this.mcpServerPath)) {
      console.error(`[MCP] MCP server not found at: ${this.mcpServerPath}`);
      console.error(
        '[MCP] Set OASIS_MCP_SERVER_PATH to the path of MCP dist/src/index.js, or from monorepo: cd MCP && npm run build'
      );
    }
  }

  async startOASISMCP(): Promise<void> {
    try {
      console.log('[MCP] Starting OASIS MCP server...');
      console.log('[MCP] Server path:', this.mcpServerPath);

      if (!fs.existsSync(this.mcpServerPath)) {
        const error = `MCP server not found at ${this.mcpServerPath}. Please build it first: cd MCP && npm run build`;
        console.error(`[MCP] ${error}`);
        throw new Error(error);
      }

      const client = new Client(
        {
          name: 'oasis-ide',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      const transport = new StdioClientTransport({
        command: 'node',
        args: [this.mcpServerPath]
      });

      await client.connect(transport);

      const listResult = await client.listTools();
      const tools = listResult.tools || [];

      this.servers.set('oasis-unified', {
        client,
        transport,
        status: 'running',
        tools
      });

      console.log(`[MCP] OASIS MCP server started with ${tools.length} tools`);

      transport.onclose = () => {
        const conn = this.servers.get('oasis-unified');
        if (conn) conn.status = 'stopped';
      };
      transport.onerror = (error: unknown) => {
        console.error('[MCP] Transport error:', error);
        const conn = this.servers.get('oasis-unified');
        if (conn) conn.status = 'error';
      };
    } catch (error: any) {
      console.error('[MCP] Failed to start server:', error);
      throw error;
    }
  }

  async listTools(serverName: string = 'oasis-unified'): Promise<any[]> {
    const conn = this.servers.get(serverName);
    if (!conn || conn.status !== 'running') {
      throw new Error(`Server ${serverName} is not running`);
    }
    return conn.tools;
  }

  async executeTool(toolName: string, args: any): Promise<any> {
    const conn = this.servers.get('oasis-unified');
    if (!conn || conn.status !== 'running') {
      throw new Error('OASIS MCP server is not running');
    }

    try {
      const result = await conn.client.callTool({
        name: toolName,
        arguments: args || {}
      });
      return result;
    } catch (error: any) {
      console.error('[MCP] Tool execution error:', error);
      throw new Error(`Failed to execute tool ${toolName}: ${error.message}`);
    }
  }

  getServer(serverName: string): MCPServerConnection | undefined {
    return this.servers.get(serverName);
  }

  async stopServer(serverName: string): Promise<void> {
    const conn = this.servers.get(serverName);
    if (conn) {
      await conn.transport.close();
      this.servers.delete(serverName);
    }
  }
}
