import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface Tool {
  name: string;
  description: string;
  inputSchema: any;
}

interface MCPContextType {
  tools: Tool[];
  loading: boolean;
  executeTool: (toolName: string, args: any) => Promise<any>;
  refreshTools: () => Promise<void>;
}

const MCPContext = createContext<MCPContextType | undefined>(undefined);

export const MCPProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTools = async () => {
    try {
      if (window.electronAPI) {
        const toolList = await window.electronAPI.listTools();
        if (Array.isArray(toolList)) {
          setTools(toolList);
          console.log(`[MCP Context] Loaded ${toolList.length} tools`);
        } else {
          console.warn('[MCP Context] Tools list is not an array:', toolList);
          setTools([]);
        }
      } else {
        console.error('[MCP Context] electronAPI not available');
        setTools([]);
      }
    } catch (error: any) {
      console.error('[MCP Context] Failed to load tools:', error);
      console.error('[MCP Context] Error details:', error.message);
      setTools([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTools();
  }, []);

  const executeTool = async (toolName: string, args: any) => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return await window.electronAPI.executeTool(toolName, args);
  };

  return (
    <MCPContext.Provider value={{ tools, loading, executeTool, refreshTools: loadTools }}>
      {children}
    </MCPContext.Provider>
  );
};

export const useMCP = () => {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error('useMCP must be used within MCPProvider');
  }
  return context;
};
