import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

const AUTH_FILE = 'oasis-ide-auth.json';

interface StoredAuth {
  token: string;
  username?: string;
  avatarId?: string;
}

function getAuthPath(): string {
  return path.join(app.getPath('userData'), AUTH_FILE);
}

export async function loadStoredAuth(): Promise<StoredAuth | null> {
  try {
    const p = getAuthPath();
    const raw = await fs.readFile(p, 'utf-8');
    const data = JSON.parse(raw) as StoredAuth;
    if (data?.token) return data;
  } catch {
    // no file or invalid
  }
  return null;
}

export async function saveAuth(auth: StoredAuth): Promise<void> {
  const p = getAuthPath();
  await fs.writeFile(p, JSON.stringify(auth), 'utf-8');
}

export async function clearStoredAuth(): Promise<void> {
  try {
    await fs.unlink(getAuthPath());
  } catch {
    // ignore
  }
}
