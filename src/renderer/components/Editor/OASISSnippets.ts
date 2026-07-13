import * as monaco from 'monaco-editor';

const SNIPPETS: Array<{
  label: string;
  detail: string;
  insertText: string;
  languages: string[];
}> = [
  // ── Avatar ────────────────────────────────────────────────────────────────
  {
    label: 'oasis-avatar',
    detail: 'OASIS Avatar scaffold',
    languages: ['typescript', 'csharp'],
    insertText: `// OASIS Avatar
const avatar = await OASISAPI.Avatar.LoadAvatarAsync("\${1:avatarId}");
if (avatar.IsError) {
  console.error(avatar.Message);
} else {
  const data = avatar.Result;
  console.log("Karma:", data.Karma);
  console.log("Level:", data.Level);
  \${0}
}`,
  },
  // ── Holon ─────────────────────────────────────────────────────────────────
  {
    label: 'oasis-holon',
    detail: 'OASIS Holon scaffold',
    languages: ['typescript', 'csharp'],
    insertText: `// OASIS Holon
const holon = {
  Name: "\${1:HolonName}",
  Description: "\${2:Description}",
  HolonType: HolonType.\${3:Custom},
  MetaData: {
    \${4:key}: "\${5:value}",
  },
};
const result = await OASISAPI.Data.SaveHolonAsync(holon);
if (result.IsError) {
  console.error(result.Message);
}
\${0}`,
  },
  // ── Provider ──────────────────────────────────────────────────────────────
  {
    label: 'oasis-provider',
    detail: 'OASIS Provider activation',
    languages: ['typescript', 'csharp'],
    insertText: `// Activate OASIS Provider
const activate = await OASISAPI.Provider.ActivateProviderAsync(ProviderType.\${1:Holochain});
if (!activate.IsError) {
  console.log("Provider activated:", ProviderType.\${1:Holochain});
}
\${0}`,
  },
  // ── OAPP entry point ─────────────────────────────────────────────────────
  {
    label: 'oasis-oapp',
    detail: 'OAPP entry point scaffold',
    languages: ['typescript', 'csharp'],
    insertText: `// \${1:MyOAPP} - OASIS Application
import { OAPP } from '@oasis-platform/star-odk';

export class \${1:MyOAPP} extends OAPP {
  async onActivate(): Promise<void> {
    console.log('\${1:MyOAPP} activated');
    \${2}
  }

  async onDeactivate(): Promise<void> {
    console.log('\${1:MyOAPP} deactivated');
  }
}

export default new \${1:MyOAPP}();
\${0}`,
  },
  // ── Web6 AI completion ────────────────────────────────────────────────────
  {
    label: 'oasis-web6-complete',
    detail: 'Web6 AI completion call',
    languages: ['typescript'],
    insertText: `// Web6 AI completion
const response = await fetch('\${1:http://localhost:64596}/v1/complete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    Model: "\${2:gpt-4o}",
    Messages: [
      { Role: "user", Content: "\${3:Hello, OASIS AI!}" },
    ],
    MaxTokens: \${4:1000},
    Temperature: \${5:0.7},
  }),
});
const data = await response.json();
console.log(data.Content);
\${0}`,
  },
  // ── MCP tool call ─────────────────────────────────────────────────────────
  {
    label: 'oasis-mcp-tool',
    detail: 'OASIS MCP tool execution',
    languages: ['typescript'],
    insertText: `// Execute OASIS MCP tool
const result = await window.electronAPI.executeTool("\${1:ToolName}", {
  \${2:param}: "\${3:value}",
});
if (result.isError) {
  console.error("Tool error:", result.message);
} else {
  console.log("Tool result:", result.result);
}
\${0}`,
  },
  // ── Search holons ─────────────────────────────────────────────────────────
  {
    label: 'oasis-search',
    detail: 'OASIS search holons',
    languages: ['typescript'],
    insertText: `// Search OASIS holons
const results = await window.electronAPI.web4SearchHolons("\${1:query}", "\${2:}");
for (const holon of results ?? []) {
  console.log(holon.Name, holon.Id);
}
\${0}`,
  },
  // ── NFT mint ─────────────────────────────────────────────────────────────
  {
    label: 'oasis-nft-mint',
    detail: 'OASIS NFT mint scaffold',
    languages: ['typescript', 'csharp'],
    insertText: `// Mint OASIS NFT
const nft = {
  Title: "\${1:NFT Title}",
  Description: "\${2:NFT Description}",
  Price: \${3:1.0},
  MintedByAvatar: "\${4:avatarId}",
  Image: "\${5:https://example.com/image.png}",
};
const result = await OASISAPI.NFT.MintNFTAsync(nft);
if (result.IsError) {
  console.error(result.Message);
} else {
  console.log("Minted NFT:", result.Result.Id);
}
\${0}`,
  },
];

let snippetsRegistered = false;

export function registerOASISSnippets(): void {
  if (snippetsRegistered) return;
  snippetsRegistered = true;

  for (const snippet of SNIPPETS) {
    for (const lang of snippet.languages) {
      monaco.languages.registerCompletionItemProvider(lang, {
        provideCompletionItems(model, position) {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          return {
            suggestions: [{
              label: snippet.label,
              kind: monaco.languages.CompletionItemKind.Snippet,
              detail: snippet.detail,
              insertText: snippet.insertText,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
              sortText: `0_${snippet.label}`, // sort snippets to top
            }],
          };
        },
      });
    }
  }
}
