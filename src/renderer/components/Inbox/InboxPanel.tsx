import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './InboxPanel.css';

export interface A2AMessage {
  messageId?: string;
  id?: string;
  fromAgentId?: string;
  from_agent_id?: string;
  content?: string;
  body?: string;
  payload?: unknown;
  createdAt?: string;
  created_at?: string;
  [key: string]: unknown;
}

function getMessageId(m: A2AMessage): string {
  return (m.messageId ?? m.id ?? '') as string;
}

function getFromAgentId(m: A2AMessage): string {
  return (m.fromAgentId ?? m.from_agent_id ?? '') as string;
}

function getContent(m: A2AMessage): string {
  const raw = m.content ?? m.body ?? m.payload;
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') return JSON.stringify(raw);
  return '';
}

function getTime(m: A2AMessage): string {
  const t = m.createdAt ?? m.created_at;
  if (!t) return '';
  try {
    const d = new Date(t as string);
    return d.toLocaleString();
  } catch {
    return String(t);
  }
}

export function InboxPanel() {
  const { loggedIn } = useAuth();
  const [messages, setMessages] = useState<A2AMessage[]>([]);
  const [selected, setSelected] = useState<A2AMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!window.electronAPI?.a2aGetPending) return;
    setLoading(true);
    setError('');
    try {
      const list = await window.electronAPI.a2aGetPending();
      setMessages(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loggedIn) load();
    else setMessages([]);
  }, [loggedIn, load]);

  const handleMarkProcessed = async () => {
    if (!selected) return;
    const id = getMessageId(selected);
    if (!id) return;
    try {
      await window.electronAPI?.a2aMarkProcessed?.(id);
      setMessages((prev) => prev.filter((m) => getMessageId(m) !== id));
      setSelected(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to mark processed');
    }
  };

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return;
    const toAgentId = getFromAgentId(selected);
    if (!toAgentId) {
      setError('Cannot determine sender');
      return;
    }
    try {
      await window.electronAPI?.a2aSendReply?.(toAgentId, replyText.trim());
      setReplyText('');
      await handleMarkProcessed();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to send reply');
    }
  };

  if (!loggedIn) {
    return (
      <div className="inbox-panel">
        <div className="inbox-panel-header">A2A Inbox</div>
        <div className="inbox-panel-empty">Log in to see A2A messages.</div>
      </div>
    );
  }

  return (
    <div className="inbox-panel">
      <div className="inbox-panel-header">
        <span>A2A Inbox</span>
        <button type="button" className="inbox-refresh" onClick={load} disabled={loading}>
          {loading ? '…' : '↻'}
        </button>
      </div>
      <div className="inbox-panel-content">
        {error && <div className="inbox-error">{error}</div>}
        {messages.length === 0 && !loading ? (
          <div className="inbox-panel-empty">No pending messages.</div>
        ) : (
          <ul className="inbox-list">
            {messages.map((m) => {
              const id = getMessageId(m);
              const from = getFromAgentId(m);
              const snippet = getContent(m).slice(0, 60) + (getContent(m).length > 60 ? '…' : '');
              return (
                <li
                  key={id || from + snippet}
                  className={`inbox-list-item ${selected === m ? 'selected' : ''}`}
                  onClick={() => { setSelected(m); setError(''); setReplyText(''); }}
                >
                  <div className="inbox-item-from">{from || 'Unknown'}</div>
                  <div className="inbox-item-snippet">{snippet || '(no content)'}</div>
                  <div className="inbox-item-time">{getTime(m)}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {selected && (
        <div className="inbox-detail">
          <div className="inbox-detail-header">
            <span>From: {getFromAgentId(selected)}</span>
            <button type="button" className="inbox-detail-close" onClick={() => setSelected(null)}>×</button>
          </div>
          <pre className="inbox-detail-body">{getContent(selected) || '(empty)'}</pre>
          <div className="inbox-detail-reply">
            <textarea
              placeholder="Reply…"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={2}
            />
            <div className="inbox-detail-actions">
              <button type="button" onClick={handleReply} disabled={!replyText.trim()}>
                Reply
              </button>
              <button type="button" onClick={handleMarkProcessed}>
                Mark processed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
