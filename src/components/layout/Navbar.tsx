"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ScrapeResponse } from "@/types/contracts";

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", index: "01" },
  { href: "/artists", label: "Artists", index: "02" },
  { href: "/tracks", label: "Tracks", index: "03" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SyncState =
  | { phase: "idle" }
  | { phase: "sending" }
  | { phase: "done"; status: ScrapeResponse["status"]; message: string }
  | { phase: "failed"; message: string };

function SyncButton({
  sending,
  onTrigger,
}: {
  sending: boolean;
  onTrigger: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTrigger}
      aria-busy={sending}
      title="Runs a full catalog sync across every active artist. Paced sequentially, roughly one artist every 2–5 seconds."
      className="tactile group inline-flex min-h-11 items-center gap-2 border border-hairline bg-riser px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-chalk hover:border-signal/70 hover:text-signal active:bg-void"
    >
      <span
        aria-hidden="true"
        className={`block h-1.5 w-1.5 ${sending ? "bg-signal" : "bg-gain"}`}
      />
      {sending ? "Starting" : "Sync scene"}
      <svg
        aria-hidden="true"
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-60 transition-opacity group-hover:opacity-100"
      >
        <path d="M21 12a9 9 0 1 1-3.2-6.9" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}

/**
 * Navbar — mobile-first command bar.
 *
 * On desktop the left rail owns identity, so this bar carries navigation,
 * cadence state, and the single mutating action in the product.
 */
export function Navbar() {
  const pathname = usePathname() ?? "/";
  const [sync, setSync] = useState<SyncState>({ phase: "idle" });

  useEffect(() => {
    if (sync.phase !== "done" && sync.phase !== "failed") return;
    const timer = window.setTimeout(() => setSync({ phase: "idle" }), 10000);
    return () => window.clearTimeout(timer);
  }, [sync]);

  async function triggerSync() {
    if (sync.phase === "sending") return;
    setSync({ phase: "sending" });

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullCatalogSync: true }),
      });
      const payload = (await response.json()) as ScrapeResponse;

      if (payload.status === "error") {
        setSync({ phase: "failed", message: payload.message });
        return;
      }
      setSync({
        phase: "done",
        status: payload.status,
        message: payload.message,
      });
    } catch {
      setSync({
        phase: "failed",
        message: "Trigger failed — the scrape route did not respond.",
      });
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-pitch/85 backdrop-blur-sm">
      <div className="flex min-h-14 flex-wrap items-stretch gap-x-2 px-3 sm:flex-nowrap sm:px-5 lg:px-8">
        {/* Compact wordmark, mobile + tablet only */}
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2 pr-2 lg:hidden"
          aria-label="DHH Pulse home"
        >
          <span aria-hidden="true" className="block h-6 w-[2px] bg-signal" />
          <span className="font-mono text-[13px] font-semibold tracking-[0.18em] text-chalk">
            DHH
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-dim">
            Pulse
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="order-3 -mx-3 flex w-full min-w-0 items-stretch overflow-x-auto border-t border-hairline/60 px-3 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:border-t-0 sm:px-0"
        >
          <ul className="flex items-stretch">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href} className="flex items-stretch">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`tactile relative flex min-h-11 items-center gap-2 px-3 font-mono text-[10px] uppercase tracking-[0.14em] sm:px-4 ${
                      active ? "text-chalk" : "text-dim hover:text-ash"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`hidden font-mono text-[9px] sm:inline ${
                        active ? "text-signal" : "text-dim"
                      }`}
                    >
                      {item.index}
                    </span>
                    {item.label}
                    <span
                      aria-hidden="true"
                      className={`absolute inset-x-2 bottom-0 h-[2px] ${
                        active ? "bg-signal opacity-100" : "opacity-0"
                      }`}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:ml-0 sm:gap-3">
          <span className="hidden items-center gap-2 border border-hairline px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-dim md:flex">
            <span aria-hidden="true" className="block h-1 w-1 bg-gain" />
            24h cadence
          </span>
          <SyncButton sending={sync.phase === "sending"} onTrigger={triggerSync} />
        </div>
      </div>

      {(sync.phase === "done" || sync.phase === "failed") && (
        <div
          role="status"
          aria-live="polite"
          className={`border-t px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] sm:px-5 lg:px-8 ${
            sync.phase === "failed"
              ? "border-loss/30 bg-loss/[0.06] text-loss"
              : "border-signal/25 bg-signal/[0.05] text-signal"
          }`}
        >
          {sync.message}
        </div>
      )}

      {sync.phase === "sending" && (
        <div className="sr-only" role="status" aria-live="polite">
          Starting scene sync
        </div>
      )}
    </header>
  );
}
