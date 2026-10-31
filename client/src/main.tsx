import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import { AuthProviderWithHistory } from "./auth/AuthProvider.js";
import "./theme.css";

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AuthProviderWithHistory>
        <App />
      </AuthProviderWithHistory>
    </React.StrictMode>,
  );
}
