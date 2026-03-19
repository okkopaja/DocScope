<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Google%20Gemini-886FBF?style=for-the-badge&logo=google&logoColor=white" alt="Google Gemini" />
</p>

<h1 align="center">🔍 DocScope</h1>

<p align="center">
  <strong>Turn any folder into a searchable semantic workspace — powered by AI.</strong>
  <br />
  <em>Local-first document indexing and natural-language retrieval for text, code, PDFs, and images.</em>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#%EF%B8%8F-architecture">Architecture</a> •
  <a href="#-cli-reference">CLI Reference</a> •
  <a href="#-api-reference">API Reference</a> •
  <a href="#-contributing">Contributing</a> •
  <a href="#-license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/okkopaja/DocScope?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/version-0.1.0-blue?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/status-alpha-orange?style=flat-square" alt="Status" />
  <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-green?style=flat-square" alt="Node" />
  <img src="https://img.shields.io/badge/pnpm-%3E%3D9.0.0-F69220?style=flat-square" alt="pnpm" />
</p>

---

## 📖 What is DocScope?

**DocScope** is a **local-first** semantic indexing and retrieval system. It allows you to point at any folder on your machine and instantly turn it into a searchable knowledge base — without uploading your data to the cloud.

Instead of relying on filenames and keywords, DocScope understands the *meaning* inside your files. Ask questions like:

- *"Find the proposal with GST tables"*
- *"Show the contract draft mentioning renewal penalties"*
- *"Which PDFs discuss transformers and attention?"*
- *"Find the screenshot where the login bug appears"*

