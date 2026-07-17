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
  getLiveIndiaVix,
  invalidateAllCache,
  getGlobalIndexQuote,
  getGlobalIndexHistory,
  getLiveCommodities,
  getUsdToInr,
  getCommodityHistory,
} from "../lib/liveMarketData.js";
import { getIntradaySuggestions, getOptionsSuggestions } from "../lib/suggestions.js";
import { getDecisionPanel } from "../lib/decisionEngine.js";
import { invalidateTokenCache, testUpstoxConnection } from "../lib/upstoxClient.js";
import { analyzeFoTrade } from "../lib/foAnalyzer.js";
import { collections, nextId } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

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

// NSE India real-time intraday chart for Nifty 50 (used for "Today" period)
router.get("/gift-nifty/intraday", async (_req, res) => {
  try {
    const resp = await fetch(
      "https://www.nseindia.com/api/chart-databyindex?index=NIFTY%2050&indices=true",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://www.nseindia.com/",
        },
      }
    );
    if (!resp.ok) { res.json({ data: [], source: "closed" }); return; }
    const json = (await resp.json()) as {
      grapthData?: [number, number][];
      closePrice?: number;
    };
    const points = (json.grapthData ?? []).map(([ts, price]) => ({
      timestamp: ts,
      price,
      label: new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }),
    }));
    res.json({ data: points, closePrice: json.closePrice ?? 0, source: points.length > 0 ? "nse" : "closed" });
  } catch {
    res.json({ data: [], source: "closed" });
  }
});

// ── Trading Decision Engine ────────────────────────────────────────────
let decisionCache: { data: Awaited<ReturnType<typeof getDecisionPanel>>; expiry: number } | null = null;

