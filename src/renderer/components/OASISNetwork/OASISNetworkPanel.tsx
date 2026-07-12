import React, { useState, useEffect, useCallback } from 'react';
import './OASISNetworkPanel.css';

interface LayerStatus {
  status: 'healthy' | 'unhealthy' | 'unreachable' | 'unknown';
  error?: string;
  layer?: string;
  data?: any;
}

interface NetworkStatus {
  web4?: LayerStatus;
  web6?: LayerStatus;
  web7?: LayerStatus;
  web8?: LayerStatus;
  web9?: LayerStatus;
  web10?: LayerStatus;
  mcpServer?: string;
  starCLI?: boolean;
  timestamp?: number;
}

const LAYERS: Array<{
  key: keyof NetworkStatus;
  label: string;
  subtitle: string;
  color: string;
}> = [
  { key: 'web4', label: 'Web4', subtitle: 'ONODE · Avatar · Holon · NFT', color: '#4d9fff' },
  { key: 'web6', label: 'Web6', subtitle: 'AI · FAHRN · A2A · Memory', color: '#00d4aa' },
  { key: 'web7', label: 'Web7', subtitle: 'Collective Consciousness · Symbiosis', color: '#d2a8ff' },
  { key: 'web8', label: 'Web8', subtitle: 'Mesh Routing · Protocol Bridge', color: '#ffa657' },
  { key: 'web9', label: 'Web9', subtitle: 'Singularity Aggregation', color: '#ff7b72' },
  { key: 'web10', label: 'Web10', subtitle: 'The Source · Root Identity', color: '#f5a524' },
];

const getAPI = () => (window as any).electronAPI;

function statusDot(s: LayerStatus | undefined): string {
  if (!s) return 'unknown';
  return s.status === 'healthy' ? 'healthy' : s.status === 'unhealthy' ? 'unhealthy' : 'unreachable';
}

function statusLabel(s: LayerStatus | undefined): string {
  if (!s) return 'Not checked';
  if (s.status === 'healthy') return 'Online';
  return s.error ? s.error.slice(0, 60) : s.status;
}

export const OASISNetworkPanel: React.FC = () => {
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result: NetworkStatus = await getAPI()?.oasisNetworkStatus?.();
      setStatus(result ?? null);
      setLastChecked(new Date());
    } catch (e) {
      console.error('Network status error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const mcpOk = status?.mcpServer === 'running';
  const starOk = status?.starCLI === true;

  return (
    <div className="oasis-network-panel panel">
      <div className="panel-header">
        <span>OASIS Network</span>
        <div className="panel-header-right">
          {lastChecked && (
            <span className="last-checked">{lastChecked.toLocaleTimeString()}</span>
          )}
          <button
            className="panel-refresh-btn"
            onClick={refresh}
            disabled={loading}
            title="Refresh"
          >
            {loading ? '⟳' : '↺'}
          </button>
        </div>
      </div>

      <div className="network-panel-content">
        {/* Layer grid */}
        <div className="layer-grid">
          {LAYERS.map(({ key, label, subtitle, color }) => {
            const s = status?.[key] as LayerStatus | undefined;
            const dot = statusDot(s);
            return (
              <div key={key} className={`layer-card dot-${dot}`} style={{ '--layer-color': color } as any}>
                <div className="layer-card-top">
                  <div className="layer-dot" />
                  <span className="layer-label">{label}</span>
                </div>
                <div className="layer-subtitle">{subtitle}</div>
                <div className={`layer-status-text ${dot}`}>{statusLabel(s)}</div>
              </div>
            );
          })}
        </div>

        {/* Infrastructure row */}
        <div className="infra-row">
          <div className={`infra-chip ${mcpOk ? 'ok' : 'off'}`}>
            <span className="infra-dot" />
            <span className="infra-label">MCP Server</span>
            <span className="infra-value">{status?.mcpServer ?? '—'}</span>
          </div>
          <div className={`infra-chip ${starOk ? 'ok' : 'off'}`}>
            <span className="infra-dot" />
            <span className="infra-label">STAR CLI</span>
            <span className="infra-value">{status == null ? '—' : starOk ? 'found' : 'not found'}</span>
          </div>
        </div>

        {!status && !loading && (
          <div className="network-empty">Click ↺ to check network status.</div>
        )}
      </div>
    </div>
  );
};
