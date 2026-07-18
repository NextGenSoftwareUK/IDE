import React, { useCallback, useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useStatusBar } from '../../contexts/StatusBarContext';
import { registerOASISSnippets } from './OASISSnippets';
import { pushReferences } from '../References/ReferencesPanel';
import { MonacoDiffViewer } from '../Git/MonacoDiffViewer';
import './Editor.css';

function parseKeyChord(key: string): number | null {
  const parts = key.split('+');
  let mod = 0;
  let code = 0;
  for (const p of parts) {
    const part = p.trim();
    if (part === 'Ctrl')  { mod |= monaco.KeyMod.CtrlCmd; continue; }
    if (part === 'Shift') { mod |= monaco.KeyMod.Shift;   continue; }
    if (part === 'Alt')   { mod |= monaco.KeyMod.Alt;     continue; }
    if (part === 'Meta')  { mod |= monaco.KeyMod.WinCtrl; continue; }
    // Single letter A-Z
    if (part.length === 1 && part >= 'A' && part <= 'Z') {
      const kc = (monaco.KeyCode as any)['Key' + part];
      if (kc !== undefined) { code = kc; continue; }
    }
    // Function keys F1-F19
    const fMatch = part.match(/^F(\d+)$/);
    if (fMatch) {
      const kc = (monaco.KeyCode as any)['F' + fMatch[1]];
      if (kc !== undefined) { code = kc; continue; }
    }
    // Named keys
    const named: Record<string, number> = {
      Space: monaco.KeyCode.Space, Tab: monaco.KeyCode.Tab,
      Enter: monaco.KeyCode.Enter, Escape: monaco.KeyCode.Escape,
      Backspace: monaco.KeyCode.Backspace, Delete: monaco.KeyCode.Delete,
      Up: monaco.KeyCode.UpArrow, Down: monaco.KeyCode.DownArrow,
      Left: monaco.KeyCode.LeftArrow, Right: monaco.KeyCode.RightArrow,
      Home: monaco.KeyCode.Home, End: monaco.KeyCode.End,
    };
    if (named[part] !== undefined) { code = named[part]; continue; }
    return null; // unrecognised key
  }
  if (code === 0) return null;
  return mod | code;
}

