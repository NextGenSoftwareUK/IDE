/**
 * AI Assistant Service
 * Maps natural language to MCP tools and executes them
 */
export class AIAssistant {
  private mcpTools: any[];
  private executeTool: (toolName: string, args: any) => Promise<any>;

  constructor(
    tools: any[],
    executeToolFn: (toolName: string, args: any) => Promise<any>
  ) {
    this.mcpTools = tools;
    this.executeTool = executeToolFn;
  }

  /**
   * Process user message and determine action
   */
  async processMessage(message: string): Promise<{
    response: string;
    toolCalls?: Array<{ tool: string; result: any }>;
    error?: boolean;
  }> {
    const lowerMessage = message.toLowerCase().trim();

    // Check for OASIS tool requests
    const toolMapping = this.mapToTool(message);
    
    if (toolMapping.success && toolMapping.tool) {
      try {
        // Execute the tool
        const result = await this.executeTool(toolMapping.tool, toolMapping.parameters || {});
        
        // Format response
        const response = this.formatToolResponse(toolMapping.tool, result);
        
        return {
          response,
          toolCalls: [{
            tool: toolMapping.tool,
            result: result
          }]
        };
      } catch (error: any) {
        return {
          response: `❌ Error executing ${toolMapping.tool}: ${error.message}`,
          error: true
        };
      }
    }

    // Check for code-related queries
    if (this.isCodeQuery(lowerMessage)) {
      return {
        response: this.handleCodeQuery(message)
      };
    }

    // Check for OASIS codebase queries
    if (this.isCodebaseQuery(lowerMessage)) {
      return {
        response: this.handleCodebaseQuery(message)
      };
    }

    // Default response
    if (toolMapping.suggestions && toolMapping.suggestions.length > 0) {
      return {
        response: `I'm not sure what you mean. Did you want to:\n${toolMapping.suggestions.map(s => `- ${s}`).join('\n')}\n\nOr try: "Create a wallet", "Mint an NFT", "Check OASIS health", etc.`
      };
    }

    return {
      response: `I can help you with:\n- OASIS operations (wallets, NFTs, avatars, etc.)\n- Code generation and editing\n- Agent discovery and invocation\n- OAPP creation\n\nTry: "Create a Solana wallet" or "Check OASIS API health"`
    };
  }

