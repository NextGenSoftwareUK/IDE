import path from 'path';
import fs from 'fs';
import type { BrowserWindow } from 'electron';
import os from 'os';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pty = require('node-pty');

export type TerminalType = 'os' | 'star';

export interface TerminalSession {
  ptyProcess: any;
  type: TerminalType;
  label: string;
}

/**
 * Resolve the STAR CLI binary path.
 * Priority:
 *   1. OASIS_STAR_CLI_PATH env var
 *   2. Monorepo default: OASIS2/STAR ODK/.../bin/Debug/net10.0/star.exe
 */
function resolveStarCLIPath(): string | null {
  const envPath = process.env.OASIS_STAR_CLI_PATH?.trim();
  if (envPath && fs.existsSync(envPath)) return envPath;

  // Monorepo layout: this file lives in OASIS-IDE/src/main/services/
  // STAR ODK is at OASIS2/STAR ODK/...
  const candidates = [
    path.join(__dirname, '../../../../STAR ODK/NextGenSoftware.OASIS.STAR.CLI/bin/Debug/net10.0/star.exe'),
    path.join(__dirname, '../../../../STAR ODK/NextGenSoftware.OASIS.STAR.CLI/bin/Release/net10.0/star.exe'),
    path.join(__dirname, '../../../../STAR ODK/NextGenSoftware.OASIS.STAR.CLI/bin/Debug/net10.0/star'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

export class TerminalService {
  private sessions = new Map<string, TerminalSession>();
  private sessionCounter = 0;
  private mainWindow: BrowserWindow | null = null;
  private starCLIPath: string | null;

  constructor() {
    this.starCLIPath = resolveStarCLIPath();
    if (this.starCLIPath) {
      console.log('[Terminal] STAR CLI found at:', this.starCLIPath);
    } else {
      console.warn('[Terminal] STAR CLI not found. Set OASIS_STAR_CLI_PATH or build the STAR ODK project.');
    }
  }

  setMainWindow(win: BrowserWindow | null) {
    this.mainWindow = win;
  }

  isStarCLIAvailable(): boolean {
    return !!this.starCLIPath;
  }

  createSession(cwd?: string, type: TerminalType = 'os'): string {
    const root = cwd || process.env.HOME || os.homedir();

    let shell: string;
    let argv: string[];
    let label: string;

    if (type === 'star') {
      if (!this.starCLIPath) {
        throw new Error(
          'STAR CLI not found. Build the STAR ODK project or set OASIS_STAR_CLI_PATH.'
        );
      }
      shell = this.starCLIPath;
      argv = [];
      label = 'STAR CLI';
    } else {
      shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');
      argv = process.platform === 'win32' ? [] : ['-l'];
      label = 'Shell';
    }

    const ptyProcess = pty.spawn(shell, argv, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: root,
      env: { ...process.env },
    });

    const sessionId = `term-${++this.sessionCounter}`;
    this.sessions.set(sessionId, { ptyProcess, type, label });

    ptyProcess.onData((data: string) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('terminal:data', { sessionId, data });
      }
    });

    ptyProcess.onExit(() => {
      this.sessions.delete(sessionId);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('terminal:exit', { sessionId });
      }
    });

    return sessionId;
  }

  getSessionInfo(sessionId: string): { type: TerminalType; label: string } | null {
    const s = this.sessions.get(sessionId);
    return s ? { type: s.type, label: s.label } : null;
  }

  write(sessionId: string, data: string): void {
    this.sessions.get(sessionId)?.ptyProcess.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.sessions.get(sessionId)?.ptyProcess.resize(cols, rows);
  }

  destroy(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.ptyProcess) session.ptyProcess.kill();
    this.sessions.delete(sessionId);
  }
}
