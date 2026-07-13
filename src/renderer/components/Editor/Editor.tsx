import React, { useCallback, useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { registerOASISSnippets } from './OASISSnippets';
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

function lspSevToMonaco(sev: number): monaco.MarkerSeverity {
  switch (sev) {
    case 1: return monaco.MarkerSeverity.Error;
    case 2: return monaco.MarkerSeverity.Warning;
    case 3: return monaco.MarkerSeverity.Info;
    default: return monaco.MarkerSeverity.Hint;
  }
}

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

let lspProvidersRegistered = false;

function registerLspProviders() {
  if (lspProvidersRegistered) return;
  lspProvidersRegistered = true;

  monaco.languages.registerCompletionItemProvider(['typescript', 'javascript'], {
    triggerCharacters: ['.', '"', "'", '/', '@', '<'],
    async provideCompletionItems(model, position) {
      const api = window.electronAPI;
      if (!api?.lspCompletion) return { suggestions: [] };
      try {
        const result = await api.lspCompletion(
          model.uri.toString(), position.lineNumber - 1, position.column - 1,
        );
        if (!result) return { suggestions: [] };
        const items = Array.isArray(result) ? result : (result.items ?? []);
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
          startColumn: word.startColumn, endColumn: word.endColumn,
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

  monaco.languages.registerHoverProvider(['typescript', 'javascript'], {
    async provideHover(model, position) {
      const api = window.electronAPI;
      if (!api?.lspHover) return null;
      try {
        const result = await api.lspHover(
          model.uri.toString(), position.lineNumber - 1, position.column - 1,
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

// ── Per-tab model cache ───────────────────────────────────────────────────────
// Keep a Monaco model alive for each open file so undo history is preserved
const modelCache = new Map<string, monaco.editor.ITextModel>();

function getOrCreateModel(filePath: string, content: string): monaco.editor.ITextModel {
  const uri = monaco.Uri.parse(fileUri(filePath));
  let model = monaco.editor.getModel(uri);
  if (!model) {
    model = monaco.editor.createModel(content, languageFromPath(filePath), uri);
    modelCache.set(filePath, model);
  }
  return model;
}

function disposeModel(filePath: string): void {
  const model = modelCache.get(filePath);
  if (model) { model.dispose(); modelCache.delete(filePath); }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface EditorProps {
  paneId?: string;
  /** Right-pane override: show this tab path instead of the workspace active tab */
  overrideTabPath?: string;
  /** Called when the right pane switches tabs */
  onTabChange?: (path: string) => void;
  /** Available tabs to show in the right pane header (when overrideTabPath is set) */
  availableTabs?: import('../../contexts/WorkspaceContext').EditorTab[];
  className?: string;
}

export const Editor: React.FC<EditorProps> = ({
  paneId = 'main',
  overrideTabPath,
  onTabChange,
  availableTabs: overrideTabs,
  className,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const {
    tabs: ctxTabs, activeTabPath: ctxActiveTabPath, openFilePath, fileContent, dirty,
    setFileContent, save, saveTab, closeTab, setActiveTab, openFile,
  } = useWorkspace();

  // In right-pane mode, use override values; otherwise use context
  const isRightPane = overrideTabPath !== undefined;
  const tabs = overrideTabs ?? ctxTabs;
  const activeTabPath = isRightPane ? overrideTabPath : ctxActiveTabPath;

  const docVersions = useRef<Map<string, number>>(new Map());

  // Create Monaco editor once
  useEffect(() => {
    if (!editorRef.current) return;
    registerLspProviders();
    registerOASISSnippets();

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
      cursorStyle: 'line',
      fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
      suggestOnTriggerCharacters: true,
      quickSuggestions: true,
      parameterHints: { enabled: true },
    });

    monacoEditorRef.current = editor;

    // Ctrl+S — save active tab
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { save(); });

    // Ctrl+H — open find & replace widget
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      editor.getAction('editor.action.startFindReplaceAction')?.run();
    });

    // Ctrl+= / Ctrl+- — zoom in/out
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Equal, () => {
      editor.getAction('editor.action.fontZoomIn')?.run();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Minus, () => {
      editor.getAction('editor.action.fontZoomOut')?.run();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit0, () => {
      editor.getAction('editor.action.fontZoomReset')?.run();
    });

    // F12 — go to definition via LSP
    editor.addCommand(monaco.KeyCode.F12, async () => {
      const api = window.electronAPI;
      if (!api?.lspDefinition) return;
      const model = editor.getModel();
      const pos = editor.getPosition();
      if (!model || !pos) return;
      try {
        const result = await api.lspDefinition(
          model.uri.toString(), pos.lineNumber - 1, pos.column - 1,
        );
        if (!result) return;
        const locations = Array.isArray(result) ? result : [result];
        if (locations.length === 0) return;
        const loc = locations[0];
        const targetUri: string = loc.uri ?? loc.targetUri;
        const targetRange = loc.range ?? loc.targetSelectionRange ?? loc.targetRange;
        if (!targetUri || !targetRange) return;

        // Convert file:///C:/... → C:\...
        const targetPath = decodeURIComponent(
          targetUri.replace(/^file:\/\/\//, '').replace(/\//g, '\\')
        );

        // Open the file (no-op if already in tabs)
        await openFile(targetPath);

        // Navigate to position — do it after React re-renders
        setTimeout(() => {
          const ed = monacoEditorRef.current;
          if (!ed) return;
          const line = (targetRange.start?.line ?? 0) + 1;
          const col = (targetRange.start?.character ?? 0) + 1;
          ed.setPosition({ lineNumber: line, column: col });
          ed.revealPositionInCenter({ lineNumber: line, column: col });
        }, 150);
      } catch (e) { console.error('Go to definition failed:', e); }
    });

    return () => {
      editor.dispose();
      monacoEditorRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wire save/openFile into editor commands when they change
  useEffect(() => {
    const editor = monacoEditorRef.current;
    if (!editor) return;
    // Re-add save command so it captures the latest `save` closure
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { save(); });
  }, [save]);

  // Subscribe to LSP publishDiagnostics → Monaco markers
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onLspDiagnostics) return;
    return api.onLspDiagnostics((params: { uri: string; diagnostics: any[] }) => {
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
  }, []);

  // Switch editor model when active tab changes
  useEffect(() => {
    const editor = monacoEditorRef.current;
    if (!editor || !activeTabPath) return;

    const tab = tabs.find((t) => t.path === activeTabPath);
    if (!tab) return;

    const model = getOrCreateModel(activeTabPath, tab.content);
    if (editor.getModel() !== model) {
      editor.setModel(model);
    }

    // Notify LSP
    const uri = fileUri(activeTabPath);
    const lang = languageFromPath(activeTabPath);
    if (LSP_LANGUAGES.has(lang)) {
      if (!docVersions.current.has(activeTabPath)) {
        docVersions.current.set(activeTabPath, 1);
        window.electronAPI?.lspOpenDocument?.(uri, lang, tab.content);
      }
    }
  }, [activeTabPath, tabs]);

  // Sync content changes from context into the model (e.g. initial load)
  useEffect(() => {
    if (!activeTabPath) return;
    const model = monaco.editor.getModel(monaco.Uri.parse(fileUri(activeTabPath)));
    if (!model) return;
    if (model.getValue() !== fileContent) {
      model.pushEditOperations([], [{ range: model.getFullModelRange(), text: fileContent }], () => null);
    }
  }, [activeTabPath, fileContent]);

  // Listen to model content changes, push to context + LSP
  useEffect(() => {
    const editor = monacoEditorRef.current;
    if (!editor) return;

    const disposable = editor.onDidChangeModelContent(() => {
      if (isRightPane) return; // right pane is read-view; edits go nowhere
      const model = editor.getModel();
      if (!model) return;
      const text = model.getValue();
      setFileContent(text);

      if (activeTabPath && LSP_LANGUAGES.has(languageFromPath(activeTabPath))) {
        const uri = fileUri(activeTabPath);
        const v = (docVersions.current.get(activeTabPath) ?? 1) + 1;
        docVersions.current.set(activeTabPath, v);
        window.electronAPI?.lspChangeDocument?.(uri, text, v);
      }
    });

    return () => disposable.dispose();
  }, [setFileContent, activeTabPath]);

  // Dispose models for closed tabs
  useEffect(() => {
    const openPaths = new Set(tabs.map((t) => t.path));
    for (const [path] of modelCache) {
      if (!openPaths.has(path)) {
        window.electronAPI?.lspCloseDocument?.(fileUri(path));
        docVersions.current.delete(path);
        disposeModel(path);
      }
    }
  }, [tabs]);

  const handleTabClose = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.stopPropagation();
      if (!isRightPane) closeTab(path);
    },
    [closeTab, isRightPane],
  );

  return (
    <div className={`editor-container${className ? ' ' + className : ''}`}>
      {/* ── Tab bar ── */}
      <div className="editor-tabs-bar">
        {tabs.length === 0 && (
          <span className="editor-no-tabs">No file open — click a file in the explorer</span>
        )}
        {tabs.map((tab) => {
          const isDirty = tab.content !== tab.savedContent;
          const name = tab.path.replace(/\\/g, '/').split('/').pop() ?? tab.path;
          const isActive = tab.path === activeTabPath;
          return (
            <div
              key={tab.path}
              className={`editor-tab-item ${isActive ? 'active' : ''}`}
              title={tab.path}
              onClick={() => isRightPane ? onTabChange?.(tab.path) : setActiveTab(tab.path)}
            >
              <span className="editor-tab-name">{name}</span>
              {isDirty && <span className="editor-tab-dirty" title="Unsaved">●</span>}
              <button
                type="button"
                className="editor-tab-close"
                onClick={(e) => handleTabClose(e, tab.path)}
                title="Close"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Breadcrumb ── */}
      {openFilePath && (
        <div className="editor-breadcrumb">
          <span className="editor-breadcrumb-path">
            {openFilePath.replace(/\\/g, '/')}
          </span>
          {dirty && (
            <button
              type="button"
              className="editor-save-btn"
              onClick={() => activeTabPath && saveTab(activeTabPath)}
              title="Save (Ctrl+S)"
            >
              Save
            </button>
          )}
        </div>
      )}

      <div ref={editorRef} className="editor" />
    </div>
  );
};
