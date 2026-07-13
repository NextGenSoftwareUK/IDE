import { app } from 'electron';
import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(app.getPath('userData'), 'oasis-ide-settings.json');
const RECENTS_FILE = path.join(app.getPath('userData'), 'oasis-ide-recents.json');
const MAX_RECENTS = 8;

const DEFAULTS: Record<string, string> = {
  EDITOR_AUTO_SAVE: 'off', // 'off' | 'afterDelay'
  EDITOR_AUTO_SAVE_DELAY: '1500',
  EDITOR_THEME: 'oasis-dark',
  OASIS_API_URL: process.env.OASIS_API_URL || 'http://localhost:7777',
  OASIS_WEB6_URL: process.env.OASIS_WEB6_URL || 'http://localhost:64596',
  OASIS_WEB6_API_KEY: process.env.OASIS_WEB6_API_KEY || '',
  OASIS_WEB7_URL: process.env.OASIS_WEB7_URL || 'http://localhost:62798',
  OASIS_WEB8_URL: process.env.OASIS_WEB8_URL || 'http://localhost:65332',
  OASIS_WEB9_URL: process.env.OASIS_WEB9_URL || 'http://localhost:65342',
  OASIS_WEB10_URL: process.env.OASIS_WEB10_URL || 'http://localhost:57483',
  OASIS_MCP_SERVER_PATH: process.env.OASIS_MCP_SERVER_PATH || '',
  OASIS_STAR_CLI_PATH: process.env.OASIS_STAR_CLI_PATH || '',
  SERV_API_KEY: process.env.SERV_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
};

export class SettingsService {
  private cache: Record<string, string> | null = null;

  getAll(): Record<string, string> {
    if (this.cache) return { ...this.cache };
    try {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      this.cache = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      this.cache = { ...DEFAULTS };
    }
    return { ...this.cache };
  }

  get(key: string): string {
    return this.getAll()[key] ?? '';
  }

  async saveAll(settings: Record<string, string>): Promise<void> {
    this.cache = { ...DEFAULTS, ...settings };
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.cache, null, 2), 'utf8');
    for (const [k, v] of Object.entries(this.cache)) process.env[k] = v;
  }

  getRecents(): string[] {
    try {
      return JSON.parse(fs.readFileSync(RECENTS_FILE, 'utf8')) as string[];
    } catch {
      return [];
    }
  }

  pushRecent(dir: string): void {
    const recents = [dir, ...this.getRecents().filter((r) => r !== dir)].slice(0, MAX_RECENTS);
    fs.writeFileSync(RECENTS_FILE, JSON.stringify(recents), 'utf8');
  }

  private get tabsFile(): string {
    return path.join(app.getPath('userData'), 'oasis-ide-tabs.json');
  }

  getPersistedTabs(): { workspacePath: string; tabs: string[]; activeTab: string | null } | null {
    try {
      return JSON.parse(fs.readFileSync(this.tabsFile, 'utf8'));
    } catch { return null; }
  }

  savePersistedTabs(workspacePath: string, tabs: string[], activeTab: string | null): void {
    fs.writeFileSync(this.tabsFile, JSON.stringify({ workspacePath, tabs, activeTab }), 'utf8');
  }
}
