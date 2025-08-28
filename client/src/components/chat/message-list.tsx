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
    <div className="flex-1 overflow-y-auto p-6 space-y-4" data-testid="message-list">
      {messages.length === 0 && (
        <div className="flex items-start gap-3 chat-message">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <i className="fas fa-robot text-primary-foreground text-sm"></i>
          </div>
          <div className="flex-1">
            <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
              <p className="text-sm text-foreground">
                Welcome! I'm your RAG-powered AI assistant. I can answer questions using external knowledge sources and save responses to the vector database for future reference. Ask me anything!
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">System • Just now</p>
          </div>
        </div>
      )}
      
      {messages.map((message, index) => (
        <div
          key={message.id}
          className={`flex items-start gap-3 chat-message ${
            message.role === "user" ? "justify-end" : ""
          }`}
        >
          {message.role === "user" ? (
            <>
              <div className="flex-1 max-w-2xl">
                <div className="bg-primary text-primary-foreground rounded-lg p-4 shadow-sm ml-auto">
                  <p className="text-sm" data-testid={`message-content-${message.id}`}>{message.content}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  You • {formatTime(message.timestamp)}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <i className="fas fa-user text-muted-foreground text-sm"></i>
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                <i className="fas fa-robot text-accent-foreground text-sm"></i>
              </div>
              <div className="flex-1">
                <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                  <div className="text-sm text-foreground mb-3 whitespace-pre-wrap" data-testid={`message-content-${message.id}`}>
                    {message.content}
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`save-response-${message.id}`}
                          className="w-4 h-4 text-accent bg-input border-border rounded focus:ring-ring focus:ring-2"
                          checked={message.savedToVector || false}
                          onChange={(e) => onToggleVectorSave(message.id, e.target.checked)}
                          disabled={isUpdating}
                          data-testid={`checkbox-save-${message.id}`}
                        />
                        <label
                          htmlFor={`save-response-${message.id}`}
                          className="text-xs text-muted-foreground cursor-pointer"
                        >
                          Save to Vector DB
                        </label>
                      </div>
                      
                      {message.sources && message.sources.length > 0 && (
                        <div className="flex items-center gap-1">
                          <i className="fas fa-link text-secondary text-xs"></i>
                          <span className="text-xs text-muted-foreground">
                            {message.sources.length} source{message.sources.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(message.content)}
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                        data-testid={`button-copy-${message.id}`}
                      >
                        <i className="fas fa-copy text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  AI Assistant • {formatTime(message.timestamp)} • 
                  {message.sources && message.sources.length > 0 
                    ? " Retrieved from external sources" 
                    : " Generated response"
                  }
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
