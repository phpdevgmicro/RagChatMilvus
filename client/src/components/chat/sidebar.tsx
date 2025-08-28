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
  onClose?: () => void;
  isOpen?: boolean;
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
  onClose,
}: SidebarProps) {
  return (
    <div className="w-80 h-screen bg-card/95 backdrop-blur-sm border-r border-border/50 flex flex-col shadow-xl">
      {/* Header */}
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <i className="fas fa-brain text-primary text-lg"></i>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">AI Assistant</h1>
              <p className="text-xs text-muted-foreground">Smart conversations</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
              data-testid="button-close-sidebar"
            >
              <i className="fas fa-times text-muted-foreground"></i>
            </button>
          )}
        </div>
      </div>

      {/* Connection Status */}
      <div className="p-4 border-b border-border/50">
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <i className="fas fa-wifi text-primary text-xs"></i>
          Status
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-database text-accent text-xs"></i>
              </div>
              <span className="text-sm text-foreground font-medium">Vector Storage</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent status-indicator"></div>
              <span className="text-xs font-medium text-accent">Active</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-brain text-primary text-xs"></i>
              </div>
              <span className="text-sm text-foreground font-medium">AI Engine</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connectionStatus?.openai ? 'bg-accent' : 'bg-destructive'} status-indicator`}></div>
              <span className={`text-xs font-medium ${connectionStatus?.openai ? 'text-accent' : 'text-destructive'}`}>
                {connectionStatus?.openai ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="p-4 border-b border-border/50">
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <i className="fas fa-cog text-primary text-xs"></i>
          Settings
        </h3>
        
        <div className="space-y-4">
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-sm text-foreground font-medium flex items-center gap-2">
                  <i className="fas fa-save text-accent text-xs"></i>
                  Auto-save
                </label>
                <p className="text-xs text-muted-foreground mt-1">Save responses automatically</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  data-testid="toggle-auto-save"
                />
                <div className="w-11 h-6 bg-muted border-2 border-transparent peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-foreground font-medium flex items-center gap-2">
                <i className="fas fa-search text-secondary text-xs"></i>
                Similarity
              </label>
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md font-medium" data-testid="text-similarity-value">
                {similarityThreshold}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
              className="w-full h-2 bg-muted/50 rounded-lg appearance-none cursor-pointer slider"
              data-testid="slider-similarity-threshold"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Less</span>
              <span>More</span>
            </div>
          </div>

          <div>
            <label className="text-sm text-foreground font-medium block mb-2 flex items-center gap-2">
              <i className="fas fa-align-left text-secondary text-xs"></i>
              Context Length
            </label>
            <select
              value={maxContextLength}
              onChange={(e) => setMaxContextLength(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-input border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              data-testid="select-max-context"
            >
              <option value="2048">2,048 tokens</option>
              <option value="4096">4,096 tokens</option>
              <option value="8192">8,192 tokens</option>
              <option value="16384">16,384 tokens</option>
            </select>
          </div>
        </div>
      </div>

      {/* Database Stats */}
      <div className="p-4 flex-1">
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <i className="fas fa-chart-bar text-primary text-xs"></i>
          Memory Stats
        </h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="p-3 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg border border-primary/10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Conversations</span>
                <span className="text-lg font-bold text-primary" data-testid="text-total-responses">
                  {dbStats?.totalResponses || 0}
                </span>
              </div>
            </div>
            
            <div className="p-3 bg-gradient-to-r from-accent/5 to-secondary/5 rounded-lg border border-accent/10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Memory Size</span>
                <span className="text-sm font-semibold text-accent" data-testid="text-collection-size">
                  {dbStats?.collectionSize || "0.0 KB"}
                </span>
              </div>
            </div>
          </div>
          
          <div className="p-3 bg-muted/20 rounded-lg border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <i className="fas fa-server text-accent text-xs"></i>
              <span className="text-xs font-medium text-foreground">Storage Info</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Data persists in PostgreSQL. Last updated: <span className="text-foreground font-medium" data-testid="text-last-updated">{dbStats?.lastUpdated || "Never"}</span>
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <button
            onClick={onClearDatabase}
            disabled={clearingDatabase}
            className="w-full px-4 py-3 text-sm bg-destructive/10 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/20 transition-all duration-200 disabled:opacity-50 button-hover-lift"
            data-testid="button-clear-database"
          >
            <i className="fas fa-trash-alt mr-2"></i>
            {clearingDatabase ? "Clearing..." : "Clear All Data"}
          </button>
        </div>
      </div>
    </div>
  );
}
