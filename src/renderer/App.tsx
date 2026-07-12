import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout/Layout';
import { RightPanelStack } from './components/Layout/RightPanelStack';
import { ChatInterface } from './components/Chat/ChatInterface';
import { FileExplorer } from './components/FileExplorer/FileExplorer';
import { Editor } from './components/Editor/Editor';
import { OASISToolsPanel } from './components/OASISTools/OASISToolsPanel';
import { OASISNetworkPanel } from './components/OASISNetwork/OASISNetworkPanel';
import { AgentPanel } from './components/Agents/AgentPanel';
import { BottomPanel } from './components/BottomPanel/BottomPanel';
import { InboxPanel } from './components/Inbox/InboxPanel';
import { ThemeProvider } from './contexts/ThemeContext';
import { MCPProvider } from './contexts/MCPContext';
import { AgentProvider } from './contexts/AgentContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { AuthProvider } from './contexts/AuthContext';
import { LoginModal } from './components/Auth/LoginModal';

declare global {
  interface Window {
    electronAPI: {
      listTools: () => Promise<any[]>;
      executeTool: (toolName: string, args: any) => Promise<any>;
      healthCheck: () => Promise<any>;
      discoverAgents: (serviceName?: string) => Promise<any[]>;
      invokeAgent: (agentId: string, task: string, context: any) => Promise<any>;
      pickWorkspace: () => Promise<string | null>;
      getWorkspacePath: () => Promise<string | null>;
      listTree: (dir?: string) => Promise<any[]>;
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, content: string) => Promise<void>;
      terminalCreate: (cwd?: string) => Promise<string>;
      terminalWrite: (sessionId: string, data: string) => Promise<void>;
      terminalResize: (sessionId: string, cols: number, rows: number) => Promise<void>;
      terminalDestroy: (sessionId: string) => Promise<void>;
      onTerminalData: (callback: (sessionId: string, data: string) => void) => () => void;
      authLogin: (username: string, password: string) => Promise<{ success: boolean; username?: string; avatarId?: string; error?: string }>;
      authLogout: () => Promise<void>;
      authGetStatus: () => Promise<{ loggedIn: boolean; username?: string; avatarId?: string }>;
      a2aGetPending: () => Promise<any[]>;
      a2aMarkProcessed: (messageId: string) => Promise<void>;
      a2aSendReply: (toAgentId: string, content: string, params?: Record<string, unknown>) => Promise<any>;
      chatHasLLM: () => Promise<boolean>;
      chatComplete: (messages: Array<{ role: string; content: string }>) => Promise<{ content: string; error?: string }>;
      chatGetDefaultAssistantAgentId: () => Promise<string>;
      chatWithAgent: (
        agentId: string,
        message: string,
        conversationId?: string,
        history?: Array<{ role: string; content: string }>,
        fromAvatarId?: string
      ) => Promise<{ content: string; toolCalls?: any[]; error?: string }>;
    };
  }
}

function App() {
  const [mcpReady, setMcpReady] = useState(false);
  const [oasisReady, setOasisReady] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    // Check MCP and OASIS status
    const checkStatus = async () => {
      try {
        if (window.electronAPI) {
          const tools = await window.electronAPI.listTools();
          setMcpReady(tools.length > 0);
          
          const health = await window.electronAPI.healthCheck();
          setOasisReady(health.status === 'healthy');
        }
      } catch (error) {
        console.error('Status check failed:', error);
      }
    };

    checkStatus();
  }, []);

  return (
    <ThemeProvider>
      <MCPProvider>
        <AgentProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <Layout>
            <FileExplorer onLoginClick={() => setShowLoginModal(true)} />
            <Editor />
            <RightPanelStack>
              <ChatInterface />
              <InboxPanel />
              <OASISToolsPanel />
              <OASISNetworkPanel />
            </RightPanelStack>
            <BottomPanel />
            <AgentPanel />
            </Layout>
              {showLoginModal && (
                <LoginModal onClose={() => setShowLoginModal(false)} />
              )}
          </WorkspaceProvider>
          </AuthProvider>
        </AgentProvider>
      </MCPProvider>
    </ThemeProvider>
  );
}

export default App;
