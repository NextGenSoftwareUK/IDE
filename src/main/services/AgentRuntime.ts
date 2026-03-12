import { OASISAPIClient } from './OASISAPIClient.js';
import { MCPServerManager } from './MCPServerManager.js';

interface ProjectContext {
  projectName?: string;
  openFiles?: string[];
  workspaceRoot?: string;
}

interface AgentResult {
  success: boolean;
  result: any;
  toolCalls?: any[];
  executionTime?: number;
}

export class AgentRuntime {
  private oasisClient: OASISAPIClient;
  private mcpManager: MCPServerManager;

  constructor() {
    this.oasisClient = new OASISAPIClient();
    this.mcpManager = new MCPServerManager();
  }

  async invokeAgent(
    agentId: string,
    task: string,
    context?: ProjectContext
  ): Promise<AgentResult> {
    try {
      // Get agent card
      const agentCard = await this.oasisClient.getAgentCard(agentId);

      // Determine service from task
      const service = this.determineService(task);

      // Prepare request
      const request = {
        jsonrpc: '2.0',
        method: 'service_request',
        params: {
          service: service,
          task: task,
          context: {
            ...context,
            mcpTools: await this.mcpManager.listTools(),
            timestamp: Date.now()
          }
        },
        id: this.generateId()
      };

      // Send A2A request
      const startTime = Date.now();
      const response = await this.oasisClient.sendA2AMessage(agentId, request);
      const executionTime = Date.now() - startTime;

      return {
        success: response.success !== false,
        result: response.result || response,
        toolCalls: response.toolCalls || [],
        executionTime
      };
    } catch (error: any) {
      return {
        success: false,
        result: { error: error.message }
      };
    }
  }

  private determineService(task: string): string {
    const lowerTask = task.toLowerCase();
    
    if (lowerTask.includes('mint nft') || lowerTask.includes('nft')) {
      return 'nft-minting';
    }
    if (lowerTask.includes('generate code') || lowerTask.includes('code')) {
      return 'code-generation';
    }
    if (lowerTask.includes('analyze') || lowerTask.includes('data')) {
      return 'data-analysis';
    }
    if (lowerTask.includes('wallet') || lowerTask.includes('transaction')) {
      return 'wallet-operations';
    }
    
    return 'general';
  }

  private generateId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
