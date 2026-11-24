# Deployment and Operations Guide

## 1. Hosting Architecture Considerations

DHH Pulse relies on an embedded SQLite database (`better-sqlite3`) that requires a persistent local filesystem and native C++ compiled bindings.

### Runtime Requirements
- **Serverless Limitation:** Ephemeral serverless environments (e.g. AWS Lambda, Vercel Serverless Functions) are **not recommended** for the full application because their filesystem is ephemeral. A write to `data/dhh-pulse.sqlite` will be discarded when the serverless container spins down.
- **Recommended Host:** Any persistent Linux/Unix server, Virtual Private Server (VPS), or Docker container with persistent volume mounts:
  - Hetzner / DigitalOcean / Linode / AWS EC2.
  - Self-hosted homelab server or Raspberry Pi 4+.

---

## 2. Production Deployment (Node.js / PM2)

### 1. Build and Setup
```bash
# Clone and install production dependencies
git clone https://github.com/divyprj/dhh-pulse.git
cd dhh-pulse
npm ci --omit=dev

# Build the Next.js bundle
npm run build
```

### 2. Process Management via PM2
Create an `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: "dhh-pulse",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      restart_delay: 5000,
    },
  ],
};
```

Start the application:
```bash
pm2 start ecosystem.config.js
pm2 save
```

---

## 3. Scheduled Automated Ingestion (GitHub Actions)

A GitHub Actions workflow is provided at `workflows/daily-scrape.yml`.

### Workflow Mechanics
- **Schedule:** Runs every day at 06:00 UTC (`cron: "0 6 * * *"`).
- **Cache Persistence:** Restores `data/dhh-pulse.sqlite` from GitHub Actions cache (`actions/cache@v4`).
- **Scraper Execution:** Runs `npx tsx scripts/scrape.ts` in production mode.
- **Artifact Retention:** Uploads a 30-day downloadable artifact (`actions/upload-artifact@v4`) of the SQLite database.
- **Git Commit:** Force-adds the updated SQLite database snapshot and commits it back to the repository with `[skip ci]`.

> **Note on Enabling in GitHub Actions:** GitHub restricts creating or updating workflows under `.github/workflows/` unless the Git credential has the explicit `workflow` OAuth scope. To activate the workflow, copy `workflows/daily-scrape.yml` to `.github/workflows/daily-scrape.yml` using an authorized GitHub Personal Access Token (PAT) with the `workflow` permission.

---

## 4. Database Backup and Recovery

### Local Backup
Because SQLite is in WAL mode, creating a safe hot backup while the application is running should use the SQLite `.backup` command:

```bash
sqlite3 data/dhh-pulse.sqlite ".backup 'backups/dhh-pulse-$(date +%Y%m%d).sqlite'"
```

### Recovery
To restore from a backup:
1. Stop the application process (`pm2 stop dhh-pulse`).
2. Replace `data/dhh-pulse.sqlite` with the backup copy.
3. Remove any residual WAL files (`rm data/dhh-pulse.sqlite-wal data/dhh-pulse.sqlite-shm`).
4. Restart the application (`pm2 start dhh-pulse`).
