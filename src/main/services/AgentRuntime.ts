import { Web6APIClient } from './Web6APIClient.js';
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
  private web6Client: Web6APIClient;
  private mcpManager: MCPServerManager;

  constructor() {
    this.web6Client = new Web6APIClient();
    this.mcpManager = new MCPServerManager();
  }

  async invokeAgent(
    agentId: string,
    task: string,
    context?: ProjectContext
  ): Promise<AgentResult> {
    try {
      const startTime = Date.now();

      const a2aTask = {
        Message: {
          Role: 'user',
          Parts: [{ Text: task, Type: 'text' }]
        }
      };

      const { taskId, error } = await this.web6Client.a2aTaskSend(a2aTask);
      if (error || !taskId) {
        return { success: false, result: { error: error ?? 'No task ID returned' } };
      }

      const status = await this.web6Client.a2aTaskPoll(taskId, 60000);
      const executionTime = Date.now() - startTime;

      const answer =
        status.Result?.Parts?.map((p: any) => p.Text ?? '').join('') ?? '';

      return {
        success: (status.State ?? '').toLowerCase() === 'completed',
        result: { answer, state: status.State, raw: status },
        executionTime
      };
    } catch (error: any) {
      return { success: false, result: { error: error.message } };
    }
  }
}
