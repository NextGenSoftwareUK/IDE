import { dialog } from 'electron';
import fs from 'fs/promises';
import path from 'path';

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
    return this.workspacePath;
  }

  setWorkspacePath(dir: string): void {
    this.workspacePath = dir;
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
}
