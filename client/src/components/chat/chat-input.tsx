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
    <div className="p-6 bg-card border-t border-border">
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="relative">
            <textarea
              ref={textareaRef}
              placeholder="Ask a question about any topic..."
              className="w-full px-4 py-3 pr-12 text-sm bg-input border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] max-h-32"
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
            
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground" data-testid="text-character-count">
              {message.length}/2000
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="quick-save"
                className="w-4 h-4 text-accent bg-input border-border rounded focus:ring-ring focus:ring-2"
                checked={saveToVector || autoSave}
                onChange={(e) => setSaveToVector(e.target.checked)}
                disabled={autoSave}
                data-testid="checkbox-save-response"
              />
              <label htmlFor="quick-save" className="text-xs text-muted-foreground cursor-pointer">
                Save response to vector DB {autoSave && "(Auto-enabled)"}
              </label>
            </div>
            
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <i className="fas fa-bolt text-accent"></i>
              <span>Press Enter to send</span>
            </div>
          </div>
        </div>
        
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || isLoading}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring transition-colors flex items-center gap-2 self-start disabled:opacity-50"
          data-testid="button-send-message"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
              <span className="hidden sm:inline">Sending...</span>
            </>
          ) : (
            <>
              <i className="fas fa-paper-plane text-sm"></i>
              <span className="hidden sm:inline">Send</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
