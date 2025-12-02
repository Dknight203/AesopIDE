import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Full-mode stylesheet system
import "./styles/app.css";
import "./styles/layout.css";
import "./styles/editor.css";
import "./styles/sidebar.css";
import "./styles/topbar.css";
import "./styles/terminal.css";
import "./styles/prompt.css";
import "./styles/status.css";

const root = createRoot(document.getElementById("root"));
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
