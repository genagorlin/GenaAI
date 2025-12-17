# GenaGPT - AI-Augmented Coaching Platform

## Overview

GenaGPT is a vertically integrated, AI-augmented coaching platform designed specifically for a single coach (Gena) and her clients. The core value proposition is providing clients with a 24/7 AI thinking partner for deep reflection, while transforming those client-AI interactions into structured insights for the coach.

The v1 scope is intentionally narrow: no marketplace, no multi-coach features, no billing/scheduling - just the closed loop of client → AI → structured insight → coach → better human sessions.

## User Preferences

**Communication Style:**
- Simple, everyday language (non-technical)
- Treat user as first-time product manager learning the ropes
- Before building any feature: clarify and flesh out the request first
- Be explicit about what will be built and why
- Look for teaching opportunities about key terms and system design
- Save preferences as they emerge from conversations

**Working Process:**
1. Receive feature request
2. Clarify what user means in plain language
3. Explain what will be built and the reasoning
4. Get confirmation before building
5. Build and demonstrate

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

### AI Integrations

The platform uses a multi-provider AI architecture with intelligent routing:

**Providers (via Replit AI Integrations - no API keys required, billed to credits):**
- **OpenAI GPT** - Used for fast tier (simple/standard messages)
  - Environment: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`
  - Models: `gpt-4o-mini` (fast tier)
- **Anthropic Claude** - Used for balanced/deep tier (emotional/complex content)
  - Environment: `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
  - Models: `claude-sonnet-4-5` (balanced/deep tier)

**Model Router (`server/modelRouter.ts`):**
The router analyzes each incoming message and selects the optimal model/provider:
- **Fast tier** (OpenAI gpt-4o-mini) - Simple greetings, short messages (<20 chars), standard messages
- **Balanced tier** (Anthropic claude-sonnet-4-5) - Emotional content, longer messages (>200 chars)
- **Deep tier** (Anthropic claude-sonnet-4-5) - Existential questions, complex reasoning

Message analysis includes:
- Emotional keyword detection (feel, scared, overwhelmed, etc.)
- Deep question pattern matching (why, meaning, purpose, etc.)
- Simple greeting detection

**Prompt Assembly (`server/promptAssembler.ts`):**
Token budgets are allocated across prompt components (total budget: 30,000 tokens):
- Role Prompt: 500 tokens (AI personality per client)
- Methodology Frame: 2,000 tokens (coaching frameworks)
- Memory Context: 15,000 tokens (living document sections)
- Current Input: 1,000 tokens
- Task Prompt: 500 tokens (response instructions)
- Conversation Buffer: 11,000 tokens (recent messages)

**Conversation Flow:**
1. Client or coach sends message via chat interface
2. Model router analyzes message → selects tier/model/provider
3. Prompt assembler builds system prompt from living document + prompts
4. Request sent to AI provider
5. Response saved to database and returned to sender

**Three-Way Conversations:**
The AI participates in conversations between client and coach:
- Messages are labeled as [CLIENT] or [COACH] in conversation history
- AI receives instructions on how to respond to each participant type
- Coach messages automatically trigger AI responses (can disable with `triggerAI: false`)
- `currentSpeaker` parameter identifies who is sending the current message
- `messageAlreadyStored` flag prevents duplicate messages in prompt history

## Session Conclusion & AI Document Updates

A client session is concluded when:
1. **Goodbye detection** - Pattern matching triggers when client says farewell ("goodbye", "see you", "thanks, bye", etc.)
2. **Inactivity timeout** - Frontend detects 5+ minutes of no messages
3. **App close/tab switch** - Visibility change or beforeunload events trigger session end

**Implementation:**
- `server/sessionSummarizer.ts` - AI analyzes messages since `lastSummarizedAt` and updates document sections
- `POST /api/clients/:clientId/session-end` - Endpoint triggers summarization
- Frontend ChatPage.tsx tracks inactivity and visibility changes
- AI updates are marked with `pendingReview=1` for coach approval (accept/revert controls)

## Client Document Access

Clients can view and edit their own living document through the Inbox interface:

**Client-Visible Sections:**
- Highlights (key moments and quotes)
- Focus (current priorities)
- Context (background information)
- Conversation Summaries
- Custom sections

**Hidden from Clients:**
- Role prompts (AI personality instructions)
- Task prompts (response guidelines)
- Coach notes (private coach observations)

**Security Model:**
- Clients must authenticate via Replit Auth before accessing documents
- `isClientAuthenticated` middleware checks session without requiring coach allowlist
- Ownership verification: `req.user.claims.email` must match `client.email`
- Prevents cross-tenant access - clients can only view/edit their own documents

**Implementation:**
- `GET /api/chat/:clientId/document` - Fetches document with client-viewable sections
- `PATCH /api/chat/:clientId/sections/:sectionId` - Updates a section (marks as client-edited)
- `client/src/components/ClientDocumentView.tsx` - Collapsible section editor
- `client/src/pages/InboxPage.tsx` - Tab toggle between "Conversations" and "My Document"

## Future Development Notes

**Insight Generation (planned, not prioritized):**
- Database schema exists for insights table
- Categories: Emotional Spike, Recurring Theme, Shift, Contradiction
- Will auto-extract from conversations when implemented

**Sentiment Analysis (planned, not prioritized):**
- Database schema exists for sentiment_data table
- Will populate "Emotional Velocity" chart automatically when implemented