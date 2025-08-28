// MCP (Model Context Protocol) client implementation
// This is a simplified implementation for external data retrieval

export interface MCPSource {
  name: string;
  url?: string;
  content: string;
}

export interface MCPResponse {
  sources: MCPSource[];
  context: string;
}

class MCPClient {
  private isConnected: boolean = false;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.MCP_SERVER_URL || "http://localhost:8080";
  }

  async connect(): Promise<void> {
    try {
      // Simulate MCP server connection
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        this.isConnected = true;
        console.log("Connected to MCP server successfully");
      } else {
        throw new Error("MCP server health check failed");
      }
    } catch (error) {
      console.error("Failed to connect to MCP server:", error);
      this.isConnected = false;
      // Don't throw error - allow app to work without MCP
    }
  }

  async retrieveContext(query: string): Promise<MCPResponse> {
    if (!this.isConnected) {
      return {
        sources: [],
        context: "",
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/retrieve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          max_results: 5,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP server error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        sources: data.sources || [],
        context: data.context || "",
      };
    } catch (error) {
      console.error("Failed to retrieve context from MCP:", error);
      return {
        sources: [],
        context: "",
      };
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  async searchDocuments(query: string): Promise<MCPSource[]> {
    if (!this.isConnected) {
      return [];
    }

    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          limit: 10,
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP search error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.documents || [];
    } catch (error) {
      console.error("Failed to search documents:", error);
      return [];
    }
  }
}

export const mcpClient = new MCPClient();
