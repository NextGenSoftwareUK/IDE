import React, { useState, useEffect } from 'react';
import './OASISToolsPanel.css';

export const OASISToolsPanel: React.FC = () => {
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTools = async () => {
      try {
        if (window.electronAPI) {
          const toolList = await window.electronAPI.listTools();
          setTools(toolList);
        }
      } catch (error) {
        console.error('Failed to load tools:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTools();
  }, []);

  return (
    <div className="oasis-tools-panel panel">
      <div className="panel-header">OASIS Tools</div>
      <div className="panel-content">
        {loading ? (
          <div className="loading">Loading tools...</div>
        ) : (
          <div className="tools-list">
            {tools.length === 0 ? (
              <div className="empty-state">No tools available</div>
            ) : (
              tools.map((tool, index) => (
                <div key={index} className="tool-item">
                  <div className="tool-name">{tool.name}</div>
                  <div className="tool-description">{tool.description}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
