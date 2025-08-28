import { Skeleton } from "@/components/ui/skeleton";
import type { ChatMessage } from "@shared/schema";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onToggleVectorSave: (messageId: string, saveToVector: boolean) => void;
  isUpdating: boolean;
}

export function MessageList({ messages, isLoading, onToggleVectorSave, isUpdating }: MessageListProps) {
  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-6 space-y-6" data-testid="message-list">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-6 chat-message">
          <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl flex items-center justify-center">
            <i className="fas fa-robot text-primary text-2xl"></i>
          </div>
          <div className="max-w-md space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Welcome to AI Assistant</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              I'm here to help with intelligent conversations backed by knowledge retrieval. Ask me anything and I'll provide thoughtful responses with context from external sources.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              <span className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full">Knowledge Retrieval</span>
              <span className="px-3 py-1 bg-accent/10 text-accent text-xs rounded-full">Memory Storage</span>
              <span className="px-3 py-1 bg-secondary/10 text-secondary text-xs rounded-full">AI Powered</span>
            </div>
          </div>
        </div>
      )}
      
      {messages.map((message, index) => (
        <div
          key={message.id}
          className={`flex items-start gap-4 chat-message ${
            message.role === "user" ? "flex-row-reverse" : ""
          }`}
        >
          {message.role === "user" ? (
            <>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-user text-primary text-sm"></i>
              </div>
              <div className="flex-1 max-w-2xl">
                <div className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-2xl rounded-tr-md p-4 shadow-lg ml-auto">
                  <p className="text-sm leading-relaxed" data-testid={`message-content-${message.id}`}>{message.content}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-right flex items-center justify-end gap-1">
                  <i className="fas fa-user text-xs"></i>
                  You • {formatTime(message.timestamp)}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-robot text-accent text-sm"></i>
              </div>
              <div className="flex-1">
                <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl rounded-tl-md p-4 shadow-lg">
                  <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap mb-4" data-testid={`message-content-${message.id}`}>
                    {message.content}
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-border/30">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          id={`save-response-${message.id}`}
                          className="w-4 h-4 text-accent bg-transparent border-2 border-muted-foreground rounded focus:ring-accent focus:ring-2 transition-all"
                          checked={message.savedToVector || false}
                          onChange={(e) => onToggleVectorSave(message.id, e.target.checked)}
                          disabled={isUpdating}
                          data-testid={`checkbox-save-${message.id}`}
                        />
                        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                          Save to memory
                        </span>
                      </label>
                      
                      {message.sources && message.sources.length > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-secondary/10 rounded-md">
                          <i className="fas fa-link text-secondary text-xs"></i>
                          <span className="text-xs text-secondary font-medium">
                            {message.sources.length} source{message.sources.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => navigator.clipboard.writeText(message.content)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all button-hover-lift"
                      data-testid={`button-copy-${message.id}`}
                      title="Copy message"
                    >
                      <i className="fas fa-copy text-xs"></i>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                  <i className="fas fa-robot text-xs"></i>
                  <span>AI Assistant • {formatTime(message.timestamp)}</span>
                  {message.sources && message.sources.length > 0 && (
                    <span className="flex items-center gap-1">
                      <span>•</span>
                      <i className="fas fa-brain text-xs"></i>
                      <span>With knowledge retrieval</span>
                    </span>
                  )}
                </p>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function formatTime(timestamp: Date | null | undefined): string {
  if (!timestamp) return "Unknown time";
  
  const now = new Date();
  const diff = now.getTime() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
