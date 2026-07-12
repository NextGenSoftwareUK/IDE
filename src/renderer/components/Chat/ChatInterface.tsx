import React, { useState, useEffect, useRef } from 'react';
import { useMCP } from '../../contexts/MCPContext';
import { useAuth } from '../../contexts/AuthContext';
import { AIAssistant } from '../../services/AIAssistant';
import './ChatInterface.css';

const CHAT_STORAGE_KEY_PREFIX = 'oasis-ide-chat-';

type AgentModeType = 'none' | 'claude' | 'openserv' | 'web6' | 'web6-fahrn';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  streaming?: boolean;
  toolCalls?: Array<{ tool: string; result: any }>;
  error?: boolean;
  confirm?: {
    requestId: string;
    kind: 'write' | 'command';
    label: string;
    detail: string;
    resolved?: boolean;
  };
  meta?: { provider?: string; model?: string; costUsd?: number; taskType?: string };
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content:
    'Hello! I\'m your OASIS IDE assistant. I can help you code, use OASIS tools, and work with Web6 AI agents.\n\nModes:\n- **Web6** — unified AI (auto-selects best provider)\n- **FAHRN** — multi-agent reasoning network\n- **Claude** / **OpenServ** — coding agents with workspace tools\n\nTry: "Explain this codebase" or "Write a Solana wallet integration"',
  timestamp: Date.now()
};

function getStorageKey(avatarId?: string) {
  return `${CHAT_STORAGE_KEY_PREFIX}${avatarId || 'default'}`;
}

