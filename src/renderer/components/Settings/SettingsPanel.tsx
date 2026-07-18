import React, { useEffect, useState, useCallback, useRef } from 'react';
import './SettingsPanel.css';

const URL_FIELDS: Array<{ key: string; label: string; placeholder: string; secret?: boolean }> = [
  { key: 'OASIS_API_URL',         label: 'Web4 (ONODE) URL',      placeholder: 'http://localhost:7777' },
  { key: 'OASIS_WEB6_URL',        label: 'Web6 AI URL',            placeholder: 'http://localhost:64596' },
  { key: 'OASIS_WEB6_API_KEY',    label: 'Web6 API Key',           placeholder: '', secret: true },
  { key: 'OASIS_WEB7_URL',        label: 'Web7 Consciousness URL', placeholder: 'http://localhost:62798' },
  { key: 'OASIS_WEB8_URL',        label: 'Web8 Mesh URL',          placeholder: 'http://localhost:65332' },
  { key: 'OASIS_WEB9_URL',        label: 'Web9 Singularity URL',   placeholder: 'http://localhost:65342' },
  { key: 'OASIS_WEB10_URL',       label: 'Web10 Source URL',       placeholder: 'http://localhost:57483' },
  { key: 'OASIS_MCP_SERVER_PATH', label: 'MCP Server Path',        placeholder: 'auto-detected' },
  { key: 'OASIS_STAR_CLI_PATH',   label: 'STAR CLI Path',          placeholder: 'auto-detected' },
  { key: 'SERV_API_KEY',          label: 'OpenServ API Key',       placeholder: '', secret: true },
  { key: 'OPENAI_API_KEY',        label: 'OpenAI API Key',         placeholder: '', secret: true },
];

const REMAPPABLE_COMMANDS: Array<{ command: string; label: string; defaultKey: string }> = [
  { command: 'editor.action.formatDocument',      label: 'Format Document',        defaultKey: 'Shift+Alt+F' },
  { command: 'editor.action.triggerSuggest',      label: 'Trigger Suggestions',    defaultKey: 'Ctrl+Space' },
  { command: 'editor.action.goToDeclaration',     label: 'Go to Definition',       defaultKey: 'F12' },
  { command: 'editor.action.referenceSearch.trigger', label: 'Find References',    defaultKey: 'Shift+F12' },
  { command: 'editor.action.rename',              label: 'Rename Symbol',          defaultKey: 'F2' },
  { command: 'editor.action.commentLine',         label: 'Toggle Line Comment',    defaultKey: 'Ctrl+/' },
  { command: 'editor.action.blockComment',        label: 'Toggle Block Comment',   defaultKey: 'Shift+Alt+A' },
  { command: 'editor.action.duplicateSelection',  label: 'Duplicate Line',         defaultKey: 'Shift+Alt+Down' },
  { command: 'editor.action.moveLinesUpAction',   label: 'Move Line Up',           defaultKey: 'Alt+Up' },
  { command: 'editor.action.moveLinesDownAction', label: 'Move Line Down',         defaultKey: 'Alt+Down' },
  { command: 'editor.action.selectAll',           label: 'Select All',             defaultKey: 'Ctrl+A' },
  { command: 'editor.action.addSelectionToNextFindMatch', label: 'Add Next Occurrence', defaultKey: 'Ctrl+D' },
];

const api = () => window.electronAPI;

