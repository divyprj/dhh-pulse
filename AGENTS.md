# DHH Pulse — Multi-Model AI Autonomous Development Team Architecture
# Governed by the Aragon & Gemini High-Throughput Specification & The Frontend Craft Triad

This document is the binding operational specification for all agents, subagents, and automated workflows inside T3 Code for the **DHH Pulse** project.

---

## 1. Multi-Agent Team Hierarchy & Role Registry

The development team is organized into specialized, non-overlapping roles utilizing your configured accounts and models:

| Role | Provider Instance | Assigned Model | Operational Scope & Responsibilities |
|---|---|---|---|
| **Chief Architect & Spec Planner** | **Divyansh** (Antigravity 1) | `gemini-3.8-flash-high` / `claude-opus-4-6-thinking` | **Technical Lead & Orchestrator.** Evaluates requirements in `PROJECT_BRIEF.md`, decides the technical architecture and tech stack, authors initial type/data contracts, decomposes work into a DAG of tasks in `.agent-state/tasks/`, coordinates workers, and approves final deliverables. Does NOT write routine feature code. |
| **State Router & Dispatcher** | **OpenCode** | `opencode/nemotron-3.5-lightning-free` | **Zero-Cost Automator.** 262K context. Monitors `.agent-state/tasks/` status JSONs, runs deterministic CLI test commands, and dispatches tasks to workers without consuming Pro quota. Never modifies source code in `src/`. |
| **Senior Systems & Backend** | **Pratyush** (Antigravity 2) | `claude-sonnet-4-6` | **Core Systems Engineer.** Implements data scrapers, auth mechanisms, databases, snapshot calculation logic, rate-limit mitigations, and resolves escalated 2nd-strike rejections. |
| **Fast Feature & UI Coder** | **OpenCode** | `opencode/deepseek-v4.1-flash-free` | **Rapid Client Coder.** Zero token cost. Develops responsive UI layouts, leaderboards, interactive charts, and styling strictly conforming to anti-slop craft standards. |
| **Visual Inspector** | **OpenCode** | `opencode/nemotron-3.5-super-vl-free` | **Multimodal Design Auditor.** Inspects rendered UI screenshots against responsive layout specs, touch target ergonomics, and visual hierarchy. |
| **Principal QA & Auditor** | **Rudraksh** (Antigravity 3) | `gemini-3.8-flash-high` | **Independent Gatekeeper.** Audits `git diff`, test coverage, security boundaries, and rate-limit safety ONLY after pre-flight automated tests pass. Issues binary `APPROVED` or `REJECTED` verdicts. |

---

## 2. Core Operating Guardrails

### Rule 1: Contract-First Development
* Before any implementation begins, **Divyansh (Chief Architect)** designs all shared schemas, types, and API contracts into a central contract file and marks it **READ-ONLY**.
* Workers import contracts; they are strictly forbidden from modifying contracts directly. If a contract is insufficient, workers emit `BLOCKED_CONTRACT_MISMATCH` to request an architectural review.

### Rule 2: Disjoint File Ownership (`write_scope`)
* Every active task must have a strictly isolated `write_scope` (array of file paths).
* **Parallel workers must NEVER share a file in `write_scope`.**
  - Backend and frontend workers operate in parallel on mutually exclusive files.
  - Shared files (`package.json`, root barrel exports, router files) may only be modified sequentially or by the Architect.

### Rule 3: Automated Pre-Flight CLI Gate (Quota Saver)
* Workers must execute their assigned CLI verification command (e.g. `pnpm tsc --noEmit`, `pytest`, `npm test`) before reporting task completion.
* If tests or lint fail, the worker fixes its own code locally. **Rudraksh (QA) is NEVER invoked on basic syntax or compile errors.**

### Rule 4: Two-Strike Circuit Breaker
* Each task allows a maximum of 2 attempts (`max_attempts: 2`).
* If a worker fails verification or is rejected by QA twice, the State Router trips the circuit breaker and reassigns the task directly to **Pratyush (Senior Systems Engineer)** for surgical completion.

