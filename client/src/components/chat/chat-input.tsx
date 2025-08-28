import { useState, useRef, KeyboardEvent } from "react";

interface ChatInputProps {
  onSendMessage: (content: string, saveToVector: boolean) => void;
  isLoading: boolean;
  autoSave: boolean;
}

export function ChatInput({ onSendMessage, isLoading, autoSave }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [saveToVector, setSaveToVector] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!message.trim() || isLoading) return;
    
    onSendMessage(message.trim(), saveToVector);
    setMessage("");
    
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
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
    <div className="p-4 lg:p-6 bg-card/50 backdrop-blur-sm border-t border-border/50">
      <div className="max-w-4xl mx-auto">
        <div className="flex gap-3">
          <div className="flex-1">
            <div className="relative">
              <textarea
                ref={textareaRef}
                placeholder="Ask me anything... I'll help with intelligent responses and knowledge lookup."
                className="w-full px-4 py-3 pr-16 text-sm bg-background/80 border border-border/50 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 min-h-[52px] max-h-32 transition-all shadow-sm"
                rows={1}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  handleInput();
                }}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                data-testid="textarea-message-input"
              />
              
              <div className="absolute bottom-2 right-3 text-xs text-muted-foreground/70" data-testid="text-character-count">
                {message.length}/2000
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    id="quick-save"
                    className="w-4 h-4 text-accent bg-transparent border-2 border-muted-foreground rounded focus:ring-accent focus:ring-2 transition-all"
                    checked={saveToVector || autoSave}
                    onChange={(e) => setSaveToVector(e.target.checked)}
                    disabled={autoSave}
                    data-testid="checkbox-save-response"
                  />
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    Save to memory {autoSave && "(Auto)"}
                  </span>
                </label>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <i className="fas fa-keyboard text-xs"></i>
                  <span className="hidden sm:inline">Enter to send</span>
                </div>
                <span className="text-muted-foreground/50">•</span>
                <div className="flex items-center gap-1">
                  <i className="fas fa-plus text-xs"></i>
                  <span className="hidden sm:inline">Shift+Enter for new line</span>
                </div>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || isLoading}
            className="px-6 py-3 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200 flex items-center gap-2 self-start disabled:opacity-50 disabled:cursor-not-allowed button-hover-lift min-h-[52px]"
            data-testid="button-send-message"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground"></div>
                <span className="hidden sm:inline font-medium">Thinking...</span>
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane text-sm"></i>
                <span className="hidden sm:inline font-medium">Send</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