DocScope uses [Google Gemini Embedding 2](https://ai.google.dev/gemini-api/docs/models/gemini#text-embedding) to create unified multimodal embeddings across **text, code, PDFs, and images** — all in the same semantic space. This means you can search across different file types with a single query, and even find images based on text descriptions.

### Who is this for?

| User                    | Use Case                                                   |
| :---------------------- | :--------------------------------------------------------- |
| 🧑‍💻 **Developers**       | Search across codebases, docs, specs, and screenshots      |
| 📚 **Researchers**      | Query document-heavy folders by concept, not keyword       |
| 🏗️ **Solo Builders**    | Get local semantic retrieval without building a RAG stack   |
| 🎓 **Students**         | Instantly find relevant notes, papers, and study materials  |

---

## ✨ Features

### Core Capabilities

- 🔍 **Semantic Search** — Natural-language queries across all your documents
- 💬 **Grounded Q&A** — Ask questions and get cited answers from your files
- 📂 **Works with Any Folder** — Initialize, index, search — three commands
- 🔄 **Incremental Indexing** — Only re-processes files that have changed (SHA-256 fingerprinting)
- 🌐 **Multimodal** — Understands text, source code, PDFs, and images in one unified space

### Supported File Types (Phase 1)

| Category    | Extensions                                                                        |
| :---------- | :-------------------------------------------------------------------------------- |
| **Text**    | `.txt`, `.md`, `.json`, `.csv`, `.html`, `.css`                                   |
| **Code**    | `.ts`, `.js`, `.tsx`, `.jsx`, `.py`, `.java`, `.go`                               |
| **PDF**     | `.pdf`                                                                            |
| **Images**  | `.png`, `.jpg`, `.jpeg`, `.webp`                                                  |

### Security & Privacy

- 🔒 **Local-first** — Your data stays on your machine; nothing is uploaded except embedding payloads to the Gemini API
- 🔐 **Secure key storage** — API keys stored in OS keychain via [`keytar`](https://github.com/nicuveo/keytar)
- 🛡️ **Workspace boundaries** — Strict path traversal protection; no access outside the workspace root
- 📝 **Audit logging** — Every configuration change, deletion, and reindex is logged
- 🚫 **Secret redaction** — Logs automatically redact API keys, tokens, and sensitive paths
- 🧱 **Helmet + Rate Limiting** — API server hardened with security headers and request throttling

---

## 🚀 Quick Start

Get DocScope running locally in under 5 minutes.

### Prerequisites

Before you begin, ensure you have the following installed:

| Tool         | Version  | Installation                                                                                      |
| :----------- | :------- | :------------------------------------------------------------------------------------------------ |
| **Node.js**  | ≥ 20.0.0 | [Download](https://nodejs.org/) or use [nvm](https://github.com/nvm-sh/nvm)                       |
| **pnpm**     | ≥ 9.0.0  | `npm install -g pnpm` or [see docs](https://pnpm.io/installation)                                |
| **Docker**   | Latest   | [Docker Desktop](https://www.docker.com/products/docker-desktop/) (required for PostgreSQL + Redis)|
| **Git**      | Latest   | [Download](https://git-scm.com/)                                                                  |

You will also need a **Google Gemini API Key**:
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click **"Create API Key"**
3. Copy the key — you'll use it during setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/okkopaja/DocScope.git
cd DocScope
```

### Step 2: Install Dependencies

```bash
pnpm install
```

> **Note:** This is a monorepo managed with [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/). Running `pnpm install` at the root will install dependencies for all apps and packages.

### Step 3: Start Infrastructure (PostgreSQL + Redis)

DocScope uses **PostgreSQL** (with the [pgvector](https://github.com/pgvector/pgvector) extension) for metadata and vector storage, and **Redis** for caching.

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

This starts:
- **PostgreSQL 16** with pgvector on port `5432`
- **Redis 7** on port `6379`

Verify they're running:

```bash
docker compose -f infra/docker/docker-compose.yml ps
```

You should see both `docscope-postgres` and `docscope-redis` with status `Up (healthy)`.

### Step 4: Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env
```

Open `.env` and update the values:

```env
# Required — Your Gemini API key
DOCSCOPE_API_KEY=your_gemini_api_key_here

# Database (default matches docker-compose.yml — no change needed if using Docker)
DATABASE_URL=postgresql://docscope:docscope@localhost:5432/docscope

# Redis (default matches docker-compose.yml — no change needed if using Docker)
REDIS_URL=redis://localhost:6379

# API Server port
PORT=3001

# Logging
LOG_LEVEL=info
NODE_ENV=development
```

### Step 5: Run Database Migrations

```bash
cd packages/db
pnpm db:generate    # Generate Prisma client
pnpm db:migrate     # Apply schema migrations
cd ../..
```

### Step 6: Build All Packages

```bash
pnpm build
```

### Step 7: Initialize Your First Workspace

Navigate to any folder you want to index (or stay in the project root for testing):

```bash
cd /path/to/your/folder
npx docscope init
```

The interactive wizard will ask for:
- **Workspace name** — A descriptive name for this folder
- **API key storage** — Whether to store your Gemini key securely in the OS keychain

### Step 8: Index Your Files

```bash
docscope index .
```

This will:
1. Scan all supported files recursively
2. Respect `.gitignore` and `.docscopeignore` rules
3. Extract text/metadata from each file
4. Chunk content using modality-aware strategies
5. Generate embeddings via Gemini Embedding 2
6. Store everything in PostgreSQL with pgvector

### Step 9: Search!

```bash
# Semantic search
docscope search "find the config file for database settings"

# Filter by file type
docscope search "logo with blue gradient" --type image --top 5

# Grounded Q&A with citations
docscope ask "Which files discuss authentication and how is it implemented?"
```

---

## 🏗️ Architecture

DocScope is structured as a **TypeScript monorepo** using [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/) for fast, incremental builds.

### High-Level Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        User Interfaces                          │
│                                                                  │
│    ┌──────────────┐                    ┌──────────────────┐      │
│    │   CLI (apps/  │                    │   API Server     │      │
│    │     cli/)     │                    │   (apps/api/)    │      │
│    │              │                    │   Express.js     │      │
│    │  Commander   │                    │   Port 3001      │      │
│    │  + Ora       │                    │                  │      │
│    │  + Chalk     │                    │  Health/Search/  │      │
│    │  + Inquirer  │                    │  Ask/Files/Jobs  │      │
│    └──────┬───────┘                    └────────┬─────────┘      │
│           │                                     │                │
└───────────┼─────────────────────────────────────┼────────────────┘
            │                                     │
            ▼                                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Shared Packages                            │
│                                                                  │
│  ┌────────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────┐ │
│  │  extractor │  │  chunker  │  │embeddings│  │  retrieval   │ │
│  │            │  │           │  │          │  │              │ │
│  │ Text/Code/ │  │ Text/Code/│  │  Gemini  │  │ Search +     │ │
│  │ PDF/Image  │  │ PDF/Image │  │  Embed 2 │  │ Ask Engine   │ │
│  └────────────┘  └───────────┘  └──────────┘  └──────────────┘ │
│                                                                  │
│  ┌────────────┐  ┌───────────────┐  ┌──────────────────────┐   │
│  │  security  │  │ shared-types  │  │   shared-utils       │   │
│  │            │  │               │  │                      │   │
│  │ Keychain/  │  │ Zod Schemas/  │  │ Logger/Crypto/       │   │
│  │ PathGuard/ │  │ DTOs/Enums    │  │ Paths/Formatting     │   │
│  │ Ignore/    │  │               │  │                      │   │
│  │ Redactor   │  │               │  │                      │   │
│  └────────────┘  └───────────────┘  └──────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────┐                    │
│  │     db (packages/db/)                   │                    │
│  │     Prisma ORM + pgvector raw SQL       │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
            │                           │
            ▼                           ▼
┌───────────────────┐       ┌────────────────────┐
│  PostgreSQL 16    │       │   Redis 7          │
│  + pgvector       │       │   (cache/queue)    │
│  Port 5432        │       │   Port 6379        │
└───────────────────┘       └────────────────────┘
```

### Repository Structure

```
DocScope/
├── apps/
│   ├── api/                    # Express.js REST API server
│   │   └── src/
│   │       ├── index.ts        # Server entry point with middleware stack
│   │       ├── middleware/     # Request ID, rate limiter, error handler
│   │       └── routes/        # health, workspaces, jobs endpoints
│   │
│   └── cli/                    # Command-line interface
│       └── src/
│           ├── index.ts        # Commander.js entry point
│           ├── commands/       # init, config, index, search, ask, status, doctor, reindex
│           ├── pipeline/       # File ingestion pipeline
│           └── utils/          # Workspace config loader, API key resolver
│
├── packages/
│   ├── chunker/                # Modality-aware content chunking
│   │   └── src/
│   │       ├── text-chunker.ts     # 600-token target, 100-token overlap
│   │       ├── code-chunker.ts     # Function/class boundary splitting
│   │       ├── pdf-chunker.ts      # Per-page + semantic block splitting
│   │       ├── image-chunker.ts    # Single primary chunk per image
│   │       ├── registry.ts         # Chunker selection by modality
│   │       └── types.ts            # Chunk interfaces
│   │
│   ├── db/                     # Database layer (Prisma + pgvector)
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # Full data model (13 tables)
│   │   │   └── migrations/         # SQL migrations including pgvector setup
│   │   └── src/index.ts            # Singleton PrismaClient factory
│   │
│   ├── embeddings/             # Gemini Embedding 2 integration
│   │   └── src/
│   │       ├── client.ts           # GeminiEmbeddingClient
│   │       ├── batcher.ts          # Modality-aware batching
│   │       ├── quota-limiter.ts    # Rate limit & quota management
│   │       ├── retry-policy.ts     # Exponential backoff (1s→30s cap)
│   │       └── types.ts            # Embedding interfaces
│   │
│   ├── extractor/              # File content extraction
│   │   └── src/
│   │       ├── text.ts             # .txt, .md, .json, .csv, .html, .css
│   │       ├── code.ts             # .ts, .js, .py, .java, .go, etc.
│   │       ├── pdf.ts              # PDF text extraction (pdf-parse)
│   │       ├── image.ts            # Image metadata extraction (sharp)
│   │       ├── registry.ts         # Extractor selection by MIME type
│   │       └── types.ts            # Extractor interface & types
│   │
│   ├── retrieval/              # Search & answer generation
│   │   └── src/
│   │       ├── search.ts           # Vector + keyword hybrid search
│   │       ├── ask.ts              # RAG: retrieve → generate answer with citations
│   │       └── reranker.ts         # Result merging & reranking
│   │
│   ├── security/               # Security primitives
│   │   └── src/
│   │       ├── keychain.ts         # OS keychain integration (keytar)
│   │       ├── path-guard.ts       # Path traversal & symlink protection
│   │       ├── ignore-engine.ts    # .gitignore + .docscopeignore merge
│   │       └── redactor.ts         # Secret redaction for logs
│   │
│   ├── shared-types/           # Shared Zod schemas & TypeScript types
│   │   └── src/index.ts            # All DTOs, enums, and validation schemas
│   │
│   └── shared-utils/           # Shared utility functions
│       └── src/index.ts            # Logger, SHA-256, path utils, formatters
│
├── infra/
│   └── docker/
│       └── docker-compose.yml  # PostgreSQL (pgvector) + Redis containers
│
├── docs/                       # Design documents and implementation plans
├── turbo.json                  # Turborepo configuration
├── pnpm-workspace.yaml         # pnpm workspace definition
├── tsconfig.base.json          # Shared TypeScript configuration
├── vitest.config.ts            # Root test configuration
├── eslint.config.mjs           # ESLint flat config
├── .prettierrc                 # Prettier configuration
├── .env.example                # Environment variable template
└── .gitignore                  # Git ignore rules
```

### Technology Stack

| Layer              | Technology                         | Purpose                                         |
| :----------------- | :--------------------------------- | :---------------------------------------------- |
| **Monorepo**       | pnpm + Turborepo                   | Fast incremental builds with caching             |
| **Language**       | TypeScript (strict mode)           | End-to-end type safety                           |
| **CLI**            | Commander.js + Ora + Chalk + Inquirer | Rich terminal experience                       |
| **API Server**     | Express.js 5 + Helmet + Zod       | Secure REST API with request validation          |
| **Database**       | PostgreSQL 16 + pgvector           | Relational metadata + vector similarity search   |
| **ORM**            | Prisma 6                           | Type-safe DB access + migrations                 |
| **Cache/Queue**    | Redis 7                            | Caching and future job queue support             |
| **Embeddings**     | Google Gemini Embedding 2          | Multimodal vector embeddings (text+image+PDF)    |
| **Answer Model**   | Gemini 2.5 Flash (configurable)    | Grounded answer generation with citations        |
| **Validation**     | Zod                                | Runtime schema validation on all inputs          |
| **Logging**        | Pino                               | Structured JSON logging with secret redaction    |
| **Testing**        | Vitest + Supertest                 | Unit, integration, and API testing               |
| **File Extraction**| pdf-parse + sharp + mime-types     | PDF text, image metadata, MIME detection         |
| **Security**       | keytar + ignore + Helmet           | Keychain secrets, ignore rules, security headers |

### Data Model

DocScope uses **13 tables** managed through Prisma, plus raw SQL for pgvector columns and indexes:

```
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
│  workspaces  │───<│  workspace_      │    │  audit_logs  │
│              │    │  settings        │    │              │
│  id          │    │                  │    │  action      │
│  name        │    │  key/value pairs │    │  actor       │
│  root_path   │    └──────────────────┘    │  details     │
│  embedding_  │                            └──────────────┘
│  model       │
│  embedding_  │    ┌──────────────┐    ┌──────────────┐
│  dimension   │───<│    files     │───<│ file_versions│
└──────────────┘    │              │    └──────────────┘
       │            │ relative_path│
       │            │ checksum     │    ┌──────────────┐
       │            │ mime_type    │───<│   previews   │
       │            │ index_status │    └──────────────┘
       │            └──────┬───────┘
       │                   │
       │            ┌──────┴───────┐    ┌──────────────┐
       │            │    chunks    │───<│  embeddings  │
       │            │              │    │              │
       │            │ content_text │    │ vector       │
       │            │ chunk_index  │    │ (pgvector    │
       │            │ modality     │    │  1536-dim)   │
       │            │ page_number  │    └──────────────┘
       │            │ line_start   │
       │            │ line_end     │
       │            └──────────────┘
       │
       │     ┌──────────────┐    ┌──────────────────┐
       └────<│     jobs     │───<│   job_events     │
             │              │    └──────────────────┘
             │  job_type    │
             │  state       │    ┌──────────────────┐
             │  progress    │    │  saved_filters   │
             └──────────────┘    └──────────────────┘

┌──────────────────┐    ┌──────────────────┐
│  search_queries  │───<│ search_results   │
│                  │    │                  │
│  query_text      │    │  chunk_id        │
│  query_type      │    │  rank / score    │
│  filters         │    │  snippet         │
│  result_count    │    └──────────────────┘
│  duration_ms     │
└──────────────────┘
```

### Ingestion Pipeline

When you run `docscope index .`, the following happens:

```
1. 📂 File Discovery        → Recursively scan workspace
2. 🚫 Ignore Engine         → Apply .gitignore + .docscopeignore rules
3. 🔗 Symlink Guard         → Reject symlinks by default
4. 🔐 Path Guard            → Verify all paths stay within workspace root
5. #️⃣  SHA-256 Fingerprint   → Compute checksum for each file
6. 🔄 Change Detection      → Compare against stored checksums (skip unchanged)
7. 📋 MIME Classification    → Detect file type (extension + MIME sniffing)
8. 📄 Content Extraction     → Extract text/metadata using modality-specific extractors
9. ✂️  Chunking              → Split content with overlap using modality-aware chunkers
10. 🧠 Embedding             → Send chunks to Gemini Embedding 2 API
11. 💾 Storage               → Store vectors + metadata transactionally in PostgreSQL
12. ✅ Progress Tracking     → Update job status and file index state
```

### Query Pipeline

When you run `docscope search` or `docscope ask`:

```
1. 📝 Receive query
2. 🧹 Normalize and trim
3. 🧠 Embed the query via Gemini Embedding 2
4. 🔍 Vector similarity search (pgvector cosine distance)
5. 📋 Keyword search (PostgreSQL full-text search on chunks)
6. ⚖️  Merge and rerank results
7. 📊 Return top matches with file path, page/line, snippet, and score
8. 💬 (Ask mode) Pass evidence to answer model → generate cited answer
```

---

## 📟 CLI Reference

DocScope provides a rich CLI built with [Commander.js](https://github.com/tj/commander.js):

### `docscope init`

Initialize a new DocScope workspace in the current directory.

```bash
docscope init
docscope init --name "My Project"
docscope init --no-keychain      # Skip keychain prompt
```

**What it does:**
- Creates `.docscope/` directory structure
- Writes `workspace.json` configuration
- Creates `.docscopeignore` with sensible defaults
- Registers the workspace in the database
- Optionally stores Gemini API key in OS keychain

### `docscope config`

Manage workspace configuration.

```bash
docscope config set apiKey <your-key>          # Store API key securely
docscope config set embeddingDimension 1536    # Set embedding dimensions
docscope config set answerModel gemini-2.5-flash
docscope config set dashboardPort 3147
docscope config set followSymlinks false
docscope config set maxFileSizeMb 100
docscope config list                            # View all settings
docscope config get <key>                       # View a specific setting
```

| Key                    | Type    | Default                      | Description                        |
| :--------------------- | :------ | :--------------------------- | :--------------------------------- |
| `apiKey`               | string  | —                            | Gemini API key                     |
| `embeddingDimension`   | number  | `1536`                       | Vector dimensions (128–3072)       |
| `answerModel`          | string  | `gemini-2.5-flash`           | Model for grounded Q&A             |
| `dashboardPort`        | number  | `3147`                       | Local dashboard port               |
| `followSymlinks`       | boolean | `false`                      | Whether to follow symlinks         |
| `maxFileSizeMb`        | number  | `100`                        | Max file size to index             |

### `docscope index`

Index files in the workspace.

```bash
docscope index .                  # Index current directory
docscope index . --force          # Force re-index all files
docscope index . --concurrency 5  # Parallel file processing
```

### `docscope reindex`

Force re-index files (reprocesses even unchanged files).

```bash
docscope reindex
```

### `docscope search`

Semantic search across indexed documents.

```bash
docscope search "database configuration settings"
docscope search "blue gradient logo" --type image
docscope search "authentication middleware" --type code --top 20
```

**Options:**

| Flag          | Description                              | Default |
| :------------ | :--------------------------------------- | :------ |
| `--type`      | Filter by modality: `text`, `code`, `pdf`, `image` | all |
| `--top <n>`   | Number of results                        | `10`    |

### `docscope ask`

Ask a grounded question — retrieves evidence first, then generates an answer with citations.

```bash
docscope ask "How is user authentication handled in this project?"
docscope ask "Summarize the database schema" --top 10
docscope ask "What error handling patterns are used?" --model gemini-2.5-pro
```

**Options:**

| Flag            | Description                              | Default              |
| :-------------- | :--------------------------------------- | :------------------- |
| `--type`        | Filter evidence by modality              | all                  |
| `--top <n>`     | Number of evidence chunks                | `5`                  |
| `--model`       | Answer generation model                  | `gemini-2.5-flash`   |

### `docscope status`

View workspace indexing status and statistics.

```bash
docscope status
```

**Output includes:** total files, indexed count, pending, failed, total chunks, and latest job info.

### `docscope doctor`

Diagnose workspace health and check for issues.

```bash
docscope doctor
```

**Checks:** database connectivity, workspace config validity, API key availability, file system permissions, and more.

---

## 🌐 API Reference

DocScope includes a local Express.js API server for programmatic access. It binds to `127.0.0.1` only by default for security.

### Starting the API Server

```bash
# Development mode (with hot reload)
cd apps/api
pnpm dev

# Production mode
pnpm build
pnpm start
```

The server runs on `http://127.0.0.1:3001` by default (configurable via `PORT` env var).

### Endpoints

#### Health Check

```
GET /health
```

Returns server status, uptime, and version information.

#### Workspaces

```
GET    /workspaces/:id          # Get workspace details
GET    /workspaces/:id/status   # Get indexing status & statistics
GET    /workspaces/:id/search   # Semantic search
POST   /workspaces/:id/ask      # Grounded Q&A
GET    /workspaces/:id/files    # List indexed files (paginated)
GET    /workspaces/:id/files/:fileId  # Get file details with chunks
```

#### Search

```http
GET /workspaces/:id/search?q=database+config&type=code&top=5
```

| Parameter | Type   | Required | Description                              |
| :-------- | :----- | :------- | :--------------------------------------- |
| `q`       | string | ✅       | Search query                             |
| `type`    | string | ❌       | Filter: `text`, `code`, `pdf`, `image`   |
| `top`     | number | ❌       | Number of results (default: 10)          |

#### Ask

```http
POST /workspaces/:id/ask
Content-Type: application/json

{
  "question": "How does the authentication system work?",
  "type": "code",
  "top": 5,
  "answerModel": "gemini-2.5-flash"
}
```

**Response:**

```json
{
  "answer": "The authentication system uses...",
  "citations": [
    {
      "filePath": "src/auth/middleware.ts",
      "snippet": "...",
      "lineStart": 42,
      "lineEnd": 68
    }
  ],
  "evidence": [...],
  "durationMs": 2340
}
```

#### Jobs

```
GET /jobs/:jobId    # Get job status and progress
```

### Middleware Stack

The API applies the following middleware in order:

1. **Request ID** — Unique ID for each request (tracing)
2. **Pino HTTP Logger** — Structured request logging
3. **Helmet** — Security headers (CSP, HSTS, etc.)
4. **CORS** — Localhost-only origin policy
5. **Cookie Parser** — Cookie handling for future auth
6. **Body Limit** — 10MB JSON body limit
7. **Rate Limiter** — Request throttling on workspace/job routes
8. **Zod Validation** — Schema validation on all inputs
9. **Error Handler** — Consistent error response format

---

## 🧪 Testing

DocScope uses [Vitest](https://vitest.dev/) as its test runner with [Supertest](https://github.com/ladjs/supertest) for API testing.

### Running Tests

```bash
# Run all tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests
pnpm test:int

# API tests (requires running database)
pnpm test:api

# End-to-end tests
pnpm test:e2e

# Security-focused tests
pnpm test:security

# Run tests for a specific package
cd packages/embeddings
pnpm test:unit
```

### Test Coverage

```bash
# Generate coverage report
pnpm test -- --coverage
```

### What's Tested

- ✅ Workspace initialization creates correct files
- ✅ Ignore engine skips expected patterns
- ✅ SHA-256 checksum detects changed files
- ✅ Extractors output normalized structures
- ✅ Chunkers respect size limits and overlap
- ✅ Embedding payload builder respects modality batching limits
- ✅ Path guard prevents traversal attacks
- ✅ Symlink protection rejects symbolic links
- ✅ Secret redactor masks keys in logs
- ✅ Retry policy with exponential backoff
- ✅ Reranker produces stable ordering
- ✅ API returns correct error codes for invalid input

---

## ⚙️ Configuration

### Environment Variables

| Variable              | Required | Default                                                        | Description                        |
| :-------------------- | :------- | :------------------------------------------------------------- | :--------------------------------- |
| `DOCSCOPE_API_KEY`    | Yes*     | —                                                              | Gemini API key (or use keychain)   |
| `DATABASE_URL`        | Yes      | `postgresql://docscope:docscope@localhost:5432/docscope`       | PostgreSQL connection string       |
| `REDIS_URL`           | No       | `redis://localhost:6379`                                       | Redis connection string            |
| `PORT`                | No       | `3001`                                                         | API server port                    |
| `LOG_LEVEL`           | No       | `info`                                                         | Pino log level                     |
| `NODE_ENV`            | No       | `development`                                                  | Environment mode                   |
| `DOCSCOPE_MASTER_KEY` | No*      | —                                                              | Fallback encryption key (if no OS keychain) |

> \* `DOCSCOPE_API_KEY` can be set via environment variable OR stored in OS keychain via `docscope config set apiKey`.
> `DOCSCOPE_MASTER_KEY` is only required when `keytar` (OS keychain) is unavailable.

### Ignore Rules

DocScope respects two ignore files, merged in this order (`.docscopeignore` wins on conflict):

1. **`.gitignore`** — Standard Git ignore rules
2. **`.docscopeignore`** — DocScope-specific ignore rules (created automatically on `init`)

**Default `.docscopeignore`:**

```gitignore
node_modules/
dist/
build/
.next/
.cache/
.turbo/
.env
.env.*
coverage/
.idea/
.vscode/
.DS_Store
Thumbs.db
.docscope/
```

### Workspace Configuration

Each workspace stores its config in `.docscope/workspace.json`:

```json
{
  "id": "a1b2c3d4-...",
  "name": "My Project",
  "rootPath": "/absolute/path/to/folder",
  "embeddingModel": "gemini-embedding-2-preview",
  "embeddingDimension": 1536,
  "createdAt": "2026-03-19T14:00:00.000Z"
}
```

---

## 🛠️ Development

### Development Workflow

```bash
# Start infrastructure
docker compose -f infra/docker/docker-compose.yml up -d

# Run all packages in dev mode (with hot reload)
pnpm dev

# Or run individual packages
cd apps/api && pnpm dev     # API server with hot reload
cd apps/cli && pnpm dev     # CLI with hot reload
```

### Building

```bash
# Build all packages (Turborepo handles dependency order)
pnpm build

# Build a specific package
cd packages/chunker && pnpm build
```

### Linting & Formatting

```bash
# Lint all packages
pnpm lint

# Type checking
pnpm typecheck

# Format code with Prettier
pnpm format

# Check formatting without writing
pnpm format:check
```

### Database Management

```bash
cd packages/db

pnpm db:generate       # Regenerate Prisma client after schema changes
pnpm db:migrate        # Create and apply new migration
pnpm db:migrate:deploy # Apply pending migrations (production)
pnpm db:studio         # Open Prisma Studio (visual DB browser)
```

### Clean Build

```bash
# Remove all build artifacts and node_modules
pnpm clean
pnpm install
pnpm build
```

### Code Style

DocScope enforces consistent code style through:

- **ESLint** — TypeScript-aware linting with flat config (`eslint.config.mjs`)
- **Prettier** — Consistent formatting (single quotes, trailing commas, 100-char width)
- **TypeScript** — Strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`

---

## 🤝 Contributing

We welcome contributions! Whether it's a bug fix, new file extractor, documentation improvement, or feature request — all contributions are valued.

### Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/DocScope.git
   cd DocScope
   ```
3. **Install dependencies:**
   ```bash
   pnpm install
   ```
4. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/my-awesome-feature
   ```
5. **Make your changes** and write tests
6. **Run the checks:**
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```
7. **Commit** with a clear, descriptive message:
   ```bash
   git commit -m "feat(chunker): add YAML file chunking support"
   ```
8. **Push** and open a Pull Request

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): add new feature
fix(scope): fix a bug
docs(scope): update documentation
refactor(scope): code refactoring
test(scope): add or update tests
chore(scope): maintenance tasks
```

**Scopes:** `cli`, `api`, `chunker`, `extractor`, `embeddings`, `retrieval`, `security`, `db`, `shared-types`, `shared-utils`, `infra`, `docs`

### Adding a New File Extractor

DocScope is designed to be easily extensible. To add support for a new file type:

1. **Create the extractor** in `packages/extractor/src/`:
   ```typescript
   // packages/extractor/src/yaml.ts
   import type { Extractor, FileInput, ExtractedDocument } from './types.js';

   export class YamlExtractor implements Extractor {
     supports(mime: string, path: string): boolean {
       return mime === 'application/x-yaml' || path.endsWith('.yaml') || path.endsWith('.yml');
     }

     async extract(input: FileInput): Promise<ExtractedDocument> {
       // Your extraction logic here
     }
   }
   ```

2. **Register it** in `packages/extractor/src/registry.ts`

3. **Create a corresponding chunker** in `packages/chunker/src/` if needed

4. **Add the file extension** to `FileTypeSchema` in `packages/shared-types/src/index.ts`

5. **Write tests** for the extractor and chunker

### Development Tips

- Each package has its own `tsconfig.json` that extends `tsconfig.base.json`
- Use `workspace:*` protocol for inter-package dependencies
- Turborepo caches builds — run `pnpm clean` to clear caches
- The API server binds to `127.0.0.1` only; this is intentional for security
- Run `docker compose -f infra/docker/docker-compose.yml logs -f` to debug database issues

---

## 🗺️ Roadmap

DocScope is being developed in three phases:

### ✅ Phase 1 (Current) — Local CLI

- [x] CLI with `init`, `config`, `index`, `search`, `ask`, `status`, `doctor`, `reindex`
- [x] Express API with local endpoints
- [x] PostgreSQL + pgvector storage
- [x] Text, code, PDF, and image indexing
- [x] Incremental re-indexing
- [x] Semantic search with hybrid ranking
- [x] Grounded Q&A with citations
- [x] Security hardening (path guard, keychain, redaction)

### 🔜 Phase 2 — Dashboard & Extended Formats

- [ ] Next.js dashboard for browsing, search, and workspace management
- [ ] `.docx`, `.pptx`, `.xlsx` support
- [ ] Audio/video support (`.mp3`, `.wav`, `.mp4`)
- [ ] Local session authentication
- [ ] File preview generation (thumbnails, waveforms)
- [ ] Job queue with BullMQ for background indexing
- [ ] Watch mode for automatic re-indexing on file changes

### 🔮 Phase 3 — MCP Server & Agent Skills

- [ ] MCP server for IDE integration (Claude, Cursor, etc.)
- [ ] Agent skill system (search, answer, classify, reindex-planner, redaction-check)
- [ ] JWT API tokens for programmatic access
- [ ] Multi-workspace management
- [ ] Remote workspace connectors
- [ ] RBAC and workspace sharing
- [ ] OpenTelemetry instrumentation

---

## ❓ Troubleshooting

### Common Issues

<details>
<summary><strong>💾 Database connection error</strong></summary>

**Symptom:** `Error: Can't reach database server at localhost:5432`

**Solution:**
1. Ensure Docker is running
2. Start the containers: `docker compose -f infra/docker/docker-compose.yml up -d`
3. Verify: `docker compose -f infra/docker/docker-compose.yml ps`
4. Check the `DATABASE_URL` in your `.env` file matches the Docker compose config

</details>

<details>
<summary><strong>🔑 API key not found</strong></summary>

**Symptom:** `Error: API key not configured in keychain and no fallback environment variable found`

**Solution:**
- Set via CLI: `docscope config set apiKey YOUR_KEY`
- Or set the `DOCSCOPE_API_KEY` environment variable in your `.env` file
- Or set `GEMINI_API_KEY` environment variable

</details>

<details>
<summary><strong>📦 Build errors after pulling changes</strong></summary>

**Symptom:** TypeScript or dependency errors after `git pull`

**Solution:**
```bash
pnpm clean
pnpm install
cd packages/db && pnpm db:generate
cd ../..
pnpm build
```

</details>

<details>
<summary><strong>🔗 Prisma client not generated</strong></summary>

**Symptom:** `Error: @prisma/client did not initialize yet`

**Solution:**
```bash
cd packages/db
pnpm db:generate
cd ../..
pnpm build
```

</details>

<details>
<summary><strong>🐳 Docker containers won't start</strong></summary>

**Symptom:** Port conflicts or containers failing to start

**Solution:**
1. Check for port conflicts: `netstat -an | findstr 5432` (Windows) or `lsof -i :5432` (macOS/Linux)
2. Stop conflicting services
3. Reset Docker volumes if needed:
   ```bash
   docker compose -f infra/docker/docker-compose.yml down -v
   docker compose -f infra/docker/docker-compose.yml up -d
   ```

</details>

<details>
<summary><strong>🪟 Keytar issues on Windows/Linux</strong></summary>

**Symptom:** `Error: Cannot find module 'keytar'` or keychain access errors

**Solution:**
- Set `DOCSCOPE_MASTER_KEY` in your `.env` as a fallback encryption key
- Or pass `--no-keychain` flag during `docscope init`
- On Linux, ensure `libsecret` is installed: `sudo apt install libsecret-1-dev`

</details>

<details>
<summary><strong>⚡ Embedding rate limit errors (429)</strong></summary>

**Symptom:** `Error: 429 Too Many Requests` from Gemini API

**Solution:**
- DocScope has built-in retry with exponential backoff (1s→2s→4s→8s, capped at 30s)
- Reduce concurrency: `docscope index . --concurrency 2`
- Wait a few minutes and re-run: `docscope reindex`
- Check your [Gemini API quotas](https://aistudio.google.com/apikey)

</details>

---

## 📚 Further Reading

- [Google Gemini Embedding 2 Documentation](https://ai.google.dev/gemini-api/docs/models/gemini#text-embedding)
- [pgvector — Vector Similarity for PostgreSQL](https://github.com/pgvector/pgvector)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Model Context Protocol (MCP)](https://spec.modelcontextprotocol.io/)

---

## 📄 License

This project is open source. See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Built with ❤️ and a lot of ☕</strong>
  <br /><br />
  <em>DocScope — Because your files deserve to be understood, not just stored.</em>
</p>
