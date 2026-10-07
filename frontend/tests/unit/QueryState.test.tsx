import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import QueryState from "../../src/components/ui/QueryState";
import { ApiError, NetworkError } from "../../src/services/apiClient";

interface Row {
  id: string;
}

function renderList(props: Partial<React.ComponentProps<typeof QueryState<Row[]>>> = {}) {
  return render(
    <QueryState<Row[]>
      isLoading={false}
      isError={false}
      error={null}
      data={[{ id: "a" }]}
      loading={<p>Loading rows…</p>}
      empty={<p>No rows yet — create your first</p>}
      isEmpty={(rows) => rows.length === 0}
      {...props}
    >
      {(rows) => <p>{rows.length} row(s)</p>}
    </QueryState>,
  );
}

describe("QueryState", () => {
  it("renders data when the query succeeded", () => {
    renderList();
    expect(screen.getByText("1 row(s)")).toBeInTheDocument();
  });

  it("renders the loading slot while genuinely in flight", () => {
    renderList({ isLoading: true, data: undefined });
    expect(screen.getByText("Loading rows…")).toBeInTheDocument();
  });

  it("renders the empty slot when the fetch returned nothing", () => {
    renderList({ data: [] });
    expect(screen.getByText(/create your first/i)).toBeInTheDocument();
    expect(screen.queryByText("Loading rows…")).not.toBeInTheDocument();
  });

  // The regression this component exists for. The old guard was
  // `if (isLoading || !data) return <Skeleton/>`, and on failure react-query
  // leaves data undefined while isLoading is false -- so that branch rendered a
  // loading message that never went away.
  it("renders the error state when data is undefined AND isLoading is false", () => {
    renderList({
      isError: true,
      isLoading: false,
      data: undefined,
      error: new ApiError(500, null),
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Loading rows…")).not.toBeInTheDocument();
  });

  it("prefers the error state over loading when both could apply", () => {
    renderList({ isError: true, isLoading: true, data: undefined, error: new ApiError(503, null) });
    expect(screen.queryByText("Loading rows…")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("offers a retry that re-runs the query", () => {
    const refetch = vi.fn();
    renderList({ isError: true, data: undefined, error: new ApiError(500, null), refetch });

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("omits the retry control when no refetch is available", () => {
    renderList({ isError: true, data: undefined, error: new ApiError(500, null) });
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });

  it("surfaces the server's own message rather than a generic fallback", () => {
    renderList({
      isError: true,
      data: undefined,
      error: new ApiError(403, { detail: "User limit reached — your trial includes 3 users." }),
      errorFallback: "Generic fallback",
    });
    expect(screen.getByText(/your trial includes 3 users/i)).toBeInTheDocument();
    expect(screen.queryByText("Generic fallback")).not.toBeInTheDocument();
  });

  it("describes a timed-out request without leaking AbortError", () => {
    renderList({ isError: true, data: undefined, error: new NetworkError(true) });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/taking longer than expected/i);
    expect(alert).not.toHaveTextContent(/abort/i);
  });

  it("describes an unreachable server in plain language", () => {
    renderList({ isError: true, data: undefined, error: new NetworkError(false) });
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't reach the server/i);
  });

  it("never shows a bare status code as the whole message", () => {
    renderList({ isError: true, data: undefined, error: new ApiError(500, null) });
    const text = screen.getByRole("alert").textContent ?? "";
    expect(text).not.toMatch(/^\s*(4\d\d|5\d\d)\s*$/);
    expect(text).toMatch(/our end/i);
  });
});
