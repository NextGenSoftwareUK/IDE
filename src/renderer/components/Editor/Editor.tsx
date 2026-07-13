import React, { useCallback, useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import './Editor.css';

function languageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    json: 'json', md: 'markdown',
    html: 'html', css: 'css',
    py: 'python', sh: 'shell',
  };
  return map[ext] ?? 'plaintext';
}

function fileUri(filePath: string): string {
  return 'file:///' + filePath.replace(/\\/g, '/');
}

const LSP_LANGUAGES = new Set(['typescript', 'javascript']);

// LSP severity → Monaco marker severity
function lspSevToMonaco(sev: number): monaco.MarkerSeverity {
  switch (sev) {
    case 1: return monaco.MarkerSeverity.Error;
    case 2: return monaco.MarkerSeverity.Warning;
    case 3: return monaco.MarkerSeverity.Info;
    default: return monaco.MarkerSeverity.Hint;
  }
}

// LSP completionItem kind → Monaco completionItem kind
function lspKindToMonaco(kind?: number): monaco.languages.CompletionItemKind {
  const map: Record<number, monaco.languages.CompletionItemKind> = {
    1: monaco.languages.CompletionItemKind.Text,
    2: monaco.languages.CompletionItemKind.Method,
    3: monaco.languages.CompletionItemKind.Function,
    4: monaco.languages.CompletionItemKind.Constructor,
    5: monaco.languages.CompletionItemKind.Field,
    6: monaco.languages.CompletionItemKind.Variable,
    7: monaco.languages.CompletionItemKind.Class,
    8: monaco.languages.CompletionItemKind.Interface,
    9: monaco.languages.CompletionItemKind.Module,
    10: monaco.languages.CompletionItemKind.Property,
    14: monaco.languages.CompletionItemKind.Keyword,
    17: monaco.languages.CompletionItemKind.File,
  };
  return kind !== undefined ? (map[kind] ?? monaco.languages.CompletionItemKind.Text) : monaco.languages.CompletionItemKind.Text;
}

// Register LSP completion provider once
let lspCompletionProviderRegistered = false;
let lspHoverProviderRegistered = false;

function registerLspProviders() {
  if (!lspCompletionProviderRegistered) {
    lspCompletionProviderRegistered = true;
    monaco.languages.registerCompletionItemProvider(['typescript', 'javascript'], {
      triggerCharacters: ['.', '"', "'", '/', '@', '<'],
      async provideCompletionItems(model, position) {
        const api = window.electronAPI;
        if (!api?.lspCompletion) return { suggestions: [] };
        try {
          const result = await api.lspCompletion(
            model.uri.toString(), position.lineNumber - 1, position.column - 1
          );
          if (!result) return { suggestions: [] };
          const items = Array.isArray(result) ? result : (result.items ?? []);
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          return {
            suggestions: items.map((item: any) => ({
              label: item.label,
              kind: lspKindToMonaco(item.kind),
              detail: item.detail,
              documentation: item.documentation?.value ?? item.documentation,
              insertText: item.insertText ?? item.label,
              range,
            })),
          };
        } catch { return { suggestions: [] }; }
      },
    });
  }

  if (!lspHoverProviderRegistered) {
    lspHoverProviderRegistered = true;
    monaco.languages.registerHoverProvider(['typescript', 'javascript'], {
      async provideHover(model, position) {
        const api = window.electronAPI;
        if (!api?.lspHover) return null;
        try {
          const result = await api.lspHover(
            model.uri.toString(), position.lineNumber - 1, position.column - 1
          );
          if (!result?.contents) return null;
          const contents = Array.isArray(result.contents)
            ? result.contents.map((c: any) => ({ value: c.value ?? c }))
            : [{ value: result.contents.value ?? result.contents }];
          return { contents };
        } catch { return null; }
      },
    });
  }
}

export const Editor: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const { fileContent, openFilePath, setFileContent, save, dirty } = useWorkspace();
  const ignoreNextChange = useRef(false);
  const docVersion = useRef(1);
  const prevUriRef = useRef<string | null>(null);

  // Create Monaco once
  useEffect(() => {
    if (!editorRef.current) return;

    registerLspProviders();

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
      suggestOnTriggerCharacters: true,
      quickSuggestions: true,
      parameterHints: { enabled: true },
    });

    monacoEditorRef.current = editor;

    return () => {
      editor.dispose();
      monacoEditorRef.current = null;
    };
  }, []);

  // Subscribe to LSP publishDiagnostics and paint markers on the model
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onLspDiagnostics) return;
    const unsub = api.onLspDiagnostics((params: { uri: string; diagnostics: any[] }) => {
      const model = monaco.editor.getModel(monaco.Uri.parse(params.uri));
      if (!model) return;
      const markers: monaco.editor.IMarkerData[] = params.diagnostics.map((d: any) => ({
        severity: lspSevToMonaco(d.severity),
        message: d.message,
        startLineNumber: d.range.start.line + 1,
        startColumn: d.range.start.character + 1,
        endLineNumber: d.range.end.line + 1,
        endColumn: d.range.end.character + 1,
        source: d.source,
        code: d.code?.toString(),
      }));
      monaco.editor.setModelMarkers(model, 'lsp', markers);
    });
    return unsub;
  }, []);

  // Sync editor content when open file changes
  useEffect(() => {
    const editor = monacoEditorRef.current;
    if (!editor) return;

    // Close previous document
    if (prevUriRef.current) {
      window.electronAPI?.lspCloseDocument?.(prevUriRef.current);
    }

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

    if (openFilePath) {
      docVersion.current = 1;
      const uri = fileUri(openFilePath);
      prevUriRef.current = uri;
      if (LSP_LANGUAGES.has(lang)) {
        window.electronAPI?.lspOpenDocument?.(uri, lang, fileContent);
      }
    }
  }, [openFilePath, fileContent]);

  // Subscribe to content changes and Ctrl+S
  useEffect(() => {
    const editor = monacoEditorRef.current;
    if (!editor) return;

    const disposable = editor.onDidChangeModelContent(() => {
      if (ignoreNextChange.current) {
        ignoreNextChange.current = false;
        return;
      }
      const text = editor.getValue();
      setFileContent(text);

      // Notify LSP of the change
      if (openFilePath && prevUriRef.current) {
        const lang = languageFromPath(openFilePath);
        if (LSP_LANGUAGES.has(lang)) {
          docVersion.current++;
          window.electronAPI?.lspChangeDocument?.(prevUriRef.current, text, docVersion.current);
        }
      }
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
  }, [setFileContent, save, openFilePath]);

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
