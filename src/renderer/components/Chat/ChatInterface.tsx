import React, { useState, useEffect, useRef } from 'react';
import { useMCP } from '../../contexts/MCPContext';
import { useAuth } from '../../contexts/AuthContext';
import { AIAssistant } from '../../services/AIAssistant';
import './ChatInterface.css';

const CHAT_STORAGE_KEY_PREFIX = 'oasis-ide-chat-';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: Array<{ tool: string; result: any }>;
  error?: boolean;
  confirm?: { requestId: string; kind: 'write' | 'command'; label: string; detail: string; resolved?: boolean };
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: 'Hello! I\'m your OASIS IDE assistant. I can help you code, use OASIS tools, and work with agents. What would you like to do?\n\nTry:\n- "Check OASIS health"\n- "Create a Solana wallet"\n- "Mint an NFT"\n- "Show me the OASIS codebase structure"',
  timestamp: Date.now()
};

function getStorageKey(avatarId?: string): string {
  return `${CHAT_STORAGE_KEY_PREFIX}${avatarId || 'default'}`;
}

function loadPersistedMessages(avatarId?: string): Message[] | null {
  try {
    const raw = localStorage.getItem(getStorageKey(avatarId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Message[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function savePersistedMessages(avatarId: string | undefined, messages: Message[]): void {
  try {
    localStorage.setItem(getStorageKey(avatarId), JSON.stringify(messages));
  } catch {
    // ignore quota or parse errors
  }
}

const getElectronAPI = () => (window as any).electronAPI;

export const ChatInterface: React.FC = () => {
  const { tools, executeTool, loading: mcpLoading } = useMCP();
  const { avatarId } = useAuth();
  const [messages, setMessages] = useState<Message[]>(() => loadPersistedMessages(avatarId) ?? [INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasLLM, setHasLLM] = useState<boolean | null>(null);
  const [defaultAgentId, setDefaultAgentId] = useState<string | null>(null);
  const [aiAssistant, setAiAssistant] = useState<AIAssistant | null>(null);
  const [hasClaudeAgent, setHasClaudeAgent] = useState<boolean>(false);
  const [agentMode, setAgentMode] = useState<boolean>(false);
  const [hasOpenServAgent, setHasOpenServAgent] = useState<boolean>(false);
  const [openServModels, setOpenServModels] = useState<Array<{ id: string; label: string }>>([]);
  const [openServModel, setOpenServModel] = useState<string>('');
  const [openServAgentMode, setOpenServAgentMode] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if Claude (Sonnet 4.6 via OpenServ) agent is configured (SERV_API_KEY set)
  useEffect(() => {
    const api = getElectronAPI();
    if (api?.claudeHasAgent) {
      api.claudeHasAgent().then((ok: boolean) => setHasClaudeAgent(ok)).catch(() => setHasClaudeAgent(false));
    }
  }, []);

  // Check if the OpenServ agent (OpenAI SDK, any model in the SERV catalog) is configured
  useEffect(() => {
    const api = getElectronAPI();
    if (api?.openservHasAgent) {
      api.openservHasAgent().then((ok: boolean) => setHasOpenServAgent(ok)).catch(() => setHasOpenServAgent(false));
    }
    if (api?.openservListModels) {
      api.openservListModels()
        .then((models: Array<{ id: string; label: string }>) => {
          setOpenServModels(models || []);
          if (models?.length) setOpenServModel(models[0].id);
        })
        .catch(() => setOpenServModels([]));
    }
  }, []);

  // Listen for streamed OpenServ agent events (text, tool calls, confirmation requests)
  useEffect(() => {
    const api = getElectronAPI();
    if (!api?.onOpenservEvent) return;
    const unsubscribe = api.onOpenservEvent((event: any) => {
      if (event.type === 'tool-call') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `🔧 ${event.name}(${JSON.stringify(event.input)})`, timestamp: Date.now() },
        ]);
      } else if (event.type === 'confirm-request') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: event.kind === 'write' ? `Proposed change — ${event.label}` : `Proposed command`,
            timestamp: Date.now(),
            confirm: { requestId: event.requestId, kind: event.kind, label: event.label, detail: event.detail },
          },
        ]);
      } else if (event.type === 'text') {
        setMessages((prev) => [...prev, { role: 'assistant', content: event.text, timestamp: Date.now() }]);
      } else if (event.type === 'error') {
        setMessages((prev) => [...prev, { role: 'assistant', content: `❌ ${event.message}`, timestamp: Date.now(), error: true }]);
      }
    });
    return unsubscribe;
  }, []);

  // Listen for streamed agent events (text, tool calls, confirmation requests)
  useEffect(() => {
    const api = getElectronAPI();
    if (!api?.onClaudeEvent) return;
    const unsubscribe = api.onClaudeEvent((event: any) => {
      if (event.type === 'tool-call') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `🔧 ${event.name}(${JSON.stringify(event.input)})`,
            timestamp: Date.now(),
          },
        ]);
      } else if (event.type === 'confirm-request') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: event.kind === 'write' ? `Proposed change — ${event.label}` : `Proposed command`,
            timestamp: Date.now(),
            confirm: { requestId: event.requestId, kind: event.kind, label: event.label, detail: event.detail },
          },
        ]);
      } else if (event.type === 'text') {
        setMessages((prev) => [...prev, { role: 'assistant', content: event.text, timestamp: Date.now() }]);
      } else if (event.type === 'error') {
        setMessages((prev) => [...prev, { role: 'assistant', content: `❌ ${event.message}`, timestamp: Date.now(), error: true }]);
      }
      // 'done' and 'tool-result' are not rendered as separate bubbles — 'done' summary
      // already arrived as a 'text' event, and tool-results are usually long/noisy.
    });
    return unsubscribe;
  }, []);

  const respondToConfirm = (requestId: string, approved: boolean) => {
    const api = getElectronAPI();
    if (openServAgentMode) {
      api?.openservConfirmResponse?.(requestId, approved);
    } else {
      api?.claudeConfirmResponse?.(requestId, approved);
    }
    setMessages((prev) =>
      prev.map((m) => (m.confirm?.requestId === requestId ? { ...m, confirm: { ...m.confirm, resolved: true } } : m))
    );
  };

  // Load persisted history when avatar (or login state) changes
  useEffect(() => {
    const saved = loadPersistedMessages(avatarId);
    setMessages(saved ?? [INITIAL_MESSAGE]);
  }, [avatarId]);

  // Persist messages whenever they change (debounce not required for localStorage)
  useEffect(() => {
    if (messages.length === 0) return;
    savePersistedMessages(avatarId, messages);
  }, [messages, avatarId]);

  // Check if main process has LLM (OpenAI) available
  useEffect(() => {
    const api = getElectronAPI();
    if (api?.chatHasLLM) {
      api.chatHasLLM().then((ok: boolean) => setHasLLM(ok)).catch(() => setHasLLM(false));
    } else {
      setHasLLM(false);
    }
  }, []);

  // Default OASIS IDE Assistant agent ID (from env / constant in main)
  useEffect(() => {
    const api = getElectronAPI();
    if (api?.chatGetDefaultAssistantAgentId) {
      api.chatGetDefaultAssistantAgentId().then((id: string) => setDefaultAgentId(id || null)).catch(() => setDefaultAgentId(null));
    }
  }, []);

  // Initialize AI Assistant when tools are loaded (fallback when no LLM)
  useEffect(() => {
    if (tools.length > 0 && !aiAssistant) {
      const assistant = new AIAssistant(tools, executeTool);
      setAiAssistant(assistant);
    }
  }, [tools, executeTool, aiAssistant]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const canSend = agentMode
    ? hasClaudeAgent
    : openServAgentMode
    ? hasOpenServAgent
    : !!(defaultAgentId || hasLLM || aiAssistant);
  const conversationId = `ide-${avatarId || 'default'}`;
  const MAX_HISTORY = 20;

  const handleSend = async () => {
    if (!input.trim() || loading || !canSend) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    const history = messages.slice(-MAX_HISTORY).map(m => ({ role: m.role, content: m.content }));

    const pushAssistantMessage = (content: string, toolCalls?: Array<{ tool: string; result: any }>, error?: boolean) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content,
        timestamp: Date.now(),
        toolCalls,
        error
      }]);
    };

    try {
      const api = getElectronAPI();

      // 0) Agent mode: run the full agentic Claude (OpenServ) loop on the workspace
      if (agentMode && hasClaudeAgent && api?.claudeRunTask) {
        const result = await api.claudeRunTask(currentInput);
        if (!result?.success) {
          pushAssistantMessage(`❌ ${result?.summary || 'Agent task failed.'}`, undefined, true);
        }
        // Successful runs already streamed their text/tool messages via claude:event.
        return;
      }

      // 0b) Agent mode: run the agentic loop against any OpenServ model via the OpenAI SDK
      if (openServAgentMode && hasOpenServAgent && api?.openservRunTask) {
        const result = await api.openservRunTask(currentInput, openServModel);
        if (!result?.success) {
          pushAssistantMessage(`❌ ${result?.summary || 'Agent task failed.'}`, undefined, true);
        }
        // Successful runs already streamed their text/tool messages via openserv:event.
        return;
      }

      // 1) Try OASIS agent first when default agent ID is set
      if (defaultAgentId && api?.chatWithAgent) {
        const result = await api.chatWithAgent(
          defaultAgentId,
          currentInput,
          conversationId,
          history,
          avatarId ?? undefined
        );
        if (!result.error && (result.content || (result.toolCalls && result.toolCalls.length > 0))) {
          pushAssistantMessage(result.content || '', result.toolCalls, false);
          return;
        }
        // Agent failed (error or empty) — fall through to fallback
      }

      // 2) Fallback: local LLM when available
      if (hasLLM && api?.chatComplete) {
        const messagesForApi = [...history, { role: 'user' as const, content: currentInput }];
        const result = await api.chatComplete(messagesForApi);
        pushAssistantMessage(
          result.error ? `❌ ${result.error}` : (result.content || 'No response.'),
          undefined,
          !!result.error
        );
        return;
      }

      // 3) Fallback: rule-based AI Assistant + MCP tools
      if (aiAssistant) {
        const response = await aiAssistant.processMessage(currentInput);
        pushAssistantMessage(response.response, response.toolCalls, response.error);
      } else {
        pushAssistantMessage('Assistant not ready. Try again in a moment.', undefined, true);
      }
    } catch (error: any) {
      pushAssistantMessage(`❌ Error: ${error.message || 'Something went wrong'}`, undefined, true);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h3>Chat with agents</h3>
        {mcpLoading && <span className="status-badge">Loading tools...</span>}
        {!mcpLoading && tools.length > 0 && (
          <span className="status-badge success">{tools.length} tools available</span>
        )}
        {!mcpLoading && tools.length === 0 && !canSend && (
          <span className="status-badge error">No tools available - Check console</span>
        )}
        {defaultAgentId && (
          <span className="status-badge success" title="Chat uses OASIS Agent first; falls back to Local LLM if needed">Assistant: OASIS Agent</span>
        )}
        {!defaultAgentId && hasLLM === true && (
          <span className="status-badge success">Assistant: Local LLM</span>
        )}
        {!defaultAgentId && !hasLLM && aiAssistant && (
          <span className="status-badge">Assistant: Offline (fallback)</span>
        )}
        {!canSend && !mcpLoading && (
          <span className="status-badge">Set OPENAI_API_KEY or connect OASIS backend</span>
        )}
        {hasClaudeAgent && (
          <label className="agent-mode-toggle" title="Run Claude Sonnet 4.6 (via OpenServ) as a coding agent on this workspace">
            <input
              type="checkbox"
              checked={agentMode}
              onChange={(e) => {
                setAgentMode(e.target.checked);
                if (e.target.checked) setOpenServAgentMode(false);
              }}
            />
            Agent mode (Claude)
          </label>
        )}
        {hasOpenServAgent && (
          <label className="agent-mode-toggle" title="Run any OpenServ model (OpenAI SDK) as a coding agent on this workspace">
            <input
              type="checkbox"
              checked={openServAgentMode}
              onChange={(e) => {
                setOpenServAgentMode(e.target.checked);
                if (e.target.checked) setAgentMode(false);
              }}
            />
            Agent mode (OpenServ)
          </label>
        )}
        {openServAgentMode && openServModels.length > 0 && (
          <select
            className="agent-model-select"
            value={openServModel}
            onChange={(e) => setOpenServModel(e.target.value)}
            title="Model used by the OpenServ agent"
          >
            {openServModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role} ${msg.error ? 'error' : ''}`}>
            <div className="message-content">
              {msg.content.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  {i < msg.content.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="tool-calls">
                <div className="tool-call-label">Tool used: {msg.toolCalls[0].tool}</div>
              </div>
            )}
            {msg.confirm && (
              <div className="agent-confirm">
                <pre className="agent-confirm-detail">{msg.confirm.detail}</pre>
                {!msg.confirm.resolved ? (
                  <div className="agent-confirm-actions">
                    <button className="agent-confirm-approve" onClick={() => respondToConfirm(msg.confirm!.requestId, true)}>
                      {msg.confirm.kind === 'write' ? 'Apply' : 'Run'}
                    </button>
                    <button className="agent-confirm-reject" onClick={() => respondToConfirm(msg.confirm!.requestId, false)}>
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
        {loading && (
          <div className="message assistant">
            <div className="message-content">
              <span className="typing-indicator">Thinking</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-container">
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={canSend ? "Ask me anything..." : "Loading..."}
          disabled={loading || !canSend}
        />
        <button 
          onClick={handleSend} 
          disabled={loading || !input.trim() || !canSend}
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
};
