import axios, { AxiosInstance } from 'axios';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ToolDefinition {
  Name: string;
  Description: string;
  Parameters: Record<string, any>;
}

export interface CompletionRequest {
  Provider?: string;
  Model?: string;
  Messages: ChatMessage[];
  AvatarId?: string;
  Temperature?: number;
  MaxTokens?: number;
  UseFAHRN?: boolean;
  UseHolonicBraid?: boolean;
  FahrnTaskType?: string;
  Stream?: boolean;
  InjectAvatarContext?: boolean;
  CacheTtlSeconds?: number;
  CacheSimilarityThreshold?: number;
  Tools?: ToolDefinition[];
  ToolChoice?: string;
  ExternalMemoryProviders?: string[];
}

export interface CompletionResponse {
  Content?: string;
  Provider?: string;
  Model?: string;
  InputTokens?: number;
  OutputTokens?: number;
  CostUsd?: number;
  ToolCalls?: any[];
  FinishReason?: string;
  Error?: string;
  IsError?: boolean;
}

export interface FahrnSolveRequest {
  Problem: string;
  TaskType?: string;
  AvatarId?: string;
  InjectAvatarContext?: boolean;
  ReturnReasoning?: boolean;
  Mode?: string;
}

export interface FahrnSolveResponse {
  Answer?: string;
  ReasoningTrace?: string;
  MermaidPlan?: string;
  TaskType?: string;
  AgentsUsed?: string[];
  TotalCostUsd?: number;
  Error?: string;
  IsError?: boolean;
}

export interface A2ATask {
  Message: {
    Role: string;
    Parts: Array<{ Text?: string; Type?: string }>;
  };
  AvatarId?: string;
}

export interface A2ATaskStatus {
  Id: string;
  State: string;
  Result?: { Parts: Array<{ Text?: string }> };
  Error?: string;
}

export class Web6APIClient {
  private client: AxiosInstance;
  private baseURL: string;
  private authToken: string | null = null;
  private apiKey: string | null = null;

  constructor() {
    this.baseURL = process.env.OASIS_WEB6_URL || 'http://localhost:64596';
    this.apiKey = process.env.OASIS_WEB6_API_KEY || null;

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000,
      validateStatus: (status) => status < 500
    });

    if (this.apiKey) {
      this.client.defaults.headers.common['X-Web6-Api-Key'] = this.apiKey;
    }
  }

  setAuthToken(token: string) {
    this.authToken = token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken() {
    this.authToken = null;
    delete this.client.defaults.headers.common['Authorization'];
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  async healthCheck(): Promise<{ status: string; error?: string }> {
    try {
      const response = await this.client.get('/api/health');
      return { status: 'healthy', ...(response.data ?? {}) };
    } catch (error: any) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const response = await this.client.post('/v1/complete', request);
      if (response.status >= 400) {
        return { Error: response.data?.error ?? response.data?.Error ?? response.statusText, IsError: true };
      }
      return response.data;
    } catch (error: any) {
      return { Error: error.message, IsError: true };
    }
  }

  /**
   * Stream a completion via SSE. Calls onChunk for each text delta, onDone when complete.
   * Uses Node.js fetch (available in Electron 28 / Node 18+).
   */
  async streamComplete(
    request: CompletionRequest,
    onChunk: (delta: string) => void,
    onDone: (fullContent: string) => void,
    onError?: (err: string) => void
  ): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authToken) headers['Authorization'] = `Bearer ${this.authToken}`;
    if (this.apiKey) headers['X-Web6-Api-Key'] = this.apiKey;

    try {
      const response = await fetch(`${this.baseURL}/v1/complete/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...request, Stream: true })
      });

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => response.statusText);
        onError?.(`HTTP ${response.status}: ${text}`);
        return;
      }

      const reader = (response.body as any).getReader();
      const decoder = new TextDecoder();
      let full = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const chunk = JSON.parse(payload);
            const text = chunk?.Delta ?? chunk?.Content ?? chunk?.delta ?? chunk?.content ?? '';
            if (text) {
              full += text;
              onChunk(text);
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
      onDone(full);
    } catch (err: any) {
      onError?.(err.message ?? String(err));
    }
  }

  async fahrnSolve(request: FahrnSolveRequest): Promise<FahrnSolveResponse> {
    try {
      const response = await this.client.post('/v1/fahrn/solve', request);
      if (response.status >= 400) {
        return { Error: response.data?.error ?? response.statusText, IsError: true };
      }
      return response.data;
    } catch (error: any) {
      return { Error: error.message, IsError: true };
    }
  }

  async getAvatarContext(avatarId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v1/context/${avatarId}`);
      return response.data;
    } catch {
      return null;
    }
  }

  async getAgentCard(): Promise<any> {
    try {
      const response = await this.client.get('/.well-known/agent.json');
      return response.data;
    } catch {
      return null;
    }
  }

  async getMcpDiscovery(): Promise<any> {
    try {
      const response = await this.client.get('/.well-known/mcp.json');
      return response.data;
    } catch {
      return null;
    }
  }

  async a2aTaskSend(task: A2ATask): Promise<{ taskId: string; error?: string }> {
    try {
      const response = await this.client.post('/a2a/tasks/send', task);
      if (response.status >= 400) {
        return { taskId: '', error: response.data?.error ?? response.statusText };
      }
      const data = response.data;
      return { taskId: data?.id ?? data?.Id ?? data?.taskId ?? '' };
    } catch (error: any) {
      return { taskId: '', error: error.message };
    }
  }

  async a2aTaskGet(taskId: string): Promise<A2ATaskStatus> {
    const response = await this.client.get(`/a2a/tasks/${taskId}`);
    return response.data;
  }

  async a2aTaskCancel(taskId: string): Promise<void> {
    await this.client.post(`/a2a/tasks/${taskId}/cancel`);
  }

  /**
   * Poll an A2A task until it reaches a terminal state or timeout.
   */
  async a2aTaskPoll(taskId: string, timeoutMs = 60000): Promise<A2ATaskStatus> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const status = await this.a2aTaskGet(taskId);
      if (['completed', 'failed', 'cancelled'].includes((status.State ?? '').toLowerCase())) {
        return status;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    return { Id: taskId, State: 'timeout', Error: 'Task polling timed out' };
  }

  async fahrnGetAgents(): Promise<any[]> {
    try {
      const response = await this.client.get('/v1/fahrn/agents');
      return response.data?.agents ?? response.data ?? [];
    } catch {
      return [];
    }
  }

  async orchestratorList(): Promise<any[]> {
    try {
      const response = await this.client.get('/v1/orchestrator/agents');
      return Array.isArray(response.data) ? response.data : response.data?.agents ?? [];
    } catch {
      return [];
    }
  }

  async orchestratorInvoke(agentId: string, task: string, input: Record<string, any> = {}): Promise<any> {
    const response = await this.client.post('/v1/orchestrator/invoke', { AgentId: agentId, Task: task, Input: input });
    return response.data;
  }

  async memorySearch(query: string, avatarId?: string, limit = 10): Promise<any[]> {
    try {
      const response = await this.client.post('/v1/memory/search', { Query: query, AvatarId: avatarId, Limit: limit });
      return response.data?.results ?? response.data ?? [];
    } catch {
      return [];
    }
  }

  async listOpenServModels(): Promise<Array<{ id: string; name: string }>> {
    try {
      const response = await this.client.get('/v1/openserv/models');
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  }
}
