# GenaGPT - AI-Augmented Coaching Platform

## Overview

GenaGPT is an AI-augmented coaching platform designed for a single coach (Gena) and her clients. Its primary purpose is to provide clients with a 24/7 AI thinking partner for deep reflection, while transforming these client-AI interactions into structured insights for the coach. The platform aims to facilitate a closed loop of client interaction leading to AI-generated insights, which then inform and enhance human coaching sessions.

## User Preferences

**Communication Style:**
- Simple, everyday language (non-technical)
- Treat user as first-time product manager learning the ropes
- Before building any feature: clarify and flesh out the request first
- Be explicit about what will be built and why
- Look for teaching opportunities about key terms and system design
- Save preferences as they emerge from conversations

**AI Behavior Preferences:**
- The AI must NOT editorialize beyond Gena's writings - no generic therapeutic language or softening of her positions
- If Gena considers something a character flaw, the AI shouldn't say "it's not a character flaw, it's human"
- AI should stay within the "canon" of her writings and exercise instructions
- When uncertain about her position, ask rather than assert
- Avoid diluting her framework with generic self-compassion language
- **Exercises: USE VERBATIM TEXT** - When guiding clients through exercises, the AI must use the exact wording from step instructions and supporting files. No paraphrasing, no "improving" the language. Quote directly when referencing materials.

**Working Process:**
1. Receive feature request
2. Clarify what user means in plain language
3. Explain what will be built and the reasoning
4. Get confirmation before building
5. Build and demonstrate

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS with shadcn/ui (New York style)
- **Build Tool**: Vite with custom Replit integration plugins
- **Views**: Landing Page (`/`), Client Page (`/client`) for journaling, Coach Page (`/coach`) for insights and history.

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful JSON API under `/api`
- **Development**: Vite dev server with HMR proxied through Express

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts`
- **Migrations**: Drizzle Kit
- **Core Tables**: `clients`, `messages`, `insights`, `sentimentData`

### Validation
- **Schema Validation**: Zod with drizzle-zod for type-safe API validation

### AI Integrations
- **Multi-provider AI Architecture**: Intelligent routing based on message content.
- **Model Router**: Analyzes messages to select optimal model/provider (OpenAI GPT for fast tier, Anthropic Claude for balanced/deep tiers).
- **Prompt Assembly**: Dynamically constructs system prompts using role, methodology, memory context, current input, task prompt, and conversation buffer, adhering to a 30,000 token budget.
- **Three-Way Conversations**: AI participates in conversations between client and coach, responding appropriately to each participant type.

### Session Management & AI Document Updates
- **Session Conclusion**: Triggered by goodbye detection, inactivity, or app closure.
- **Session Summarization**: AI analyzes messages to update client living document sections (Highlights, Focus, Context, Conversation Summaries, Custom sections).
- **Client Document Access**: Clients can view and edit their own living document sections via the Inbox interface.
- **Security Model**: Two-tier authentication (Coach and Client) with strict session and client-specific access isolation (`verifyClientAccess` middleware).

### Reference Library
- Coaches upload writings (articles, excerpts) for AI reference and client browsing.
- AI embodies the worldview from these writings, not just quotes them, within a 3,000 token budget.

### File Attachments
- Coaches attach files (PDFs, text files) to reference documents or exercises.
- Files are stored in Replit Object Storage, parsed by `server/fileParser.ts`, and their content included in AI prompts (2,000 token budget per context).

### Structured Emotion Capture
- Clients capture emotions during exercises using structured fields (Emotion Name, Intensity, Surface Content, Tone, Action Urges, Underlying Belief, Underlying Values).
- Data is saved to `exercise_emotion_snapshots` table and summarized upon exercise completion.

## External Dependencies

### Database
- PostgreSQL (via `DATABASE_URL` env var)
- `connect-pg-simple` (session storage)
- `pg` (driver with connection pooling)

### UI Framework
- shadcn/ui (components)
- Radix UI (primitives)
- Recharts (sentiment visualization)
- Lucide React (icons)
- Embla Carousel (mobile interactions)

### Build & Development
- Vite (frontend bundling)
- esbuild (server bundling)

### AI Integrations
- OpenAI GPT (`gpt-4o-mini`) via Replit AI Integrations
- Anthropic Claude (`claude-sonnet-4-5`) via Replit AI Integrations

### File Handling
- Uppy dashboard (ObjectUploader component)
- `pdf-parse` library (PDF text extraction)