import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/chat/sidebar";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { VectorSearchModal } from "@/components/chat/vector-search-modal";
import { MemorySuggestion } from "@/components/chat/memory-suggestion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ChatMessage } from "@shared/schema";

interface MemoryDecision {
  action: "auto_save" | "prompt_user" | "skip";
  reason: string;
  confidence: number;
}

interface ChatResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  sources: Array<{ name: string; content: string; url?: string }>;
  memoryDecision?: MemoryDecision;
}

export default function Chat() {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.7);
  const [maxContextLength, setMaxContextLength] = useState(4096);
  const [pendingMemoryDecision, setPendingMemoryDecision] = useState<{
    decision: MemoryDecision;
    messageId: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/messages"],
  });

  // Fetch connection status
  const { data: connectionStatus } = useQuery<{
    milvus: boolean;
    openai: boolean;
  }>({
    queryKey: ["/api/status"],
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Fetch database stats
  const { data: dbStats } = useQuery<{
    totalResponses: number;
    collectionSize: string;
    lastUpdated: string;
  }>({
    queryKey: ["/api/stats"],
    refetchInterval: 60000, // Check every minute
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, saveToVector }: { content: string; saveToVector: boolean }) => {
      const response = await apiRequest("POST", "/api/messages", {
        content,
        saveToVector: saveToVector || autoSave,
      });
      return response.json() as Promise<ChatResponse>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      // Check if we need to show memory suggestion
      if (data.memoryDecision && data.memoryDecision.action === "prompt_user") {
        setPendingMemoryDecision({
          decision: data.memoryDecision,
          messageId: data.assistantMessage.id,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send message: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle vector save mutation
  const toggleVectorSaveMutation = useMutation({
    mutationFn: async ({ messageId, saveToVector }: { messageId: string; saveToVector: boolean }) => {
      const response = await apiRequest("PATCH", `/api/messages/${messageId}/vector-save`, {
        saveToVector,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update message: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Clear database mutation
  const clearDatabaseMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/clear-database");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "Database cleared successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to clear database: " + error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (content: string, saveToVector: boolean) => {
    sendMessageMutation.mutate({ content, saveToVector });
  };

  const handleToggleVectorSave = (messageId: string, saveToVector: boolean) => {
    toggleVectorSaveMutation.mutate({ messageId, saveToVector });
  };

  const handleMemoryDecision = (save: boolean) => {
    if (pendingMemoryDecision) {
      toggleVectorSaveMutation.mutate({ 
        messageId: pendingMemoryDecision.messageId, 
        saveToVector: save 
      });
      setPendingMemoryDecision(null);
    }
  };

  const handleClearDatabase = () => {
    if (window.confirm("Are you sure you want to clear the entire database? This action cannot be undone.")) {
      clearDatabaseMutation.mutate();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        connectionStatus={connectionStatus}
        dbStats={dbStats}
        autoSave={autoSave}
        setAutoSave={setAutoSave}
        similarityThreshold={similarityThreshold}
        setSimilarityThreshold={setSimilarityThreshold}
        maxContextLength={maxContextLength}
        setMaxContextLength={setMaxContextLength}
        onClearDatabase={handleClearDatabase}
        clearingDatabase={clearDatabaseMutation.isPending}
        onSearchSimilar={() => setIsSearchModalOpen(true)}
      />
      
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-4 bg-card border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Knowledge Chat</h2>
              <p className="text-sm text-muted-foreground">Ask questions and get AI-powered responses with context</p>
            </div>
            
            <button
              className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors flex items-center gap-2"
              onClick={() => setIsSearchModalOpen(true)}
              data-testid="button-search-similar"
            >
              <i className="fas fa-search"></i>
              Search Similar
            </button>
          </div>
        </div>

        <MessageList
          messages={messages}
          isLoading={messagesLoading}
          onToggleVectorSave={handleToggleVectorSave}
          isUpdating={toggleVectorSaveMutation.isPending}
        />
        
        {pendingMemoryDecision && (
          <div className="px-6">
            <MemorySuggestion
              memoryDecision={pendingMemoryDecision.decision}
              onDecision={handleMemoryDecision}
              isLoading={toggleVectorSaveMutation.isPending}
            />
          </div>
        )}
        
        <div ref={messagesEndRef} />

        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={sendMessageMutation.isPending}
          autoSave={autoSave}
        />
      </div>

      <VectorSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        similarityThreshold={similarityThreshold}
        setSimilarityThreshold={setSimilarityThreshold}
      />
    </div>
  );
}
