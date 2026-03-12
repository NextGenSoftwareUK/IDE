/**
 * Chat service: LLM completion when OPENAI_API_KEY is set.
 * Used by the renderer chat to get real AI responses; falls back to MCP-only in renderer when unavailable.
 */
import OpenAI from 'openai';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class ChatService {
  private client: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey.trim()) {
      this.client = new OpenAI({ apiKey: apiKey.trim() });
    }
  }

  hasLLM(): boolean {
    return this.client !== null;
  }

  async complete(messages: ChatMessage[]): Promise<{ content: string; error?: string }> {
    if (!this.client) {
      return {
        content: '',
        error: 'No LLM configured. Set OPENAI_API_KEY in your environment to enable AI responses.'
      };
    }

    try {
      const response = await this.client.chat.completions.create({
        model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: 2048
      });

      const choice = response.choices?.[0];
      const content = choice?.message?.content?.trim() ?? '';
      return { content };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: '', error: message };
    }
  }
}
