import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { FileSystemService } from './FileSystemService.js';

// All models are reached through the OpenAI-compatible chat/completions endpoint —
// SERV's docs confirm that endpoint works for every model in the catalog, regardless
// of the model's own provider (OpenAI, Anthropic, Google, xAI, Qwen, DeepSeek).
// https://docs.openserv.ai/serv-reasoning/sdk-integration
export const OPENSERV_MODELS = [
  { id: 'gpt-5.5', label: 'GPT-5.5 (OpenAI)' },
  { id: 'gpt-5.4', label: 'GPT-5.4 (OpenAI)' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini (OpenAI)' },
  { id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano (OpenAI)' },
  { id: 'o3', label: 'o3 (OpenAI)' },
  { id: 'o3-mini', label: 'o3-mini (OpenAI)' },
  { id: 'o3-pro', label: 'o3-pro (OpenAI)' },
  { id: 'o4-mini', label: 'o4-mini (OpenAI)' },
  { id: 'claude-opus-4.6', label: 'Claude Opus 4.6 (Anthropic)' },
  { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6 (Anthropic)' },
  { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5 (Anthropic)' },
  { id: 'gemini-flash-latest', label: 'Gemini Flash (Google)' },
  { id: 'gemini-pro-latest', label: 'Gemini Pro (Google)' },
  { id: 'gemma-4-26b-a4b-it', label: 'Gemma 4 26B (Google)' },
  { id: 'gemma-4-31b-it', label: 'Gemma 4 31B (Google)' },
  { id: 'grok-4.3', label: 'Grok 4.3 (xAI)' },
  { id: 'grok-4.20', label: 'Grok 4.20 (xAI)' },
  { id: 'qwen3.6-flash', label: 'Qwen3.6 Flash' },
  { id: 'qwen3.6-max-preview', label: 'Qwen3.6 Max Preview' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek v4 Pro' },
  { id: 'deepseek-v4-flash', label: 'DeepSeek v4 Flash' },
] as const;

export const DEFAULT_OPENSERV_MODEL = 'gpt-5.4';

const MAX_TURNS = 30;
const SEARCH_MATCH_CAP = 200;
const COMMAND_TIMEOUT_MS = 60_000;

export type OpenServAgentEvent =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; name: string; input: any }
  | { type: 'tool-result'; name: string; result: string }
  | { type: 'confirm-request'; requestId: string; kind: 'write' | 'command'; label: string; detail: string }
  | { type: 'done'; summary: string }
  | { type: 'error'; message: string };

interface RunTaskOptions {
  workspaceRoot: string;
  model?: string;
  onEvent: (event: OpenServAgentEvent) => void;
  requestConfirmation: (requestId: string, kind: 'write' | 'command', label: string, detail: string) => Promise<boolean>;
}

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file, relative to the workspace root.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Relative file path' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description:
        'Create or overwrite a file with the given content, relative to the workspace root. Requires user confirmation in the IDE before it is applied.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative file path' },
          content: { type: 'string', description: 'Full file content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: "List files and folders at a relative path (use '.' for workspace root).",
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Relative directory path' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description:
        "Search file contents for a pattern across the workspace (like grep -rn). Use before read_file when you don't know which file something is in.",
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Text or regex pattern to search for' },
          path: { type: 'string', description: "Relative directory to search in, default '.'" },
          glob: { type: 'string', description: "Optional filename glob filter, e.g. '*.tsx'" },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description:
        'Run a shell command in the workspace root (build tools, tests, git, etc). Requires user confirmation in the IDE before it runs.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string' } },
        required: ['command'],
      },
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

// Agentic coding assistant that talks to the OpenServ inference API through the
// OpenAI SDK (chat/completions), so it can drive any model in the SERV catalog —
// not just OpenAI's own models — by swapping the `model` field per request.
export class OpenServAgentService {
  private fsService = new FileSystemService();

  isAvailable(): boolean {
    return !!process.env.SERV_API_KEY;
  }

  listModels() {
    return OPENSERV_MODELS;
  }

  private client(): OpenAI {
    return new OpenAI({
      baseURL: 'https://inference-api.openserv.ai/v1',
      apiKey: process.env.SERV_API_KEY,
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
      const message = 'SERV_API_KEY is not set — OpenServ agent is unavailable.';
      opts.onEvent({ type: 'error', message });
      return { success: false, summary: message };
    }

    const model = opts.model || DEFAULT_OPENSERV_MODEL;
    const client = this.client();
    const requestIdSeq = { n: 0 };
    const system =
      'You are a careful coding agent working inside a real project workspace in the OASIS IDE. ' +
      "Use list_directory and search_files to locate relevant code before reading or editing it — " +
      "prefer search_files over reading whole files blindly when you don't know where something lives. " +
      'Make minimal, correct edits with write_file. Explain what you changed when you are done. ' +
      'Stop calling tools once the task is complete and give a final summary.';

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
      { role: 'user', content: task },
    ];

    try {
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const response = await client.chat.completions.create({
          model,
          max_tokens: 4096,
          messages,
          tools: TOOLS,
        });

        const choice = response.choices[0];
        const assistantMessage = choice.message;
        messages.push(assistantMessage);

        const text = assistantMessage.content?.trim() || '';
        if (text) {
          opts.onEvent({ type: 'text', text });
        }

        const toolCalls = assistantMessage.tool_calls || [];

        if (toolCalls.length === 0) {
          opts.onEvent({ type: 'done', summary: text || 'Task complete.' });
          return { success: true, summary: text || 'Task complete.' };
        }

        for (const call of toolCalls) {
          const input = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          opts.onEvent({ type: 'tool-call', name: call.function.name, input });
          const result = await this.executeTool(call.function.name, input, opts, requestIdSeq);
          opts.onEvent({ type: 'tool-result', name: call.function.name, result });
          messages.push({ role: 'tool', tool_call_id: call.id, content: result });
        }
      }

      const message = `Stopped after ${MAX_TURNS} turns without finishing.`;
      opts.onEvent({ type: 'error', message });
      return { success: false, summary: message };
    } catch (err: any) {
      const message = err?.message || 'OpenServ agent task failed.';
      opts.onEvent({ type: 'error', message });
      return { success: false, summary: message };
    }
  }
}
