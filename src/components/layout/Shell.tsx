import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";

/**
 * Shell — the console frame.
 *
 * Fixed rail on desktop, sticky command bar everywhere, and a `100dvh`
 * substrate that survives mobile browser chrome. Content is capped at 1440px
 * so dense ledgers never stretch into unreadable scan lines.
 */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-pitch">
      <a
        href="#console"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:border focus:border-signal focus:bg-riser focus:px-4 focus:font-mono focus:text-[11px] focus:uppercase focus:tracking-[0.12em] focus:text-chalk"
      >
        Skip to console
      </a>

      <Sidebar />

      <div className="flex min-h-[100dvh] flex-col lg:pl-rail">
        <Navbar />

        <main
          id="console"
          className="mx-auto w-full max-w-[1440px] flex-1 px-3 pb-16 pt-5 sm:px-5 sm:pt-7 lg:px-8"
        >
          {children}
        </main>

        <footer className="border-t border-hairline px-3 py-5 sm:px-5 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-2 font-mono text-[9px] uppercase tracking-[0.14em] text-dim">
            <p>DHH Pulse — snapshot engine</p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Source: Spotify Pathfinder</span>
              <span aria-hidden="true" className="text-hairline">
                /
              </span>
              <span>Storage: SQLite · WAL</span>
              <span aria-hidden="true" className="text-hairline">
                /
              </span>
              <span>Budget: $0</span>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
