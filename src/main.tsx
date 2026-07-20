import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import EasyTeleprompter from "./EasyTeleprompter";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><EasyTeleprompter /></StrictMode>,
);
