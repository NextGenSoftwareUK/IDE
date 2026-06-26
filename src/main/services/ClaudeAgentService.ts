import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { FileSystemService } from './FileSystemService.js';

const MODEL = 'claude-sonnet-4-6';
const MAX_TURNS = 30;
const SEARCH_MATCH_CAP = 200;
const COMMAND_TIMEOUT_MS = 60_000;

export type ClaudeAgentEvent =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; name: string; input: any }
  | { type: 'tool-result'; name: string; result: string }
  | { type: 'confirm-request'; requestId: string; kind: 'write' | 'command'; label: string; detail: string }
  | { type: 'done'; summary: string }
  | { type: 'error'; message: string };

interface RunTaskOptions {
  workspaceRoot: string;
  onEvent: (event: ClaudeAgentEvent) => void;
  requestConfirmation: (requestId: string, kind: 'write' | 'command', label: string, detail: string) => Promise<boolean>;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file, relative to the workspace root.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative file path' } },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description:
      'Create or overwrite a file with the given content, relative to the workspace root. Requires user confirmation in the IDE before it is applied.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path' },
        content: { type: 'string', description: 'Full file content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_directory',
    description: "List files and folders at a relative path (use '.' for workspace root).",
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative directory path' } },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description:
      "Search file contents for a pattern across the workspace (like grep -rn). Use before read_file when you don't know which file something is in.",
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Text or regex pattern to search for' },
        path: { type: 'string', description: "Relative directory to search in, default '.'" },
        glob: { type: 'string', description: "Optional filename glob filter, e.g. '*.tsx'" },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'run_command',
    description:
      'Run a shell command in the workspace root (build tools, tests, git, etc). Requires user confirmation in the IDE before it runs.',
    input_schema: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    },
  },
];

function simpleDiff(oldText: string, newText: string): string {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const max = Math.max(oldLines.length, newLines.length);
  const out: string[] = [];
  for (let i = 0; i < max; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) continue;
    if (o !== undefined) out.push(`- ${o}`);
    if (n !== undefined) out.push(`+ ${n}`);
  }
  return out.length ? out.join('\n') : '(no line-level changes detected)';
}

export class ClaudeAgentService {
  private fsService = new FileSystemService();

  isAvailable(): boolean {
    return !!process.env.SERV_API_KEY;
  }

  private client(): Anthropic {
    return new Anthropic({
      baseURL: 'https://inference-api.openserv.ai', // Anthropic SDK appends /v1/messages itself
      authToken: process.env.SERV_API_KEY,
    });
  }

  private safePath(workspaceRoot: string, rel: string): string {
    const full = path.resolve(workspaceRoot, rel);
    if (!full.startsWith(path.resolve(workspaceRoot))) {
      throw new Error(`Path escapes workspace root: ${rel}`);
    }
    return full;
  }

