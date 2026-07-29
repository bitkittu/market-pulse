import app from "./app";
import { logger } from "./lib/logger";
import { seedAuthDefaults } from "./lib/auth.js";
import { startHoldingScheduler } from "./lib/holding/scheduler.js";
import { connectDb } from "@workspace/db";

const rawPort = process.env["PORT"] ?? "3001";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// The server only starts once the database is reachable. Serving without it
// would produce a site that loads but fails every data request with a 500,
// which is far harder to diagnose than a process that refuses to boot.
connectDb()
  .then(() => seedAuthDefaults())
  .then(() => {
    logger.info("MySQL connected and auth defaults seeded");

    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");

      // Records the post-close Holding Stocks scan even on days nobody opens
      // the page — started after listen() so a scan can never delay boot.
      startHoldingScheduler();
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to connect to database / seed defaults");
    console.error(
      "[startup] Database connection/seed FAILED:",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  });
