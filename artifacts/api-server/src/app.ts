import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Behind nginx in production, this makes req.ip / req.secure reflect the
// real client (via X-Forwarded-For) instead of the reverse proxy itself.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ── Serve the built frontend (single-process deploys, e.g. Hostinger) ──────
// In dev the Vite server serves the UI, so this stays inert unless a build
// exists. Override the location with FRONTEND_DIST if your host differs.
const bundleDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDist =
  process.env["FRONTEND_DIST"] ??
  path.resolve(bundleDir, "../../stock-dashboard/dist/public");

if (existsSync(path.join(frontendDist, "index.html"))) {
  logger.info({ frontendDist }, "Serving frontend static files");

  // Hashed assets can be cached hard; index.html must not be.
  app.use(express.static(frontendDist, { index: false }));

  // SPA fallback: any non-API GET returns index.html for client-side routing.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  logger.warn({ frontendDist }, "No frontend build found; serving API only");
}

export default app;
