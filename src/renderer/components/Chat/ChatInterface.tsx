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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const canSend = !!(defaultAgentId || hasLLM || aiAssistant);
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
