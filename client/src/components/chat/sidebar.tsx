interface SidebarProps {
  connectionStatus?: {
    milvus: boolean;
    openai: boolean;
  };
  dbStats?: {
    totalResponses: number;
    collectionSize: string;
    lastUpdated: string;
  };
  autoSave: boolean;
  setAutoSave: (value: boolean) => void;
  similarityThreshold: number;
  setSimilarityThreshold: (value: number) => void;
  maxContextLength: number;
  setMaxContextLength: (value: number) => void;
  onClearDatabase: () => void;
  clearingDatabase: boolean;
  onSearchSimilar: () => void;
}

export function Sidebar({
  connectionStatus,
  dbStats,
  autoSave,
  setAutoSave,
  similarityThreshold,
  setSimilarityThreshold,
  maxContextLength,
  setMaxContextLength,
  onClearDatabase,
  clearingDatabase,
}: SidebarProps) {
  return (
    <div className="w-80 bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <i className="fas fa-robot text-primary"></i>
          RAG Chatbot
        </h1>
        <p className="text-sm text-muted-foreground mt-1">AI Knowledge Assistant</p>
      </div>

      {/* Connection Status */}
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">Connection Status</h3>
        
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <i className="fas fa-database text-secondary text-sm"></i>
            <span className="text-sm text-foreground">Milvus Vector DB</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${connectionStatus?.milvus ? 'bg-accent' : 'bg-destructive'} status-indicator`}></div>
            <span className={`text-xs font-medium ${connectionStatus?.milvus ? 'text-accent' : 'text-destructive'}`}>
              {connectionStatus?.milvus ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>


        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fas fa-brain text-secondary text-sm"></i>
            <span className="text-sm text-foreground">OpenAI API</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${connectionStatus?.openai ? 'bg-accent' : 'bg-destructive'} status-indicator`}></div>
            <span className={`text-xs font-medium ${connectionStatus?.openai ? 'text-accent' : 'text-destructive'}`}>
              {connectionStatus?.openai ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">Settings</h3>
        
        <div className="flex items-center justify-between mb-3">
          <div>
            <label className="text-sm text-foreground font-medium">Auto-save Responses</label>
            <p className="text-xs text-muted-foreground">Automatically save all responses to vector DB</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              data-testid="toggle-auto-save"
            />
            <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
          </label>
        </div>

        <div className="mb-3">
          <label className="text-sm text-foreground font-medium block mb-2">Similarity Threshold</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={similarityThreshold}
            onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
            data-testid="slider-similarity-threshold"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0.0</span>
            <span data-testid="text-similarity-value">{similarityThreshold}</span>
            <span>1.0</span>
          </div>
        </div>

        <div className="mb-3">
          <label className="text-sm text-foreground font-medium block mb-2">Max Context Length</label>
          <select
            value={maxContextLength}
            onChange={(e) => setMaxContextLength(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="select-max-context"
          >
            <option value="2048">2,048 tokens</option>
            <option value="4096">4,096 tokens</option>
            <option value="8192">8,192 tokens</option>
            <option value="16384">16,384 tokens</option>
          </select>
        </div>
      </div>

      {/* Database Stats */}
      <div className="p-4 flex-1">
        <h3 className="text-sm font-medium text-foreground mb-3">Vector Database</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total Responses</span>
            <span className="text-sm font-medium text-foreground" data-testid="text-total-responses">
              {dbStats?.totalResponses || 0}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Collection Size</span>
            <span className="text-sm font-medium text-foreground" data-testid="text-collection-size">
              {dbStats?.collectionSize || "Unknown"}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Last Updated</span>
            <span className="text-sm font-medium text-foreground" data-testid="text-last-updated">
              {dbStats?.lastUpdated || "Never"}
            </span>
          </div>
        </div>

        <button
          onClick={onClearDatabase}
          disabled={clearingDatabase}
          className="w-full mt-4 px-3 py-2 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50"
          data-testid="button-clear-database"
        >
          <i className="fas fa-trash-alt mr-2"></i>
          {clearingDatabase ? "Clearing..." : "Clear Database"}
        </button>
      </div>
    </div>
  );
}
