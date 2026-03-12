import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface Agent {
  id: string;
  name?: string;
  services?: string[];
  skills?: string[];
  status?: string;
}

interface AgentContextType {
  agents: Agent[];
  loading: boolean;
  discoverAgents: (serviceName?: string) => Promise<void>;
  invokeAgent: (agentId: string, task: string, context?: any) => Promise<any>;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export const AgentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const discoverAgents = async (serviceName?: string) => {
    setLoading(true);
    try {
      if (window.electronAPI) {
        const agentList = await window.electronAPI.discoverAgents(serviceName);
        setAgents(agentList);
      }
    } catch (error) {
      console.error('Failed to discover agents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    discoverAgents();
  }, []);

  const invokeAgent = async (agentId: string, task: string, context?: any) => {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return await window.electronAPI.invokeAgent(agentId, task, context);
  };

  return (
    <AgentContext.Provider value={{ agents, loading, discoverAgents, invokeAgent }}>
      {children}
    </AgentContext.Provider>
  );
};

export const useAgents = () => {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgents must be used within AgentProvider');
  }
  return context;
};
