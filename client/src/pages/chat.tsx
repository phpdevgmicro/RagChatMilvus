import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, MessageSquare, Search, Menu } from "lucide-react";
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
  const [temperature, setTemperature] = useState(0.7);
  const [model, setModel] = useState("gpt-4o");
  const [maxTokens, setMaxTokens] = useState(2048);
  const [isTyping, setIsTyping] = useState(false);
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
    },
    onError: (error) => {
      setIsTyping(false);
      // Remove the optimistic update on error
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
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
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update message: " + error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (content: string) => {
    sendMessageMutation.mutate({
      content,
      saveToVector: false,
      temperature,
      model,
      maxTokens,
    });
  };

  const handleToggleVectorSave = (messageId: string, saveToVector: boolean) => {
    toggleVectorSaveMutation.mutate({ messageId, saveToVector });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-background to-muted/20 safe-area-inset">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-sm">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">AI Assistant</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Intelligent conversations with vector memory</p>
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

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Model Configuration</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="model-select">Model</Label>
                          <Select value={model} onValueChange={setModel}>
                            <SelectTrigger id="model-select" data-testid="select-model">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                              <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                              <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                              <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <Label htmlFor="temperature-slider">Temperature</Label>
                            <span className="text-sm text-muted-foreground" data-testid="text-temperature-value">{temperature}</span>
                          </div>
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
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Focused</span>
                            <span>Creative</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="max-tokens-select">Max Tokens</Label>
                          <Select value={maxTokens.toString()} onValueChange={(value) => setMaxTokens(Number(value))}>
                            <SelectTrigger id="max-tokens-select" data-testid="select-max-tokens">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1024">1,024</SelectItem>
                              <SelectItem value="2048">2,048</SelectItem>
                              <SelectItem value="4096">4,096</SelectItem>
                              <SelectItem value="8192">8,192</SelectItem>
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
        />

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />

        <div ref={messagesEndRef} />

        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={sendMessageMutation.isPending}
        />
      </div>
    </div>
  );
}