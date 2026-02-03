import React from "react";
import { createRoot } from "react-dom/client";

import "@patternfly/react-core/dist/styles/base.css";

import Application from "./app.jsx";
import "./app.scss";

document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("app");
  if (!el) {
    console.error("[sudo-manager-react] mount element #app not found");
    return;
  }

  createRoot(el).render(<Application />);
});
