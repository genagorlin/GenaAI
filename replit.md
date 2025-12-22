# GenaGPT - AI-Augmented Coaching Platform

## Overview

GenaGPT is an AI-augmented coaching platform designed for a single coach (Gena) and her clients. Its primary purpose is to provide clients with a 24/7 AI thinking partner for reflection, transforming these client-AI interactions into structured insights for the coach to enhance human coaching sessions. The platform focuses on a closed loop: client → AI → structured insight → coach → improved human sessions, without features like marketplaces, multi-coach support, billing, or scheduling.

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

**Frontend:**
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS with shadcn/ui components (New York style)
- **Build Tool**: Vite with custom Replit plugins
- **Views**: Landing Page (`/`), Client Page (`/client`) for journaling, Coach Page (`/coach`) for insights and conversation history.

**Backend:**
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON API (`/api` prefix)
- **Development**: Vite dev server with HMR proxied through Express

**Data Storage:**
- **Database**: PostgreSQL via Drizzle ORM
- **Schema**: `shared/schema.ts` (shared)
- **Migrations**: Drizzle Kit
- **Core tables**: `clients`, `messages`, `insights`, `sentimentData`

**Validation:**
- **Schema Validation**: Zod with drizzle-zod for type-safe API validation.

**AI System Design:**
- **Multi-provider architecture**: Uses OpenAI GPT and Anthropic Claude via Replit AI Integrations.
- **Model Router (`server/modelRouter.ts`)**: Selects optimal model based on message analysis (fast, balanced, deep tiers).
- **Prompt Assembly (`server/promptAssembler.ts`)**: Dynamically builds system prompts with token allocation for role, methodology, memory, input, task, and conversation buffer.
- **Session Conclusion**: AI analyzes messages since `lastSummarizedAt` and updates client document sections upon session end (goodbye detection, inactivity, app close).
- **Client Document Access**: Clients can view/edit specific sections of their living document (Highlights, Focus, Context, Conversation Summaries).
- **Reference Library**: Coach uploads documents for AI to reference and for clients to browse. AI embodies this worldview in responses.
- **File Attachments**: Coaches can attach files (PDFs, text files) to reference documents and exercises. AI extracts and uses content in prompts.

**Security Model:**
- **Two-tier authentication**: Separate flows for Coach and Client via OAuth.
- **Coach Auth**: Requires `authorized_users` allowlist.
- **Client Auth**: Binds login email to existing client, `sessionType: "client"`, `boundClientId` checks.
- **`verifyClientAccess` middleware**: Enforces strict client session and cross-client access prevention for client-facing routes.

**Voice Features:**
- **Speech-to-Text**: Client voice input transcribed via OpenAI Whisper API.
- **Text-to-Speech**: AI text responses converted to speech via OpenAI TTS API ("nova" voice).

## External Dependencies

**Database:**
- PostgreSQL
- `connect-pg-simple` (session storage)
- `pg` driver

**UI Frameworks & Libraries:**
- shadcn/ui (Radix UI primitives)
- Recharts (sentiment visualization)
- Lucide React (icons)
- Embla Carousel (mobile interactions)
- Uppy dashboard (ObjectUploader)

**Build & Development Tools:**
- Vite
- esbuild

**AI Integrations:**
- **OpenAI GPT**: `gpt-4o-mini` (via Replit AI Integrations)
- **Anthropic Claude**: `claude-sonnet-4-5` (via Replit AI Integrations)
- OpenAI Whisper API (for Speech-to-Text)
- OpenAI TTS API (for Text-to-Speech)
- `pdf-parse` library (for PDF text extraction)

**Object Storage:**
- Replit Object Storage (`.private/` directory)