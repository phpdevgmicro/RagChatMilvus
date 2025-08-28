# Overview

This is a RAG (Retrieval-Augmented Generation) chatbot application that combines AI chat capabilities with vector database storage for intelligent knowledge retrieval. The system allows users to interact with an AI assistant that can save responses to a vector database and retrieve similar conversations for context-aware responses. It features a modern web interface built with React and a Node.js/Express backend with PostgreSQL and Milvus vector database integration.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Components**: Shadcn/ui component library with Radix UI primitives for accessibility
- **Styling**: Tailwind CSS with CSS variables for theming and dark mode support
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation via @hookform/resolvers

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **API Design**: RESTful API endpoints with JSON communication
- **Development Server**: Custom Vite integration for hot module replacement in development

## Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon Database serverless connection
- **Vector Database**: Milvus for storing and searching message embeddings
- **Session Storage**: PostgreSQL with connect-pg-simple for session management
- **Schema Management**: Drizzle Kit for database migrations and schema updates

## Database Schema
- **Users**: Authentication with username/password
- **Chat Messages**: Stores conversation history with role, content, timestamps, and vector storage flags
- **Vector Responses**: Links messages to their embeddings with similarity scores and source metadata

## Authentication and Authorization
- **Session-based Authentication**: Express sessions stored in PostgreSQL
- **In-memory Storage Fallback**: MemStorage class provides fallback when database is unavailable
- **User Management**: Basic username/password authentication system

## External Service Integrations
- **OpenAI API**: GPT-5 for chat completions and text-embedding-ada-002 for vector embeddings
- **Model Context Protocol (MCP)**: External knowledge retrieval service for augmenting responses
- **Milvus Vector Database**: Similarity search and vector storage capabilities
- **Neon Database**: Serverless PostgreSQL hosting

## Key Features
- **Vector Search**: Similarity-based retrieval of previous conversations
- **Auto-save Functionality**: Configurable automatic saving of responses to vector database
- **Real-time Status Monitoring**: Connection status tracking for all external services
- **Responsive Design**: Mobile-first UI with adaptive layouts
- **Database Management**: Clear database functionality and statistics tracking
- **Context-aware Responses**: Integration with MCP server for external knowledge augmentation

## Development and Deployment
- **Build Process**: Vite for frontend bundling, esbuild for backend compilation
- **Development Mode**: Hot reload with Vite middleware integration
- **Environment Configuration**: Environment variables for all external service connections
- **Error Handling**: Comprehensive error boundaries and logging throughout the application