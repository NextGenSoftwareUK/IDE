import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const exec = promisify(execFile);

const STAR_TEMPLATES = [
  { id: 'oapp', name: 'OAPP (Basic)', description: 'Minimal OASIS Application with avatar and holon support' },
  { id: 'oapp-web', name: 'OAPP (Web)', description: 'OAPP with Web4/Web5 API endpoints' },
  { id: 'oapp-nft', name: 'OAPP (NFT)', description: 'NFT-enabled OAPP with minting and wallet integration' },
  { id: 'oapp-ai', name: 'OAPP (AI)', description: 'OAPP with Web6 AI/FAHRN integration' },
];

function resolveStarCLI(): string | null {
  if (process.env.OASIS_STAR_CLI_PATH && fs.existsSync(process.env.OASIS_STAR_CLI_PATH)) {
    return process.env.OASIS_STAR_CLI_PATH;
  }
  const monoRepo = path.join(__dirname, '../../../../../../STAR ODK/NextGenSoftware.OASIS.STAR.CLI/bin/Debug/net10.0/star.exe');
  if (fs.existsSync(monoRepo)) return monoRepo;
  return null;
}

export class StarWizardService {
  getTemplates() { return STAR_TEMPLATES; }

  async createApp(name: string, templateType: string, outputDir: string): Promise<{
    success: boolean; path?: string; output?: string; error?: string;
  }> {
    const starPath = resolveStarCLI();
    if (!starPath) {
      return { success: false, error: 'STAR CLI not found. Build the STAR ODK or set OASIS_STAR_CLI_PATH.' };
    }
    try {
      const appDir = path.join(outputDir, name);
      const { stdout, stderr } = await exec(starPath, ['new', templateType, name, '--output', outputDir], {
        timeout: 60000,
        maxBuffer: 2 * 1024 * 1024,
      });
      return { success: true, path: appDir, output: stdout + stderr };
    } catch (e: any) {
      return { success: false, error: e.stderr ?? e.message };
    }
  }
}
