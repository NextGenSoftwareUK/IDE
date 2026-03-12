import React, { useCallback, useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './Editor.css';

function languageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    html: 'html',
    css: 'css',
    py: 'python',
    sh: 'shell',
  };
  return map[ext] ?? 'plaintext';
}

export const Editor: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const { fileContent, openFilePath, setFileContent, save, dirty } = useWorkspace();
  const ignoreNextChange = useRef(false);

  // Create Monaco once
  useEffect(() => {
    if (!editorRef.current) return;

    const editor = monaco.editor.create(editorRef.current, {
      value: '',
      language: 'plaintext',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 14,
      wordWrap: 'on',
      lineNumbers: 'on',
      roundedSelection: false,
      scrollBeyondLastLine: false,
      readOnly: false,
      cursorStyle: 'line',
      fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
    });

    monacoEditorRef.current = editor;

    return () => {
      editor.dispose();
      monacoEditorRef.current = null;
    };
  }, []);

  // Sync editor content when open file or fileContent (from open) changes
  useEffect(() => {
    const editor = monacoEditorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    const current = editor.getValue();
    if (current !== fileContent) {
      ignoreNextChange.current = true;
      editor.pushUndoStop();
      model.setValue(fileContent);
      editor.pushUndoStop();
    }

    const lang = openFilePath ? languageFromPath(openFilePath) : 'plaintext';
    monaco.editor.setModelLanguage(model, lang);
  }, [openFilePath, fileContent]);

  // Subscribe to content changes and Cmd+S
  useEffect(() => {
    const editor = monacoEditorRef.current;
    if (!editor) return;

    const disposable = editor.onDidChangeModelContent(() => {
      if (ignoreNextChange.current) {
        ignoreNextChange.current = false;
        return;
      }
      setFileContent(editor.getValue());
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      disposable.dispose();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setFileContent, save]);

  const label = openFilePath ? openFilePath.replace(/^.*[/\\]/, '') : 'Untitled';

  return (
    <div className="editor-container">
      <div className="editor-toolbar">
        <span className="editor-tab">
          {label}
          {dirty && <span className="editor-dirty" title="Unsaved changes">●</span>}
        </span>
      </div>
      <div ref={editorRef} className="editor" />
    </div>
  );
};
