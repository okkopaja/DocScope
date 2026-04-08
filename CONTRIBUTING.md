# Contributing to DocScope

First off — thank you for taking the time to contribute! 🎉

DocScope is an open-source project and we deeply value every form of contribution, whether it's a bug report, a documentation fix, a new file extractor, or a fully-fledged feature. This guide will help you do that effectively.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [I Have a Question](#i-have-a-question)
- [Ways to Contribute](#ways-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Your First Code Contribution](#your-first-code-contribution)
  - [Improving Documentation](#improving-documentation)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Extending DocScope](#extending-docscope)
  - [Adding a New File Extractor](#adding-a-new-file-extractor)
  - [Adding a New Chunker](#adding-a-new-chunker)
- [Code Style](#code-style)
- [Testing](#testing)
- [Project Structure Quick Reference](#project-structure-quick-reference)

---

## Code of Conduct

This project and everyone participating in it is governed by the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this standard. Please report unacceptable behavior to the project maintainers via GitHub Issues.

---

## I Have a Question

> **Before opening an issue**, please search [existing issues](https://github.com/okkopaja/DocScope/issues) and [discussions](https://github.com/okkopaja/DocScope/discussions) to see if your question has already been answered.

If you need clarification:

- Open a [GitHub Discussion](https://github.com/okkopaja/DocScope/discussions) for general questions.
- Open a [GitHub Issue](https://github.com/okkopaja/DocScope/issues) for concrete bugs or feature requests.

---

## Ways to Contribute

### Reporting Bugs

A great bug report makes it easy to reproduce and fix the problem. Before submitting, please:

1. **Update** to the latest version and check if the bug still exists.
2. **Search** [existing issues](https://github.com/okkopaja/DocScope/issues?q=is%3Aissue+label%3Abug) to avoid duplicates.
3. **Collect** the following information:
   - OS and version (e.g., macOS 14.4, Ubuntu 22.04, Windows 11)
   - Node.js and pnpm versions (`node -v`, `pnpm -v`)
   - DocScope version
   - Steps to reproduce (minimal and precise)
   - What you expected vs. what actually happened
   - Relevant logs (from `LOG_LEVEL=debug docscope ...`)
   - Any error stack traces

Submit bugs via **[New Issue → Bug Report](https://github.com/okkopaja/DocScope/issues/new?template=bug_report.md)**.

> ⚠️ **Security vulnerabilities** must **not** be reported via public issues. Please open a [GitHub Security Advisory](https://github.com/okkopaja/DocScope/security/advisories/new) instead.

---

### Suggesting Features

We love ideas! When suggesting a feature:

1. **Check** the [Roadmap](README.md#%EF%B8%8F-roadmap) and [existing feature requests](https://github.com/okkopaja/DocScope/issues?q=is%3Aissue+label%3Aenhancement) — it may already be planned.
2. **Describe**:
   - The problem you're trying to solve
   - The solution you propose, and why it's the right fit for DocScope
   - Any alternative approaches you considered

Submit features via **[New Issue → Feature Request](https://github.com/okkopaja/DocScope/issues/new?template=feature_request.md)**.

---

### Your First Code Contribution

Not sure where to start? Look for issues labeled:

- [`good first issue`](https://github.com/okkopaja/DocScope/issues?q=is%3Aopen+label%3A%22good+first+issue%22) — Great for newcomers
- [`help wanted`](https://github.com/okkopaja/DocScope/issues?q=is%3Aopen+label%3A%22help+wanted%22) — Needs extra attention from the community

> **Tip:** Comment on the issue to let maintainers know you're working on it. This prevents double efforts.

---

### Improving Documentation

Documentation contributions are just as important as code contributions. This includes:

- Fixing typos or unclear wording in the `README.md` or `docs/`
- Adding missing examples or clarifying existing ones
- Writing guides for new workflows or use cases
- Improving inline code comments

---

## Development Setup

### Prerequisites

| Tool         | Version  | Notes                                                              |
| :----------- | :------- | :----------------------------------------------------------------- |
| **Node.js**  | ≥ 20.0.0 | Use [nvm](https://github.com/nvm-sh/nvm) for version management   |
| **pnpm**     | ≥ 9.0.0  | `npm install -g pnpm`                                              |
| **Docker**   | Latest   | Required to run PostgreSQL + Redis locally                         |
| **Git**      | Latest   | —                                                                  |

You will also need a **[Google Gemini API Key](https://aistudio.google.com/apikey)** for tests that exercise the embedding pipeline.

### 1. Fork & Clone

```bash
# Fork via GitHub UI, then:
git clone https://github.com/YOUR_USERNAME/DocScope.git
cd DocScope

# Add the upstream remote so you can pull changes later
git remote add upstream https://github.com/okkopaja/DocScope.git
```

### 2. Install Dependencies

```bash
pnpm install
```

> This installs dependencies for all apps and packages in the monorepo via pnpm workspaces.

### 3. Start Infrastructure

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

### 4. Configure Environment

```bash
cp .env.example .env
# Edit .env — at minimum, set DOCSCOPE_API_KEY and DATABASE_URL
```

### 5. Run Database Migrations

```bash
cd packages/db
pnpm db:generate
pnpm db:migrate
cd ../..
```

### 6. Verify Everything Works

```bash
pnpm build
pnpm test
```

---

## Development Workflow

### Branching Strategy

Branch off from `main`. Use descriptive branch names following the pattern:

```
<type>/<short-description>
```

Examples:

```
feat/yaml-extractor
fix/pdf-chunker-utf8
docs/improve-api-reference
refactor/embedding-batcher
```

### Making Changes

```bash
# Create your branch
git checkout -b feat/my-awesome-feature

# Run the dev server for the relevant package
cd apps/api && pnpm dev     # API server with hot reload
cd apps/cli && pnpm dev     # CLI with hot reload

# Or run everything at once from root
pnpm dev
```

### Before Committing

Always run the full quality gate locally before pushing:

```bash
pnpm lint         # ESLint — must pass with zero errors
pnpm typecheck    # TypeScript strict mode — must pass with zero errors
pnpm test         # All tests — must pass
pnpm format:check # Prettier — must be clean (or run pnpm format to fix)
```

---

## Commit Convention

DocScope uses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). This enables automatic changelog generation and semantic versioning.

### Format

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

### Types

| Type         | When to use                                              |
| :----------- | :------------------------------------------------------- |
| `feat`       | A new feature                                            |
| `fix`        | A bug fix                                                |
| `docs`       | Documentation-only changes                               |
| `refactor`   | Code change that neither fixes a bug nor adds a feature  |
| `test`       | Adding or updating tests                                 |
| `chore`      | Build process, tooling, or maintenance tasks             |
| `perf`       | A code change that improves performance                  |
| `ci`         | Changes to CI/CD configuration                           |

### Scopes

`cli` · `api` · `chunker` · `extractor` · `embeddings` · `retrieval` · `security` · `db` · `shared-types` · `shared-utils` · `infra` · `docs`

### Examples

```bash
git commit -m "feat(extractor): add YAML file extractor"
git commit -m "fix(pdf-chunker): handle UTF-8 BOM in extracted text"
git commit -m "docs(readme): clarify DATABASE_URL configuration"
git commit -m "test(security): add symlink traversal edge case tests"
git commit -m "chore(deps): bump pnpm to 9.4.0"
```

### Breaking Changes

If your change breaks the public API or CLI interface, append `!` after the type/scope and add a `BREAKING CHANGE:` footer:

```
feat(cli)!: rename `--type` flag to `--modality`

BREAKING CHANGE: The `--type` flag in `docscope search` and `docscope ask`
has been renamed to `--modality` to be more precise. Update any scripts
or aliases using the old flag name.
```

---

## Pull Request Process

1. **Ensure** your branch is up to date with `upstream/main`:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push** your branch:
   ```bash
   git push origin feat/my-awesome-feature
   ```

3. **Open a Pull Request** against `main` on the upstream repository.

4. **Fill in the PR template** completely:
   - What does this PR do?
   - Why is this change needed?
   - How was it tested?
   - Any breaking changes?
   - Screenshots or logs if relevant

5. **Address review feedback** — maintainers may request changes. Push additional commits to the same branch; the PR will update automatically.

6. **Squash policy** — Maintainers may squash your commits on merge to keep the history clean. If you have many commits, consider squashing them yourself before the PR is merged.

7. **Merge** — A maintainer will merge your PR once it has been approved and all CI checks pass.

### PR Checklist

- [ ] All quality gate commands pass locally (`lint`, `typecheck`, `test`, `format:check`)
- [ ] New functionality is covered by tests
- [ ] `README.md` or `docs/` are updated if behaviour changes
- [ ] No secrets or API keys are committed
- [ ] Branch is rebased off the latest `main`

---

## Extending DocScope

### Adding a New File Extractor

DocScope is designed for extensibility. Adding support for a new file type (e.g., `.yaml`, `.docx`) involves four steps:

#### Step 1 — Create the extractor

```typescript
// packages/extractor/src/yaml.ts
import type { Extractor, FileInput, ExtractedDocument } from './types.js';

export class YamlExtractor implements Extractor {
  supports(mime: string, path: string): boolean {
    return mime === 'application/x-yaml' || path.endsWith('.yaml') || path.endsWith('.yml');
  }

  async extract(input: FileInput): Promise<ExtractedDocument> {
    // Parse the YAML, return normalized ExtractedDocument
    const raw = input.content.toString('utf-8');
    return {
      content: raw,
      metadata: { mimeType: 'application/x-yaml' },
    };
  }
}
```

#### Step 2 — Register the extractor

Add an entry to `packages/extractor/src/registry.ts`:

```typescript
import { YamlExtractor } from './yaml.js';

// Inside the registry array:
new YamlExtractor(),
```

#### Step 3 — Create a matching chunker (if needed)

If the new format benefits from custom chunking logic (e.g., per-document chunking for YAML), add a chunker in `packages/chunker/src/` and register it in `packages/chunker/src/registry.ts`. Otherwise, the default text chunker will be used.

#### Step 4 — Update the shared type

Add the new extension to `FileTypeSchema` in `packages/shared-types/src/index.ts`:

```typescript
export const FileTypeSchema = z.enum(['text', 'code', 'pdf', 'image', 'yaml']);
```

#### Step 5 — Write tests

Add unit tests in `packages/extractor/src/__tests__/yaml.test.ts` covering:

- Supported MIME types and extensions
- Correct text extraction output
- Edge cases (empty file, malformed YAML, etc.)

---

### Adding a New Chunker

Follow the same pattern for chunkers in `packages/chunker/src/`. Implement the `Chunker` interface, register it in the chunker registry, and add tests.

---

## Code Style

DocScope enforces consistent style through automated tooling. There is no style debate — the tools decide.

| Tool           | Config                  | What it enforces                                                             |
| :------------- | :---------------------- | :--------------------------------------------------------------------------- |
| **ESLint**     | `eslint.config.mjs`     | TypeScript-aware linting, import ordering, no-unused-vars, etc.              |
| **Prettier**   | `.prettierrc`           | Single quotes, trailing commas, 100-character line width, 2-space indentation |
| **TypeScript** | `tsconfig.base.json`    | Strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`        |

**Key conventions:**

- All new code must be written in **TypeScript** with explicit types — avoid `any`.
- Use **named exports** over default exports.
- Use **ES modules** (`import`/`export`) throughout — no `require()`.
- Prefer `async`/`await` over raw Promises.
- Log using the shared `logger` from `@docscope/shared-utils` — never use `console.log` in production code.
- Never commit secrets, API keys, or credentials.

---

## Testing

DocScope uses [Vitest](https://vitest.dev/) with [Supertest](https://github.com/ladjs/supertest) for API-level tests.

### Running Tests

```bash
# All tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests
pnpm test:int

# API tests (requires running PostgreSQL + Redis)
pnpm test:api

# End-to-end tests
pnpm test:e2e

# Security-focused tests
pnpm test:security

# A specific package
cd packages/extractor && pnpm test:unit

# With coverage
pnpm test -- --coverage
```

### What to Test

When adding new functionality, please include tests that cover:

- **Happy path** — the expected normal behaviour
- **Edge cases** — empty inputs, boundary values, large inputs
- **Error paths** — invalid inputs, missing dependencies, network failures
- **Security** — if your code touches file paths, user input, or secrets

### Test Location Convention

Tests live alongside the source code:

```
packages/extractor/src/
├── yaml.ts
└── __tests__/
    └── yaml.test.ts
```

---

## Project Structure Quick Reference

```
DocScope/
├── apps/
│   ├── api/          # Express.js REST API server
│   └── cli/          # Commander.js CLI
├── packages/
│   ├── chunker/      # Modality-aware content chunking
│   ├── db/           # Prisma ORM + pgvector
│   ├── embeddings/   # Gemini Embedding 2 integration
│   ├── extractor/    # File content extraction (text, code, PDF, image)
│   ├── retrieval/    # Search & answer generation (RAG)
│   ├── security/     # Keychain, path guard, ignore engine, redactor
│   ├── shared-types/ # Zod schemas, DTOs, enums
│   └── shared-utils/ # Logger, SHA-256, path utils, formatters
├── infra/
│   └── docker/       # docker-compose.yml (PostgreSQL + Redis)
└── docs/             # Design documents and implementation plans
```

Each package under `packages/` is independently buildable and testable. Use `workspace:*` protocol when declaring cross-package dependencies in `package.json`.

---

## Recognition

All contributors are credited in the project's release notes. Significant contributions may be highlighted in the README.

Thank you again for helping make DocScope better. Every contribution counts. 💙
