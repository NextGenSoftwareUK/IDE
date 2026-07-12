import axios, { AxiosInstance } from 'axios';

/**
 * Web4 / ONODE REST client.
 * Handles avatar auth (JWT issuance) and legacy A2A inbox calls.
 * Auth is performed against Web4 (default port 5003); the resulting JWT
 * is cross-valid with Web6 (shared HMAC-SHA256 secret) and should also
 * be set on Web6APIClient after a successful login.
 */
export class OASISAPIClient {
  private client: AxiosInstance;
  private baseURL: string;
  private authToken: string | null = null;

  constructor() {
    this.baseURL = process.env.OASIS_API_URL || 'http://127.0.0.1:5003';

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: { 'Content-Type': 'application/json' },
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

  setBaseURL(url: string) {
    this.baseURL = url;
    this.client.defaults.baseURL = url;
  }

  /**
   * Authenticate avatar against Web4 and get JWT.
   * Sets token for subsequent Web4 requests.
   */
  async authenticateAvatar(
    username: string,
    password: string
  ): Promise<{ token: string; avatarId: string; username?: string }> {
    const response = await this.client.post('/api/avatar/authenticate', { username, password });

    const data = response.data ?? response;
    const isError = data.isError === true || data.IsError === true;
    if (isError) {
      const msg = data.message ?? data.Message ?? 'Authentication failed';
      throw new Error(msg);
    }

    const result = data.result?.result ?? data.result ?? data;
    const token = result.jwtToken ?? result.JwtToken ?? result.token ?? result.Token;
    const avatarId = result.avatarId ?? result.id ?? result.AvatarId ?? result.Id ?? '';
    const usernameOut = result.username ?? result.Username;

    if (!token) throw new Error('No JWT token received from OASIS API');

    this.setAuthToken(token);
    return { token, avatarId, username: usernameOut };
  }

  async healthCheck(): Promise<any> {
    try {
      const response = await this.client.get('/api/health');
      return { status: 'healthy', data: response.data };
    } catch (error: any) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  // ── A2A Inbox (Web4 legacy routes) ──────────────────────────────────────

  async getPendingA2AMessages(): Promise<any[]> {
    const response = await this.client.get('/api/a2a/messages');
    const data = response.data ?? response;
    const result = data.result ?? data;
    return Array.isArray(result) ? result : result?.messages ?? result?.items ?? [];
  }

  async markMessageProcessed(messageId: string): Promise<void> {
    await this.client.post(`/api/a2a/messages/${messageId}/process`);
  }

  async sendA2AJsonRpc(
    toAgentId: string,
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<any> {
    const response = await this.client.post('/api/a2a/jsonrpc', {
      jsonrpc: '2.0',
      method,
      params: { toAgentId, ...params }
    });
    return (response.data ?? response).result;
  }
}
