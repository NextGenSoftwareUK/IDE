import React, { useEffect, useMemo, useRef } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './MarkdownPreview.css';

// Minimal Markdown → HTML renderer (no external deps)
function mdToHtml(md: string): string {
  let html = md
    // Escape HTML entities first
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Fenced code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="lang-${lang}">${code}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headers
    .replace(/^#{6}\s(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#{5}\s(.+)$/gm, '<h5>$1</h5>')
    .replace(/^#{4}\s(.+)$/gm, '<h4>$1</h4>')
    .replace(/^#{3}\s(.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{2}\s(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{1}\s(.+)$/gm, '<h1>$1</h1>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Blockquote
    .replace(/^&gt;\s(.+)$/gm, '<blockquote>$1</blockquote>')
    // Horizontal rule
    .replace(/^---+$/gm, '<hr>')
    // Unordered list items
    .replace(/^\s*[-*+]\s(.+)$/gm, '<li>$1</li>')
    // Ordered list items
    .replace(/^\s*\d+\.\s(.+)$/gm, '<li>$1</li>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    // Paragraphs: blank-line separated
    .replace(/\n{2,}/g, '\n</p><p>\n')
    .replace(/\n/g, '<br>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>(\s*<br>)*)+/g, (m) => `<ul>${m}</ul>`);

  return `<p>${html}</p>`;
}

interface MarkdownPreviewProps {
  onClose: () => void;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ onClose }) => {
  const { tabs, activeTabPath } = useWorkspace();
  const containerRef = useRef<HTMLDivElement>(null);

  const content = useMemo(() => {
    if (!activeTabPath) return '';
    const tab = tabs.find((t) => t.path === activeTabPath);
    return tab?.content ?? '';
  }, [tabs, activeTabPath]);

  const html = useMemo(() => mdToHtml(content), [content]);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [activeTabPath]);

  return (
    <div className="md-preview">
      <div className="md-preview-header">
        <span className="md-preview-title">Preview — {activeTabPath?.split(/[/\\]/).pop() ?? ''}</span>
        <button type="button" className="md-preview-close" onClick={onClose} title="Close preview (Ctrl+Shift+V)">✕</button>
      </div>
      <div
        ref={containerRef}
        className="md-preview-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};
