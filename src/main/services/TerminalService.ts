import type { BrowserWindow } from 'electron';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pty = require('node-pty');

export interface TerminalSession {
  ptyProcess: any;
}

export class TerminalService {
  private sessions = new Map<string, TerminalSession>();
  private sessionCounter = 0;
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(win: BrowserWindow | null) {
    this.mainWindow = win;
  }

  createSession(cwd?: string): string {
    const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');
    const argv = process.platform === 'win32' ? [] : ['-l'];
    const env = { ...process.env };
    const root = cwd || process.env.HOME || os.homedir();

    const ptyProcess = pty.spawn(shell, argv, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: root,
      env,
    });

    const sessionId = `term-${++this.sessionCounter}`;
    const session: TerminalSession = { ptyProcess };
    this.sessions.set(sessionId, session);

    ptyProcess.onData((data: string) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('terminal:data', { sessionId, data });
      }
    });

    ptyProcess.onExit(() => {
      this.sessions.delete(sessionId);
    });

    return sessionId;
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.ptyProcess) {
      session.ptyProcess.write(data);
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session?.ptyProcess) {
      session.ptyProcess.resize(cols, rows);
    }
  }

  destroy(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.ptyProcess) {
      session.ptyProcess.kill();
    }
    this.sessions.delete(sessionId);
  }
}
