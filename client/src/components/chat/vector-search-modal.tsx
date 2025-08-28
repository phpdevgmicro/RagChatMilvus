import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";

interface VectorSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  similarityThreshold: number;
  setSimilarityThreshold: (value: number) => void;
}

interface SearchResult {
  id: string;
  query: string;
  response: string;
  sources: string[];
  similarity: number;
  timestamp: string;
}

export function VectorSearchModal({
  isOpen,
  onClose,
  similarityThreshold,
  setSimilarityThreshold,
}: VectorSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const { data: searchResults = [], isLoading, error } = useQuery({
    queryKey: ["/api/search-similar", searchQuery, similarityThreshold],
    enabled: hasSearched && searchQuery.length > 0,
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/search-similar", {
        query: searchQuery,
        threshold: similarityThreshold,
        limit: 10,
      });
      return response.json() as Promise<SearchResult[]>;
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setHasSearched(true);
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setHasSearched(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <i className="fas fa-search text-primary"></i>
            Search Similar Responses
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Find similar responses using vector similarity search
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter your query to find similar responses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              data-testid="input-search-query"
            />
            <Button onClick={handleSearch} disabled={!searchQuery.trim()}>
              Search
            </Button>
          </div>

          <div>
            <Label>Similarity Threshold: {similarityThreshold}</Label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer mt-2"
              data-testid="slider-search-threshold"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0.0</span>
              <span>1.0</span>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-3">
            {isLoading && (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-4 bg-muted rounded-lg space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="text-center py-8">
                <i className="fas fa-exclamation-triangle text-destructive text-2xl mb-2"></i>
                <p className="text-sm text-destructive">
                  Error searching: {(error as Error).message}
                </p>
              </div>
            )}

            {hasSearched && !isLoading && !error && searchResults.length === 0 && (
              <div className="text-center py-8">
                <i className="fas fa-search text-muted-foreground text-2xl mb-2"></i>
                <p className="text-sm text-muted-foreground">
                  No similar responses found. Try adjusting your query or lowering the similarity threshold.
                </p>
              </div>
            )}

            {searchResults.map((result) => (
              <div key={result.id} className="p-4 bg-muted rounded-lg" data-testid={`search-result-${result.id}`}>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    Similarity: {(result.similarity * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatSearchTime(result.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Query:</strong> {result.query}
                </p>
                <p className="text-sm text-foreground">
                  {result.response.length > 200 
                    ? result.response.substring(0, 200) + "..." 
                    : result.response
                  }
                </p>
                {result.sources.length > 0 && (
                  <div className="mt-2 flex items-center gap-1">
                    <i className="fas fa-link text-secondary text-xs"></i>
                    <span className="text-xs text-muted-foreground">
                      {result.sources.length} source{result.sources.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatSearchTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } catch (error) {
    return "Unknown time";
  }
}
