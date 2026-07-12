import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './AgentPanel.css';

interface Agent {
  id: string;
  name: string;
  description?: string;
  services?: string[];
  skills?: string[];
  source?: string;
}

interface TaskResult {
  agentId: string;
  state: string;
  answer?: string;
  error?: string;
}

const getAPI = () => (window as any).electronAPI;

export const AgentPanel: React.FC = () => {
  const { avatarId } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [taskInput, setTaskInput] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TaskResult | null>(null);
  const [taskUpdates, setTaskUpdates] = useState<Array<{ state: string; msg?: string }>>([]);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const api = getAPI();
      const list: Agent[] = await api?.discoverAgents?.() ?? [];
      setAgents(list);
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Listen for A2A task state updates from the main process
  useEffect(() => {
    const api = getAPI();
    const unsub = api?.onWeb6A2ATaskUpdate?.((update: any) => {
      setTaskUpdates((prev) => [
        ...prev,
        { state: update.state, msg: update.error ?? undefined }
      ]);
      if (['completed', 'failed', 'cancelled', 'timeout'].includes((update.state ?? '').toLowerCase())) {
        const answer =
          update.result?.Parts?.map((p: any) => p.Text ?? '').join('') ??
          update.result?.parts?.map((p: any) => p.text ?? '').join('') ??
          undefined;
        setResult({
          agentId: selected?.id ?? '',
          state: update.state,
          answer,
          error: update.error
        });
        setRunning(false);
      }
    });
    return () => unsub?.();
  }, [selected]);

  const runTask = async () => {
    if (!selected || !taskInput.trim() || running) return;
    const api = getAPI();
    if (!api?.web6A2ATaskRun) return;

    setRunning(true);
    setResult(null);
    setTaskUpdates([{ state: 'sending' }]);

    try {
      const task = {
        Message: {
          Role: 'user',
          Parts: [{ Text: taskInput.trim(), Type: 'text' }]
        },
        ...(avatarId ? { AvatarId: avatarId } : {})
      };

      // web6A2ATaskRun polls until done and sends task-update events during polling
      const status = await api.web6A2ATaskRun(task);

      if (!status || status.error) {
        setResult({ agentId: selected.id, state: 'error', error: status?.error ?? 'Unknown error' });
      }
      // result set by event listener above
    } catch (err: any) {
      setResult({ agentId: selected.id, state: 'error', error: err.message });
    } finally {
      setRunning(false);
    }
  };

  const sourceLabel: Record<string, string> = {
    web6: 'Web6',
    fahrn: 'FAHRN',
    orchestrator: 'Orchestrator'
  };

  return (
    <div className="agent-panel panel">
      <div className="panel-header">
        <span>Agents</span>
        <button className="panel-refresh-btn" onClick={loadAgents} title="Refresh agent list">↺</button>
      </div>

      <div className="panel-content">
        {loading ? (
          <div className="loading">Discovering agents…</div>
        ) : agents.length === 0 ? (
          <div className="empty-state">
            <p>No agents found.</p>
            <p className="empty-hint">Start the Web6 WebAPI to discover agents.</p>
          </div>
        ) : (
          <div className="agents-list">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={`agent-item ${selected?.id === agent.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelected(agent);
                  setResult(null);
                  setTaskUpdates([]);
                }}
              >
                <div className="agent-name">{agent.name || agent.id}</div>
                {agent.description && (
                  <div className="agent-description">{agent.description}</div>
                )}
                <div className="agent-tags">
                  {agent.source && (
                    <span className="agent-tag source">
                      {sourceLabel[agent.source] ?? agent.source}
                    </span>
                  )}
                  {(agent.services ?? agent.skills ?? []).slice(0, 3).map((s) => (
                    <span key={s} className="agent-tag">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {selected && (
          <div className="agent-task-panel">
            <div className="agent-task-title">
              Task for: <strong>{selected.name}</strong>
            </div>
            <textarea
              className="agent-task-input"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder="Describe the task…"
              rows={3}
              disabled={running}
            />
            <button
              className="agent-run-btn"
              onClick={runTask}
              disabled={running || !taskInput.trim()}
            >
              {running ? 'Running…' : 'Send Task (A2A)'}
            </button>

            {taskUpdates.length > 0 && (
              <div className="agent-task-updates">
                {taskUpdates.map((u, i) => (
                  <div key={i} className={`task-update ${u.state}`}>
                    {u.state}{u.msg ? `: ${u.msg}` : ''}
                  </div>
                ))}
              </div>
            )}

            {result && (
              <div className={`agent-result ${result.error ? 'error' : 'success'}`}>
                <div className="agent-result-state">State: {result.state}</div>
                {result.error && <div className="agent-result-error">❌ {result.error}</div>}
                {result.answer && (
                  <pre className="agent-result-answer">{result.answer}</pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