function loadPersistedMessages(avatarId?: string): Message[] | null {
  try {
    const raw = localStorage.getItem(getStorageKey(avatarId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Message[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function savePersistedMessages(avatarId: string | undefined, messages: Message[]) {
  try {
    localStorage.setItem(getStorageKey(avatarId), JSON.stringify(messages));
  } catch {
    // ignore quota errors
  }
}

const getAPI = () => (window as any).electronAPI;

export const ChatInterface: React.FC = () => {
  const { tools, executeTool, loading: mcpLoading } = useMCP();
  const { avatarId } = useAuth();

  const [messages, setMessages] = useState<Message[]>(
    () => loadPersistedMessages(avatarId) ?? [INITIAL_MESSAGE]
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentMode, setAgentMode] = useState<AgentModeType>('web6');

  // Available backends
  const [hasLLM, setHasLLM] = useState(false);
  const [hasClaudeAgent, setHasClaudeAgent] = useState(false);
  const [hasOpenServAgent, setHasOpenServAgent] = useState(false);
  const [openServModels, setOpenServModels] = useState<Array<{ id: string; label: string }>>([]);
  const [openServModel, setOpenServModel] = useState('');
  const [web6Provider, setWeb6Provider] = useState('auto');
  const [web6Model, setWeb6Model] = useState('auto');
  const [useStream, setUseStream] = useState(true);
  const [useTools, setUseTools] = useState(false);
  const [injectAvatarCtx, setInjectAvatarCtx] = useState(false);
  const [aiAssistant, setAiAssistant] = useState<AIAssistant | null>(null);

  // Streaming state
  const streamingIdRef = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Effect: check available backends ──────────────────────────────────────

  useEffect(() => {
    const api = getAPI();
    api?.chatHasLLM?.().then((ok: boolean) => setHasLLM(ok)).catch(() => {});
    api?.claudeHasAgent?.().then((ok: boolean) => setHasClaudeAgent(ok)).catch(() => {});
    api?.openservHasAgent?.().then((ok: boolean) => setHasOpenServAgent(ok)).catch(() => {});
    api?.openservListModels?.()
      .then((models: Array<{ id: string; label: string }>) => {
        setOpenServModels(models ?? []);
        if (models?.length) setOpenServModel(models[0].id);
      })
      .catch(() => {});
  }, []);

  // ── Effect: streaming listeners ───────────────────────────────────────────

  useEffect(() => {
    const api = getAPI();
    if (!api) return;

    const unChunk = api.onWeb6StreamChunk?.((delta: string) => {
      const id = streamingIdRef.current;
      if (id === null) return;
      setMessages((prev) =>
        prev.map((m, i) => (i === id ? { ...m, content: m.content + delta } : m))
      );
    });

    const unDone = api.onWeb6StreamDone?.((full: string) => {
      const id = streamingIdRef.current;
      streamingIdRef.current = null;
      if (id === null) return;
      setMessages((prev) =>
        prev.map((m, i) => (i === id ? { ...m, content: full, streaming: false } : m))
      );
      setLoading(false);
    });

    const unErr = api.onWeb6StreamError?.((err: string) => {
      const id = streamingIdRef.current;
      streamingIdRef.current = null;
      if (id !== null) {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === id ? { ...m, content: `❌ Stream error: ${err}`, streaming: false, error: true } : m
          )
        );
      }
      setLoading(false);
    });

    return () => {
      unChunk?.();
      unDone?.();
      unErr?.();
    };
  }, []);

  // ── Effect: MCP tool-call event listeners ─────────────────────────────────

  useEffect(() => {
    const api = getAPI();
    if (!api) return;
    const unToolCall = api.onWeb6ToolCall?.((tcs: any[]) => {
      const names = tcs.map((tc: any) => tc.name ?? tc.Name).join(', ');
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `🔧 Calling MCP tool${tcs.length > 1 ? 's' : ''}: ${names}`,
        timestamp: Date.now()
      }]);
    });
    const unToolResult = api.onWeb6ToolResult?.((r: { name: string; result: any }) => {
      const preview = JSON.stringify(r.result)?.slice(0, 200) ?? '';
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `✅ ${r.name} → ${preview}`,
        timestamp: Date.now()
      }]);
    });
    return () => { unToolCall?.(); unToolResult?.(); };
  }, []);

  // ── Effect: Claude/OpenServ event listeners ────────────────────────────────

  useEffect(() => {
    const api = getAPI();
    if (!api) return;

    const handler = (event: any) => {
      if (event.type === 'tool-call') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `🔧 ${event.name}(${JSON.stringify(event.input)})`, timestamp: Date.now() }
        ]);
      } else if (event.type === 'confirm-request') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: event.kind === 'write' ? `Proposed change — ${event.label}` : `Proposed command`,
            timestamp: Date.now(),
            confirm: { requestId: event.requestId, kind: event.kind, label: event.label, detail: event.detail }
          }
        ]);
      } else if (event.type === 'text') {
        setMessages((prev) => [...prev, { role: 'assistant', content: event.text, timestamp: Date.now() }]);
      } else if (event.type === 'error') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `❌ ${event.message}`, timestamp: Date.now(), error: true }
        ]);
      }
    };

    const unClaude = api.onClaudeEvent?.(handler);
    const unOpenServ = api.onOpenservEvent?.(handler);
    return () => {
      unClaude?.();
      unOpenServ?.();
    };
  }, []);

  // ── Effect: persist / restore messages ───────────────────────────────────

  useEffect(() => {
    const saved = loadPersistedMessages(avatarId);
    setMessages(saved ?? [INITIAL_MESSAGE]);
  }, [avatarId]);

  useEffect(() => {
    if (messages.length === 0) return;
    savePersistedMessages(avatarId, messages);
  }, [messages, avatarId]);

  // ── Effect: AI assistant (offline fallback) ───────────────────────────────

  useEffect(() => {
    if (tools.length > 0 && !aiAssistant) {
      setAiAssistant(new AIAssistant(tools, executeTool));
    }
  }, [tools, executeTool, aiAssistant]);

  // ── Effect: auto-scroll ───────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const pushAssistantMessage = (
    content: string,
    opts?: { toolCalls?: any[]; error?: boolean; meta?: Message['meta']; streaming?: boolean }
  ): number => {
    let idx = -1;
    setMessages((prev) => {
      idx = prev.length;
      return [
        ...prev,
        {
          role: 'assistant',
          content,
          timestamp: Date.now(),
          ...(opts ?? {})
        }
      ];
    });
    return idx;
  };

  const respondToConfirm = (requestId: string, approved: boolean) => {
    const api = getAPI();
    if (agentMode === 'openserv') {
      api?.openservConfirmResponse?.(requestId, approved);
    } else {
      api?.claudeConfirmResponse?.(requestId, approved);
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.confirm?.requestId === requestId ? { ...m, confirm: { ...m.confirm, resolved: true } } : m
      )
    );
  };

  const canSend =
    agentMode === 'claude'
      ? hasClaudeAgent
      : agentMode === 'openserv'
      ? hasOpenServAgent
      : agentMode === 'web6' || agentMode === 'web6-fahrn'
      ? true
      : hasLLM || !!aiAssistant;

  const MAX_HISTORY = 20;

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!input.trim() || loading || !canSend) return;

    const userMsg: Message = { role: 'user', content: input, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    const history = messages
      .slice(-MAX_HISTORY)
      .filter((m) => !m.streaming && !m.confirm)
      .map((m) => ({ role: m.role, content: m.content }));

    const api = getAPI();

    try {
      // ── Claude coding agent ────────────────────────────────────────────────
      if (agentMode === 'claude' && hasClaudeAgent && api?.claudeRunTask) {
        const result = await api.claudeRunTask(currentInput);
        if (!result?.success) {
          pushAssistantMessage(`❌ ${result?.summary || 'Agent task failed.'}`, { error: true });
        }
        return; // events streamed via onClaudeEvent
      }

      // ── OpenServ coding agent ──────────────────────────────────────────────
      if (agentMode === 'openserv' && hasOpenServAgent && api?.openservRunTask) {
        const result = await api.openservRunTask(currentInput, openServModel);
        if (!result?.success) {
          pushAssistantMessage(`❌ ${result?.summary || 'Agent task failed.'}`, { error: true });
        }
        return; // events streamed via onOpenservEvent
      }

      // ── Web6 FAHRN multi-agent solve ──────────────────────────────────────
      if (agentMode === 'web6-fahrn' && api?.web6FahrnSolve) {
        const req = {
          Problem: currentInput,
          TaskType: 'auto',
          ...(avatarId && injectAvatarCtx ? { AvatarId: avatarId, InjectAvatarContext: true } : {})
        };
        const result = await api.web6FahrnSolve(req);
        if (result?.IsError || result?.Error) {
          pushAssistantMessage(`❌ ${result.Error ?? 'FAHRN solve failed'}`, { error: true });
        } else {
          const content = result?.Answer ?? 'No answer returned.';
          const meta: Message['meta'] = { taskType: result?.TaskType };
          pushAssistantMessage(content, { meta });
          if (result?.ReasoningTrace) {
            pushAssistantMessage(`📊 Reasoning trace:\n${result.ReasoningTrace}`, { meta });
          }
        }
        return;
      }

      // ── Web6 standard completion (with optional streaming / tool-use) ────────
      if (agentMode === 'web6' && api?.web6Complete) {
        const msgs = [
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: currentInput }
        ];
        const baseReq = {
          Provider: web6Provider,
          Model: web6Model,
          Messages: msgs,
          ...(avatarId && injectAvatarCtx ? { AvatarId: avatarId, InjectAvatarContext: true } : {})
        };

        // Tool-use loop mode: MCP tools injected, runs multi-round agentic loop
        if (useTools && api?.web6CompleteWithTools) {
          const result = await api.web6CompleteWithTools(baseReq);
          if (result?.error) {
            pushAssistantMessage(`❌ ${result.error}`, { error: true });
          } else {
            const meta: Message['meta'] = result?.meta;
            pushAssistantMessage(result?.content ?? 'No response.', { meta });
          }
          setLoading(false);
          return;
        }

        if (useStream && api?.web6StreamComplete) {
          const placeholderIdx = messages.length + 1;
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: '', timestamp: Date.now(), streaming: true }
          ]);
          streamingIdRef.current = placeholderIdx;
          await api.web6StreamComplete(baseReq);
          // loading cleared by onWeb6StreamDone handler
        } else {
          const result = await api.web6Complete(baseReq);
          if (result?.IsError || result?.Error) {
            pushAssistantMessage(`❌ ${result.Error ?? 'Web6 completion failed'}`, { error: true });
          } else {
            const meta: Message['meta'] = {
              provider: result?.Provider,
              model: result?.Model,
              costUsd: result?.CostUsd
            };
            pushAssistantMessage(result?.Content ?? 'No response.', { meta });
          }
          setLoading(false);
        }
        return;
      }

      // ── Local LLM fallback ─────────────────────────────────────────────────
      if (hasLLM && api?.chatComplete) {
        const msgs = [...history, { role: 'user' as const, content: currentInput }];
        const result = await api.chatComplete(msgs);
        pushAssistantMessage(
          result.error ? `❌ ${result.error}` : (result.content || 'No response.'),
          { error: !!result.error }
        );
        return;
      }

      // ── Offline rule-based fallback ────────────────────────────────────────
      if (aiAssistant) {
        const response = await aiAssistant.processMessage(currentInput);
        pushAssistantMessage(response.response, { toolCalls: response.toolCalls, error: response.error });
      } else {
        pushAssistantMessage('Assistant not ready. Try again in a moment.', { error: true });
      }
    } catch (error: any) {
      pushAssistantMessage(`❌ Error: ${error.message || 'Something went wrong'}`, { error: true });
    } finally {
      // For streaming modes, loading is cleared by the event handlers
      if (agentMode !== 'web6' || !useStream) setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearHistory = () => {
    setMessages([INITIAL_MESSAGE]);
    savePersistedMessages(avatarId, [INITIAL_MESSAGE]);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const modeOptions: Array<{ value: AgentModeType; label: string; available: boolean }> = [
    { value: 'web6', label: 'Web6 (unified AI)', available: true },
    { value: 'web6-fahrn', label: 'FAHRN (multi-agent)', available: true },
    { value: 'claude', label: 'Claude coding agent', available: hasClaudeAgent },
    { value: 'openserv', label: 'OpenServ coding agent', available: hasOpenServAgent },
    { value: 'none', label: 'Local LLM / offline', available: hasLLM || !!aiAssistant },
  ];

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h3>Chat</h3>
        <div className="chat-header-controls">
          <select
            className="chat-mode-select"
            value={agentMode}
            onChange={(e) => setAgentMode(e.target.value as AgentModeType)}
            title="Choose AI backend"
          >
            {modeOptions.filter((o) => o.available || o.value === agentMode).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {(agentMode === 'web6' || agentMode === 'web6-fahrn') && (
            <>
              {agentMode === 'web6' && (
                <>
                  <select
                    className="chat-provider-select"
                    value={web6Provider}
                    onChange={(e) => setWeb6Provider(e.target.value)}
                    title="Web6 AI provider"
                  >
                    {['auto','openai','anthropic','gemini','groq','mistral','cohere','xai','deepseek','ollama'].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <label className="chat-toggle" title="Stream response token by token">
                    <input type="checkbox" checked={useStream} onChange={(e) => setUseStream(e.target.checked)} />
                    Stream
                  </label>
                  {tools.length > 0 && (
                    <label className="chat-toggle chat-toggle-tools" title={`Let the AI call MCP tools (${tools.length} available). Disables streaming.`}>
                      <input type="checkbox" checked={useTools} onChange={(e) => { setUseTools(e.target.checked); if (e.target.checked) setUseStream(false); }} />
                      Tools
                    </label>
                  )}
                </>
              )}
              <label className="chat-toggle" title="Inject OASIS avatar context (karma, quests) — requires login">
                <input
                  type="checkbox"
                  checked={injectAvatarCtx}
                  onChange={(e) => setInjectAvatarCtx(e.target.checked)}
                  disabled={!avatarId}
                />
                Avatar ctx
              </label>
            </>
          )}

          {agentMode === 'openserv' && openServModels.length > 0 && (
            <select
              className="chat-provider-select"
              value={openServModel}
              onChange={(e) => setOpenServModel(e.target.value)}
            >
              {openServModels.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          )}

          {!mcpLoading && tools.length > 0 && (
            <span className="status-badge success">{tools.length} MCP tools</span>
          )}

          <button className="chat-clear-btn" onClick={clearHistory} title="Clear history">
            Clear
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role} ${msg.error ? 'error' : ''}`}>
            <div className="message-content">
              {msg.streaming && !msg.content ? (
                <span className="typing-indicator">Thinking</span>
              ) : (
                msg.content.split('\n').map((line, i, arr) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < arr.length - 1 && <br />}
                  </React.Fragment>
                ))
              )}
              {msg.streaming && msg.content && <span className="stream-cursor">▋</span>}
            </div>
            {msg.meta && (msg.meta.provider || msg.meta.taskType) && (
              <div className="message-meta">
                {msg.meta.provider && <span>{msg.meta.provider}/{msg.meta.model}</span>}
                {msg.meta.taskType && <span>task: {msg.meta.taskType}</span>}
                {msg.meta.costUsd != null && <span>${msg.meta.costUsd.toFixed(4)}</span>}
              </div>
            )}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="tool-calls">
                <div className="tool-call-label">Tool: {msg.toolCalls[0].tool}</div>
              </div>
            )}
            {msg.confirm && (
              <div className="agent-confirm">
                <pre className="agent-confirm-detail">{msg.confirm.detail}</pre>
                {!msg.confirm.resolved ? (
                  <div className="agent-confirm-actions">
                    <button
                      className="agent-confirm-approve"
                      onClick={() => respondToConfirm(msg.confirm!.requestId, true)}
                    >
                      {msg.confirm.kind === 'write' ? 'Apply' : 'Run'}
                    </button>
                    <button
                      className="agent-confirm-reject"
                      onClick={() => respondToConfirm(msg.confirm!.requestId, false)}
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <div className="agent-confirm-resolved">Responded</div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && agentMode !== 'web6' && (
          <div className="message assistant">
            <div className="message-content">
              <span className="typing-indicator">Thinking</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={canSend ? 'Ask anything… (Shift+Enter for newline)' : 'Loading…'}
          disabled={loading || !canSend}
          rows={2}
        />
        <button onClick={handleSend} disabled={loading || !input.trim() || !canSend}>
          {loading ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
};
