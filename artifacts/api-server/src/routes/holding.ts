import { Router, type IRouter } from "express";
import {
  getHoldingAnalysis,
  getHoldingScan,
  getPreviousPicks,
  parseUniverse,
} from "../lib/holding/index.js";
import { logger } from "../lib/logger.js";
import { requireAuth, requireFeature } from "../lib/auth.js";
import { recordFeatureUsage } from "../lib/features/resolve.js";

const router: IRouter = Router();

/**
 * Holding Stocks scan.
 *
 * A cold scan fans out across the universe, so the engine caches per post-close
 * boundary and collapses concurrent first-requests — see lib/holding/engine.ts.
 */
router.get("/holding/scan", requireAuth, requireFeature("holding_stocks"), async (req, res) => {
  try {
    const universe = parseUniverse(req.query.universe);
    res.json(await getHoldingScan(universe));
  } catch (err) {
    logger.error(`[holding] scan failed: ${(err as Error).message}`);
    res.status(502).json({ error: "Holding scan is temporarily unavailable" });
  }
});

router.get("/holding/picks/:symbol/analysis", requireAuth, requireFeature("holding_stocks"), async (req, res) => {
  try {
    const universe = parseUniverse(req.query.universe);
    // Multiple middleware before the handler loses Express's literal-path
    // param inference (same quirk documented in admin-email.ts) — `symbol`
    // types as string | string[] even though a single `:symbol` segment is
    // always a plain string at runtime.
    const analysis = await getHoldingAnalysis(universe, req.params.symbol as string);
    if (!analysis) {
      res.status(404).json({ error: "No analysis available for that symbol" });
      return;
    }
    res.json(analysis);
    if (req.effectivePlanKey) void recordFeatureUsage(req.user!.id, req.effectivePlanKey, "holding_stocks");
  } catch (err) {
    logger.error(`[holding] analysis failed: ${(err as Error).message}`);
    res.status(502).json({ error: "Holding analysis is temporarily unavailable" });
  }
});

router.get("/holding/previous-picks", requireAuth, requireFeature("holding_stocks"), async (_req, res) => {
  try {
    res.json(await getPreviousPicks());
  } catch (err) {
    logger.error(`[holding] previous picks failed: ${(err as Error).message}`);
    res.status(502).json({ error: "Previous picks are temporarily unavailable" });
  }
});

export default router;
