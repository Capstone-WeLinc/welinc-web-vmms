import { StrictMode } from "react";
import type { ReactElement, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";

const FutureBrowserRouter = BrowserRouter as typeof BrowserRouter & ((props: {
  children: ReactNode;
  future?: {
    v7_startTransition?: boolean;
    v7_relativeSplatPath?: boolean;
  };
}) => ReactElement);

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
