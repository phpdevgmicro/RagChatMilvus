interface ConnectionStatusProps {
  status?: {
    milvus: boolean;
    mcp: boolean;
    openai: boolean;
  };
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const services = [
    {
      name: "Milvus Vector DB",
      icon: "fas fa-database",
      connected: status?.milvus,
      key: "milvus",
    },
    {
      name: "MCP Server",
      icon: "fas fa-server",
      connected: status?.mcp,
      key: "mcp",
    },
    {
      name: "OpenAI API",
      icon: "fas fa-brain",
      connected: status?.openai,
      key: "openai",
    },
  ];

  return (
    <div className="space-y-3">
      {services.map((service) => (
        <div key={service.key} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className={`${service.icon} text-secondary text-sm`}></i>
            <span className="text-sm text-foreground">{service.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <div 
              className={`w-2 h-2 rounded-full ${
                service.connected ? 'bg-accent' : 'bg-destructive'
              } status-indicator`}
              data-testid={`status-indicator-${service.key}`}
            />
            <span 
              className={`text-xs font-medium ${
                service.connected ? 'text-accent' : 'text-destructive'
              }`}
              data-testid={`status-text-${service.key}`}
            >
              {service.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
