"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./Navbar";

const SYSTEM_ROWS = [
  { key: "Source", value: "Pathfinder" },
  { key: "Cadence", value: "24h" },
  { key: "Storage", value: "SQLite / WAL" },
  { key: "Budget", value: "$0" },
] as const;

function CassetteMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 62"
      className="h-auto w-full text-dim"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    >
      <rect x="1" y="1" width="118" height="60" rx="3" />
      <rect x="12" y="10" width="96" height="27" rx="2" />
      <circle cx="34" cy="23.5" r="7.5" />
      <circle cx="34" cy="23.5" r="2.2" />
      <circle cx="86" cy="23.5" r="7.5" />
      <circle cx="86" cy="23.5" r="2.2" />
      <path d="M41.5 23.5h37" strokeDasharray="2 4" />
      <path d="M30 44h60l-7 12H37z" />
      <path d="M46 47.5h28" strokeDasharray="2 3" />
    </svg>
  );
}

/**
 * Sidebar — desktop console rail.
 *
 * Identity, navigation with numbered stations, and the machine facts an
 * operator actually needs (source, cadence, storage, budget). Hidden below
 * `lg`, where the Navbar takes over navigation.
 */
export function Sidebar() {
  const pathname = usePathname() ?? "/";

  function active(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-rail flex-col border-r border-hairline bg-void/80 lg:flex">
      <div className="deck-rule" aria-hidden="true" />

      {/* Identity ------------------------------------------------------- */}
      <div className="border-b border-hairline px-5 py-5">
        <p className="eyebrow">Desi hip hop</p>
        <Link
          href="/"
          className="group mt-3 flex min-h-11 items-center gap-2.5"
          aria-label="DHH Pulse — dashboard"
        >
          <span aria-hidden="true" className="block h-9 w-[3px] bg-signal" />
          <span className="flex flex-col leading-none">
            <span className="text-[22px] font-semibold tracking-[-0.03em] text-chalk">
              DHH
              <span className="text-signal">.</span>
              PULSE
            </span>
            <span className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-dim">
              Stream intelligence
            </span>
          </span>
        </Link>
      </div>

      {/* Navigation ----------------------------------------------------- */}
      <nav aria-label="Console" className="px-3 py-5">
        <p className="eyebrow px-2">Navigate</p>
        <ul className="mt-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const current = active(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={`tactile group relative flex min-h-11 items-center gap-3 px-2 font-mono text-[11px] uppercase tracking-[0.14em] ${
                    current
                      ? "bg-riser text-chalk"
                      : "text-ash hover:bg-riser/50 hover:text-chalk"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-[2px] ${
                      current ? "bg-signal" : "bg-transparent"
                    }`}
                  />
                  <span
                    className={`text-[9px] ${
                      current ? "text-signal" : "text-dim"
                    }`}
                  >
                    {item.index}
                  </span>
                  {item.label}
                  <span
                    aria-hidden="true"
                    className={`ml-auto h-[1px] w-3 ${
                      current ? "bg-signal" : "bg-transparent"
                    }`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Machine facts -------------------------------------------------- */}
      <div className="border-t border-hairline px-5 py-5">
        <p className="eyebrow">System</p>
        <dl className="mt-3 space-y-2">
          {SYSTEM_ROWS.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-3">
              <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-dim">
                {row.key}
              </dt>
              <dd className="font-mono text-[10px] text-ash">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Motif + build -------------------------------------------------- */}
      <div className="mt-auto border-t border-hairline px-5 py-5">
        <div className="w-full max-w-[132px]">
          <CassetteMark />
        </div>
        <p className="mt-4 font-mono text-[9px] uppercase leading-relaxed tracking-[0.14em] text-dim">
          Side A · daily snapshot
          <br />
          <span className="text-dim">v0.1.0 — operate mode</span>
        </p>
      </div>
    </aside>
  );
}
