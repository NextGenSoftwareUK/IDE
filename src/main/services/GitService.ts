import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec('git', args, { cwd, maxBuffer: 4 * 1024 * 1024 });
  return stdout.trim();
}

export interface GitFileStatus { path: string; status: string; }
export interface GitCommit { hash: string; message: string; author: string; date: string; }

export class GitService {
  async status(dir: string): Promise<GitFileStatus[]> {
    try {
      const out = await git(dir, ['status', '--porcelain=v1', '-z']);
      if (!out) return [];
      return out.split('\0').filter(Boolean).map((line) => ({
        status: line.slice(0, 2).trim(),
        path: line.slice(3),
      }));
    } catch { return []; }
  }

  async diff(dir: string, filePath?: string): Promise<string> {
    try {
      const args = ['diff', '--unified=3'];
      if (filePath) args.push('--', filePath);
      return await git(dir, args);
    } catch (e: any) { return e.message ?? ''; }
  }

  async log(dir: string, limit = 50): Promise<GitCommit[]> {
    try {
      const fmt = '%H\x1f%s\x1f%an\x1f%ai';
      const out = await git(dir, ['log', `--max-count=${limit}`, `--format=${fmt}`]);
      if (!out) return [];
      return out.split('\n').filter(Boolean).map((line) => {
        const [hash, message, author, date] = line.split('\x1f');
        return { hash: hash.slice(0, 12), message, author, date };
      });
    } catch { return []; }
  }

  async commit(dir: string, message: string, files: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      if (files.length > 0) await exec('git', ['add', '--', ...files], { cwd: dir });
      await exec('git', ['commit', '-m', message], { cwd: dir });
      return { success: true };
    } catch (e: any) { return { success: false, error: e.stderr ?? e.message }; }
  }

  async init(dir: string): Promise<{ success: boolean; error?: string }> {
    try {
      await exec('git', ['init'], { cwd: dir });
      return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
  }
}