let themesRegistered = false;
function ensureThemes() {
  if (themesRegistered) return;
  themesRegistered = true;

  monaco.editor.defineTheme('oasis-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '5a7a9a', fontStyle: 'italic' },
      { token: 'keyword', foreground: '7dd3fc' },
      { token: 'string', foreground: '86efac' },
      { token: 'number', foreground: 'fca5a5' },
      { token: 'type', foreground: 'f9a8d4' },
      { token: 'class', foreground: 'fde68a' },
      { token: 'function', foreground: 'a5b4fc' },
    ],
    colors: {
      'editor.background': '#091a2d',
      'editor.foreground': '#c8d8ec',
      'editorLineNumber.foreground': '#2a4a6a',
      'editorLineNumber.activeForeground': '#5a8ac8',
      'editor.selectionBackground': '#1a4a7a55',
      'editor.lineHighlightBackground': '#0d2a4520',
      'editorCursor.foreground': '#3b82f6',
      'editorIndentGuide.background1': '#1a3a5c',
    },
  });

  monaco.editor.defineTheme('monokai', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '75715e', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'f92672' },
      { token: 'string', foreground: 'e6db74' },
      { token: 'number', foreground: 'ae81ff' },
      { token: 'type', foreground: '66d9e8' },
      { token: 'function', foreground: 'a6e22e' },
    ],
    colors: {
      'editor.background': '#272822',
      'editor.foreground': '#f8f8f2',
      'editorLineNumber.foreground': '#75715e',
      'editor.selectionBackground': '#49483e',
      'editor.lineHighlightBackground': '#3e3d32',
      'editorCursor.foreground': '#f8f8f0',
    },
  });

  monaco.editor.defineTheme('one-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c678dd' },
      { token: 'string', foreground: '98c379' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'type', foreground: 'e5c07b' },
      { token: 'function', foreground: '61afef' },
      { token: 'variable', foreground: 'e06c75' },
    ],
    colors: {
      'editor.background': '#282c34',
      'editor.foreground': '#abb2bf',
      'editorLineNumber.foreground': '#4b5263',
      'editor.selectionBackground': '#3e4451',
      'editor.lineHighlightBackground': '#2c313c',
      'editorCursor.foreground': '#528bff',
    },
  });
}

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

  monaco.languages.registerRenameProvider(['typescript', 'javascript'], {
    async provideRenameEdits(model, position, newName) {
      const api = window.electronAPI;
      if (!api?.lspRename) return { edits: [] };
      try {
        const result = await api.lspRename(
          model.uri.toString(), position.lineNumber - 1, position.column - 1, newName,
        );
        if (!result) return { edits: [], rejectReason: 'No rename result' };

        // Convert WorkspaceEdit → Monaco WorkspaceEdit
        const edits: monaco.languages.IWorkspaceTextEdit[] = [];
        const lspRangeToMonaco = (r: any): monaco.IRange => ({
          startLineNumber: r.start.line + 1,
          startColumn: r.start.character + 1,
          endLineNumber: r.end.line + 1,
          endColumn: r.end.character + 1,
        });

        for (const [uri, fileEdits] of Object.entries(result.changes ?? {})) {
          for (const e of fileEdits as any[]) {
            edits.push({ resource: monaco.Uri.parse(uri), versionId: undefined, textEdit: { range: lspRangeToMonaco(e.range), text: e.newText ?? '' } });
          }
        }
        for (const dc of result.documentChanges ?? []) {
          if (dc.textDocument?.uri && dc.edits) {
            for (const e of dc.edits) {
              edits.push({ resource: monaco.Uri.parse(dc.textDocument.uri), versionId: undefined, textEdit: { range: lspRangeToMonaco(e.range), text: e.newText ?? '' } });
            }
          }
        }

        // Also apply to disk for files not open as Monaco models
        api.lspApplyWorkspaceEdit?.(result).catch(() => {});

        return { edits };
      } catch (err: any) { return { edits: [], rejectReason: err?.message ?? 'Rename failed' }; }
    },
  });

  monaco.languages.registerCodeActionProvider(['typescript', 'javascript'], {
    async provideCodeActions(model, range, context) {
      const api = window.electronAPI;
      if (!api?.lspCodeAction) return { actions: [], dispose: () => {} };
      try {
        const lspRange = {
          start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
          end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
        };
        const lspContext = {
          diagnostics: context.markers.map((m) => ({
            range: {
              start: { line: m.startLineNumber - 1, character: m.startColumn - 1 },
              end: { line: m.endLineNumber - 1, character: m.endColumn - 1 },
            },
            severity: m.severity === monaco.MarkerSeverity.Error ? 1 :
                      m.severity === monaco.MarkerSeverity.Warning ? 2 : 3,
            message: m.message,
            source: m.source,
            code: m.code ? String(m.code) : undefined,
          })),
          only: undefined,
        };

        const result = await api.lspCodeAction(model.uri.toString(), lspRange, lspContext);

        const lspRangeToMonaco = (r: any): monaco.IRange => ({
          startLineNumber: r.start.line + 1, startColumn: r.start.character + 1,
          endLineNumber: r.end.line + 1, endColumn: r.end.character + 1,
        });

        const convertEdit = (we: any): monaco.languages.WorkspaceEdit => {
          const edits: monaco.languages.IWorkspaceTextEdit[] = [];
          for (const [uri, fileEdits] of Object.entries(we?.changes ?? {})) {
            for (const e of fileEdits as any[]) {
              edits.push({ resource: monaco.Uri.parse(uri), versionId: undefined, textEdit: { range: lspRangeToMonaco(e.range), text: e.newText ?? '' } });
            }
          }
          for (const dc of we?.documentChanges ?? []) {
            if (dc.textDocument?.uri && dc.edits) {
              for (const e of dc.edits) {
                edits.push({ resource: monaco.Uri.parse(dc.textDocument.uri), versionId: undefined, textEdit: { range: lspRangeToMonaco(e.range), text: e.newText ?? '' } });
              }
            }
          }
          return { edits };
        };

        const actions: monaco.languages.CodeAction[] = (result ?? [])
          .filter((a: any) => a.edit)  // only actions with edits (not command-only)
          .map((a: any) => ({
            title: a.title,
            kind: a.kind,
            diagnostics: [],
            edit: convertEdit(a.edit),
            isPreferred: a.isPreferred ?? false,
          }));

        return { actions, dispose: () => {} };
      } catch { return { actions: [], dispose: () => {} }; }
    },
  });

  // ── Signature help (parameter hints) ──────────────────────────────────────
  monaco.languages.registerSignatureHelpProvider(['typescript', 'javascript'], {
    signatureHelpTriggerCharacters: ['(', ','],
    signatureHelpRetriggerCharacters: [','],
    async provideSignatureHelp(model, position) {
      const api = window.electronAPI;
      if (!api?.lspSignatureHelp) return null;
      try {
        const result = await api.lspSignatureHelp(
          model.uri.toString(), position.lineNumber - 1, position.column - 1,
        );
        if (!result?.signatures?.length) return null;
        return {
          value: {
            signatures: result.signatures.map((sig: any) => ({
              label: sig.label,
              documentation: sig.documentation ? { value: sig.documentation.value ?? sig.documentation } : undefined,
              parameters: (sig.parameters ?? []).map((p: any) => ({
                label: p.label,
                documentation: p.documentation ? { value: p.documentation.value ?? p.documentation } : undefined,
              })),
            })),
            activeSignature: result.activeSignature ?? 0,
            activeParameter: result.activeParameter ?? 0,
          },
          dispose: () => {},
        };
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
    setFileContent, save, saveTab, closeTab, setActiveTab, openFile, workspacePath,
    navigateBack, navigateForward, togglePin,
  } = useWorkspace();
  const { setCursor, setLspReady, setEol, setIndent, setDiagnosticCounts } = useStatusBar();

  // In right-pane mode, use override values; otherwise use context
  const isRightPane = overrideTabPath !== undefined;
  const tabs = overrideTabs ?? ctxTabs;
  const activeTabPath = isRightPane ? overrideTabPath : ctxActiveTabPath;

  const docVersions = useRef<Map<string, number>>(new Map());

  // ── Inline diff panel ────────────────────────────────────────────────────
  const [diffOpen, setDiffOpen] = React.useState(false);
  const [diffSaved, setDiffSaved] = React.useState('');

  // ── Compare with active file ──────────────────────────────────────────────
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [compareLeft, setCompareLeft] = React.useState<{ path: string; content: string } | null>(null);
  const [compareRight, setCompareRight] = React.useState<{ path: string; content: string } | null>(null);

  // ── Tab context menu ──────────────────────────────────────────────────────
  const [tabMenu, setTabMenu] = React.useState<{ x: number; y: number; path: string } | null>(null);

  const openTabMenu = React.useCallback((e: React.MouseEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setTabMenu({ x: e.clientX, y: e.clientY, path });
  }, []);

  const closeTabMenu = React.useCallback(() => setTabMenu(null), []);

  React.useEffect(() => {
    if (!tabMenu) return;
    const close = () => setTabMenu(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [tabMenu]);

  const handleMenuClose = React.useCallback((path: string) => {
    (closeTab as any)(path, true); // force-close even if pinned
    closeTabMenu();
  }, [closeTab, closeTabMenu]);

  const handleMenuCloseOthers = React.useCallback((keepPath: string) => {
    tabs.filter((t) => t.path !== keepPath && !t.pinned).forEach((t) => closeTab(t.path));
    closeTabMenu();
  }, [tabs, closeTab, closeTabMenu]);

  const handleMenuCloseRight = React.useCallback((path: string) => {
    const idx = tabs.findIndex((t) => t.path === path);
    if (idx === -1) return;
    tabs.slice(idx + 1).filter((t) => !t.pinned).forEach((t) => closeTab(t.path));
    closeTabMenu();
  }, [tabs, closeTab, closeTabMenu]);

  const handleMenuCopyPath = React.useCallback((path: string) => {
    navigator.clipboard.writeText(path.replace(/\\/g, '/'));
    closeTabMenu();
  }, [closeTabMenu]);

  const handleMenuReveal = React.useCallback((path: string) => {
    (window as any).electronAPI?.shellReveal?.(path);
    closeTabMenu();
  }, [closeTabMenu]);

  const handleMenuPin = React.useCallback((path: string) => {
    togglePin(path);
    closeTabMenu();
  }, [togglePin, closeTabMenu]);

  const handleMenuCompare = React.useCallback(async (path: string) => {
    closeTabMenu();
    if (!activeTabPath || path === activeTabPath) return;
    const leftTab = tabs.find((t) => t.path === activeTabPath);
    const rightTab = tabs.find((t) => t.path === path);
    const leftContent = leftTab?.content ?? await (window.electronAPI?.readFile?.(activeTabPath) ?? Promise.resolve(''));
    const rightContent = rightTab?.content ?? await (window.electronAPI?.readFile?.(path) ?? Promise.resolve(''));
    setCompareLeft({ path: activeTabPath, content: leftContent });
    setCompareRight({ path, content: rightContent });
    setCompareOpen(true);
  }, [activeTabPath, tabs, closeTabMenu]);

  // Create Monaco editor once
  useEffect(() => {
    if (!editorRef.current) return;
    ensureThemes();
    registerLspProviders();
    registerOASISSnippets();

    const editor = monaco.editor.create(editorRef.current, {
      value: '',
      language: 'plaintext',
      theme: 'oasis-dark',
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
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true },
      stickyScroll: { enabled: true },
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

    // Ctrl+Shift+I — format document (LSP formatter)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyI, () => {
      editor.getAction('editor.action.formatDocument')?.run();
    });

    // Alt+Left / Alt+Right — tab history navigation
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow, () => navigateBack());
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.RightArrow, () => navigateForward());

    // Shift+F12 — find all references via LSP
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F12, async () => {
      const api = window.electronAPI;
      if (!api?.lspReferences) return;
      const model = editor.getModel();
      const pos = editor.getPosition();
      if (!model || !pos) return;
      try {
        const word = model.getWordAtPosition(pos);
        const symbol = word?.word ?? '';
        const result = await api.lspReferences(
          model.uri.toString(), pos.lineNumber - 1, pos.column - 1,
        );
        pushReferences({ symbol, locations: result ?? [] });
        window.dispatchEvent(new CustomEvent('oasis-show-references'));
      } catch {}
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

    // Alt+F12 — peek definition inline
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.F12, () => {
      editor.getAction('editor.action.peekDefinition')?.run();
    });

    // Ctrl+Shift+D — toggle inline diff (current buffer vs saved on disk)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyD, async () => {
      const model = editor.getModel();
      if (!model) return;
      const filePath = decodeURIComponent(model.uri.path.replace(/^\//, '').replace(/\//g, '\\'));
      const diskContent = await window.electronAPI?.readFile?.(filePath) ?? '';
      setDiffSaved(diskContent);
      setDiffOpen((v) => !v);
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
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { save(); });
  }, [save]);

  // Apply user-remapped keybindings
  useEffect(() => {
    const editor = monacoEditorRef.current;
    if (!editor || isRightPane) return;
    window.electronAPI?.keybindingsGet?.().then((bindings) => {
      if (!bindings?.length) return;
      for (const { command, key } of bindings) {
        const chord = parseKeyChord(key);
        if (chord === null) continue;
        editor.addCommand(chord, () => { editor.getAction(command)?.run(); });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = monacoEditorRef.current;
    if (!editor) return;
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow, () => navigateBack());
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.RightArrow, () => navigateForward());
  }, [navigateBack, navigateForward]);

  // Subscribe to LSP publishDiagnostics → Monaco markers + signal LSP ready
  // Maintain per-file counts and push aggregated totals to StatusBar
  const diagCountsRef = useRef<Map<string, { e: number; w: number }>>(new Map());
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onLspDiagnostics) return;
    let readySignalled = false;
    return api.onLspDiagnostics((params: { uri: string; diagnostics: any[] }) => {
      if (!readySignalled && !isRightPane) { readySignalled = true; setLspReady(true); }
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

      if (!isRightPane) {
        const e = params.diagnostics.filter((d: any) => d.severity === 1).length;
        const w = params.diagnostics.filter((d: any) => d.severity === 2).length;
        diagCountsRef.current.set(params.uri, { e, w });
        let totalE = 0, totalW = 0;
        diagCountsRef.current.forEach((c) => { totalE += c.e; totalW += c.w; });
        setDiagnosticCounts(totalE, totalW);
      }
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

  // Poll settings for theme + editor option changes (left pane drives global Monaco theme)
  useEffect(() => {
    if (isRightPane) return;
    const apply = () => {
      window.electronAPI?.settingsGet?.().then((s) => {
        monaco.editor.setTheme(s?.EDITOR_THEME ?? 'oasis-dark');
        const editor = monacoEditorRef.current;
        if (editor) {
          const rulerSetting = s?.EDITOR_RULERS ?? 'none';
          const rulers = rulerSetting === 'none' ? [] :
            rulerSetting.split(',').map((c: string) => ({ column: parseInt(c.trim(), 10), color: '#1a3a5c' }));
          editor.updateOptions({
            fontSize: Math.max(8, Math.min(32, parseInt(s?.EDITOR_FONT_SIZE ?? '14', 10) || 14)),
            wordWrap: (s?.EDITOR_WORD_WRAP ?? 'on') as monaco.editor.IEditorOptions['wordWrap'],
            minimap: { enabled: s?.EDITOR_MINIMAP !== 'false' },
            rulers,
          });
        }
      });
    };
    apply();
    const id = setInterval(apply, 5000);
    return () => clearInterval(id);
  }, [isRightPane]);

  // Track cursor position + model EOL/indent for status bar (left pane only)
  useEffect(() => {
    if (isRightPane) return;
    const editor = monacoEditorRef.current;
    if (!editor) return;

    const syncModelMeta = () => {
      const model = editor.getModel();
      if (!model) return;
      const eolVal = model.getEOL();
      setEol(eolVal === '\r\n' ? 'CRLF' : 'LF');
      const opts = model.getOptions();
      setIndent(opts.insertSpaces ? 'spaces' : 'tabs', opts.tabSize);
    };

    const dCursor = editor.onDidChangeCursorPosition((e) => {
      setCursor(e.position.lineNumber, e.position.column);
    });
    const dModel = editor.onDidChangeModel(() => syncModelMeta());
    const dOpts = editor.onDidChangeModelOptions(() => syncModelMeta());
    syncModelMeta();

    // Handle EOL change from status bar click
    const handleEol = (e: Event) => {
      const model = editor.getModel();
      if (!model) return;
      const eolStr = (e as CustomEvent<string>).detail;
      model.pushEOL(eolStr === 'CRLF' ? monaco.editor.EndOfLineSequence.CRLF : monaco.editor.EndOfLineSequence.LF);
      setEol(eolStr === 'CRLF' ? 'CRLF' : 'LF');
    };

    // Handle indent change from status bar click
    const handleIndent = (e: Event) => {
      const { type, size } = (e as CustomEvent<{ type: string; size: number }>).detail;
      editor.getModel()?.updateOptions({ tabSize: size, insertSpaces: type === 'spaces' });
      setIndent(type === 'spaces' ? 'spaces' : 'tabs', size);
    };

    // Handle jump-to-line from Outline panel
    const handleGotoLine = (e: Event) => {
      const line = (e as CustomEvent<number>).detail;
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
    };

    const handleFormat = () => { if (!isRightPane) editor.getAction('editor.action.formatDocument')?.run(); };
    window.addEventListener('oasis-format-document', handleFormat);
    window.addEventListener('oasis-set-eol', handleEol);
    window.addEventListener('oasis-set-indent', handleIndent);
    window.addEventListener('oasis-goto-line', handleGotoLine);

    return () => {
      dCursor.dispose(); dModel.dispose(); dOpts.dispose();
      window.removeEventListener('oasis-format-document', handleFormat);
      window.removeEventListener('oasis-set-eol', handleEol);
      window.removeEventListener('oasis-set-indent', handleIndent);
      window.removeEventListener('oasis-goto-line', handleGotoLine);
    };
  }, [isRightPane, setCursor, setEol, setIndent]);

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

  // Git blame decorations — show dim annotation after each line (left pane only)
  const blameDecorationsRef = useRef<string[]>([]);
  useEffect(() => {
    if (isRightPane || !activeTabPath) return;
    const editor = monacoEditorRef.current;
    if (!editor) return;
    const api = window.electronAPI;
    if (!api?.gitBlame) return;

    // Clear existing decorations whenever tab changes
    blameDecorationsRef.current = editor.deltaDecorations(blameDecorationsRef.current, []);

    if (!workspacePath) return;

    let cancelled = false;
    api.gitBlame(workspacePath, activeTabPath).then((entries) => {
      if (cancelled || !entries?.length) return;
      const ed = monacoEditorRef.current;
      if (!ed) return;

      const now = Math.floor(Date.now() / 1000);
      function relTime(ts: number) {
        const diff = now - ts;
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
        if (diff < 86400 * 365) return `${Math.floor(diff / (86400 * 30))}mo ago`;
        return `${Math.floor(diff / (86400 * 365))}y ago`;
      }

      const decorations: monaco.editor.IModelDeltaDecoration[] = entries.map((e) => ({
        range: new monaco.Range(e.line, 1, e.line, 1),
        options: {
          isWholeLine: false,
          after: {
            content: `  ${e.hash}  ${e.author}  ${relTime(e.timestamp)}`,
            inlineClassName: 'blame-annotation',
          },
        },
      }));

      blameDecorationsRef.current = ed.deltaDecorations(blameDecorationsRef.current, decorations);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [activeTabPath, isRightPane, workspacePath]);

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
              className={`editor-tab-item ${isActive ? 'active' : ''}${tab.pinned ? ' pinned' : ''}`}
              title={tab.path}
              onClick={() => isRightPane ? onTabChange?.(tab.path) : setActiveTab(tab.path)}
              onContextMenu={(e) => openTabMenu(e, tab.path)}
            >
              {tab.pinned && <span className="editor-tab-pin" title="Pinned">📌</span>}
              <span className="editor-tab-name">{name}</span>
              {isDirty && <span className="editor-tab-dirty" title="Unsaved">●</span>}
              <button
                type="button"
                className="editor-tab-close"
                onClick={(e) => handleTabClose(e, tab.path)}
                title={tab.pinned ? 'Unpin and close' : 'Close'}
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

      <div ref={editorRef} className={`editor${diffOpen ? ' editor--with-diff' : ''}`} />

      {/* ── Inline diff panel ── */}
      {diffOpen && activeTabPath && (() => {
        const tab = tabs.find((t) => t.path === activeTabPath);
        const lang = activeTabPath.split('.').pop()?.toLowerCase() ?? 'plaintext';
        return (
          <div className="editor-diff-panel">
            <div className="editor-diff-header">
              <span className="editor-diff-title">Changes — {activeTabPath.replace(/\\/g, '/').split('/').pop()}</span>
              <button type="button" className="editor-diff-close" onClick={() => setDiffOpen(false)} title="Close diff (Ctrl+Shift+D)">✕</button>
            </div>
            <div className="editor-diff-body">
              <MonacoDiffViewer original={diffSaved} modified={tab?.content ?? ''} language={lang} filePath={activeTabPath} />
            </div>
          </div>
        );
      })()}

      {/* ── Compare panel ── */}
      {compareOpen && compareLeft && compareRight && (
        <div className="editor-compare-overlay">
          <div className="editor-diff-header">
            <span className="editor-diff-title">
              {compareLeft.path.replace(/\\/g, '/').split('/').pop()} ↔ {compareRight.path.replace(/\\/g, '/').split('/').pop()}
            </span>
            <button type="button" className="editor-diff-close" onClick={() => setCompareOpen(false)}>✕</button>
          </div>
          <div className="editor-compare-body">
            <MonacoDiffViewer
              original={compareLeft.content}
              modified={compareRight.content}
              language={compareLeft.path.split('.').pop()?.toLowerCase() ?? 'plaintext'}
              filePath={compareLeft.path}
            />
          </div>
        </div>
      )}

      {/* ── Tab context menu ── */}
      {tabMenu && (() => {
        const menuTab = tabs.find((t) => t.path === tabMenu.path);
        const canCompare = activeTabPath && tabMenu.path !== activeTabPath;
        return (
          <div
            className="tab-context-menu"
            style={{ left: tabMenu.x, top: tabMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button type="button" className="tab-context-item" onClick={() => handleMenuPin(tabMenu.path)}>
              {menuTab?.pinned ? 'Unpin Tab' : 'Pin Tab'}
            </button>
            <div className="tab-context-sep" />
            <button type="button" className="tab-context-item" onClick={() => handleMenuClose(tabMenu.path)}>Close</button>
            <button type="button" className="tab-context-item" onClick={() => handleMenuCloseOthers(tabMenu.path)}>Close Others</button>
            <button type="button" className="tab-context-item" onClick={() => handleMenuCloseRight(tabMenu.path)}>Close to the Right</button>
            <div className="tab-context-sep" />
            {canCompare && (
              <button type="button" className="tab-context-item" onClick={() => handleMenuCompare(tabMenu.path)}>
                Compare with Active File
              </button>
            )}
            <button type="button" className="tab-context-item" onClick={() => handleMenuCopyPath(tabMenu.path)}>Copy Path</button>
            <button type="button" className="tab-context-item" onClick={() => handleMenuReveal(tabMenu.path)}>Reveal in Explorer</button>
          </div>
        );
      })()}
    </div>
  );
};
