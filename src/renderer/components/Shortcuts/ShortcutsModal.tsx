import React, { useEffect } from 'react';
import './ShortcutsModal.css';

const SHORTCUTS: Array<{ group: string; items: Array<{ keys: string[]; desc: string }> }> = [
  {
    group: 'File',
    items: [
      { keys: ['Ctrl', 'P'],           desc: 'Go to File — fuzzy-open any workspace file' },
      { keys: ['Ctrl', 'S'],           desc: 'Save file' },
      { keys: ['Ctrl', 'Shift', 'F'],  desc: 'Search in workspace' },
    ],
  },
  {
    group: 'Navigate',
    items: [
      { keys: ['Ctrl', 'Shift', 'P'],  desc: 'Command Palette — run any IDE action' },
      { keys: ['Ctrl', 'Shift', 'O'],  desc: 'Go to Symbol — search functions, classes, variables' },
      { keys: ['F12'],                  desc: 'Go to Definition (LSP)' },
    ],
  },
  {
    group: 'Editor',
    items: [
      { keys: ['Ctrl', 'H'],  desc: 'Find & replace in file' },
      { keys: ['Ctrl', '='],  desc: 'Zoom in' },
      { keys: ['Ctrl', '-'],  desc: 'Zoom out' },
      { keys: ['Ctrl', '0'],  desc: 'Reset zoom' },
      { keys: ['?'],          desc: 'Show keyboard shortcuts' },
    ],
  },
  {
    group: 'OASIS Snippets (type to expand)',
    items: [
      { keys: ['oasis-avatar'],        desc: 'Load OASIS Avatar' },
      { keys: ['oasis-holon'],         desc: 'Create / save a Holon' },
      { keys: ['oasis-provider'],      desc: 'Activate a Provider' },
      { keys: ['oasis-oapp'],          desc: 'OAPP entry point class' },
      { keys: ['oasis-web6-complete'], desc: 'Web6 AI completion call' },
      { keys: ['oasis-mcp-tool'],      desc: 'Execute MCP tool' },
      { keys: ['oasis-search'],        desc: 'Search Holons' },
      { keys: ['oasis-nft-mint'],      desc: 'Mint an NFT' },
    ],
  },
  {
    group: 'Git Panel',
    items: [
      { keys: ['Click file', 'View Diff'], desc: 'Open diff for a changed file' },
      { keys: ['Branch dropdown'],          desc: 'Checkout a branch' },
      { keys: ['+'],                        desc: 'Create a new branch' },
    ],
  },
  {
    group: 'Window',
    items: [
      { keys: ['Escape'],  desc: 'Close any modal / palette' },
    ],
  },
];

interface Props {
  onClose: () => void;
}

export const ShortcutsModal: React.FC<Props> = ({ onClose }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="shortcuts-backdrop" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <span>Keyboard Shortcuts</span>
          <button type="button" className="shortcuts-close" onClick={onClose}>✕</button>
        </div>
        <div className="shortcuts-body">
          {SHORTCUTS.map((group) => (
            <div key={group.group} className="shortcuts-group">
              <p className="shortcuts-group-label">{group.group}</p>
              {group.items.map((item) => (
                <div key={item.desc} className="shortcuts-row">
                  <span className="shortcuts-keys">
                    {item.keys.map((k, i) => (
                      <React.Fragment key={k}>
                        <kbd className="shortcuts-kbd">{k}</kbd>
                        {i < item.keys.length - 1 && <span className="shortcuts-plus">+</span>}
                      </React.Fragment>
                    ))}
                  </span>
                  <span className="shortcuts-desc">{item.desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
