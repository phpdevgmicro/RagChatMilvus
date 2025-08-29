import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, MessageSquare, Search, Menu, Trash2 } from "lucide-react";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
// Define ChatMessage interface locally since we removed shared schema
interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  sources?: string[];
  savedToVector?: boolean;
}

interface ChatResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  sources: Array<{ name: string; content: string; url?: string }>;
}

export default function Chat() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [temperature, setTemperature] = useState<number | undefined>(undefined);
  const [model, setModel] = useState<string>("");
  const [maxTokens, setMaxTokens] = useState<number | undefined>(undefined);
  const [isTyping, setIsTyping] = useState(false);
  const [updatingMessageId, setUpdatingMessageId] = useState<string>();
  
  // Prompt settings state
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPromptTemplate, setUserPromptTemplate] = useState("");
  const [userPromptNoContext, setUserPromptNoContext] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/messages"],
  });

  // Fetch connection status
  const { data: connectionStatus } = useQuery<{
    qdrant: boolean;
    openai: boolean;
  }>({
    queryKey: ["/api/status"],
    refetchInterval: 30000,
  });

  // Fetch all settings (prompts + model configuration)
  const { data: allSettings } = useQuery<{
    systemPrompt: string;
    userPromptTemplate: string;
    userPromptNoContext: string;
    model: string;
    temperature: number;
    maxTokens: number;
  }>({
    queryKey: ["/api/settings"],
  });

  // Update local state when settings are fetched from database
  useEffect(() => {
    if (allSettings) {
      setSystemPrompt(allSettings.systemPrompt);
      setUserPromptTemplate(allSettings.userPromptTemplate);
      setUserPromptNoContext(allSettings.userPromptNoContext);
      setModel(allSettings.model);
      setTemperature(allSettings.temperature);
      setMaxTokens(allSettings.maxTokens);
    }
  }, [allSettings]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, saveToVector }: { content: string; saveToVector?: boolean }) => {
      // Instantly add user message to local state
      const userMessage: ChatMessage = {
        id: Date.now().toString(), // Temporary ID
        content,
        role: "user",
        timestamp: new Date(),
        sources: [],
      };

      // Optimistically update the query cache
      queryClient.setQueryData<ChatMessage[]>(["/api/messages"], (oldMessages = []) => [
        ...oldMessages,
        userMessage,
      ]);

      setIsTyping(true);

      // Scroll to bottom immediately when starting to type
      setTimeout(scrollToBottom, 50);

      // Only send message if settings are loaded from database
      if (!model || temperature === undefined || maxTokens === undefined) {
        throw new Error("Settings not loaded from database. Please wait for configuration to load.");
      }
      
      const response = await apiRequest("POST", "/api/messages", {
        content,
        temperature,
        model,
        maxTokens,
        saveToVector: saveToVector,
      });
      return response.json() as Promise<ChatResponse>;
    },
    onSuccess: () => {
      setIsTyping(false);
      // Refresh to get the actual server data with proper IDs
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      // Ensure scroll after response is received
      setTimeout(() => {
        scrollToBottom();
      }, 300);
    },
    onError: (error) => {
      setIsTyping(false);
      // Remove the optimistic update on error
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });

      let errorMessage = "An unexpected error occurred";
      if (error.message.includes('401')) {
        errorMessage = "Authentication failed. Please check your API key.";
      } else if (error.message.includes('429')) {
        errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
      } else if (error.message.includes('503')) {
        errorMessage = "AI service is temporarily unavailable. Please try again later.";
      } else if (error.message.includes('network')) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "⚠️ Message Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 6000,
      });
    },
  });


  // Toggle vector save mutation
  const toggleVectorSaveMutation = useMutation({
    mutationFn: async ({ messageId, saveToVector }: { messageId: string; saveToVector: boolean }) => {
      setUpdatingMessageId(messageId);
      const response = await apiRequest("PATCH", `/api/messages/${messageId}/vector-save`, {
        saveToVector,
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      setUpdatingMessageId(undefined);
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      toast({
        title: variables.saveToVector ? "✓ Saved Successfully" : "✓ Removed Successfully",
        description: variables.saveToVector ? 
          "Response saved to vector database for future reference" : 
          "Response removed from vector database",
        variant: "default",
        duration: 3000,
      });
    },
    onError: (error, variables) => {
      setUpdatingMessageId(undefined);
      toast({
        title: "⚠️ Update Failed",
        description: `Failed to ${variables.saveToVector ? 'save to' : 'remove from'} vector database. Please try again.`,
        variant: "destructive",
        duration: 4000,
      });
    },
  });

  // Update prompt settings mutation
  const updatePromptsMutation = useMutation({
    mutationFn: async (settings: {
      systemPrompt: string;
      userPromptTemplate: string;
      userPromptNoContext: string;
      model: string;
      temperature: number;
      maxTokens: number;
    }) => {
      const response = await apiRequest("PUT", "/api/settings", settings);
      return response.json();
    },
    onSuccess: () => {
      // Auto-close the settings dialog
      setIsSettingsOpen(false);
      
      // Invalidate queries to refresh data from database
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      
      toast({
        title: "✓ Settings Updated",
        description: "All settings have been saved successfully",
        variant: "default",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      console.error("Settings update error:", error);
      
      let errorMessage = "Failed to update settings. Please try again.";
      if (error.message) {
        if (error.message.includes('network')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes('401')) {
          errorMessage = "Authentication failed. Please refresh the page.";
        } else if (error.message.includes('500')) {
          errorMessage = "Server error. Please try again in a moment.";
        }
      }
      
      toast({
        title: "⚠️ Settings Update Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const handleSendMessage = (content: string) => {
    sendMessageMutation.mutate({
      content,
      saveToVector: false,
    });
  };

  const handleClearChat = async () => {
    try {
      // Call the server API to clear messages
      await apiRequest("DELETE", "/api/clear-database");
      
      // Then clear the local cache
      queryClient.setQueryData<ChatMessage[]>(["/api/messages"], []);
      
      toast({
        title: "✓ Chat Cleared",
        description: "All messages have been deleted successfully",
        variant: "default",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "⚠️ Clear Failed",
        description: "Failed to clear chat. Please try again.",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  const handleToggleVectorSave = (messageId: string, saveToVector: boolean) => {
    toggleVectorSaveMutation.mutate({ messageId, saveToVector });
  };

  const handleUpdatePrompts = () => {
    // Only update if all settings are loaded from database
    if (!model || temperature === undefined || maxTokens === undefined) {
      toast({
        title: "⚠️ Settings Not Loaded",
        description: "Please wait for settings to load from database before updating.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    
    updatePromptsMutation.mutate({
      systemPrompt,
      userPromptTemplate,
      userPromptNoContext,
      model,
      temperature,
      maxTokens,
    });
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 300);
    return () => clearTimeout(timer);
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  // Scroll when typing state changes
  useEffect(() => {
    if (isTyping) {
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isTyping]);

  return (
    <div className="flex h-screen bg-background">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">AI Assistant</h1>
                <p className="text-xs text-muted-foreground">RAG-enabled chat</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus?.openai ? "bg-green-500" : "bg-red-500"
              }`} />
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearChat}
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </Button>

              <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" data-testid="button-open-settings">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-semibold">Settings</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Model Configuration</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="model-select" className="text-sm">Model</Label>
                          <Select value={model} onValueChange={setModel}>
                            <SelectTrigger id="model-select" data-testid="select-model">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gpt-5">GPT-5</SelectItem>
                              <SelectItem value="gpt-5-mini">GPT-5 Mini</SelectItem>
                              <SelectItem value="gpt-5-nano">GPT-5 Nano</SelectItem>
                              <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                              <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                              <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                              <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label htmlFor="temperature-slider" className="text-sm">Temperature</Label>
                            <span className="text-sm font-mono">{temperature?.toFixed(1) || "0.0"}</span>
                          </div>
                          <Slider
                            id="temperature-slider"
                            min={0}
                            max={2}
                            step={0.1}
                            value={[temperature || 0]}
                            onValueChange={(value) => setTemperature(value[0])}
                            className="w-full"
                            data-testid="slider-temperature"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="max-tokens-select" className="text-sm">Max Tokens</Label>
                          <Select value={maxTokens?.toString() || ""} onValueChange={(value) => setMaxTokens(Number(value))}>
                            <SelectTrigger id="max-tokens-select" data-testid="select-max-tokens">
                              <SelectValue placeholder="Select max tokens" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1024">1,024 tokens</SelectItem>
                              <SelectItem value="2048">2,048 tokens</SelectItem>
                              <SelectItem value="4096">4,096 tokens</SelectItem>
                              <SelectItem value="8192">8,192 tokens</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Prompt Settings</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="system-prompt" className="text-sm">System Prompt</Label>
                          <Textarea
                            id="system-prompt"
                            placeholder="You are a helpful AI assistant..."
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            className="min-h-[60px] resize-none"
                            data-testid="textarea-system-prompt"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="user-prompt-template" className="text-sm">User Prompt (with context)</Label>
                          <Textarea
                            id="user-prompt-template"
                            placeholder="Context: {context}&#10;&#10;User Question: {query}&#10;&#10;Please provide a comprehensive answer."
                            value={userPromptTemplate}
                            onChange={(e) => setUserPromptTemplate(e.target.value)}
                            className="min-h-[80px] resize-none"
                            data-testid="textarea-user-prompt-template"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="user-prompt-no-context" className="text-sm">User Prompt (no context)</Label>
                          <Textarea
                            id="user-prompt-no-context"
                            placeholder="User Question: {query}&#10;&#10;Please provide a helpful answer."
                            value={userPromptNoContext}
                            onChange={(e) => setUserPromptNoContext(e.target.value)}
                            className="min-h-[60px] resize-none"
                            data-testid="textarea-user-prompt-no-context"
                          />
                        </div>

                        <Button
                          onClick={handleUpdatePrompts}
                          disabled={updatePromptsMutation.isPending}
                          className="w-full"
                          data-testid="button-update-settings"
                        >
                          {updatePromptsMutation.isPending ? "Saving..." : "Save Settings"}
                        </Button>
                      </CardContent>
                    </Card>

                  </div>
                </DialogContent>
              </Dialog>

              <ThemeToggle />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <MessageList
            messages={messages}
            isLoading={messagesLoading}
            onToggleVectorSave={handleToggleVectorSave}
            isUpdating={toggleVectorSaveMutation.isPending}
            isTyping={isTyping}
            updatingMessageId={updatingMessageId}
          />
          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={sendMessageMutation.isPending}
        />
      </div>
    </div>
  );
}