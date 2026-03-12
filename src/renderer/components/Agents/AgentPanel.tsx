import React, { useState, useEffect } from 'react';
import './AgentPanel.css';

export const AgentPanel: React.FC = () => {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        if (window.electronAPI) {
          const agentList = await window.electronAPI.discoverAgents();
          setAgents(agentList);
        }
      } catch (error) {
        console.error('Failed to load agents:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAgents();
  }, []);

  return (
    <div className="agent-panel panel">
      <div className="panel-header">Agents</div>
      <div className="panel-content">
        {loading ? (
          <div className="loading">Loading agents...</div>
        ) : (
          <div className="agents-list">
            {agents.length === 0 ? (
              <div className="empty-state">No agents available</div>
            ) : (
              agents.map((agent, index) => (
                <div key={index} className="agent-item">
                  <div className="agent-name">{agent.name || agent.id}</div>
                  <div className="agent-services">
                    {agent.services?.join(', ') || 'No services'}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
