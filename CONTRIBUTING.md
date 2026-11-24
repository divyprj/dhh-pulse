# Contributing Guidelines

Thank you for your interest in contributing to DHH Pulse. To maintain engineering standards, contract integrity, and repository stability, all contributors must adhere to the protocols outlined below.

---

## 1. Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/divyprj/dhh-pulse.git
   cd dhh-pulse
   ```

2. **Install dependencies:**
   ```bash
   npm ci
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env.local
   ```

4. **Verify local test suite:**
   ```bash
   npm test
   npm run type-check
   ```

---

## 2. Architectural Guardrails

### Rule 1: Immutable Contracts
`src/types/contracts.ts` is the central source of truth for all types and data models. Contributors must **never** modify this file directly. If a contract is insufficient, open an issue proposing an architectural escalation.

### Rule 2: 100% Parameterized SQL
All database queries in `src/lib/db/`, `src/lib/scraper/`, and `src/lib/analytics/` must use parameterized prepared statements (`db.prepare(...)`). Concatenating variables into SQL strings will result in immediate rejection.

### Rule 3: Anti-AI-Slop and Frontend Craft
UI modifications must comply with the Frontend Craft Triad (`docs/design/design.md`):
- No generic SaaS cards or purple/blue gradient blobs.
- Enforce 44x44px minimum touch targets on all interactive elements.
- Animate only composite-friendly properties (`transform` and `opacity`).
- Implement all four UI states (Default, Loading, Empty, Error) for any new view.

---

## 3. Branching and Commits

- **Branch Naming:**
  - `feat/description` for new features or endpoints.
  - `fix/description` for bug repairs.
  - `docs/description` for documentation improvements.
  - `test/description` for test additions.
- **Commit Messages:** Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
  - `feat(scope): short description`
  - `fix(scope): short description`
  - `docs(scope): short description`
  - `test(scope): short description`

---

## 4. Pre-Flight Verification Gate

Before submitting a pull request, run the deterministic test commands locally:

```bash
# 1. Type validation
npm run type-check

# 2. Unit test execution (all tests must pass)
npm test

# 3. Production build check
npm run build
```

Pull requests failing any of these gates will not be reviewed.

---

## 5. Pull Request Submission

1. Submit pull requests against the `main` branch.
2. Complete all sections of the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md).
3. Ensure test coverage is included for any newly introduced logic.
