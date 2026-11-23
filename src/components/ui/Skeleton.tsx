import type { CSSProperties } from "react";

/**
 * Skeleton — composite-only shimmer placeholder.
 *
 * The sweep is a translated gradient layer (`transform`), never a
 * `background-position` animation, so it stays on the compositor.
 *
 * Always render inside a container marked `aria-busy="true"`; the blocks
 * themselves are decorative.
 */
export interface SkeletonProps {
  className?: string;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
}

export function Skeleton({ className = "", width, height }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton ${className}`}
      style={{ width, height }}
    />
  );
}

/** Stacked text lines with a natural ragged right edge. */
export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  const widths = ["100%", "94%", "72%", "88%", "61%", "97%"];
  return (
    <div aria-hidden="true" className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-2.5"
          width={widths[index % widths.length]}
        />
      ))}
    </div>
  );
}

/** A single metric unit: uppercase label rail + big numeric plate. */
export function SkeletonStat({
  className = "",
  valueClassName = "h-8 w-28",
}: {
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 ${className}`} aria-hidden="true">
      <Skeleton className="h-2 w-20" />
      <Skeleton className={`${valueClassName} max-w-full`} />
    </div>
  );
}

/** Table body placeholder that preserves the real row rhythm (52px). */
export function SkeletonTableRows({
  rows = 8,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} aria-hidden="true" className="h-row">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <td key={colIndex} className="px-3 py-3">
              <Skeleton
                className="h-3"
                width={
                  colIndex === 0
                    ? "1.5rem"
                    : colIndex === 1
                      ? "70%"
                      : `${35 + ((rowIndex + colIndex) % 4) * 12}%`
                }
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
