import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Bot, User, Copy } from "lucide-react";

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  sources?: string[];
  savedToVector?: boolean;
}

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onToggleVectorSave: (messageId: string, saveToVector: boolean) => void;
  isUpdating: boolean;
  isTyping: boolean;
}

export function MessageList({ messages, isLoading, onToggleVectorSave, isUpdating, isTyping }: MessageListProps) {
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
    <div className="flex-1 overflow-y-auto" data-testid="message-list">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-8">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] sm:min-h-[60vh] text-center space-y-4 sm:space-y-6 px-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center">
              <Bot className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            </div>
            <div className="max-w-sm sm:max-w-md space-y-2 sm:space-y-3">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground">Welcome to AI Assistant</h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Start a conversation and I'll provide intelligent, contextual responses. Use the settings to customize your experience.
              </p>
            </div>
          </div>
        )}
      
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-4 group ${
              message.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            <Avatar className="w-9 h-9 shrink-0">
              <AvatarFallback className={message.role === "user" ? "bg-primary/15 border border-primary/20" : "bg-muted border border-border"}>
                {message.role === "user" ? (
                  <User className="h-4 w-4 text-primary" />
                ) : (
                  <Bot className="h-4 w-4 text-muted-foreground" />
                )}
              </AvatarFallback>
            </Avatar>
            
            <div className={`flex-1 max-w-[80%] space-y-2 ${
              message.role === "user" ? "flex flex-col items-end" : ""
            }`}>
              <Card className={`${
                message.role === "user" 
                  ? "bg-primary text-primary-foreground shadow-sm border-primary/20" 
                  : "bg-card border border-border/50 shadow-sm"
              }`}>
                <div className="p-4">
                  <div className="text-sm leading-relaxed whitespace-pre-wrap" data-testid={`message-content-${message.id}`}>
                    {message.content}
                  </div>
              
                  {message.role === "assistant" && (
                    <div className="space-y-3 pt-3 mt-3 border-t border-border/30">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`save-${message.id}`}
                          checked={message.savedToVector || false}
                          onChange={(e) => onToggleVectorSave(message.id, e.target.checked)}
                          disabled={isUpdating}
                          className="w-3 h-3 text-primary bg-transparent border border-input rounded-sm focus:ring-1 focus:ring-primary"
                          data-testid={`checkbox-save-${message.id}`}
                        />
                        <Label htmlFor={`save-${message.id}`} className="text-xs cursor-pointer text-muted-foreground">
                          Save to vector database
                        </Label>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground/70">
                          {formatTime(message.timestamp)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(message.content)}
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`button-copy-${message.id}`}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
              
                  {message.role === "user" && (
                    <p className="text-xs mt-2 opacity-70">
                      {formatTime(message.timestamp)}
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        ))}
      
        {isTyping && (
          <div className="flex gap-4">
            <Avatar className="w-9 h-9 shrink-0">
              <AvatarFallback className="bg-muted border border-border">
                <Bot className="h-4 w-4 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 max-w-[80%]">
              <Card className="bg-card border border-border/50 shadow-sm">
                <div className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"></div>
                    </div>
                    <span className="text-sm text-muted-foreground">AI is thinking...</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
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
