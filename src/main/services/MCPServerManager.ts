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
 * Resolve how to launch the OASIS MCP server.
 *
 * Priority:
 * 1. OASIS_MCP_SERVER_PATH env — if it ends in .js, launch with `node`; if .exe or no ext on
 *    Windows, launch directly; if it's a directory, treat as a `dotnet run --project` path.
 * 2. Default: `dotnet run --project` against the Web6 MCP server project directory.
 */
function resolveMCPLaunch(): { command: string; args: string[] } {
  const envPath = process.env.OASIS_MCP_SERVER_PATH?.trim();

  if (envPath) {
    if (envPath.endsWith('.js')) {
      return { command: 'node', args: [path.resolve(envPath)] };
    }
    const stat = fs.existsSync(envPath) ? fs.statSync(envPath) : null;
    if (stat?.isDirectory()) {
      return { command: 'dotnet', args: ['run', '--project', path.resolve(envPath), '--no-build'] };
    }
    // Assume binary (exe or native executable)
    return { command: path.resolve(envPath), args: [] };
  }

  // Default: Web6 MCP server project in the sibling OASIS2 tree
  const web6McpProject = path.join(__dirname, '../../../../WEB6/NextGenSoftware.OASIS.MCP.Server');
  if (fs.existsSync(web6McpProject)) {
    return { command: 'dotnet', args: ['run', '--project', web6McpProject, '--no-build'] };
  }

  // Legacy Node.js fallback (monorepo layout)
  const legacyJs = path.join(__dirname, '../../../../MCP/dist/src/index.js');
  return { command: 'node', args: [legacyJs] };
}

export class MCPServerManager {
  private servers: Map<string, MCPServerConnection> = new Map();
  private launch: { command: string; args: string[] };

  constructor() {
    this.launch = resolveMCPLaunch();
    console.log(`[MCP] Resolved launch: ${this.launch.command} ${this.launch.args.join(' ')}`);
  }

  async startOASISMCP(): Promise<void> {
    const { command, args } = this.launch;

    // Validate the entry point exists (skip for dotnet run — project dir already checked)
    if (command === 'node') {
      const scriptPath = args[0];
      if (!scriptPath || !fs.existsSync(scriptPath)) {
        throw new Error(
          `MCP server script not found at ${scriptPath}. ` +
          `Set OASIS_MCP_SERVER_PATH or build the MCP server first.`
        );
      }
    }

    console.log(`[MCP] Starting OASIS MCP server: ${command} ${args.join(' ')}`);

    const client = new Client(
      { name: 'oasis-ide', version: '1.0.0' },
      { capabilities: {} }
    );

    const transport = new StdioClientTransport({ command, args });

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
      console.warn('[MCP] Server transport closed');
    };
    transport.onerror = (error: unknown) => {
      console.error('[MCP] Transport error:', error);
      const conn = this.servers.get('oasis-unified');
      if (conn) conn.status = 'error';
    };
  }

  async listTools(serverName: string = 'oasis-unified'): Promise<any[]> {
    const conn = this.servers.get(serverName);
    if (!conn || conn.status !== 'running') return [];
    return conn.tools;
  }

  async executeTool(toolName: string, args: any): Promise<any> {
    const conn = this.servers.get('oasis-unified');
    if (!conn || conn.status !== 'running') {
      throw new Error('OASIS MCP server is not running');
    }
    try {
      const result = await conn.client.callTool({ name: toolName, arguments: args || {} });
      return result;
    } catch (error: any) {
      console.error('[MCP] Tool execution error:', error);
      throw new Error(`Failed to execute tool ${toolName}: ${error.message}`);
    }
  }

  getServerStatus(serverName: string = 'oasis-unified'): string {
    return this.servers.get(serverName)?.status ?? 'stopped';
  }

  async stopServer(serverName: string): Promise<void> {
    const conn = this.servers.get(serverName);
    if (conn) {
      await conn.transport.close();
      this.servers.delete(serverName);
    }
  }
}
