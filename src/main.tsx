/* eslint-disable react-refresh/only-export-components -- Application entrypoint bootstraps React and exports no components. */
import { StrictMode } from "react";
import type { ReactElement, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { bootSession } from "./lib/session/session";
import { useBackend } from "./lib/api/httpClient";

const FutureBrowserRouter = BrowserRouter as typeof BrowserRouter & ((props: {
  children: ReactNode;
  future?: {
    v7_startTransition?: boolean;
    v7_relativeSplatPath?: boolean;
  };
}) => ReactElement);

function render() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <FutureBrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </FutureBrowserRouter>
    </StrictMode>,
  );
}

if (useBackend) void bootSession().finally(render);
else render();
