import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./index.css";

/**
 * Retry budget: none.
 *
 * A screen has to reach data, empty, or an error within 15s. With the 12s
 * per-request deadline in apiClient, `retry: 1` would allow two attempts and
 * push the worst case to ~24s -- past the point the screen is allowed to still
 * be undecided. Lowering the deadline instead would make a slow-but-healthy
 * backend look broken.
 *
 * Automatic retry is also redundant now: every error state renders an explicit
 * Retry control, so a user who wants another attempt asks for one, and sees
 * what happened in the meantime instead of watching a longer spinner.
 */
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 10_000 } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
