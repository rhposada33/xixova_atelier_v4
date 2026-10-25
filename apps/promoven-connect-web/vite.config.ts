import { defineConfig } from "vite";
import process from "node:process";
import react from "@vitejs/plugin-react";
import { validateRemoteEnvironment } from "./src/deployment-policy";

export default defineConfig(({ mode }) => {
  const remote = mode === "remote";
  if ((process.env.VERCEL || process.env.VERCEL_ENV) && !remote) {
    throw new Error("Na Vercel use npm run build:vercel.");
  }
  const target = remote ? validateRemoteEnvironment(process.env) : undefined;
  return {
    // Remote builds must never load the developer's .env.local or .env.production.
    envDir: remote ? false : undefined,
    // Explicitly inject the single approved public value, not platform metadata.
    envPrefix: remote ? [] : "VITE_",
    define: remote ? { "import.meta.env.VITE_CONNECT_ENV": JSON.stringify(target) } : undefined,
    plugins: [react(), ...(remote ? [{
      name: "connect-remote-entry",
      transformIndexHtml: { order: "pre" as const, handler: (html: string) => html.replace("/src/main.tsx", "/src/main.remote.tsx") },
    }] : [])],
    server: { host: "127.0.0.1", port: 5178, strictPort: true },
  };
});
