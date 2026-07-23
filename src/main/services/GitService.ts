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

  async currentBranch(dir: string): Promise<string> {
    try { return await git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']); }
    catch { return ''; }
  }

  async listBranches(dir: string): Promise<{ name: string; current: boolean }[]> {
    try {
      const out = await git(dir, ['branch', '--format=%(refname:short)\t%(HEAD)']);
      return out.split('\n').filter(Boolean).map((line) => {
        const [name, head] = line.split('\t');
        return { name: name.trim(), current: head?.trim() === '*' };
      });
    } catch { return []; }
  }

  async checkoutBranch(dir: string, branch: string): Promise<{ success: boolean; error?: string }> {
    try {
      await exec('git', ['checkout', branch], { cwd: dir });
      return { success: true };
    } catch (e: any) { return { success: false, error: e.stderr ?? e.message }; }
  }

  async createBranch(dir: string, branch: string): Promise<{ success: boolean; error?: string }> {
    try {
      await exec('git', ['checkout', '-b', branch], { cwd: dir });
      return { success: true };
    } catch (e: any) { return { success: false, error: e.stderr ?? e.message }; }
  }

  async getFileOriginal(dir: string, filePath: string): Promise<string> {
    try {
      // Normalise to forward slashes for git
      const rel = filePath.replace(/\\/g, '/');
      return await git(dir, ['show', `HEAD:${rel}`]);
    } catch { return ''; }
  }

  async blameFile(dir: string, filePath: string): Promise<BlameEntry[]> {
    try {
      const rel = filePath.replace(/\\/g, '/');
      const out = await git(dir, ['blame', '--porcelain', '--', rel]);
      if (!out) return [];
      const lines = out.split('\n');
      const commits = new Map<string, { author: string; summary: string; timestamp: number }>();
      const result: BlameEntry[] = [];
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        if (!line) { i++; continue; }
        // Header line: <40-char hash> <orig-line> <final-line> [<num>]
        const headerMatch = line.match(/^([0-9a-f]{40}) \d+ (\d+)/);
        if (!headerMatch) { i++; continue; }
        const hash = headerMatch[1];
        const finalLine = parseInt(headerMatch[2], 10);
        i++;
        // Read commit metadata lines until we hit the filename line
        if (!commits.has(hash)) {
          let author = '';
          let summary = '';
          let timestamp = 0;
          while (i < lines.length && !lines[i].startsWith('\t')) {
            const meta = lines[i];
            if (meta.startsWith('author ') && !meta.startsWith('author-')) author = meta.slice(7).trim();
            else if (meta.startsWith('summary ')) summary = meta.slice(8).trim();
            else if (meta.startsWith('author-time ')) timestamp = parseInt(meta.slice(12), 10);
            i++;
          }
          commits.set(hash, { author, summary, timestamp });
        } else {
          while (i < lines.length && !lines[i].startsWith('\t')) i++;
        }
        i++; // skip the \t<content> line
        const meta = commits.get(hash)!;
        result.push({ line: finalLine, hash: hash.slice(0, 8), author: meta.author, summary: meta.summary, timestamp: meta.timestamp });
      }
      return result;
    } catch { return []; }
  }

  async push(dir: string, remote = 'origin', branch?: string): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      const args = ['push', remote];
      if (branch) args.push(branch);
      const output = await git(dir, args);
      return { success: true, output };
    } catch (e: any) {
      return { success: false, output: '', error: e?.stderr ?? e?.message ?? 'Push failed' };
    }
  }

  async pull(dir: string, remote = 'origin', branch?: string): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      const args = ['pull', remote];
      if (branch) args.push(branch);
      const output = await git(dir, args);
      return { success: true, output };
    } catch (e: any) {
      return { success: false, output: '', error: e?.stderr ?? e?.message ?? 'Pull failed' };
    }
  }

  async getRemoteUrl(dir: string): Promise<string> {
    try { return await git(dir, ['remote', 'get-url', 'origin']); }
    catch { return ''; }
  }
}

export interface BlameEntry {
  line: number;
  hash: string;
  author: string;
  summary: string;
  timestamp: number;
}
