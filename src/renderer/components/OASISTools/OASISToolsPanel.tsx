import React, { useState, useEffect, useCallback } from 'react';
import './OASISToolsPanel.css';

interface Tool {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  };
}

interface ExecResult {
  toolName: string;
  output: string;
  error?: boolean;
}

const getAPI = () => (window as any).electronAPI;

function buildDefaultArgs(tool: Tool): Record<string, string> {
  const props = tool.inputSchema?.properties ?? {};
  const result: Record<string, string> = {};
  for (const key of Object.keys(props)) {
    result[key] = '';
  }
  return result;
}

export const OASISToolsPanel: React.FC = () => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Tool | null>(null);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecResult | null>(null);
  const [filter, setFilter] = useState('');
  const [mcpStatus, setMcpStatus] = useState<string>('unknown');

  const loadTools = useCallback(async () => {
    setLoading(true);
    try {
      const api = getAPI();
      const [toolList, status] = await Promise.all([
        api?.listTools?.() ?? Promise.resolve([]),
        api?.mcpStatus?.() ?? Promise.resolve('unknown')
      ]);
      setTools(toolList ?? []);
      setMcpStatus(status ?? 'unknown');
    } catch (error) {
      console.error('Failed to load tools:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  const selectTool = (tool: Tool) => {
    setSelected(tool);
    setArgs(buildDefaultArgs(tool));
    setResult(null);
  };

  const executeTool = async () => {
    if (!selected || running) return;
    const api = getAPI();
    setRunning(true);
    setResult(null);

    try {
      // Parse string args to appropriate types where possible
      const parsedArgs: Record<string, any> = {};
      for (const [key, val] of Object.entries(args)) {
        if (val === '') continue;
        try {
          parsedArgs[key] = JSON.parse(val);
        } catch {
          parsedArgs[key] = val;
        }
      }

      const raw = await api.executeTool(selected.name, parsedArgs);
      let output: string;
      if (typeof raw === 'string') {
        output = raw;
      } else if (raw?.content) {
        // MCP standard result shape: { content: [{ type: 'text', text: '...' }] }
        const parts = Array.isArray(raw.content)
          ? raw.content.map((c: any) => c.text ?? JSON.stringify(c)).join('\n')
          : JSON.stringify(raw.content, null, 2);
        output = parts;
      } else {
        output = JSON.stringify(raw, null, 2);
      }

      const isError = raw?.isError === true || raw?.error === true;
      setResult({ toolName: selected.name, output, error: isError });
    } catch (err: any) {
      setResult({ toolName: selected.name, output: err.message ?? String(err), error: true });
    } finally {
      setRunning(false);
    }
  };

  const filteredTools = filter
    ? tools.filter(
        (t) =>
          t.name.toLowerCase().includes(filter.toLowerCase()) ||
          (t.description ?? '').toLowerCase().includes(filter.toLowerCase())
      )
    : tools;

  const props = selected?.inputSchema?.properties ?? {};
  const required = new Set(selected?.inputSchema?.required ?? []);

  const statusColor = mcpStatus === 'running' ? 'success' : mcpStatus === 'error' ? 'error' : '';

  return (
    <div className="oasis-tools-panel panel">
      <div className="panel-header">
        <span>MCP Tools</span>
        <div className="panel-header-right">
          <span className={`status-dot ${statusColor}`} title={`MCP: ${mcpStatus}`} />
          <button className="panel-refresh-btn" onClick={loadTools} title="Refresh tools">↺</button>
        </div>
      </div>

      <div className="tools-filter">
        <input
          className="tools-filter-input"
          placeholder="Filter tools…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="tools-count">{filteredTools.length}/{tools.length}</span>
      </div>

      <div className="panel-content tools-layout">
        <div className="tools-list">
          {loading ? (
            <div className="loading">Loading tools…</div>
          ) : filteredTools.length === 0 ? (
            <div className="empty-state">
              {tools.length === 0 ? 'MCP server not connected.' : 'No matching tools.'}
            </div>
          ) : (
            filteredTools.map((tool) => (
              <div
                key={tool.name}
                className={`tool-item ${selected?.name === tool.name ? 'selected' : ''}`}
                onClick={() => selectTool(tool)}
              >
                <div className="tool-name">{tool.name}</div>
                {tool.description && (
                  <div className="tool-description">{tool.description}</div>
                )}
              </div>
            ))
          )}
        </div>

        {selected && (
          <div className="tool-exec-panel">
            <div className="tool-exec-title">
              <strong>{selected.name}</strong>
            </div>
            {selected.description && (
              <div className="tool-exec-desc">{selected.description}</div>
            )}

            {Object.keys(props).length > 0 ? (
              <div className="tool-args">
                {Object.entries(props).map(([key, schema]) => (
                  <div key={key} className="tool-arg">
                    <label className="tool-arg-label">
                      {key}
                      {required.has(key) && <span className="required">*</span>}
                      {schema.description && (
                        <span className="tool-arg-hint">{schema.description}</span>
                      )}
                    </label>
                    <textarea
                      className="tool-arg-input"
                      value={args[key] ?? ''}
                      onChange={(e) =>
                        setArgs((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder={schema.type === 'object' || schema.type === 'array' ? 'JSON…' : ''}
                      rows={2}
                      disabled={running}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="tool-no-args">No parameters required.</div>
            )}

            <button
              className="tool-run-btn"
              onClick={executeTool}
              disabled={running}
            >
              {running ? 'Running…' : 'Execute'}
            </button>

            {result && (
              <div className={`tool-result ${result.error ? 'error' : 'success'}`}>
                <div className="tool-result-label">
                  {result.error ? '❌ Error' : '✓ Result'}
                </div>
                <pre className="tool-result-output">{result.output}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
