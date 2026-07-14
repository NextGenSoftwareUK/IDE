import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number | string | null;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

export class LspService extends EventEmitter {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private buf = '';
  private msgId = 1;
  private pendingRequests = new Map<number | string, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private initialized = false;
  private workspaceRoot: string | null = null;

  private resolveServerBin(): string {
    // Prefer local install in IDE project, fall back to global
    const local = path.join(path.dirname(path.dirname(path.dirname(__dirname))), 'node_modules', '.bin', 'typescript-language-server');
    if (fs.existsSync(local)) return local;
    if (fs.existsSync(local + '.cmd')) return local + '.cmd';
    return 'typescript-language-server';
  }

  start(workspaceRoot: string): void {
    if (this.proc) this.stop();
    this.workspaceRoot = workspaceRoot;
    this.initialized = false;

    const bin = this.resolveServerBin();
    this.proc = spawn(bin, ['--stdio'], {
      cwd: workspaceRoot,
      shell: process.platform === 'win32',
      env: { ...process.env },
    });

    this.proc.stdout.on('data', (chunk: Buffer) => this.onData(chunk.toString()));
    this.proc.stderr.on('data', (d: Buffer) => console.error('[LSP stderr]', d.toString().slice(0, 200)));
    this.proc.on('exit', () => { this.proc = null; this.initialized = false; });

    this.sendInitialize(workspaceRoot);
  }

  stop(): void {
    if (this.proc) {
      try { this.proc.kill(); } catch {}
      this.proc = null;
    }
    this.initialized = false;
    this.pendingRequests.forEach((p) => p.reject(new Error('LSP stopped')));
    this.pendingRequests.clear();
  }

  private sendInitialize(rootPath: string): void {
    this.request('initialize', {
      processId: process.pid,
      rootUri: `file:///${rootPath.replace(/\\/g, '/')}`,
      rootPath,
      capabilities: {
        textDocument: {
          publishDiagnostics: { relatedInformation: false },
          completion: { completionItem: { snippetSupport: false } },
          hover: {},
          definition: {},
          documentSymbol: { hierarchicalDocumentSymbolSupport: true },
          formatting: {},
          rename: { prepareSupport: false },
          codeAction: { codeActionLiteralSupport: { codeActionKind: { valueSet: ['', 'quickfix', 'refactor', 'source'] } } },
        },
        workspace: { workspaceFolders: true, symbol: { symbolKind: { valueSet: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26] } } },
      },
      initializationOptions: { preferences: { includeInlayParameterNameHints: 'none' } },
    }).then(() => {
      this.notify('initialized', {});
      this.initialized = true;
    }).catch((e) => console.error('[LSP] initialize failed:', e));
  }

  openDocument(uri: string, languageId: string, text: string): void {
    if (!this.initialized) return;
    this.notify('textDocument/didOpen', {
      textDocument: { uri, languageId, version: 1, text },
    });
  }

  changeDocument(uri: string, text: string, version: number): void {
    if (!this.initialized) return;
    this.notify('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    });
  }

  closeDocument(uri: string): void {
    if (!this.initialized) return;
    this.notify('textDocument/didClose', { textDocument: { uri } });
  }

  async getCompletions(uri: string, line: number, character: number): Promise<any> {
    if (!this.initialized) return null;
    return this.request('textDocument/completion', {
      textDocument: { uri },
      position: { line, character },
    });
  }

  async getHover(uri: string, line: number, character: number): Promise<any> {
    if (!this.initialized) return null;
    return this.request('textDocument/hover', {
      textDocument: { uri },
      position: { line, character },
    });
  }

  async getDefinition(uri: string, line: number, character: number): Promise<any> {
    if (!this.initialized) return null;
    return this.request('textDocument/definition', {
      textDocument: { uri },
      position: { line, character },
    });
  }

  async getDocumentSymbols(uri: string): Promise<any[]> {
    if (!this.initialized) return [];
    try {
      const result = await this.request('textDocument/documentSymbol', { textDocument: { uri } });
      return Array.isArray(result) ? result : [];
    } catch { return []; }
  }

  async getWorkspaceSymbols(query: string): Promise<any[]> {
    if (!this.initialized) return [];
    try {
      const result = await this.request('workspace/symbol', { query });
      return Array.isArray(result) ? result : [];
    } catch { return []; }
  }

  async getRename(uri: string, line: number, character: number, newName: string): Promise<any> {
    if (!this.initialized) return null;
    try {
      return await this.request('textDocument/rename', {
        textDocument: { uri },
        position: { line, character },
        newName,
      });
    } catch { return null; }
  }

  async getCodeActions(uri: string, range: any, context: any): Promise<any[]> {
    if (!this.initialized) return [];
    try {
      const result = await this.request('textDocument/codeAction', {
        textDocument: { uri },
        range,
        context,
      });
      return Array.isArray(result) ? result : [];
    } catch { return []; }
  }

  private request(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pendingRequests.set(id, { resolve, reject });
      this.send({ jsonrpc: '2.0', id, method, params });
      // Timeout after 10s
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`LSP request ${method} timed out`));
        }
      }, 10000);
    });
  }

  private notify(method: string, params: any): void {
    this.send({ jsonrpc: '2.0', method, params });
  }

  private send(msg: JsonRpcMessage): void {
    if (!this.proc) return;
    const body = JSON.stringify(msg);
    const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
    this.proc.stdin.write(header + body);
  }

  private onData(chunk: string): void {
    this.buf += chunk;
    while (true) {
      const headerEnd = this.buf.indexOf('\r\n\r\n');
      if (headerEnd < 0) break;
      const header = this.buf.slice(0, headerEnd);
      const lenMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lenMatch) { this.buf = this.buf.slice(headerEnd + 4); continue; }
      const len = parseInt(lenMatch[1], 10);
      const bodyStart = headerEnd + 4;
      if (this.buf.length < bodyStart + len) break;
      const body = this.buf.slice(bodyStart, bodyStart + len);
      this.buf = this.buf.slice(bodyStart + len);
      try {
        this.handleMessage(JSON.parse(body));
      } catch {}
    }
  }

  private handleMessage(msg: JsonRpcMessage): void {
    if (msg.id != null && (msg.result !== undefined || msg.error !== undefined)) {
      // Response to a request
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if (msg.error) pending.reject(msg.error);
        else pending.resolve(msg.result);
      }
    } else if (msg.method) {
      // Server notification or request
      this.emit('notification', msg.method, msg.params);
    }
  }
}
