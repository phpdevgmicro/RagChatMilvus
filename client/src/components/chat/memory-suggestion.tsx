import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface MemoryDecision {
  action: "auto_save" | "prompt_user" | "skip";
  reason: string;
  confidence: number;
}

interface MemorySuggestionProps {
  memoryDecision: MemoryDecision;
  onDecision: (save: boolean) => void;
  isLoading: boolean;
}

export function MemorySuggestion({ memoryDecision, onDecision, isLoading }: MemorySuggestionProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || memoryDecision.action !== "prompt_user") {
    return null;
  }

  const handleSave = () => {
    onDecision(true);
    setDismissed(true);
  };

  const handleSkip = () => {
    onDecision(false);
    setDismissed(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <Card className="border-l-4 border-l-accent bg-accent/5 my-3">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
            <i className="fas fa-brain text-accent text-sm"></i>
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-sm font-medium text-foreground">Memory Suggestion</h4>
              <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                {Math.round(memoryDecision.confidence * 100)}% confidence
              </span>
            </div>
            
            <p className="text-sm text-muted-foreground mb-3">
              {memoryDecision.reason}
            </p>
            
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isLoading}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                data-testid="button-save-to-memory"
              >
                <i className="fas fa-save text-xs mr-1"></i>
                Save to Memory
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={handleSkip}
                disabled={isLoading}
                data-testid="button-skip-memory"
              >
                <i className="fas fa-times text-xs mr-1"></i>
                Don't Save
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="text-muted-foreground"
                data-testid="button-dismiss-suggestion"
              >
                <i className="fas fa-eye-slash text-xs"></i>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}