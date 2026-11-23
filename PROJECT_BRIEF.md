# Project Brief: DHH Pulse — Desi Hip Hop Spotify Intelligence

## 1. Project Overview & Objective
Build an automated, high-throughput stream and audience intelligence platform dedicated to the Desi Hip Hop (DHH) ecosystem. The platform must track, analyze, and visualize daily playcounts, monthly listener trends, and catalog performance for 100–200+ DHH artists (e.g. KR$NA, Seedhe Maut, MC Stan, DIVINE, Raftaar, Talha Anjum, Talhah Yunus, Karma, Raga, Bella, etc.) and their complete song discographies.

The technical architecture, language, database, and frameworks are **NOT pre-assigned**. The **Chief Architect (Divyansh)** is responsible for analyzing these requirements, selecting the optimal cross-platform technology stack, and designing the architecture.

---

## 2. In-Depth Functional Requirements

### 1. Song-Level Stream Tracking (Lifetime & Daily Growth)
* **Lifetime Playcounts:** Extract exact lifetime stream counts for every track across all singles, EPs, and albums in an artist's discography.
* **Derived Daily Streams:** Because Spotify does not expose an official "daily stream" metric publicly, daily streams must be calculated mathematically via snapshot comparison:
  $$\text{Daily Streams} = \text{Streams}_{\text{today}} - \text{Streams}_{\text{yesterday}}$$
* **Negative Delta Guards:** Handle edge cases such as track metadata migrations or deduplication shifts to prevent negative daily stream anomalies.
* **Collabs & Feature Credits:** Track collaborations (e.g., songs featuring multiple DHH artists) and attribute stream performance appropriately across credited artists.

### 2. Artist-Level Audience Tracking
* **Monthly Listeners:** Capture the exact monthly listener count for every tracked artist.
* **Daily Listener Delta:** Calculate net daily listener changes ($\Delta = \text{Listeners}_{\text{today}} - \text{Listeners}_{\text{yesterday}}$).
* **Followers & Public Ranks:** Track follower counts and global/regional rankings where publicly exposed.

### 3. Catalog & Artist Management
* **Scale:** Support 100–200 artists at launch, designed to scale to 500+ artists without architecture degradation.
* **Registry Management:** Provide a clean mechanism to add, edit, or deactivate tracked artists using their Spotify Artist ID or public profile link.
* **Catalog Sync:** Distinguish between lightweight daily stream updates and periodic deep-catalog discovery (discovering newly dropped singles or albums).

### 4. Historical Analytics & Data Retention
* **Long-Term Persistence:** Store daily snapshot records permanently.
* **Time-Series Analysis:** Enable comparative trajectory analysis (day-over-day, week-over-week, month-over-month).
* **Aggregations:** Aggregate total daily streams across an artist's entire catalog to identify top daily gainers and scene-wide momentum.

### 5. Analytics UI & Data Visualization
* **Artist Leaderboard:** Ranked by daily stream gain, monthly listeners, and total streams.
* **Top Gainer Tracks:** Daily top-streamed songs across the entire scene.
* **Artist Trajectory Curves:** Interactive historical growth charts comparing artist trajectories.
* **Anti-AI-Slop Compliance:** The interface must strictly obey the Art Direction and Design Engineering standards in `AGENTS.md`.

---

## 3. Strict Non-Functional Requirements & Constraints

1. **$0 Budget (Zero Cost):**
   * Must not require paid proxy networks. Scraper traffic must be paced with polite, randomized request jitter to prevent IP blocks on standard residential connections.
   * Must not depend on paid third-party scraper APIs (e.g. Apify, ScrapingBee).
   * Must not require paid database or hosting subscriptions.
2. **Native Cross-Platform Execution:**
   * Must run cleanly and identically on Linux, Windows, and macOS without platform-specific binary dependencies or fragile hacks.
3. **Data Source Mechanics:**
   * The official Spotify Web API intentionally omits exact track playcounts and monthly listeners (returning only a relative popularity score).
   * Data collection must leverage Spotify's internal web player layer (e.g., Pathfinder GraphQL endpoints) using guest session authentication.
4. **Automated 24h Execution:**
   * Must be capable of automated, unattended 24-hour execution (e.g., free GitHub Actions cron or native OS scheduled task).

---

## 4. Account Identity, Cloud Providers & Auto-Push

* **Project Owner / Primary Email:** `surajdivyansh104@gmail.com`
* **GitHub Username:** `divyprj` (Authenticated locally via `gh` CLI).
* **Cloud Services (Vercel, Supabase, Firebase, etc.):** Any cloud integration or deployment must associate with the account tied to `surajdivyansh104@gmail.com`.
* **Automated Git Push:** Every verified and QA-approved task must be automatically committed and pushed to the remote GitHub repository under `@divyprj`.