  /**
   * Map natural language to MCP tool
   */
  private mapToTool(message: string): ToolMapping {
    const lowerMessage = message.toLowerCase();

    // Health check
    if (lowerMessage.includes('health') || lowerMessage.includes('status') || lowerMessage.includes('check oasis')) {
      return {
        success: true,
        tool: 'oasis_health_check',
        parameters: {},
        confidence: 0.9
      };
    }

    // Avatar operations
    if (lowerMessage.includes('create avatar') || lowerMessage.includes('register avatar')) {
      const username = this.extractValue(message, 'username');
      const email = this.extractValue(message, 'email');
      
      if (username && email) {
        return {
          success: true,
          tool: 'oasis_register_avatar',
          parameters: {
            username,
            email,
            password: this.generatePassword(),
            acceptTerms: true,
            confirmPassword: this.generatePassword()
          },
          confidence: 0.9
        };
      }
      
      return {
        success: false,
        message: 'I need a username and email to create an avatar. Example: "Create avatar with username testuser and email test@example.com"',
        suggestions: ['Create avatar with username testuser and email test@example.com']
      };
    }

    // Wallet operations
    if (lowerMessage.includes('create wallet') || lowerMessage.includes('wallet')) {
      if (lowerMessage.includes('solana')) {
        const avatarId = this.extractValue(message, 'avatar');
        return {
          success: true,
          tool: 'oasis_create_solana_wallet',
          parameters: {
            avatarId: avatarId || 'default',
            setAsDefault: true
          },
          confidence: 0.8
        };
      }
      if (lowerMessage.includes('ethereum')) {
        const avatarId = this.extractValue(message, 'avatar');
        return {
          success: true,
          tool: 'oasis_create_ethereum_wallet',
          parameters: {
            avatarId: avatarId || 'default',
            setAsDefault: true
          },
          confidence: 0.8
        };
      }
      
      return {
        success: false,
        message: 'Which blockchain? Try: "Create Solana wallet" or "Create Ethereum wallet"',
        suggestions: ['Create Solana wallet', 'Create Ethereum wallet']
      };
    }

    // NFT operations
    if (lowerMessage.includes('mint nft') || lowerMessage.includes('create nft')) {
      const title = this.extractValue(message, 'title') || this.extractValue(message, 'name');
      const description = this.extractValue(message, 'description');
      const imageUrl = this.extractValue(message, 'image') || this.extractUrl(message);
      
      if (title) {
        return {
          success: true,
          tool: 'oasis_mint_nft',
          parameters: {
            Title: title,
            Description: description || `NFT: ${title}`,
            Symbol: title.toUpperCase().replace(/\s/g, '').substring(0, 10),
            ImageUrl: imageUrl || 'https://via.placeholder.com/512',
            JSONMetaDataURL: imageUrl || 'https://jsonplaceholder.typicode.com/posts/1'
          },
          confidence: 0.7
        };
      }
      
      return {
        success: false,
        message: 'I need a title for the NFT. Example: "Mint NFT with title My Art"',
        suggestions: ['Mint NFT with title My Art']
      };
    }

    // Karma operations
    if (lowerMessage.includes('karma')) {
      if (lowerMessage.includes('get') || lowerMessage.includes('check')) {
        const avatarId = this.extractValue(message, 'avatar');
        if (avatarId) {
          return {
            success: true,
            tool: 'oasis_get_karma',
            parameters: { avatarId },
            confidence: 0.8
          };
        }
      }
    }

    // Holon operations
    if (lowerMessage.includes('save holon') || lowerMessage.includes('create holon')) {
      const name = this.extractValue(message, 'name');
      if (name) {
        return {
          success: true,
          tool: 'oasis_save_holon',
          parameters: {
            holon: {
              name,
              description: this.extractValue(message, 'description') || '',
              data: {}
            }
          },
          confidence: 0.7
        };
      }
    }

    // Codebase queries
    if (lowerMessage.includes('codebase') || lowerMessage.includes('code') || lowerMessage.includes('file')) {
      return {
        success: false,
        message: 'I can help you explore the OASIS codebase. What would you like to know?',
        suggestions: [
          'Show me the OASIS API structure',
          'How does MCP integration work?',
          'Where are the agent implementations?'
        ]
      };
    }

    return {
      success: false,
      message: 'I understand you want to use OASIS, but I need more details.',
      suggestions: [
        'Create a Solana wallet',
        'Mint an NFT',
        'Check OASIS health',
        'Create an avatar'
      ]
    };
  }

