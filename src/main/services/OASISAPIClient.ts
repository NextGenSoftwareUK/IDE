import axios, { AxiosInstance } from 'axios';

export class OASISAPIClient {
  private client: AxiosInstance;
  private baseURL: string;
  private authToken: string | null = null;

  constructor() {
    this.baseURL = process.env.OASIS_API_URL || 'http://127.0.0.1:5003';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      validateStatus: (status) => status < 500
    });
  }

  setAuthToken(token: string) {
    this.authToken = token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken() {
    this.authToken = null;
    delete this.client.defaults.headers.common['Authorization'];
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  /**
   * Authenticate avatar and get JWT. Sets token for subsequent requests.
   */
  async authenticateAvatar(username: string, password: string): Promise<{ token: string; avatarId: string; username?: string }> {
    const response = await this.client.post('/api/avatar/authenticate', {
      username,
      password
    });

    const data = response.data ?? response;
    const isError = data.isError === true || data.IsError === true;
    if (isError) {
      const msg = data.message ?? data.Message ?? 'Authentication failed';
      throw new Error(msg);
    }

    const result = data.result?.result ?? data.result ?? data;
    const token =
      result.jwtToken ?? result.JwtToken ?? result.token ?? result.Token;
    const avatarId = result.avatarId ?? result.id ?? result.AvatarId ?? result.Id ?? '';
    const usernameOut = result.username ?? result.Username;

    if (!token) {
      throw new Error('No JWT token received from OASIS API');
    }

    this.setAuthToken(token);
    return { token, avatarId, username: usernameOut };
  }

  /**
   * Get pending A2A messages for the authenticated avatar.
   */
  async getPendingA2AMessages(): Promise<any[]> {
    const response = await this.client.get('/api/a2a/messages');
    const data = response.data ?? response;
    const result = data.result ?? data;
    const list = Array.isArray(result) ? result : result?.messages ?? result?.items ?? [];
    return list;
  }

  /**
   * Mark an A2A message as processed.
   */
  async markMessageProcessed(messageId: string): Promise<void> {
    await this.client.post(`/api/a2a/messages/${messageId}/process`);
  }

  /**
   * Send A2A JSON-RPC (e.g. service_request for reply). Use for replying to a message.
   */
  async sendA2AJsonRpc(toAgentId: string, method: string, params: Record<string, unknown> = {}): Promise<any> {
    const response = await this.client.post('/api/a2a/jsonrpc', {
      jsonrpc: '2.0',
      method,
      params: { toAgentId, ...params }
    });
    return (response.data ?? response).result;
  }

  async healthCheck(): Promise<any> {
    try {
      const response = await this.client.get('/api/health');
      return { status: 'healthy', data: response.data };
    } catch (error: any) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  async discoverAgents(serviceName?: string): Promise<any[]> {
    const url = serviceName
      ? `/api/serv/agents/discover-serv?service=${encodeURIComponent(serviceName)}`
      : '/api/serv/agents/discover-serv';
    
    try {
      const response = await this.client.get(url);
      return response.data.result || [];
    } catch (error: any) {
      console.error('[OASIS] Agent discovery error:', error);
      return [];
    }
  }

  async getAgentCard(agentId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/serv/agent-card/${agentId}`);
      return response.data.result;
    } catch (error: any) {
      throw new Error(`Failed to get agent card: ${error.message}`);
    }
  }

  async sendA2AMessage(toAgentId: string, message: any): Promise<any> {
    try {
      const response = await this.client.post('/api/serv/jsonrpc', {
        toAgentId,
        ...message
      });
      return response.data.result;
    } catch (error: any) {
      throw new Error(`Failed to send A2A message: ${error.message}`);
    }
  }

  /**
   * Chat with an OASIS agent (e.g. IDE assistant). Uses POST /api/ide/chat when the backend
   * supports it (built-in oasis-ide-assistant). Returns { content, toolCalls?, error? }.
   */
  async chatWithAgent(
    agentId: string,
    message: string,
    options?: {
      conversationId?: string;
      history?: Array<{ role: string; content: string }>;
      fromAvatarId?: string;
    }
  ): Promise<{ content: string; toolCalls?: any[]; error?: string }> {
    try {
      const response = await this.client.post<{
        content?: string;
        toolCalls?: any[];
        error?: string;
      }>('/api/ide/chat', {
        agentId: agentId || 'oasis-ide-assistant',
        message,
        conversationId: options?.conversationId,
        history: options?.history ?? [],
        fromAvatarId: options?.fromAvatarId
      });

      const data = response.data;
      if (response.status >= 400) {
        const errMsg = (data as any)?.error ?? response.statusText ?? 'IDE chat failed';
        return { content: '', error: errMsg };
      }

      const content = data?.content ?? '';
      const toolCalls = data?.toolCalls;
      const error = data?.error;
      return { content: content || '', toolCalls, error };
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      return { content: '', error: msg };
    }
  }
}
