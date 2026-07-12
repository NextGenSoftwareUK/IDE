import React, { useEffect, useState } from 'react';
import './StartupWarning.css';

interface LayerInfo { name: string; key: string; }

const LAYERS: LayerInfo[] = [
  { name: 'Web4 (ONODE)', key: 'web4' },
  { name: 'Web6 (AI)', key: 'web6' },
];

export const StartupWarning: React.FC = () => {
  const [offline, setOffline] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.oasisNetworkStatus) return;
    api.oasisNetworkStatus().then((status) => {
      const down = LAYERS
        .filter((l) => (status as any)?.[l.key]?.status !== 'healthy')
        .map((l) => l.name);
      setOffline(down);
    }).catch(() => {});
  }, []);

  if (dismissed || offline.length === 0) return null;

  return (
    <div className="startup-warning">
      <span className="startup-warning-icon">⚠</span>
      <span className="startup-warning-text">
        {offline.join(', ')} {offline.length === 1 ? 'is' : 'are'} unreachable.
        {' '}Check that OASIS services are running or update URLs in Settings.
      </span>
      <button type="button" className="startup-warning-close" onClick={() => setDismissed(true)}>✕</button>
    </div>
  );
};
