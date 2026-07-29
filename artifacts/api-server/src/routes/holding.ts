import { Router, type IRouter } from "express";
import {
  getHoldingAnalysis,
  getHoldingScan,
  getPreviousPicks,
  parseUniverse,
} from "../lib/holding/index.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

/**
 * Holding Stocks scan.
 *
 * A cold scan fans out across the universe, so the engine caches per post-close
 * boundary and collapses concurrent first-requests — see lib/holding/engine.ts.
 */
router.get("/holding/scan", async (req, res) => {
  try {
    const universe = parseUniverse(req.query.universe);
    res.json(await getHoldingScan(universe));
  } catch (err) {
    logger.error(`[holding] scan failed: ${(err as Error).message}`);
    res.status(502).json({ error: "Holding scan is temporarily unavailable" });
  }
});

router.get("/holding/picks/:symbol/analysis", async (req, res) => {
  try {
    const universe = parseUniverse(req.query.universe);
    const analysis = await getHoldingAnalysis(universe, req.params.symbol);
    if (!analysis) {
      res.status(404).json({ error: "No analysis available for that symbol" });
      return;
    }
    res.json(analysis);
  } catch (err) {
    logger.error(`[holding] analysis failed: ${(err as Error).message}`);
    res.status(502).json({ error: "Holding analysis is temporarily unavailable" });
  }
});

router.get("/holding/previous-picks", async (_req, res) => {
  try {
    res.json(await getPreviousPicks());
  } catch (err) {
    logger.error(`[holding] previous picks failed: ${(err as Error).message}`);
    res.status(502).json({ error: "Previous picks are temporarily unavailable" });
  }
});

export default router;
