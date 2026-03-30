import { Router, type IRouter } from "express";
import {
  getNseHistory,
  getGiftNiftyHistory,
  calculateIndicators,
  NSE_STOCKS,
} from "../lib/nseData.js";
import {
  getLiveQuote,
  getLiveMovers,
  getLiveGiftNifty,
  getLiveSectors,
  invalidateAllCache,
} from "../lib/liveMarketData.js";
import { getIntradaySuggestions, getOptionsSuggestions } from "../lib/suggestions.js";
import { invalidateTokenCache, testUpstoxConnection } from "../lib/upstoxClient.js";
import { db, portfolioTable, upstoxSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// ── Gift Nifty ──────────────────────────────────────────────────────────
router.get("/gift-nifty/quote", async (_req, res) => {
  try {
    res.json(await getLiveGiftNifty());
  } catch {
    res.status(500).json({ error: "Failed to fetch Gift Nifty data" });
  }
});

router.get("/gift-nifty/history", (req, res) => {
  const period = (req.query.period as string) || "3M";
  const data = getGiftNiftyHistory(period);
  res.json({ symbol: "GIFT NIFTY", period, data });
});

// ── NSE Market ──────────────────────────────────────────────────────────
router.get("/nse/movers", async (_req, res) => {
  try {
    res.json(await getLiveMovers());
  } catch {
    res.status(500).json({ error: "Failed to fetch market movers" });
  }
});

router.get("/nse/sectors", async (_req, res) => {
  try {
    res.json(await getLiveSectors());
  } catch {
    res.status(500).json({ error: "Failed to fetch sector data" });
  }
});

router.get("/nse/quote/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  if (!NSE_STOCKS[symbol]) {
    res.status(404).json({ error: "Symbol not found on NSE" });
    return;
  }
  try {
    const quote = await getLiveQuote(symbol);
    if (!quote) {
      res.status(404).json({ error: "Symbol not found on NSE" });
      return;
    }
    res.json(quote);
  } catch {
    res.status(500).json({ error: "Failed to fetch quote" });
  }
});

router.get("/nse/history/:symbol", (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  if (!NSE_STOCKS[symbol]) {
    res.status(404).json({ error: "Symbol not found on NSE" });
    return;
  }
  const period = (req.query.period as string) || "1M";
  const data = getNseHistory(symbol, period);
  res.json({ symbol, period, data });
});

// ── Portfolio ────────────────────────────────────────────────────────────
router.get("/portfolio", async (_req, res) => {
  const items = await db.select().from(portfolioTable).orderBy(portfolioTable.addedAt);
  res.json(
    items.map((i) => ({
      id: i.id,
      symbol: i.symbol,
      exchange: i.exchange,
      addedAt: i.addedAt.toISOString(),
      buyPrice: i.buyPrice ?? undefined,
      quantity: i.quantity ?? undefined,
    }))
  );
});

router.post("/portfolio", async (req, res) => {
  const { symbol, exchange = "NSE", buyPrice, quantity } = req.body;
  if (!symbol || typeof symbol !== "string") {
    res.status(400).json({ error: "Symbol is required" });
    return;
  }
  const upper = symbol.toUpperCase();
  const [existing] = await db.select().from(portfolioTable).where(eq(portfolioTable.symbol, upper));
  if (existing) {
    res.json({
      id: existing.id,
      symbol: existing.symbol,
      exchange: existing.exchange,
      addedAt: existing.addedAt.toISOString(),
      buyPrice: existing.buyPrice ?? undefined,
      quantity: existing.quantity ?? undefined,
    });
    return;
  }
  const [inserted] = await db
    .insert(portfolioTable)
    .values({
      symbol: upper,
      exchange: exchange.toUpperCase(),
      buyPrice: buyPrice ? Number(buyPrice) : null,
      quantity: quantity ? Number(quantity) : null,
    })
    .returning();
  res.json({
    id: inserted.id,
    symbol: inserted.symbol,
    exchange: inserted.exchange,
    addedAt: inserted.addedAt.toISOString(),
    buyPrice: inserted.buyPrice ?? undefined,
    quantity: inserted.quantity ?? undefined,
  });
});

router.delete("/portfolio/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  await db.delete(portfolioTable).where(eq(portfolioTable.symbol, symbol));
  res.json({ success: true });
});

router.get("/portfolio/:symbol/indicators", (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const indicators = calculateIndicators(symbol);
  if (!indicators) {
    res.status(404).json({ error: "Symbol not found" });
    return;
  }
  res.json(indicators);
});

// ── Upstox Settings ──────────────────────────────────────────────────────
router.get("/settings/upstox", async (_req, res) => {
  const [settings] = await db.select().from(upstoxSettingsTable).limit(1);
  if (!settings) {
    res.json({ connected: false, liveDataEnabled: false });
    return;
  }
  res.json({
    connected: true,
    apiKeyMasked: settings.apiKey.slice(0, 4) + "●●●●●●●●" + settings.apiKey.slice(-4),
    clientId: settings.clientId ?? undefined,
    connectedAt: settings.connectedAt.toISOString(),
    liveDataEnabled: settings.liveDataEnabled,
    hasAccessToken: !!settings.accessToken,
  });
});

router.post("/settings/upstox", async (req, res) => {
  const { apiKey, apiSecret, clientId, accessToken } = req.body;
  if (!apiKey || typeof apiKey !== "string") {
    res.status(400).json({ error: "API Key is required" });
    return;
  }
  // Remove existing, then insert
  await db.delete(upstoxSettingsTable);
  const [inserted] = await db
    .insert(upstoxSettingsTable)
    .values({
      apiKey,
      apiSecret: apiSecret || null,
      clientId: clientId || null,
      accessToken: accessToken || null,
      liveDataEnabled: true,
    })
    .returning();
  // Clear caches so next request uses the new token
  invalidateTokenCache();
  invalidateAllCache();
  res.json({
    connected: true,
    apiKeyMasked: inserted.apiKey.slice(0, 4) + "●●●●●●●●" + inserted.apiKey.slice(-4),
    clientId: inserted.clientId ?? undefined,
    connectedAt: inserted.connectedAt.toISOString(),
    liveDataEnabled: inserted.liveDataEnabled,
    hasAccessToken: !!inserted.accessToken,
  });
});

router.post("/settings/upstox/disconnect", async (_req, res) => {
  await db.delete(upstoxSettingsTable);
  invalidateTokenCache();
  invalidateAllCache();
  res.json({ success: true });
});

router.post("/settings/upstox/test", async (_req, res) => {
  try {
    const result = await testUpstoxConnection();
    res.json(result);
  } catch {
    res.status(500).json({ ok: false, source: "none", message: "Connection test failed unexpectedly." });
  }
});

// ── Suggestions ──────────────────────────────────────────────────────────
router.get("/suggestions/intraday", async (_req, res) => {
  try {
    res.json(await getIntradaySuggestions());
  } catch {
    res.status(500).json({ error: "Failed to generate intraday suggestions" });
  }
});

router.get("/suggestions/options", async (_req, res) => {
  try {
    res.json(await getOptionsSuggestions());
  } catch {
    res.status(500).json({ error: "Failed to generate options suggestions" });
  }
});

export default router;
