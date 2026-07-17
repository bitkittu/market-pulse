import { Router, type IRouter } from "express";
import {
  getStockQuote,
  generatePriceHistory,
  getSectorPerformance,
  STOCKS,
  getDailySeed,
  seededRandom,
  getAiAnalysis,
  getAiMarketSummary,
} from "../lib/stockData.js";
import { collections, nextId } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";

const router: IRouter = Router();

const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "NFLX", "JPM", "JNJ"];

router.get("/stocks/quotes", async (req, res) => {
  const symbolsParam = req.query.symbols as string | undefined;
  const symbols = symbolsParam
    ? symbolsParam.split(",").map((s) => s.trim().toUpperCase())
    : DEFAULT_SYMBOLS;

  const quotes = symbols
    .map((s) => getStockQuote(s))
    .filter(Boolean);

  res.json(quotes);
});

router.get("/stocks/:symbol/history", (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const period = (req.query.period as string) || "1M";

  if (!STOCKS[symbol]) {
    res.status(404).json({ error: "Symbol not found" });
    return;
  }

  const data = generatePriceHistory(symbol, period);
  res.json({ symbol, period, data });
});

router.get("/stocks/indices", (_req, res) => {
  const seed = getDailySeed();
  const indices = [
    {
      name: "S&P 500",
      symbol: "SPX",
      baseValue: 5248.3,
      seed: seed * 3,
    },
    {
      name: "NASDAQ",
      symbol: "COMP",
      baseValue: 16421.5,
      seed: seed * 7,
    },
    {
      name: "Dow Jones",
      symbol: "DJI",
      baseValue: 39127.8,
      seed: seed * 11,
    },
    {
      name: "VIX",
      symbol: "VIX",
      baseValue: 14.8,
      seed: seed * 13,
    },
    {
      name: "Russell 2000",
      symbol: "RUT",
      baseValue: 2082.4,
      seed: seed * 17,
    },
  ];

  const result = indices.map(({ name, symbol, baseValue, seed: s }) => {
    const r = seededRandom(s);
    const changePercent = parseFloat(((r - 0.48) * 3).toFixed(2));
    const value = parseFloat((baseValue * (1 + changePercent / 100)).toFixed(2));
    const change = parseFloat((value - baseValue).toFixed(2));
    return { name, symbol, value, change, changePercent };
  });

  res.json(result);
});

router.get("/stocks/movers", (_req, res) => {
  const seed = getDailySeed();
  const allSymbols = Object.keys(STOCKS);

  const quotes = allSymbols.map((s) => getStockQuote(s)).filter(Boolean) as ReturnType<typeof getStockQuote>[];
  const sorted = [...quotes].sort((a, b) => b!.changePercent - a!.changePercent);

  res.json({
    gainers: sorted.slice(0, 5),
    losers: sorted.slice(-5).reverse(),
  });
});

router.get("/stocks/sectors", (_req, res) => {
  res.json(getSectorPerformance());
});

router.get("/watchlist", requireAuth, async (req, res) => {
  const items = await collections
    .watchlist()
    .find({ userId: req.user!.id })
    .sort({ addedAt: 1 })
    .toArray();
  res.json(items.map((i) => ({ id: i.id, symbol: i.symbol, addedAt: i.addedAt.toISOString() })));
});

router.post("/watchlist", requireAuth, async (req, res) => {
  const { symbol } = req.body;
  if (!symbol || typeof symbol !== "string") {
    res.status(400).json({ error: "Symbol is required" });
    return;
  }
  const upper = symbol.toUpperCase();
  const existing = await collections.watchlist().findOne({ userId: req.user!.id, symbol: upper });
  if (existing) {
    res.json({ id: existing.id, symbol: existing.symbol, addedAt: existing.addedAt.toISOString() });
    return;
  }
  const inserted = {
    id: await nextId("watchlist"),
    userId: req.user!.id,
    symbol: upper,
    addedAt: new Date(),
  };
  await collections.watchlist().insertOne(inserted);
  res.json({ id: inserted.id, symbol: inserted.symbol, addedAt: inserted.addedAt.toISOString() });
});

router.delete("/watchlist/:symbol", requireAuth, async (req, res) => {
  const symbol = String(req.params.symbol).toUpperCase();
  await collections.watchlist().deleteOne({ userId: req.user!.id, symbol });
  res.json({ success: true });
});

router.get("/ai/analysis/:symbol", (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  if (!STOCKS[symbol]) {
    res.status(404).json({ error: "Symbol not found" });
    return;
  }
  const quote = getStockQuote(symbol);
  if (!quote) {
    res.status(404).json({ error: "Symbol not found" });
    return;
  }
  res.json(getAiAnalysis(symbol, quote.price));
});

router.get("/ai/market-summary", (_req, res) => {
  res.json(getAiMarketSummary());
});

export default router;
