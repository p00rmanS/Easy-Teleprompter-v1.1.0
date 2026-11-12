import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Keep in sync with the Content-Security-Policy header in netlify.toml. GitHub Pages cannot
// set response headers, so production builds also embed the policy as a <meta> tag
// (frame-ancestors is header-only and is intentionally omitted here).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasedatabase.app wss://*.firebasedatabase.app",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// Inserted straight after <meta charset> (which must stay within the first 1024 bytes) and before
// any script or stylesheet, so the policy covers everything that follows it.
const cspMeta = (): Plugin => ({
  name: "csp-meta",
  apply: "build",
  transformIndexHtml: {
    order: "post",
    handler: (html) => html.replace(/(<meta charset="UTF-8"\s*\/?>)/i, `$1\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  },
});

// BASE_PATH lets the same build target a sub-path host (GitHub Pages project site: "/repo-name/")
// or a root host (Netlify, default "/").
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "BASE_");
  return {
    base: env.BASE_PATH || "/",
    plugins: [react(), cspMeta()],
    build: { target: "es2020", sourcemap: false },
  };
});
