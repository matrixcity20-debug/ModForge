import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import express from "express";
import app from "./app";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rawPort = process.env["PORT"];
const port = rawPort ? Number(rawPort) : 3001;

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// In production: serve the built frontend static files
if (process.env.NODE_ENV === "production") {
  const staticDir = path.resolve(__dirname, "../public");
  if (fs.existsSync(staticDir)) {
    // Serve Vite build output
    app.use(express.static(staticDir));
    // SPA fallback — use app.use() (no path argument) to avoid
    // path-to-regexp v8 wildcard syntax issues in Express 5.
    // Must be registered AFTER express.static() and API routes.
    app.use((_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
    logger.info({ staticDir }, "Serving static frontend");
  } else {
    logger.warn({ staticDir }, "Static dir not found — run 'npm run build' first");
  }
}

const server = app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port, env: process.env.NODE_ENV ?? "development" }, "Server listening");
});

// AI generation can take up to 5 minutes per model across the fallback chain.
server.timeout          = 600_000; // 10 minutes
server.keepAliveTimeout = 620_000;
server.headersTimeout   = 630_000;
