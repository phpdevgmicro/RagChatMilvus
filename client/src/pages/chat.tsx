import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, MessageSquare, Search, Menu, Trash2 } from "lucide-react";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  const [temperature, setTemperature] = useState(0.5);
  const [model, setModel] = useState("gpt-4.1-mini");
  const [maxTokens, setMaxTokens] = useState(2048);
  const [isTyping, setIsTyping] = useState(false);
  const [updatingMessageId, setUpdatingMessageId] = useState<string>();
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

  const handleSendMessage = (content: string) => {
    sendMessageMutation.mutate({
      content,
      saveToVector: false,
    });
  };

  const handleClearChat = () => {
    queryClient.setQueryData<ChatMessage[]>(["/api/messages"], []);
  };

  const handleToggleVectorSave = (messageId: string, saveToVector: boolean) => {
    toggleVectorSaveMutation.mutate({ messageId, saveToVector });
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  // Scroll when typing state changes
  useEffect(() => {
    if (isTyping) {
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isTyping]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-background/95 to-muted/10 safe-area-inset">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-background/95 to-background/90 backdrop-blur-xl border-b border-border/30 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-2xl flex items-center justify-center shadow-lg ring-2 ring-primary/20">
                <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent truncate">AI Assistant</h1>
                <p className="text-sm text-muted-foreground/80 hidden sm:block font-medium">Intelligent conversations with vector memory</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus?.openai ? "bg-green-500" : "bg-red-500"
                }`} />
                <Badge variant={connectionStatus?.openai ? "outline" : "destructive"} className="text-xs hidden sm:inline-flex">
                  {connectionStatus?.openai ? "AI Online" : "Offline"}
                </Badge>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClearChat}
                className="shrink-0"
                title="Clear chat session"
              >
                <Trash2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Clear</span>
              </Button>

              <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-open-settings" className="shrink-0">
                    <Settings className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Settings</span>
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:w-80 sm:max-w-80">
                  <div className="space-y-4 sm:space-y-6 py-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-3 sm:mb-4">Chat Settings</h3>
                    </div>

                    <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          Model Configuration
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-3">
                          <Label htmlFor="model-select" className="text-sm font-medium flex items-center gap-2">
                            AI Model
                            <span className="text-xs text-muted-foreground font-normal">(affects response quality)</span>
                          </Label>
                          <Select value={model} onValueChange={setModel}>
                            <SelectTrigger id="model-select" data-testid="select-model" className="h-11 bg-background/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              <SelectItem value="gpt-5" className="font-medium">
                                <div className="flex flex-col items-start">
                                  <span>GPT-5</span>
                                  <span className="text-xs text-muted-foreground">Latest model, best performance</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="gpt-5-mini" className="font-medium">
                                <div className="flex flex-col items-start">
                                  <span>GPT-5 Mini</span>
                                  <span className="text-xs text-muted-foreground">Fast and efficient</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="gpt-5-nano" className="font-medium">
                                <div className="flex flex-col items-start">
                                  <span>GPT-5 Nano</span>
                                  <span className="text-xs text-muted-foreground">Ultra-lightweight</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="gpt-4.1-mini" className="font-medium">
                                <div className="flex flex-col items-start">
                                  <span>GPT-4.1 Mini</span>
                                  <span className="text-xs text-muted-foreground">Balanced performance</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="gpt-4o" className="font-medium">
                                <div className="flex flex-col items-start">
                                  <span>GPT-4o</span>
                                  <span className="text-xs text-muted-foreground">Optimized model</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="gpt-4o-mini" className="font-medium">
                                <div className="flex flex-col items-start">
                                  <span>GPT-4o Mini</span>
                                  <span className="text-xs text-muted-foreground">Cost-effective</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="gpt-4-turbo" className="font-medium">
                                <div className="flex flex-col items-start">
                                  <span>GPT-4 Turbo</span>
                                  <span className="text-xs text-muted-foreground">Powerful, slower</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="gpt-3.5-turbo" className="font-medium">
                                <div className="flex flex-col items-start">
                                  <span>GPT-3.5 Turbo</span>
                                  <span className="text-xs text-muted-foreground">Budget option</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <Label htmlFor="temperature-slider" className="text-sm font-medium">
                              Temperature
                            </Label>
                            <div className="bg-primary/10 px-2 py-1 rounded text-sm font-mono border">
                              {temperature.toFixed(1)}
                            </div>
                          </div>
                          <div className="px-1">
                            <Slider
                              id="temperature-slider"
                              min={0}
                              max={2}
                              step={0.1}
                              value={[temperature]}
                              onValueChange={(value) => setTemperature(value[0])}
                              className="w-full"
                              data-testid="slider-temperature"
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground font-medium">
                            <span>🎯 Focused (0.0)</span>
                            <span>⚖️ Balanced (1.0)</span>
                            <span>🎨 Creative (2.0)</span>
                          </div>
                          <p className="text-xs text-muted-foreground/80">
                            Lower values make responses more focused and deterministic
                          </p>
                        </div>

                        <div className="space-y-3">
                          <Label htmlFor="max-tokens-select" className="text-sm font-medium flex items-center gap-2">
                            Max Tokens
                            <span className="text-xs text-muted-foreground font-normal">(response length)</span>
                          </Label>
                          <Select value={maxTokens.toString()} onValueChange={(value) => setMaxTokens(Number(value))}>
                            <SelectTrigger id="max-tokens-select" data-testid="select-max-tokens" className="h-11 bg-background/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1024" className="font-medium">
                                <div className="flex flex-col items-start">
                                  <span>1,024 tokens</span>
                                  <span className="text-xs text-muted-foreground">~750 words, quick responses</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="2048" className="font-medium">
                                <div className="flex flex-col items-start">
                                  <span>2,048 tokens ⭐</span>
                                  <span className="text-xs text-muted-foreground">~1,500 words, balanced</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="4096" className="font-medium">
                                <div className="flex flex-col items-start">
                                  <span>4,096 tokens</span>
                                  <span className="text-xs text-muted-foreground">~3,000 words, detailed</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="8192" className="font-medium">
                                <div className="flex flex-col items-start">
                                  <span>8,192 tokens</span>
                                  <span className="text-xs text-muted-foreground">~6,000 words, very detailed</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>

                  </div>
                </SheetContent>
              </Sheet>

              <ThemeToggle />
            </div>
          </div>
        </div>

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

        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={sendMessageMutation.isPending}
        />
      </div>
    </div>
  );
}