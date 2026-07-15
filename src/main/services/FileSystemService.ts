import { dialog } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import chokidar, { FSWatcher } from 'chokidar';

const DEFAULT_IGNORE = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.vite',
  'coverage',
  '__pycache__',
  '.DS_Store',
  '*.log',
]);

export interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
  isDirectory: boolean;
}

export class FileSystemService {
  private workspacePath: string | null = null;
  private watcher: FSWatcher | null = null;
  private onChangeCallback: (() => void) | null = null;
  private onFileChangeCallback: ((filePath: string) => void) | null = null;

  getWorkspacePath(): string | null {
    return this.workspacePath;
  }

  async pickWorkspace(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Open folder as workspace',
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    this.workspacePath = result.filePaths[0];
    this.startWatcher(this.workspacePath);
    return this.workspacePath;
  }

  setWorkspacePath(dir: string): void {
    this.workspacePath = dir;
    this.startWatcher(dir);
  }

  onWorkspaceChange(cb: () => void): void {
    this.onChangeCallback = cb;
  }

  onFileChange(cb: (filePath: string) => void): void {
    this.onFileChangeCallback = cb;
  }

  private startWatcher(dir: string): void {
    this.watcher?.close();
    this.watcher = chokidar.watch(dir, {
      ignored: /(node_modules|\.git|dist|build|\.next|\.vite|coverage|__pycache__)/,
      ignoreInitial: true,
      depth: 8,
      usePolling: false,
    });
    const notify = () => this.onChangeCallback?.();
    this.watcher
      .on('add', notify).on('unlink', notify).on('addDir', notify).on('unlinkDir', notify)
      .on('change', (filePath) => this.onFileChangeCallback?.(filePath));
  }

  async listTree(dir?: string): Promise<TreeNode[]> {
    const root = dir ?? this.workspacePath;
    if (!root) return [];
    return this.readDirRecursive(root, root);
  }

  private async readDirRecursive(
    currentPath: string,
    rootPath: string
  ): Promise<TreeNode[]> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const nodes: TreeNode[] = [];
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(rootPath, fullPath);
      if (this.shouldIgnore(entry.name, relativePath)) continue;
      const node: TreeNode = {
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
      };
      if (entry.isDirectory()) {
        try {
          node.children = await this.readDirRecursive(fullPath, rootPath);
        } catch {
          node.children = [];
        }
      }
      nodes.push(node);
    }
    nodes.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
      return a.isDirectory ? -1 : 1;
    });
    return nodes;
  }

  private shouldIgnore(name: string, relativePath: string): boolean {
    if (DEFAULT_IGNORE.has(name)) return true;
    const parts = relativePath.split(path.sep);
    if (parts.some((p) => DEFAULT_IGNORE.has(p))) return true;
    return false;
  }

  async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async createFile(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '', 'utf-8');
  }

  async createFolder(folderPath: string): Promise<void> {
    await fs.mkdir(folderPath, { recursive: true });
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    await fs.rename(oldPath, newPath);
  }

  async deleteFile(filePath: string): Promise<void> {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      await fs.rm(filePath, { recursive: true, force: true });
    } else {
      await fs.unlink(filePath);
    }
  }

  async searchFiles(
    query: string,
    dir: string,
    extensions?: string[]
  ): Promise<Array<{ file: string; line: number; preview: string }>> {
    const results: Array<{ file: string; line: number; preview: string }> = [];
    const queryLower = query.toLowerCase();
    await this.searchDir(dir, dir, queryLower, extensions ?? [], results, 0);
    return results.slice(0, 500);
  }

  private async searchDir(
    dir: string,
    root: string,
    query: string,
    extensions: string[],
    results: Array<{ file: string; line: number; preview: string }>,
    depth: number
  ): Promise<void> {
    if (depth > 8 || results.length >= 500) return;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      if (this.shouldIgnore(entry.name, path.relative(root, path.join(dir, entry.name)))) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.searchDir(fullPath, root, query, extensions, results, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase().slice(1);
        if (extensions.length > 0 && !extensions.includes(ext)) continue;
        try {
          const text = await fs.readFile(fullPath, 'utf-8');
          const lines = text.split('\n');
          lines.forEach((lineText, idx) => {
            if (results.length >= 500) return;
            if (lineText.toLowerCase().includes(query)) {
              results.push({ file: fullPath, line: idx + 1, preview: lineText.trim().slice(0, 200) });
            }
          });
        } catch { /* skip binary */ }
      }
    }
  }
}
