import React, { useEffect, useState, useCallback } from 'react';
import './SettingsPanel.css';

const FIELDS: Array<{ key: string; label: string; placeholder: string; secret?: boolean }> = [
  { key: 'OASIS_API_URL',       label: 'Web4 (ONODE) URL',    placeholder: 'http://localhost:7777' },
  { key: 'OASIS_WEB6_URL',      label: 'Web6 AI URL',          placeholder: 'http://localhost:64596' },
  { key: 'OASIS_WEB6_API_KEY',  label: 'Web6 API Key',         placeholder: '', secret: true },
  { key: 'OASIS_WEB7_URL',      label: 'Web7 Consciousness URL', placeholder: 'http://localhost:62798' },
  { key: 'OASIS_WEB8_URL',      label: 'Web8 Mesh URL',         placeholder: 'http://localhost:65332' },
  { key: 'OASIS_WEB9_URL',      label: 'Web9 Singularity URL',  placeholder: 'http://localhost:65342' },
  { key: 'OASIS_WEB10_URL',     label: 'Web10 Source URL',      placeholder: 'http://localhost:57483' },
  { key: 'OASIS_MCP_SERVER_PATH', label: 'MCP Server Path',     placeholder: 'auto-detected' },
  { key: 'OASIS_STAR_CLI_PATH', label: 'STAR CLI Path',          placeholder: 'auto-detected' },
  { key: 'SERV_API_KEY',        label: 'OpenServ API Key',       placeholder: '', secret: true },
  { key: 'OPENAI_API_KEY',      label: 'OpenAI API Key',         placeholder: '', secret: true },
];

const api = () => window.electronAPI;

export const SettingsPanel: React.FC = () => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api().settingsGet?.().then((v) => { setValues(v ?? {}); setLoading(false); });
  }, []);

  const handleChange = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }, []);

  const save = useCallback(async () => {
    await api().settingsSave?.(values);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, [values]);

  if (loading) return <div className="settings-panel panel"><div className="settings-loading">Loading…</div></div>;

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
        <p className="settings-hint">
          Changes apply immediately to running layer clients. Restart the IDE after changing MCP or STAR paths.
        </p>
        {FIELDS.map(({ key, label, placeholder, secret }) => (
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
      </div>
    </div>
  );
};
