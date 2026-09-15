import path from "node:path";
import { defineConfig } from "vite";
import dotenv from "dotenv";
import { expand } from "dotenv-expand";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({command}) => {
  let scriptSrcPolicy = "'self'";
  let styleSrcPolicy = "'self'";
  let connectSrcPolicy = "'self'";

  if (command === "serve") {
    scriptSrcPolicy = "'self' 'unsafe-inline' https://maps.googleapis.com";
    styleSrcPolicy = "'self' 'unsafe-inline' https://unpkg.com";
    connectSrcPolicy = "'self' ws://localhost:3000 ws://127.0.0.1:3000 http://localhost:3000 http://localhost:8080 https://maps.googleapis.com";
  }


  const env = {
    parsed: {
      // Load root .env
      ...(dotenv.config({
        path: path.resolve(__dirname, "../../.env"),
      }).parsed || {}),
      // Load workspace-specific .env, overriding duplicates
      ...(dotenv.config({
        path: path.resolve(__dirname, "./.env"),
      }).parsed || {}),
    },
  }
  expand(env);

  // Map thee to Vite's `define` so they are accessible via import.meta.env.*
  const processEnv = {};
  for (const key in env.parsed) {
    if (key.startsWith("VITE_")) {
      processEnv[`import.meta.env.${key}`] = JSON.stringify(env.parsed[key]);
    }
  }

  
  
  return {
    define: processEnv,
    plugins: [react()],
    server: {
      port: 3000,
      headers: {
        "Content-Security-Policy": [
          "default-src 'self';",
          `script-src ${scriptSrcPolicy};`,
          `script-src-elem ${scriptSrcPolicy};`,
          `style-src ${styleSrcPolicy};`,
          `connect-src ${connectSrcPolicy};`,
          "img-src 'self' blob: https: data:;",
          "worker-src 'self' blob:;"
        ].join(' ')
      },
    },
  };
})
