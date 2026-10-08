import type { ReactNode } from "react";

import ErrorState from "./ErrorState";
import { describeApiError } from "../../services/apiClient";

interface Props<T> {
  /** From useQuery. */
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  data: T | undefined;
  /** useQuery's refetch, wired to the error state's Try again. */
  refetch?: () => void;
  /** Shown only while genuinely in flight -- usually the screen's own skeleton. */
  loading: ReactNode;
  /** Shown when the fetch succeeded but there is nothing to show. */
  empty?: ReactNode;
  /** Decides emptiness; screen-specific, so the screen supplies it. */
  isEmpty?: (data: T) => boolean;
  /** Fallback error text for causes describeApiError can't interpret. */
  errorFallback?: string;
  children: (data: T) => ReactNode;
}

/**
 * Resolves a query into exactly one of three terminal states -- data, empty, or
 * error-with-retry -- so loading is always transient.
 *
 * This exists because the obvious guard is wrong:
 *
 *     if (isLoading || !data) return <Skeleton />;   // don't
 *
 * On failure react-query sets isLoading false and leaves data undefined, so that
 * condition is still true and the screen shows a loading state forever. Checking
 * isError *first* is the whole point; every screen going through this component
 * gets that ordering for free.
 */
export default function QueryState<T>({
  isLoading,
  isError,
  error,
  data,
  refetch,
  loading,
  empty,
  isEmpty,
  errorFallback = "Something went wrong loading this. Please try again.",
  children,
}: Props<T>) {
  // Error before loading: the ordering that prevents the stuck-screen bug.
  if (isError) {
    return <ErrorState description={describeApiError(error, errorFallback)} onRetry={refetch} />;
  }

  if (isLoading) return <>{loading}</>;

  // Not loading, not an error, but still no data. Reachable for a disabled or
  // idle query, and treating it as an error would be a lie -- nothing failed.
  if (data === undefined) return <>{loading}</>;

  if (empty && isEmpty?.(data)) return <>{empty}</>;

  return <>{children(data)}</>;
}
