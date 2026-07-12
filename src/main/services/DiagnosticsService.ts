import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const exec = promisify(execFile);

export interface Diagnostic {
  file: string;
  line: number;
  col: number;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

// tsc output line: path(line,col): error TS####: message
const TSC_LINE = /^(.+?)\((\d+),(\d+)\):\s+(error|warning|info)\s+(TS\d+):\s+(.+)$/;

function parseTscOutput(output: string, workspaceRoot: string): Diagnostic[] {
  const results: Diagnostic[] = [];
  for (const line of output.split('\n')) {
    const m = line.match(TSC_LINE);
    if (!m) continue;
    const [, rawFile, lineStr, colStr, sev, code, msg] = m;
    const filePath = path.isAbsolute(rawFile) ? rawFile : path.join(workspaceRoot, rawFile);
    results.push({
      file: filePath,
      line: parseInt(lineStr, 10),
      col: parseInt(colStr, 10),
      severity: sev as Diagnostic['severity'],
      code,
      message: msg.trim(),
    });
  }
  return results;
}

export class DiagnosticsService {
  async runTsc(workspaceRoot: string): Promise<{ diagnostics: Diagnostic[]; error?: string }> {
    // Look for a tsconfig in the workspace root
    const tsconfig = fs.existsSync(path.join(workspaceRoot, 'tsconfig.json'))
      ? path.join(workspaceRoot, 'tsconfig.json')
      : null;

    // Resolve tsc: prefer local node_modules/.bin/tsc, fall back to global
    const localTsc = path.join(workspaceRoot, 'node_modules', '.bin', 'tsc');
    const tscBin = fs.existsSync(localTsc) ? localTsc : 'tsc';

    const args = ['--noEmit', '--pretty', 'false'];
    if (tsconfig) args.push('--project', tsconfig);

    try {
      await exec(tscBin, args, { cwd: workspaceRoot, timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
      return { diagnostics: [] };
    } catch (e: any) {
      // tsc exits non-zero when there are errors — that's expected
      const output = (e.stdout ?? '') + (e.stderr ?? '');
      return { diagnostics: parseTscOutput(output, workspaceRoot) };
    }
  }

  async runEslint(workspaceRoot: string): Promise<{ diagnostics: Diagnostic[]; error?: string }> {
    const localEslint = path.join(workspaceRoot, 'node_modules', '.bin', 'eslint');
    if (!fs.existsSync(localEslint)) {
      return { diagnostics: [], error: 'eslint not found in node_modules' };
    }
    try {
      await exec(localEslint, ['.', '--format', 'unix', '--ext', '.ts,.tsx,.js,.jsx'], {
        cwd: workspaceRoot, timeout: 60000, maxBuffer: 4 * 1024 * 1024
      });
      return { diagnostics: [] };
    } catch (e: any) {
      const output = (e.stdout ?? '') + (e.stderr ?? '');
      // eslint unix format: file:line:col: message [rule]
      const diagnostics: Diagnostic[] = [];
      for (const line of output.split('\n')) {
        const m = line.match(/^(.+?):(\d+):(\d+):\s+(error|warning|info)\s+(.+?)\s+\[(.+)\]$/);
        if (!m) continue;
        const [, file, ln, col, sev, msg, rule] = m;
        diagnostics.push({ file, line: +ln, col: +col, severity: sev as Diagnostic['severity'], code: rule, message: msg });
      }
      return { diagnostics };
    }
  }
}