  /**
   * Extract value from message (e.g., "username testuser" -> "testuser")
   */
  private extractValue(message: string, key: string): string | null {
    const regex = new RegExp(`${key}\\s+([\\w@.-]+)`, 'i');
    const match = message.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Extract URL from message
   */
  private extractUrl(message: string): string | null {
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const match = message.match(urlRegex);
    return match ? match[1] : null;
  }

  /**
   * Generate a random password
   */
  private generatePassword(): string {
    return `pwd_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Format tool response for display
   */
  private formatToolResponse(toolName: string, result: any): string {
    if (result.error) {
      return `❌ Error: ${result.message || 'Unknown error'}`;
    }

    // Handle different result structures
    let data = result;
    if (result.content && Array.isArray(result.content)) {
      // MCP response format
      const textContent = result.content.find((c: any) => c.type === 'text');
      if (textContent) {
        try {
          data = JSON.parse(textContent.text);
        } catch {
          data = { result: textContent.text };
        }
      }
    }

    // Extract meaningful information
    const resultData = data.result || data.data || data;

    // Format based on tool type
    if (toolName === 'oasis_health_check') {
      const status = resultData.status || (resultData.result && resultData.result.status);
      return status === 'healthy' 
        ? '✅ OASIS API is healthy and running!'
        : `⚠️ OASIS API status: ${status || 'unknown'}`;
    }

    if (toolName === 'oasis_create_solana_wallet') {
      const wallet = resultData.result || resultData;
      const address = wallet.walletAddress || wallet.address || wallet.publicKey;
      return address 
        ? `✅ Solana wallet created!\nAddress: ${address}`
        : `✅ Wallet creation initiated. Check the result for details.`;
    }

    if (toolName === 'oasis_create_ethereum_wallet') {
      const wallet = resultData.result || resultData;
      const address = wallet.walletAddress || wallet.address;
      return address
        ? `✅ Ethereum wallet created!\nAddress: ${address}`
        : `✅ Wallet creation initiated.`;
    }

    if (toolName === 'oasis_register_avatar') {
      const avatar = resultData.result || resultData;
      const avatarId = avatar.id || avatar.avatarId;
      return avatarId
        ? `✅ Avatar created!\nID: ${avatarId}\nUsername: ${avatar.username || 'N/A'}`
        : `✅ Avatar registration initiated.`;
    }

    if (toolName === 'oasis_mint_nft') {
      const nft = resultData.result || resultData;
      const mintAddress = nft.mintAddress || nft.mint || nft.id;
      return mintAddress
        ? `✅ NFT minted!\nMint Address: ${mintAddress}\nTitle: ${nft.title || 'N/A'}`
        : `✅ NFT minting initiated.`;
    }

    if (toolName === 'oasis_get_karma') {
      const karma = resultData.result || resultData;
      const score = karma.karma || karma.score || karma;
      return `📊 Karma Score: ${score}`;
    }

    // Generic response
    if (resultData && typeof resultData === 'object') {
      return `✅ Operation completed!\n${JSON.stringify(resultData, null, 2)}`;
    }
    
    return `✅ Operation completed!`;
  }

  /**
   * Check if message is a code query
   */
  private isCodeQuery(message: string): boolean {
    return message.includes('code') || 
           message.includes('function') || 
           message.includes('class') ||
           message.includes('implement');
  }

  /**
   * Handle code queries
   */
  private handleCodeQuery(message: string): string {
    return `I can help you with code! Try:\n- "Generate a function to..."\n- "Create a class for..."\n- "Show me how to..."\n\nCode generation features coming soon!`;
  }

  /**
   * Check if message is about the codebase
   */
  private isCodebaseQuery(message: string): boolean {
    return message.includes('codebase') || 
           message.includes('oasis code') ||
           message.includes('where is') ||
           message.includes('show me');
  }

  /**
   * Handle codebase queries
   */
  private handleCodebaseQuery(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('mcp') || lowerMessage.includes('model context')) {
      return `📁 MCP Integration:\n- Server: /MCP/src/index.ts\n- Tools: /MCP/src/tools/oasisTools.ts\n- Client: /MCP/src/clients/oasisClient.ts\n\nThe MCP server exposes 100+ OASIS tools via Model Context Protocol.`;
    }
    
    if (lowerMessage.includes('agent') || lowerMessage.includes('a2a')) {
      return `🤖 Agent System:\n- A2A Protocol: /SERV/\n- Agent Manager: /OASIS Architecture/.../A2AManager/\n- Agent Registration: /ONODE/.../Controllers/A2AController.cs\n\nAgents use A2A Protocol (JSON-RPC 2.0) for communication.`;
    }
    
    if (lowerMessage.includes('api') || lowerMessage.includes('endpoint')) {
      return `🌐 OASIS API:\n- WEB4 API: /ONODE/NextGenSoftware.OASIS.API.ONODE.WebAPI/\n- STAR API: /Native EndPoint/.../STARAPI.cs\n- Documentation: /Docs/Devs/API Documentation/\n\n500+ endpoints available!`;
    }
    
    return `📚 OASIS Codebase Structure:\n- Core: /OASIS Architecture/\n- MCP: /MCP/\n- Agents: /SERV/\n- APIs: /ONODE/, /Native EndPoint/\n- Documentation: /Docs/\n\nWhat specifically would you like to explore?`;
  }
}

interface ToolMapping {
  success: boolean;
  tool?: string;
  parameters?: any;
  confidence?: number;
  message?: string;
  suggestions?: string[];
}
