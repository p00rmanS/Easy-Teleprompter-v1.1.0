import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import EasyTeleprompter from "./EasyTeleprompter";
import { AuthProvider } from "./auth/AuthContext";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><AuthProvider><EasyTeleprompter /></AuthProvider></StrictMode>,
);
