# Project Authors and Contributors

## Primary Author and Maintainer

- **Divyansh**
  - GitHub: [@divyprj](https://github.com/divyprj)
  - Contact: `surajdivyansh104@gmail.com`
  - Role: Project Lead, System Architect, and Repository Owner
  - Scope: Platform concept, contract architecture, database design, scraper engine, analytics logic, and user interface.

## Multi-Agent Engineering Architecture

The codebase was implemented and verified under the Aragon & Gemini High-Throughput Specification (documented in `AGENTS.md`) using specialized agent roles:

- **Chief Architect (Divyansh Account)**: System planning, DAG task decomposition, immutable contracts authoring (`src/types/contracts.ts`).
- **Senior Systems & Backend (Pratyush Account)**: Scraper engine, rate limiting, and database schema implementation.
- **Analytics & Math Specialist (OpenCode Beam)**: Stream delta computation, negative delta clamping, and catalog aggregation logic.
- **Fast Feature & UI Coder (OpenCode DeepSeek)**: Next.js 15 App Router views and Tailwind CSS v4 components.
- **QA & Security Auditor (Rudraksh Account)**: Code diff audits, SQL parameterization checks, test verification, and automated push governance.
- **Visual Inspector (OpenCode Nemotron)**: Multimodal UI audit against the Frontend Craft Triad specification.
