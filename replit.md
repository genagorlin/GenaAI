# GenaGPT - AI-Augmented Coaching Platform

## Overview

GenaGPT is a vertically integrated, AI-augmented coaching platform designed specifically for a single coach (Gena) and her clients. The core value proposition is providing clients with a 24/7 AI thinking partner for deep reflection, while transforming those client-AI interactions into structured insights for the coach.

The v1 scope is intentionally narrow: no marketplace, no multi-coach features, no billing/scheduling - just the closed loop of client → AI → structured insight → coach → better human sessions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend has three main views:
1. **Landing Page** (`/`) - Marketing and entry point with coach/client portals
2. **Client Page** (`/client`) - Mobile-first journal interface for client-AI conversations
3. **Coach Page** (`/coach`) - Dashboard showing client insights, sentiment analysis, and conversation history

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful JSON API under `/api` prefix
- **Development**: Vite dev server with HMR proxied through Express

Key API endpoints:
- `/api/clients` - CRUD operations for client management
- `/api/clients/:id/messages` - Client conversation history
- `/api/clients/:id/insights` - AI-generated insights per client
- `/api/clients/:id/sentiment` - Sentiment tracking data

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` (shared between client/server)
- **Migrations**: Drizzle Kit with `db:push` for schema sync

Core tables:
- `clients` - Client profiles with activity tracking
- `messages` - Conversation history (user and AI messages)
- `insights` - Categorized coaching insights (emotional spikes, recurring themes, shifts, contradictions)
- `sentimentData` - Time-series sentiment and intensity scores

### Validation
- **Schema Validation**: Zod with drizzle-zod for type-safe API validation
- **Insert Schemas**: Auto-generated from Drizzle table definitions

## External Dependencies

### Database
- PostgreSQL database (connection via `DATABASE_URL` environment variable)
- `connect-pg-simple` for session storage
- `pg` driver with connection pooling

### UI Framework
- shadcn/ui components built on Radix UI primitives
- Recharts for sentiment visualization
- Lucide React for icons
- Embla Carousel for mobile interactions

### Build & Development
- Vite for frontend bundling
- esbuild for server bundling (production builds)
- Custom Vite plugins for Replit deployment (meta images, cartographer, dev banner)

### Potential AI Integrations (dependencies present but not yet wired)
- OpenAI SDK (`openai`)
- Google Generative AI (`@google/generative-ai`)

These packages are bundled but the actual AI conversation logic is not yet implemented in the codebase.