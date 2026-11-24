# Security Policy

## 1. Supported Versions

Security updates and patches are applied to the active branch of this repository.

| Version | Supported | Notes |
|---|---|---|
| `main` / `team` (0.1.x) | Yes | Current development branch. |
| Legacy commits (< 0.1.0) | No | Deprecated prototype commits. |

## 2. Reporting a Vulnerability

If you discover a security vulnerability, do not report it through public GitHub issues or public pull requests.

Send a detailed vulnerability report privately to:
- **Email:** `surajdivyansh104@gmail.com`
- **Subject Line:** `[SECURITY] DHH Pulse Vulnerability Report`

Include the following information in your report:
1. Target component or file path (e.g., `src/app/api/scrape/route.ts`).
2. Description of the vulnerability and its potential impact.
3. Step-by-step reproduction instructions or proof-of-concept payload.
4. Suggested mitigation or code remediation, if known.

Reports will be acknowledged within 48 hours.

## 3. Security Architecture Highlights

- **SQL Injection Prevention:** 100% of SQLite database queries use parameterized statements (`db.prepare('... WHERE col = ?')`). Dynamic string concatenation into SQL statements is prohibited.
- **Timing-Safe Authentication:** API trigger token validation in `src/app/api/scrape/route.ts` uses `crypto.timingSafeEqual` to eliminate timing attacks.
- **Zero Secrets Exposure:** The application does not store Spotify user passwords, developer API client secrets, or private credentials. Scraper requests rely entirely on ephemeral public guest access tokens.
- **Single-Flight Concurrency:** The ingestion route enforces a process-local mutex (`syncInFlight`) preventing race conditions and denial-of-service loops on local storage.
