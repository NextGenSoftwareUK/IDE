import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './StarWizardPanel.css';

interface Template { id: string; name: string; description: string; }

const api = () => window.electronAPI;

export const StarWizardPanel: React.FC = () => {
  const { workspacePath, pickWorkspace } = useWorkspace();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('oapp');
  const [appName, setAppName] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; path?: string } | null>(null);

  useEffect(() => {
    api().starGetTemplates?.().then((t) => {
      setTemplates(t ?? []);
    });
  }, []);

  useEffect(() => {
    if (workspacePath && !outputDir) setOutputDir(workspacePath);
  }, [workspacePath, outputDir]);

  const create = async () => {
    if (!appName.trim() || !outputDir.trim()) return;
    setCreating(true);
    setResult(null);
    try {
      const res = await api().starNewApp?.(appName.trim(), selectedTemplate, outputDir.trim());
      if (res?.success) {
        setResult({ ok: true, message: `Created at ${res.path}`, path: res.path });
        setAppName('');
      } else {
        setResult({ ok: false, message: res?.error ?? 'Failed to create OAPP.' });
      }
    } catch (e: any) {
      setResult({ ok: false, message: e.message ?? 'Unknown error.' });
    } finally {
      setCreating(false);
    }
  };

  const selectedTpl = templates.find((t) => t.id === selectedTemplate);

  return (
    <div className="star-wizard-panel panel">
      <div className="panel-header">
        <span>✦ New OAPP</span>
      </div>

      <div className="star-wizard-content">
        <p className="star-wizard-hint">
          Use the STAR ODK to scaffold a new OASIS Application (OAPP).
          The STAR CLI must be built or configured via Settings.
        </p>

        <label className="star-field-label">Template</label>
        <div className="star-templates">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`star-template-btn ${selectedTemplate === t.id ? 'active' : ''}`}
              onClick={() => setSelectedTemplate(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
        {selectedTpl && (
          <p className="star-template-desc">{selectedTpl.description}</p>
        )}

        <label className="star-field-label">App name</label>
        <input
          type="text"
          className="star-input"
          placeholder="MyOASISApp"
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />

        <label className="star-field-label">Output directory</label>
        <div className="star-dir-row">
          <input
            type="text"
            className="star-input star-dir-input"
            placeholder={workspacePath ?? 'C:\\Projects'}
            value={outputDir}
            onChange={(e) => setOutputDir(e.target.value)}
            spellCheck={false}
          />
          <button
            type="button"
            className="star-browse-btn"
            onClick={async () => {
              const p = await api().pickWorkspace?.();
              if (p) setOutputDir(p);
            }}
          >
            Browse
          </button>
        </div>

        <button
          type="button"
          className="star-create-btn"
          disabled={creating || !appName.trim() || !outputDir.trim()}
          onClick={create}
        >
          {creating ? 'Creating…' : 'Create OAPP'}
        </button>

        {result && (
          <div className={`star-result ${result.ok ? 'ok' : 'err'}`}>
            {result.message}
            {result.ok && result.path && (
              <button
                type="button"
                className="star-open-btn"
                onClick={async () => {
                  // Open the newly created project folder as workspace
                  if (result.path) {
                    (window as any).electronAPI?.setWorkspacePath?.(result.path);
                  }
                }}
              >
                Open in Explorer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
