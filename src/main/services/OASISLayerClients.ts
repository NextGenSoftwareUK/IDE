import axios, { AxiosInstance } from 'axios';

/**
 * Thin REST clients for Web4 (ONODE), Web7, Web8, Web9, Web10.
 * The deep per-layer functionality is already covered by the 243 MCP tools
 * in the Web6 MCP server. These clients expose health checks + the handful
 * of endpoints the IDE itself calls directly (status panels, quick queries).
 */

function makeClient(baseURL: string, token?: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
    validateStatus: (s) => s < 500
  });
  if (token) client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  return client;
}

// ── Web4 / ONODE ──────────────────────────────────────────────────────────────

export class Web4APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = makeClient(process.env.OASIS_API_URL || 'http://localhost:7777');
  }

  setAuthToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken() {
    delete this.client.defaults.headers.common['Authorization'];
  }

  async healthCheck() {
    try {
      const r = await this.client.get('/api/health');
      return { status: 'healthy', data: r.data };
    } catch (e: any) {
      return { status: 'unhealthy', error: e.message };
    }
  }

  async getAvatarById(avatarId: string) {
    const r = await this.client.get(`/api/avatar/${avatarId}`);
    return r.data?.result ?? r.data;
  }

  async getKarma(avatarId: string) {
    const r = await this.client.get(`/api/karma/${avatarId}`);
    return r.data?.result ?? r.data;
  }

  async searchHolons(query: string, holonType?: string) {
    const r = await this.client.get('/api/search', {
      params: { query, holonType }
    });
    return r.data?.result ?? [];
  }

  async getNFTs(avatarId: string) {
    const r = await this.client.get(`/api/nft/avatar/${avatarId}`);
    return r.data?.result ?? [];
  }

  async getWallet(avatarId: string) {
    const r = await this.client.get(`/api/wallet/${avatarId}`);
    return r.data?.result ?? r.data;
  }
}

// ── Web7 ──────────────────────────────────────────────────────────────────────

export class Web7APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = makeClient(process.env.OASIS_WEB7_URL || 'http://localhost:62798');
  }

  setAuthToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken() { delete this.client.defaults.headers.common['Authorization']; }

  async healthCheck() {
    try {
      const r = await this.client.get('/api/health');
      return { status: 'healthy', layer: 'web7', data: r.data };
    } catch (e: any) {
      return { status: 'unhealthy', layer: 'web7', error: e.message };
    }
  }

  async getCollectiveConsciousnessStatus() {
    try {
      const r = await this.client.get('/v1/collective-consciousness/status');
      return r.data;
    } catch (e: any) {
      return { error: e.message };
    }
  }

  async getSymbiosisStatus() {
    try {
      const r = await this.client.get('/v1/symbiosis/status');
      return r.data;
    } catch (e: any) {
      return { error: e.message };
    }
  }
}

// ── Web8 ──────────────────────────────────────────────────────────────────────

export class Web8APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = makeClient(process.env.OASIS_WEB8_URL || 'http://localhost:65332');
  }

  setAuthToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken() { delete this.client.defaults.headers.common['Authorization']; }

  async healthCheck() {
    try {
      const r = await this.client.get('/api/health');
      return { status: 'healthy', layer: 'web8', data: r.data };
    } catch (e: any) {
      return { status: 'unhealthy', layer: 'web8', error: e.message };
    }
  }

  async getMeshStatus() {
    try {
      const r = await this.client.get('/v1/mesh/status');
      return r.data;
    } catch (e: any) {
      return { error: e.message };
    }
  }

  async getMeshNodes() {
    try {
      const r = await this.client.get('/v1/mesh/nodes');
      return Array.isArray(r.data) ? r.data : r.data?.nodes ?? [];
    } catch {
      return [];
    }
  }
}

// ── Web9 ──────────────────────────────────────────────────────────────────────

export class Web9APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = makeClient(process.env.OASIS_WEB9_URL || 'http://localhost:65342');
  }

  setAuthToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken() { delete this.client.defaults.headers.common['Authorization']; }

  async healthCheck() {
    try {
      const r = await this.client.get('/api/health');
      return { status: 'healthy', layer: 'web9', data: r.data };
    } catch (e: any) {
      return { status: 'unhealthy', layer: 'web9', error: e.message };
    }
  }

  /** Singularity aggregation — polls Web4-Web8 health and returns unified status. */
  async getSingularityStatus() {
    try {
      const r = await this.client.get('/v1/singularity/status');
      return r.data;
    } catch (e: any) {
      return { error: e.message };
    }
  }
}

// ── Web10 ─────────────────────────────────────────────────────────────────────

export class Web10APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = makeClient(process.env.OASIS_WEB10_URL || 'http://localhost:57483');
  }

  setAuthToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken() { delete this.client.defaults.headers.common['Authorization']; }

  async healthCheck() {
    try {
      const r = await this.client.get('/api/health');
      return { status: 'healthy', layer: 'web10', data: r.data };
    } catch (e: any) {
      return { status: 'unhealthy', layer: 'web10', error: e.message };
    }
  }

  async getSource() {
    try {
      const r = await this.client.get('/v1/source');
      return r.data;
    } catch (e: any) {
      return { error: e.message };
    }
  }
}