router.get("/decision-engine", async (_req, res) => {
  try {
    if (decisionCache && decisionCache.expiry > Date.now()) {
      res.json(decisionCache.data);
      return;
    }
    const panel = await getDecisionPanel();
    decisionCache = { data: panel, expiry: Date.now() + 60_000 };
    res.json(panel);
  } catch (err) {
    console.error("Decision engine error:", err);
    res.status(500).json({ error: "Failed to compute decision panel" });
  }
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

router.get("/nse/india-vix", async (_req, res) => {
  try {
    res.json(await getLiveIndiaVix());
  } catch {
    res.status(500).json({ error: "Failed to fetch India VIX" });
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
router.get("/portfolio", requireAuth, async (req, res) => {
  try {
    const items = await collections
      .portfolio()
      .find({ userId: req.user!.id })
      .sort({ addedAt: 1 })
      .toArray();
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
  } catch (err) {
    req.log.error({ err }, "Failed to fetch portfolio");
    res.status(500).json({ error: "Failed to fetch portfolio" });
  }
});

router.post("/portfolio", requireAuth, async (req, res) => {
  try {
    const { symbol, exchange = "NSE", buyPrice, quantity } = req.body;
    if (!symbol || typeof symbol !== "string") {
      res.status(400).json({ error: "Symbol is required" });
      return;
    }
    const upper = symbol.toUpperCase();
    const existing = await collections.portfolio().findOne({ userId: req.user!.id, symbol: upper });
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
    const inserted = {
      id: await nextId("portfolio"),
      userId: req.user!.id,
      symbol: upper,
      exchange: String(exchange).toUpperCase(),
      buyPrice: buyPrice ? Number(buyPrice) : null,
      quantity: quantity ? Number(quantity) : null,
      addedAt: new Date(),
    };
    await collections.portfolio().insertOne(inserted);
    res.json({
      id: inserted.id,
      symbol: inserted.symbol,
      exchange: inserted.exchange,
      addedAt: inserted.addedAt.toISOString(),
      buyPrice: inserted.buyPrice ?? undefined,
      quantity: inserted.quantity ?? undefined,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to add portfolio item");
    res.status(500).json({ error: "Failed to add portfolio item" });
  }
});

router.delete("/portfolio/:symbol", requireAuth, async (req, res) => {
  try {
    const symbol = String(req.params.symbol).toUpperCase();
    await collections.portfolio().deleteOne({ userId: req.user!.id, symbol });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete portfolio item");
    res.status(500).json({ error: "Failed to delete portfolio item" });
  }
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
router.get("/settings/upstox", requireAuth, async (req, res) => {
  try {
    const settings = await collections.upstoxSettings().findOne({ userId: req.user!.id });
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
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Upstox settings");
    res.json({ connected: false, liveDataEnabled: false });
  }
});

router.post("/settings/upstox", requireAuth, async (req, res) => {
  try {
    const { apiKey, apiSecret, clientId, accessToken } = req.body;
    if (!apiKey || typeof apiKey !== "string") {
      res.status(400).json({ error: "API Key is required" });
      return;
    }
    await collections.upstoxSettings().deleteMany({ userId: req.user!.id });
    const inserted = {
      id: await nextId("upstox_settings"),
      userId: req.user!.id,
      apiKey,
      apiSecret: apiSecret || null,
      clientId: clientId || null,
      accessToken: accessToken || null,
      liveDataEnabled: true,
      connectedAt: new Date(),
    };
    await collections.upstoxSettings().insertOne(inserted);
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
  } catch (err) {
    req.log.error({ err }, "Failed to save Upstox settings");
    res.status(500).json({ error: "Failed to save Upstox settings" });
  }
});

router.post("/settings/upstox/disconnect", requireAuth, async (req, res) => {
  try {
    await collections.upstoxSettings().deleteMany({ userId: req.user!.id });
    invalidateTokenCache();
    invalidateAllCache();
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to disconnect Upstox");
    res.status(500).json({ error: "Failed to disconnect" });
  }
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

// ── Commodities ─────────────────────────────────────────────────────────────
const VALID_COMMODITY_SYMBOLS = new Set([
  "GC=F","SI=F","CL=F","BZ=F","NG=F","HG=F","PL=F","ZW=F","ZC=F","ZS=F",
]);

router.get("/commodities", async (_req, res) => {
  try {
    const [commodities, usdToInr] = await Promise.all([
      getLiveCommodities(),
      getUsdToInr(),
    ]);
    res.json({ updatedAt: new Date().toISOString(), usdToInr, commodities });
  } catch {
    res.status(500).json({ error: "Failed to fetch commodity data" });
  }
});

router.get("/commodities/history", async (req, res) => {
  const symbol = req.query.symbol as string;
  const period = (req.query.period as string) || "3M";
  if (!symbol || !VALID_COMMODITY_SYMBOLS.has(symbol)) {
    res.status(400).json({ error: "Invalid commodity symbol" });
    return;
  }
  try {
    const data = await getCommodityHistory(symbol, period);
    res.json({ symbol, period, data });
  } catch {
    res.status(500).json({ error: `Failed to fetch history for ${symbol}` });
  }
});

// ── Global Indices (Yahoo Finance) ──────────────────────────────────────────
const ALLOWED_GLOBAL = new Set(["^NYA", "000001.SS", "^HSI", "^NSEI"]);

router.get("/global-index/quote", async (req, res) => {
  const ticker = req.query.ticker as string;
  if (!ticker || !ALLOWED_GLOBAL.has(ticker)) {
    res.status(400).json({ error: "Invalid ticker. Allowed: ^NYA, 000001.SS, ^HSI, ^NSEI" });
    return;
  }
  try {
    res.json(await getGlobalIndexQuote(ticker));
  } catch {
    res.status(500).json({ error: `Failed to fetch quote for ${ticker}` });
  }
});

router.get("/global-index/history", async (req, res) => {
  const ticker = req.query.ticker as string;
  const period = (req.query.period as string) || "3M";
  if (!ticker || !ALLOWED_GLOBAL.has(ticker)) {
    res.status(400).json({ error: "Invalid ticker. Allowed: ^NYA, 000001.SS, ^HSI, ^NSEI" });
    return;
  }
  try {
    const data = await getGlobalIndexHistory(ticker, period);
    res.json({ ticker, period, data });
  } catch {
    res.status(500).json({ error: `Failed to fetch history for ${ticker}` });
  }
});

// ── F&O AI Analyzer ───────────────────────────────────────────────────────
router.post("/fo-analyzer", async (req, res) => {
  try {
    const { symbol, optionType, strikePrice, buyPrice, currentPremium, lots, expiry, entryTime, stopLoss, target } = req.body;
    if (!symbol || !optionType || !strikePrice || !buyPrice || !currentPremium || !lots || !expiry) {
      res.status(400).json({ error: "Missing required fields: symbol, optionType, strikePrice, buyPrice, currentPremium, lots, expiry" });
      return;
    }
    if (!["CE", "PE", "FUT"].includes(optionType)) {
      res.status(400).json({ error: "optionType must be CE, PE, or FUT" });
      return;
    }
    const result = await analyzeFoTrade({
      symbol: String(symbol),
      optionType: optionType as "CE" | "PE" | "FUT",
      strikePrice: Number(strikePrice),
      buyPrice: Number(buyPrice),
      currentPremium: Number(currentPremium),
      lots: Number(lots),
      expiry: String(expiry),
      entryTime: entryTime ? String(entryTime) : undefined,
      stopLoss: stopLoss !== undefined ? Number(stopLoss) : undefined,
      target: target !== undefined ? Number(target) : undefined,
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "F&O analyzer error");
    res.status(500).json({ error: "Failed to analyze trade" });
  }
});

export default router;
