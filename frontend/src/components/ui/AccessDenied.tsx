import { Lock } from "lucide-react";

import EmptyState from "./EmptyState";

export default function AccessDenied({ description }: { description?: string }) {
  return (
    <EmptyState
      icon={Lock}
      title="You don't have permission to view this"
      description={description ?? "Ask an organization owner if you need access."}
    />
  );
}
