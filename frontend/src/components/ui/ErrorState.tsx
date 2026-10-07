import { AlertTriangle } from "lucide-react";

import Button from "./Button";
import EmptyState from "./EmptyState";

/**
 * Terminal state for a failed fetch: says what went wrong in words a trader can
 * act on, and offers the way out. Built on EmptyState so error, empty, and
 * access-denied all read as the same family rather than three inventions.
 */
export default function ErrorState({
  description,
  onRetry,
  title = "We couldn't load this",
}: {
  description: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div role="alert">
      <EmptyState
        icon={AlertTriangle}
        title={title}
        description={description}
        action={
          onRetry ? (
            <Button variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
