import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import { TestingApp } from "./TestingApp";
import "./testing.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TestingApp />
  </React.StrictMode>,
);