---

## 3. Loop Engineering Protocol

All work follows an iterative, controlled engineering loop:

```
Plan (Architect)
  └──> Delegate (State Router)
         └──> Implement (Scoped Worker)
                └──> Pre-Flight Verify (CLI Test Command)
                       ├── [Fails] ──> Self-Fix (Attempt < 2) or Escalate to Senior (Attempt >= 2)
                       └── [Passes]
                              └──> Independent Audit (QA Auditor via Git Diff)
                                     ├── [Rejected] ──> Remediation Loop
                                     └── [Approved] ──> Auto-Commit & Auto-Push
```

1. **Planning:** Architect analyzes `PROJECT_BRIEF.md`, defines interfaces, and creates task JSON files in `.agent-state/tasks/`.
2. **Delegation:** Router dispatches tasks to designated models based on capability and quota tier.
3. **Implementation:** Scoped workers write code strictly within their assigned `write_scope`.
4. **Pre-Flight Verification:** Automated tests run via CLI to prove functionality with concrete exit codes.
5. **Independent Review:** An independent model (different from the implementer) reviews the diff for bugs and security flaws.
6. **Remediation / Escalation:** Any rejection includes exact line numbers and concrete remediations. 2nd strikes escalate to Pratyush.
7. **Verification & Auto-Push:** Once the QA Auditor issues `APPROVED`, the task is marked complete, committed with semantic message, and automatically pushed to the remote repository.

---

## 4. Cloud Infrastructure, Account Identity & Auto-Push Directive

### User Identity & Cloud Integrations:
* **Primary Account Email:** `surajdivyansh104@gmail.com`
* **GitHub Username:** `divyprj` (Active & authenticated on the local system via `gh` CLI).
* **Connected Cloud Platforms (Vercel, Supabase, Firebase, etc.):** When provisioning databases, hosting, or deployment keys, always bind to the account under `surajdivyansh104@gmail.com`.

### Mandatory Auto-Push Policy:
* The team operates with an **Automated Git Push** mandate.
* **Trigger:** Immediately upon QA Auditor (`Rudraksh`) approval of any task or milestone.
* **Procedure:**
  1. If no remote exists, create or link the remote repository under `divyprj` using GitHub CLI:
     ```bash
     gh repo create dhh-pulse --private --source=. --remote=origin --push
     ```
  2. Commit using Conventional Commits (`feat(...)`, `fix(...)`, `chore(...)`).
  3. Auto-push to `origin main` (or the active feature branch):
     ```bash
     git push origin main
     ```
  4. Never leave completed, QA-verified tasks unpushed.

---


## 5. Automated Subagent Dispatch Commands (T3 CLI)

The Orchestrator (`Divyansh`) or State Router can spawn delegated subagents directly from the terminal using the installed `t3` CLI:

```bash
# 1. Dispatch Fast Feature & UI Coder (OpenCode DeepSeek Flash):
t3 thread start . "Execute task T-102 in .agent-state/tasks/T-102.json" --provider opencode --model opencode/deepseek-v4.1-flash-free --wait

# 2. Dispatch Senior Systems & Backend (Pratyush / Claude Sonnet 4.6):
t3 thread start . "Execute task T-101 in .agent-state/tasks/T-101.json" --provider Pratyush --model claude-sonnet-4-6 --wait

# 3. Dispatch Visual Inspector (OpenCode Nemotron Super VL):
t3 thread start . "Inspect UI layout screenshot in .agent-state/screenshots/" --provider opencode --model opencode/nemotron-3.5-super-vl-free --wait

# 4. Dispatch Independent QA & Security Auditor (Rudraksh / Gemini 3.8 Flash High):
t3 thread start . "Audit git diff and verify task T-101 against acceptance criteria" --provider Rudraksh --model gemini-3.8-flash --wait
```

---

## 5. Strict Anti-AI-Slop & Design Craft Directives

