import React, { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';

interface Props {
  original: string;
  modified: string;
  language: string;
}

function langFromPath(p: string): string {
  const ext = p.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    cs: 'csharp', json: 'json', md: 'markdown', html: 'html',
    css: 'css', py: 'python', sh: 'shell', yaml: 'yaml', yml: 'yaml',
  };
  return map[ext] ?? 'plaintext';
}

export const MonacoDiffViewer: React.FC<Props & { filePath?: string }> = ({
  original, modified, language, filePath,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);

  const lang = filePath ? langFromPath(filePath) : language;

  useEffect(() => {
    if (!containerRef.current) return;
    const diffEditor = monaco.editor.createDiffEditor(containerRef.current, {
      readOnly: true,
      renderSideBySide: true,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 12,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      fontFamily: "'Fira Code', 'Consolas', monospace",
      renderIndicators: true,
      ignoreTrimWhitespace: false,
    });
    editorRef.current = diffEditor;
    return () => { diffEditor.dispose(); editorRef.current = null; };
  }, []);

  useEffect(() => {
    const diffEditor = editorRef.current;
    if (!diffEditor) return;
    const origModel = monaco.editor.createModel(original, lang);
    const modModel = monaco.editor.createModel(modified, lang);
    diffEditor.setModel({ original: origModel, modified: modModel });
    return () => { origModel.dispose(); modModel.dispose(); };
  }, [original, modified, lang]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 200 }} />;
};
