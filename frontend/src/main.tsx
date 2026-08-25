import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Automatically reload page when a new deployment has updated asset chunk hashes
window.addEventListener("vite:preloadError", (event) => {
  console.warn("New application build detected. Reloading latest assets...", event);
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
