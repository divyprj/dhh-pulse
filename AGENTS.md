# Autonomous Multi-Model AI Development Team Architecture (T3 Code)
# Governed by the Aragon & Gemini High-Throughput Specification & T3.md

This document defines the 10 specialized agent roles, model allocations across 3 Antigravity Pro accounts and OpenCode Free, inter-thread ACP delegation protocols, and the unified Loop Engineering state machine.

---

## 1. Team Hierarchy & Verified Model Registry

| Role | Provider / Account | Primary Model | Fallback Model | Core Responsibilities |
|---|---|---|---|---|
| **Chief Architect & Swarm Director** | **Antigravity Acct 1** (`Divyansh`) | `claude-opus-4-6-thinking` | `gemini-3.8-flash` | DAG decomposition, authoring immutable `contracts.ts`, orchestrating child threads via `t3_thread_launch`. |
| **Senior Systems & Backend** | **Antigravity Acct 2** (`Pratyush`) | `claude-sonnet-4-6` | `gemini-3.8-flash` | Core business logic, APIs, rate limiting with polite jitter, exponential backoff, and auth. |
| **Database Specialist** | **Antigravity Acct 2** (`Pratyush`) | `claude-sonnet-4-6` | `gemini-3.8-flash` | SQLite WAL singleton, schema migrations, indexes, 100% parameterized SQL query enforcement. |
| **Analytics & Math Specialist** | **OpenCode Free** | `opencode/beam-free` | `gemini-3.8-flash` | Time-series aggregations, rolling window analytics, 24h delta calculation with negative clamping. |
| **Fast Feature & UI Coder** | **OpenCode Free** | `opencode/deepseek-v4.1-flash-free` | `claude-sonnet-4-6` | Next.js 15 App Router, React components, Tailwind CSS v4 dark mode, 60fps GPU motion. |
| **Visual & UX Inspector** | **OpenCode Free** | `opencode/nemotron-3.5-super-vl-free` | `gemini-3.8-flash` | Multimodal UI inspection, WCAG AA contrast (chalk-on-pitch), 44x44px touch targets, layout stress testing. |
| **Debugging Specialist** | **Antigravity Acct 2** (`Pratyush`) | `claude-sonnet-4-6` | `gemini-3.8-flash` | Surgical bug-fixing triggered on 2nd failure strike; root-cause analysis and compiler error repair. |
| **QA & Security Auditor** | **Antigravity Acct 3** (`Rudraksh`) | `gemini-3.8-flash` (high) | `claude-sonnet-4-6` | Independent diff review, security auditing, SQL injection checks, test suite validation. |
| **Auto-Push Gatekeeper** | **Antigravity Acct 3** (`Rudraksh`) | `gemini-3.8-flash` (high) | `claude-sonnet-4-6` | Executes Conventional Commits and pushes verified code directly to GitHub (`origin/team`). |
| **Docs & Type Generator** | **OpenCode Free** | `opencode/nemotron-3.5-lightning-free` | `opencode/flint-40b-free` | Generates docstrings, API schemas, and README documentation asynchronously post-merge. |

---

## 2. Core Operating Guardrails

### Rule 1: Contract-First Development
* Before any implementation begins, **Antigravity Account 1** authors all shared types, schemas, and API contracts into `src/types/contracts.ts`.
* Once created, `src/types/contracts.ts` is **LOCKED AS READ-ONLY**. Workers may not modify it without an architectural escalation.

### Rule 2: Disjoint File Ownership (`write_scope`)
* Every active task must have a strictly isolated `write_scope` (array of file paths).
* **Parallel workers must NEVER share a file in `write_scope`.**
* Barrel exports (`index.ts`), router manifests, and `package.json` may only be modified sequentially or by the Architect.

### Rule 3: Deterministic Pre-Flight CLI Gate (Quota Saver)
* Workers must execute the assigned deterministic verification command (e.g. `npx tsc --noEmit && npm test`) before handoff.
* If tests or lint fail, the worker fixes its own code locally. **Antigravity Account 3 is never invoked on basic compile/syntax errors.**

### Rule 4: Two-Strike Circuit Breaker & Quota Fallback
* Each task allows a maximum of 2 attempts (`max_attempts: 2`).
* If an OpenCode free worker fails twice OR reports `Free usage limit reached`, the Orchestrator trips the circuit breaker and reassigns the task to **Antigravity Account 2 (Pratyush / Claude Sonnet)** or **Account 3 (Rudraksh / Gemini 3.8 Flash)** for instant surgical completion.

---

## 3. The 5-Stage Swarm Loop Protocol

```
[1. TEST]   ───> Runs `tsc`, `vitest`, and `next build`
     │
     ├── If FAIL ──> [2. ROUTE]  Orchestrator routes bug to specialist:
     │                           • DB / Scraper  -> Pratyush (Sonnet)
     │                           • Math / Deltas -> Gemini 3.8 Flash
     │                           • UI / Styling  -> DeepSeek Flash
     │                                  │
     │                                  ▼
     │               [3. FIX]    Specialist patches file in scope
     │                                  │
     │                                  ▼
     │               [4. RE-TEST] Re-runs test gate until EXIT 0
     │
[5. VERIFY] ───> Nemotron (Visual/UX) + Rudraksh (Security/Contract)
     │
     ▼
[6. PUSH]   ───> Conventional Commit & `git push origin main:team`
```
