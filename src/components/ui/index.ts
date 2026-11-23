/**
 * UI barrel — shared console primitives.
 *
 * Public import surface: `@/components/ui`
 */
export { Skeleton, SkeletonStat, SkeletonTableRows, SkeletonText } from "./Skeleton";
export type { SkeletonProps } from "./Skeleton";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps, EmptyStateIcon } from "./EmptyState";

export { ErrorBoundary, ErrorState } from "./ErrorBoundary";
export type { ErrorBoundaryProps, ErrorStateProps } from "./ErrorBoundary";