Every user interface created for this project must strictly comply with the **Frontend Craft Triad** (Impeccable, Taste Skill, and Emil Kowalski Motion Physics):

```
┌────────────────────────────────────────────────────────────────────────┐
│                   THE FRONTEND CRAFT TRIAD                             │
├──────────────────────────┬──────────────────────────┬──────────────────┤
│   1. ART DIRECTION       │   2. UX ARCHITECTURE     │ 3. MOTION & FEEL │
│      (Taste Skill)       │       (Impeccable)       │  (Emil Kowalski) │
├──────────────────────────┼──────────────────────────┼──────────────────┤
│ • Anti-slop bans         │ • Mode: Operate          │ • 60fps GPU only │
│ • Subject-first aesthetic│ • Zero placeholder slop  │ • Spring physics │
│ • High-contrast dark     │ • Dense, scanable data   │ • Tactile states │
│ • Raw DHH street rhythm  │ • Resilient layout       │ • Mobile-native  │
└──────────────────────────┴──────────────────────────┴──────────────────┘
```

### Pillar 1: Banish Generic AI Slop (`taste-skill`)
* ❌ **Prohibited AI Defaults:**
  - No centered 3-line hero headlines with floating pill badges above them.
  - No generic 3-column feature cards with colorful icon squares in the top-left corner.
  - No purple/blue SaaS gradient blobs or generic template styling.
  - No unconsidered plain fonts with flat visual hierarchy.
  - No monotonous 1px solid gray borders around every box.
* ✅ **Rooted in Desi Hip Hop Culture:**
  - High-contrast monochromatic dark mode with stark typographic scale, cassette/raw audio tape motifs, and subtle industrial or amber accents.
  - The stream statistics, artist leaderboards, and daily growth numbers must lead the visual hierarchy.

### Pillar 2: UX Architecture & Systems Craft (`impeccable`)
* **Mode: `Operate`**: Maximize data density, scanability, and quick interaction for music data analysts.
* **The Craft Floor (Zero Tolerance for Incomplete Work):**
  - No dummy placeholders (`lorem ipsum`, `TODO`, `Song 1`).
  - Implement all UI states: Default, Loading (skeletons), Active, Empty, and Error.
  - **Stress-Test Layouts:** Components must survive 1-character artist names ("R") and 100-character unbroken song titles without layout overflow or text clipping.
  - **Touch Ergonomics:** Minimum $44\text{px} \times 44\text{px}$ touch targets on all buttons and interactive rows.

### Pillar 3: Motion Physics & 60fps GPU (`emil-design-eng`)
* **Composite-Friendly Motion Only:** Animate **ONLY** `transform` and `opacity`.
  - ❌ NEVER animate `width`, `height`, `margin`, `padding`, `top`, or `left`.
* **Natural Physical Emergence:** Never scale from zero (`transform: scale(0)`). Scale from `0.95` with `opacity: 0`.
* **Tactile Interactions:** Buttons and interactive cards must provide physical press feedback (`active:scale-[0.97]` or `translate-y-[1px]`).
* **Mobile-Native:** Use `100dvh` (dynamic viewport height) and eliminate sticky hover traps using `@media (hover: hover)`.

---

## 6. State Machine Handoff Schema (`.agent-state/tasks/<id>.json`)

```json
{
  "task_id": "T-101",
  "title": "Clear task description",
  "assigned_agent": "Pratyush",
  "provider_instance": "Pratyush",
  "model": "claude-sonnet-4-6",
  "status": "QUEUED",
  "attempt_count": 0,
  "max_attempts": 2,
  "scope": {
    "write_scope": ["path/to/target/file.py"],
    "read_only_scope": ["contracts.py", "AGENTS.md", "PROJECT_BRIEF.md"]
  },
  "acceptance_criteria": [
    "Specific verifiable behavior 1",
    "Specific verifiable behavior 2"
  ],
  "verification": {
    "cmd": "deterministic CLI verification command",
    "passed": false
  },
  "qa_feedback": [],
  "escalate_to": "Pratyush"
}
```
