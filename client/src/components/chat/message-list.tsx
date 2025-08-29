import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Bot, User, Copy, Loader2, Check, X } from "lucide-react";

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
  updatingMessageId?: string;
}

export function MessageList({ messages, isLoading, onToggleVectorSave, isUpdating, isTyping, updatingMessageId }: MessageListProps) {
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
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4" data-testid="message-list">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
            <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div className="max-w-md space-y-2">
              <h3 className="text-xl font-semibold">AI Assistant</h3>
              <p className="text-sm text-muted-foreground">
                Start a conversation with RAG-enabled responses.
              </p>
            </div>
          </div>
        )}
      
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 group ${
              message.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarFallback className={message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}>
                {message.role === "user" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </AvatarFallback>
            </Avatar>
            
            <div className={`flex-1 max-w-[75%] ${
              message.role === "user" ? "flex flex-col items-end" : ""
            }`}>
              <Card className={message.role === "user" ? "bg-primary text-primary-foreground" : "bg-card"}>
                <div className="p-3">
                  <div className="text-sm leading-relaxed whitespace-pre-wrap" data-testid={`message-content-${message.id}`}>
                    {message.content}
                  </div>
              
                  {message.role === "assistant" && (
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-border/30">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`save-${message.id}`}
                          checked={message.savedToVector || false}
                          onChange={(e) => onToggleVectorSave(message.id, e.target.checked)}
                          disabled={isUpdating && updatingMessageId === message.id}
                          className="w-3 h-3"
                          data-testid={`checkbox-save-${message.id}`}
                        />
                        <Label htmlFor={`save-${message.id}`} className="text-xs cursor-pointer text-muted-foreground">
                          Save to RAG
                        </Label>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatTime(message.timestamp)}</span>
                    </div>
                  )}
              
                  {message.role === "user" && (
                    <p className="text-xs mt-2 text-primary-foreground/70">
                      {formatTime(message.timestamp)}
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        ))}
      
        {isTyping && (
          <div className="flex gap-3">
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarFallback className="bg-muted">
                <Bot className="h-4 w-4" />
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
