import { useState, useRef, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!message.trim() || isLoading) return;
    
    onSendMessage(message.trim());
    setMessage("");
    
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + "px";
    }
  };

  return (
    <div className="p-3 sm:p-4 bg-background/95 backdrop-blur-xl border-t border-border/30 shadow-xl">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card/90 backdrop-blur-sm rounded-2xl border border-border/30 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
          <div className="flex gap-3 p-3 sm:p-4">
            <div className="flex-1">
              <Textarea
                ref={textareaRef}
                placeholder="Type your message here... Press Enter to send, Shift+Enter for new line"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  handleInput();
                }}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="min-h-[48px] sm:min-h-[52px] max-h-32 resize-none border-0 focus:ring-0 focus-visible:ring-0 bg-transparent p-2 text-sm sm:text-base placeholder:text-muted-foreground/70 font-medium"
                data-testid="textarea-message-input"
              />
            </div>
            
            <Button
              onClick={handleSubmit}
              disabled={!message.trim() || isLoading}
              size="sm"
              className="shrink-0 h-10 w-10 sm:h-12 sm:w-12 p-0 rounded-xl bg-gradient-to-br from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
              data-testid="button-send-message"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-2 border-primary-foreground/30 border-t-primary-foreground" />
              ) : (
                <Send className="h-3 w-3 sm:h-4 sm:w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