  private async executeTool(
    name: string,
    input: any,
    opts: RunTaskOptions,
    requestIdSeq: { n: number }
  ): Promise<string> {
    const { workspaceRoot, requestConfirmation } = opts;
    try {
      switch (name) {
        case 'read_file':
          return await fs.readFile(this.safePath(workspaceRoot, input.path), 'utf-8');

        case 'list_directory': {
          const entries = await fs.readdir(this.safePath(workspaceRoot, input.path || '.'));
          return entries.join('\n') || '(empty directory)';
        }

        case 'write_file': {
          const target = this.safePath(workspaceRoot, input.path);
          let existed = true;
          let oldContent = '';
          try {
            oldContent = await fs.readFile(target, 'utf-8');
          } catch {
            existed = false;
          }
          const diff = existed ? simpleDiff(oldContent, input.content) : input.content;
          const requestId = `req-${++requestIdSeq.n}-${Date.now()}`;
          const approved = await requestConfirmation(
            requestId,
            'write',
            `${existed ? 'Edit' : 'Create'}: ${input.path}`,
            diff
          );
          if (!approved) return 'REJECTED by user: write was not applied.';
          await this.fsService.writeFile(target, input.content);
          return `Wrote ${input.content.length} bytes to ${input.path}`;
        }

        case 'run_command': {
          const requestId = `req-${++requestIdSeq.n}-${Date.now()}`;
          const approved = await requestConfirmation(requestId, 'command', 'Run command', input.command);
          if (!approved) return 'REJECTED by user: command was not run.';
          return await new Promise<string>((resolve) => {
            exec(
              input.command,
              { cwd: workspaceRoot, timeout: COMMAND_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
              (error, stdout, stderr) => {
                if (error) {
                  resolve(`ERROR: ${error.message}\n${stderr}`);
                } else {
                  resolve(stdout || '(no output)');
                }
              }
            );
          });
        }

        case 'search_files': {
          const root = this.safePath(workspaceRoot, input.path || '.');
          const matches: string[] = [];
          const re = new RegExp(input.pattern);
          const globRe = input.glob
            ? new RegExp('^' + input.glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
            : null;

          const walk = async (dir: string) => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                await walk(full);
              } else if (!globRe || globRe.test(entry.name)) {
                let content: string;
                try {
                  content = await fs.readFile(full, 'utf-8');
                } catch {
                  continue;
                }
                content.split('\n').forEach((line, idx) => {
                  if (re.test(line)) {
                    matches.push(`${path.relative(workspaceRoot, full)}:${idx + 1}: ${line.trim()}`);
                  }
                });
              }
              if (matches.length >= SEARCH_MATCH_CAP) return;
            }
          };
          await walk(root);
          return matches.length === 0 ? 'No matches found.' : matches.slice(0, SEARCH_MATCH_CAP).join('\n');
        }

        default:
          return `Unknown tool: ${name}`;
      }
    } catch (err: any) {
      return `ERROR: ${err.message}`;
    }
  }

  async runTask(task: string, opts: RunTaskOptions): Promise<{ success: boolean; summary: string }> {
    if (!this.isAvailable()) {
      const message = 'SERV_API_KEY is not set — Claude (OpenServ) agent is unavailable.';
      opts.onEvent({ type: 'error', message });
      return { success: false, summary: message };
    }

    const client = this.client();
    const requestIdSeq = { n: 0 };
    const system =
      'You are a careful coding agent working inside a real project workspace in the OASIS IDE. ' +
      "Use list_directory and search_files to locate relevant code before reading or editing it — " +
      "prefer search_files over reading whole files blindly when you don't know where something lives. " +
      'Make minimal, correct edits with write_file. Explain what you changed when you are done. ' +
      'Stop calling tools once the task is complete and give a final summary.';

    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: task }];

    try {
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system,
          messages,
          tools: TOOLS,
        });

        messages.push({ role: 'assistant', content: response.content });

        let lastText = '';
        for (const block of response.content) {
          if (block.type === 'text' && block.text.trim()) {
            lastText = block.text;
            opts.onEvent({ type: 'text', text: block.text });
          }
        }

        const toolCalls = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

        if (response.stop_reason !== 'tool_use' || toolCalls.length === 0) {
          opts.onEvent({ type: 'done', summary: lastText || 'Task complete.' });
          return { success: true, summary: lastText || 'Task complete.' };
        }

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const call of toolCalls) {
          opts.onEvent({ type: 'tool-call', name: call.name, input: call.input });
          const result = await this.executeTool(call.name, call.input, opts, requestIdSeq);
          opts.onEvent({ type: 'tool-result', name: call.name, result });
          toolResults.push({ type: 'tool_result', tool_use_id: call.id, content: result });
        }

        messages.push({ role: 'user', content: toolResults });
      }

      const message = `Stopped after ${MAX_TURNS} turns without finishing.`;
      opts.onEvent({ type: 'error', message });
      return { success: false, summary: message };
    } catch (err: any) {
      const message = err?.message || 'Claude agent task failed.';
      opts.onEvent({ type: 'error', message });
      return { success: false, summary: message };
    }
  }
}