export const SettingsPanel: React.FC = () => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [keybindings, setKeybindings] = useState<Record<string, string>>({});
  const [capturingCmd, setCapturingCmd] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api().settingsGet?.().then((v) => { setValues(v ?? {}); setLoading(false); });
    api().keybindingsGet?.().then((bindings) => {
      const map: Record<string, string> = {};
      for (const b of (bindings ?? [])) map[b.command] = b.key;
      setKeybindings(map);
    });
  }, []);

  const handleChange = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }, []);

  const save = useCallback(async () => {
    await api().settingsSave?.(values);
    const bindings = Object.entries(keybindings).map(([command, key]) => ({ command, key }));
    await api().keybindingsSave?.(bindings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, [values, keybindings]);

  const captureKey = useCallback((e: React.KeyboardEvent, command: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') { setCapturingCmd(null); return; }
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (e.metaKey) parts.push('Meta');
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    parts.push(key);
    setKeybindings((prev) => ({ ...prev, [command]: parts.join('+') }));
    setCapturingCmd(null);
  }, []);

  if (loading) return <div className="settings-panel panel"><div className="settings-loading">Loading…</div></div>;

  const autoSave = values['EDITOR_AUTO_SAVE'] ?? 'off';
  const autoSaveDelay = values['EDITOR_AUTO_SAVE_DELAY'] ?? '1500';

  return (
    <div className="settings-panel panel">
      <div className="panel-header">
        <span>Settings</span>
        <button
          type="button"
          className={`settings-save-btn ${saved ? 'saved' : ''}`}
          onClick={save}
        >
          {saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
      <div className="settings-content">

        <p className="settings-section-label">Editor</p>

        <div className="settings-field">
          <label className="settings-label">Auto Save</label>
          <select
            className="settings-input"
            value={autoSave}
            onChange={(e) => handleChange('EDITOR_AUTO_SAVE', e.target.value)}
          >
            <option value="off">Off</option>
            <option value="afterDelay">After delay</option>
            <option value="onFocusChange">On focus change</option>
          </select>
        </div>

        {autoSave === 'afterDelay' && (
          <div className="settings-field">
            <label className="settings-label">Auto Save Delay (ms)</label>
            <input
              type="number"
              className="settings-input"
              value={autoSaveDelay}
              min={500}
              max={30000}
              step={500}
              onChange={(e) => handleChange('EDITOR_AUTO_SAVE_DELAY', e.target.value)}
            />
          </div>
        )}

        <div className="settings-field">
          <label className="settings-label">Font Size</label>
          <input
            type="number"
            className="settings-input"
            value={values['EDITOR_FONT_SIZE'] ?? '14'}
            min={8}
            max={32}
            step={1}
            onChange={(e) => handleChange('EDITOR_FONT_SIZE', e.target.value)}
          />
        </div>

        <div className="settings-field">
          <label className="settings-label">Word Wrap</label>
          <select
            className="settings-input"
            value={values['EDITOR_WORD_WRAP'] ?? 'on'}
            onChange={(e) => handleChange('EDITOR_WORD_WRAP', e.target.value)}
          >
            <option value="on">On</option>
            <option value="off">Off</option>
            <option value="wordWrapColumn">At column</option>
            <option value="bounded">Bounded</option>
          </select>
        </div>

        <div className="settings-field">
          <label className="settings-label">Minimap</label>
          <select
            className="settings-input"
            value={values['EDITOR_MINIMAP'] ?? 'true'}
            onChange={(e) => handleChange('EDITOR_MINIMAP', e.target.value)}
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>

        <div className="settings-field">
          <label className="settings-label">Editor Theme</label>
          <select
            className="settings-input"
            value={values['EDITOR_THEME'] ?? 'oasis-dark'}
            onChange={(e) => handleChange('EDITOR_THEME', e.target.value)}
          >
            <option value="oasis-dark">OASIS Dark (default)</option>
            <option value="vs-dark">VS Dark</option>
            <option value="vs">VS Light</option>
            <option value="hc-black">High Contrast</option>
            <option value="monokai">Monokai</option>
            <option value="one-dark">One Dark</option>
          </select>
        </div>

        <div className="settings-field">
          <label className="settings-label">Rulers (columns)</label>
          <select
            className="settings-input"
            value={values['EDITOR_RULERS'] ?? 'none'}
            onChange={(e) => handleChange('EDITOR_RULERS', e.target.value)}
          >
            <option value="none">None</option>
            <option value="80">80</option>
            <option value="100">100</option>
            <option value="120">120</option>
            <option value="80,120">80 and 120</option>
          </select>
        </div>

        <p className="settings-section-label">OASIS Services</p>
        <p className="settings-hint">
          Changes apply immediately to running layer clients. Restart the IDE after changing MCP or STAR paths.
        </p>

        {URL_FIELDS.map(({ key, label, placeholder, secret }) => (
          <div key={key} className="settings-field">
            <label className="settings-label">{label}</label>
            <input
              type={secret ? 'password' : 'text'}
              className="settings-input"
              value={values[key] ?? ''}
              placeholder={placeholder}
              onChange={(e) => handleChange(key, e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ))}

        <p className="settings-section-label">Keyboard Shortcuts</p>
        <p className="settings-hint">Click a binding to remap it. Press Escape to cancel.</p>
        <div ref={captureRef}>
          {REMAPPABLE_COMMANDS.map(({ command, label, defaultKey }) => {
            const current = keybindings[command] ?? defaultKey;
            const isCapturing = capturingCmd === command;
            return (
              <div key={command} className="settings-field settings-keybinding-row">
                <label className="settings-label">{label}</label>
                <button
                  type="button"
                  className={`settings-keybinding-btn${isCapturing ? ' capturing' : ''}`}
                  onClick={() => setCapturingCmd(command)}
                  onKeyDown={isCapturing ? (e) => captureKey(e, command) : undefined}
                  title={isCapturing ? 'Press a key combination…' : 'Click to remap'}
                >
                  {isCapturing ? 'Press a key…' : current}
                </button>
                {keybindings[command] && keybindings[command] !== defaultKey && (
                  <button
                    type="button"
                    className="settings-keybinding-reset"
                    title="Reset to default"
                    onClick={() => setKeybindings((prev) => { const n = { ...prev }; delete n[command]; return n; })}
                  >↺</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
