import React, { useState, ReactNode } from 'react';
import './SidebarHost.css';

export type SidebarTab = 'explorer' | 'search' | 'git' | 'outline' | 'star';

interface SidebarHostProps {
  explorer: ReactNode;
  search: ReactNode;
  git: ReactNode;
  outline: ReactNode;
  star: ReactNode;
}

const TABS: Array<{ id: SidebarTab; icon: string; title: string }> = [
  { id: 'explorer', icon: '⬛', title: 'Explorer' },
  { id: 'search',   icon: '🔍', title: 'Search (Ctrl+Shift+F)' },
  { id: 'git',      icon: '±',  title: 'Source Control' },
  { id: 'outline',  icon: '≡',  title: 'Outline (Ctrl+Shift+O opens symbol search)' },
  { id: 'star',     icon: '✦',  title: 'New OAPP (STAR Wizard)' },
];

export const SidebarHost: React.FC<SidebarHostProps> = ({ explorer, search, git, outline, star }) => {
  const [active, setActive] = useState<SidebarTab>('explorer');

  // Ctrl+Shift+F opens Search tab
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setActive('search');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const panels: Record<SidebarTab, ReactNode> = { explorer, search, git, outline, star };

  return (
    <div className="sidebar-host">
      <div className="activity-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`activity-btn ${active === t.id ? 'active' : ''}`}
            title={t.title}
            onClick={() => setActive(t.id)}
          >
            {t.icon}
          </button>
        ))}
      </div>
      <div className="sidebar-panel">
        {TABS.map((t) => (
          <div key={t.id} style={{ display: active === t.id ? 'contents' : 'none' }}>
            {panels[t.id]}
          </div>
        ))}
      </div>
    </div>
  );
};
