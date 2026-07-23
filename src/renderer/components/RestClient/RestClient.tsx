import React, { useState, useCallback, useRef } from 'react';
import './RestClient.css';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

interface Header { key: string; value: string; enabled: boolean; }

interface HistoryEntry {
  method: HttpMethod;
  url: string;
  status: number;
  ts: number;
}

function parseHeaders(headers: Header[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers) {
    if (h.enabled && h.key.trim()) out[h.key.trim()] = h.value;
  }
  return out;
}

function syntaxHighlight(json: string): string {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = 'rj-num';
        if (/^"/.test(match)) cls = /:$/.test(match) ? 'rj-key' : 'rj-str';
        else if (/true|false/.test(match)) cls = 'rj-bool';
        else if (/null/.test(match)) cls = 'rj-null';
        return `<span class="${cls}">${match}</span>`;
      });
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const METHOD_COLOR: Record<HttpMethod, string> = {
  GET: '#58a6ff', POST: '#3fb950', PUT: '#d29922', PATCH: '#bc8cff',
  DELETE: '#f85149', HEAD: '#79c0ff', OPTIONS: '#a5b4fc',
};

export const RestClient: React.FC = () => {
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState<Header[]>([
    { key: 'Content-Type', value: 'application/json', enabled: true },
    { key: 'Accept', value: 'application/json', enabled: true },
    { key: '', value: '', enabled: true },
  ]);
  const [body, setBody] = useState('');
  const [activeTab, setActiveTab] = useState<'headers' | 'body'>('headers');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{
    status: number; statusText: string; headers: Record<string, string>;
    body: string; time: number; size: number;
  } | null>(null);
  const [responseTab, setResponseTab] = useState<'body' | 'headers'>('body');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [prettyPrint, setPrettyPrint] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setResponse(null);
    const t0 = performance.now();
    try {
      const reqHeaders = parseHeaders(headers);
      const hasBody = !['GET', 'HEAD'].includes(method) && body.trim();
      const res = await fetch(trimmedUrl, {
        method,
        headers: reqHeaders,
        body: hasBody ? body : undefined,
        signal: abortRef.current.signal,
      });
      const elapsed = Math.round(performance.now() - t0);
      const text = await res.text();
      const respHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { respHeaders[k] = v; });
      const size = new TextEncoder().encode(text).length;
      setResponse({ status: res.status, statusText: res.statusText, headers: respHeaders, body: text, time: elapsed, size });
      setHistory((prev) => [{ method, url: trimmedUrl, status: res.status, ts: Date.now() }, ...prev.slice(0, 49)]);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setResponse({ status: 0, statusText: e?.message ?? 'Network error', headers: {}, body: '', time: Math.round(performance.now() - t0), size: 0 });
    } finally {
      setLoading(false);
    }
  }, [url, method, headers, body]);

  const formatBody = useCallback((text: string): string => {
    if (!prettyPrint) return text;
    try { return JSON.stringify(JSON.parse(text), null, 2); }
    catch { return text; }
  }, [prettyPrint]);

  const updateHeader = (idx: number, field: keyof Header, val: string | boolean) => {
    setHeaders((prev) => {
      const next = prev.map((h, i) => i === idx ? { ...h, [field]: val } : h);
      // Auto-add empty row when last row gets a key
      if (field === 'key' && idx === prev.length - 1 && val) {
        next.push({ key: '', value: '', enabled: true });
      }
      return next;
    });
  };

  const removeHeader = (idx: number) => {
    setHeaders((prev) => prev.filter((_, i) => i !== idx));
  };

  const statusColor = response
    ? response.status >= 500 ? '#f85149'
    : response.status >= 400 ? '#d29922'
    : response.status >= 200 ? '#3fb950'
    : '#a5b4fc'
    : undefined;

  const formattedBody = response ? formatBody(response.body) : '';
  const isJson = response?.headers['content-type']?.includes('json') || (() => { try { JSON.parse(response?.body ?? ''); return true; } catch { return false; } })();

  return (
    <div className="rest-root">
      {/* Request bar */}
      <div className="rest-request-bar">
        <select
          className="rest-method-select"
          value={method}
          style={{ color: METHOD_COLOR[method] }}
          onChange={(e) => setMethod(e.target.value as HttpMethod)}
        >
          {METHODS.map((m) => (
            <option key={m} value={m} style={{ color: METHOD_COLOR[m] }}>{m}</option>
          ))}
        </select>
        <input
          className="rest-url-input"
          type="text"
          placeholder="https://localhost:7777/api/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          className={`rest-send-btn ${loading ? 'loading' : ''}`}
          onClick={loading ? () => abortRef.current?.abort() : send}
          disabled={!url.trim() && !loading}
        >
          {loading ? 'Cancel' : 'Send'}
        </button>
      </div>

      <div className="rest-body-area">
        {/* Request config */}
        <div className="rest-request-panel">
          <div className="rest-tabs">
            <button type="button" className={`rest-tab ${activeTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveTab('headers')}>
              Headers {headers.filter((h) => h.enabled && h.key).length > 0 && (
                <span className="rest-tab-badge">{headers.filter((h) => h.enabled && h.key).length}</span>
              )}
            </button>
            <button type="button" className={`rest-tab ${activeTab === 'body' ? 'active' : ''}`} onClick={() => setActiveTab('body')}>
              Body
            </button>
            {history.length > 0 && (
              <div className="rest-history-row">
                {history.slice(0, 8).map((h, i) => (
                  <button
                    key={i}
                    type="button"
                    className="rest-history-chip"
                    title={`${h.method} ${h.url}`}
                    onClick={() => { setMethod(h.method); setUrl(h.url); }}
                  >
                    <span style={{ color: METHOD_COLOR[h.method] }}>{h.method}</span>
                    <span className="rest-history-url">{h.url.replace(/^https?:\/\//, '').slice(0, 28)}</span>
                    <span className={`rest-history-status ${h.status >= 400 ? 'err' : 'ok'}`}>{h.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="rest-tab-content">
            {activeTab === 'headers' && (
              <div className="rest-headers-table">
                {headers.map((h, i) => (
                  <div key={i} className="rest-header-row">
                    <input
                      type="checkbox"
                      checked={h.enabled}
                      onChange={(e) => updateHeader(i, 'enabled', e.target.checked)}
                      className="rest-header-check"
                    />
                    <input
                      className="rest-header-key"
                      placeholder="Header"
                      value={h.key}
                      onChange={(e) => updateHeader(i, 'key', e.target.value)}
                      spellCheck={false}
                    />
                    <input
                      className="rest-header-val"
                      placeholder="Value"
                      value={h.value}
                      onChange={(e) => updateHeader(i, 'value', e.target.value)}
                      spellCheck={false}
                    />
                    {headers.length > 1 && (
                      <button type="button" className="rest-header-del" onClick={() => removeHeader(i)} title="Remove">×</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'body' && (
              <textarea
                className="rest-body-textarea"
                placeholder={'{\n  "key": "value"\n}'}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck={false}
              />
            )}
          </div>
        </div>

        {/* Response */}
        <div className="rest-response-panel">
          {!response && !loading && (
            <div className="rest-response-empty">
              <p>Hit Send to make a request.</p>
            </div>
          )}
          {loading && (
            <div className="rest-response-empty">
              <p className="rest-loading-text">Waiting for response…</p>
            </div>
          )}
          {response && (
            <>
              <div className="rest-response-meta">
                <span className="rest-status-badge" style={{ color: statusColor }}>
                  {response.status > 0 ? response.status : '—'} {response.statusText}
                </span>
                <span className="rest-meta-pill">{response.time} ms</span>
                <span className="rest-meta-pill">{response.size > 1024 ? `${(response.size / 1024).toFixed(1)} KB` : `${response.size} B`}</span>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  className={`rest-pretty-btn ${prettyPrint ? 'active' : ''}`}
                  onClick={() => setPrettyPrint((v) => !v)}
                  title="Toggle pretty print"
                >
                  Pretty
                </button>
                <button
                  type="button"
                  className="rest-copy-btn"
                  onClick={() => navigator.clipboard.writeText(formattedBody)}
                  title="Copy response body"
                >
                  Copy
                </button>
              </div>
              <div className="rest-tabs">
                <button type="button" className={`rest-tab ${responseTab === 'body' ? 'active' : ''}`} onClick={() => setResponseTab('body')}>Body</button>
                <button type="button" className={`rest-tab ${responseTab === 'headers' ? 'active' : ''}`} onClick={() => setResponseTab('headers')}>
                  Headers <span className="rest-tab-badge">{Object.keys(response.headers).length}</span>
                </button>
              </div>
              <div className="rest-response-body">
                {responseTab === 'body' && (
                  prettyPrint && isJson
                    ? <pre className="rest-json" dangerouslySetInnerHTML={{ __html: syntaxHighlight(formattedBody) }} />
                    : <pre className="rest-plain">{formattedBody || '(empty body)'}</pre>
                )}
                {responseTab === 'headers' && (
                  <div className="rest-resp-headers">
                    {Object.entries(response.headers).map(([k, v]) => (
                      <div key={k} className="rest-resp-header-row">
                        <span className="rest-resp-header-key">{k}</span>
                        <span className="rest-resp-header-val">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
