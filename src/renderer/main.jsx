import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

// Full-mode stylesheet system
import "./styles/app.css";
import "./styles/layout.css";
import "./styles/editor.css";
import "./styles/sidebar.css";
import "./styles/topbar.css";
import "./styles/terminal.css";
import "./styles/prompt.css";
import "./styles/status.css";
import "./styles/error-boundary.css"; // Phase 7.5: Error Boundary styles

const root = createRoot(document.getElementById("root"));
root.render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>
);
