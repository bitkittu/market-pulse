import { Router, type IRouter } from "express";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

const router: IRouter = Router();

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round(100 - 100 / (1 + rs));
}

function calcVWAP(candles: { close: number; volume: number }[]): number {
  let pv = 0, vol = 0;
  for (const c of candles) {
    pv += c.close * (c.volume ?? 1);
    vol += c.volume ?? 1;
  }
  return vol > 0 ? pv / vol : 0;
}

const POSITIVE_WEIGHTS: Record<string, number> = {
  surge: 9, soar: 9, skyrocket: 10, boom: 8, rally: 8,
  outperform: 8, upgrade: 8, bullish: 8, record: 7, beat: 7,
  profit: 7, rebound: 7, recover: 6, boost: 6, gain: 6,
  growth: 6, rise: 5, climb: 5, expand: 5, dividend: 5,
  revenue: 4, earn: 4, strong: 5, high: 4, opportunity: 6,
  buy: 5, positive: 5, exceed: 6, increase: 5,
};

const NEGATIVE_WEIGHTS: Record<string, number> = {
  crash: 10, plunge: 9, collapse: 9, fraud: 9, tumble: 8,
  slump: 8, bearish: 8, downgrade: 8, warn: 7, loss: 7,
  miss: 7, layoff: 7, lawsuit: 7, decline: 6, penalty: 6,
  investigation: 6, recall: 6, fall: 5, drop: 5, sell: 5,
  risk: 5, weak: 5, debt: 5, cut: 5, below: 4, concern: 4,
  down: 3, delay: 4, negative: 5,
};

interface SentimentResult {
  score: number;
  label: "Positive" | "Negative" | "Neutral";
}

function deriveSentimentWithScore(articles: Array<{ title?: string; description?: string }>): SentimentResult {
  let totalPos = 0;
  let totalNeg = 0;

  const sample = articles.slice(0, 15);
  for (const a of sample) {
    const text = ((a.title ?? "") + " " + (a.description ?? "")).toLowerCase();
    for (const [word, weight] of Object.entries(POSITIVE_WEIGHTS)) {
      if (text.includes(word)) totalPos += weight;
    }
    for (const [word, weight] of Object.entries(NEGATIVE_WEIGHTS)) {
      if (text.includes(word)) totalNeg += weight;
    }
  }

  const total = totalPos + totalNeg;
  let score: number;
  if (total === 0) {
    score = 50;
  } else {
    const raw = (totalPos / total) * 100;
    score = Math.round(Math.max(0, Math.min(100, raw)));
  }

  const label: "Positive" | "Negative" | "Neutral" =
    score >= 60 ? "Positive" : score <= 40 ? "Negative" : "Neutral";

  return { score, label };
}

function deriveForecast(rsi: number, price: number, vwap: number): "Bullish" | "Bearish" | "Neutral" {
  const aboveVWAP = vwap > 0 ? price > vwap : null;
  if (rsi >= 60 && aboveVWAP !== false) return "Bullish";
  if (rsi <= 40 && aboveVWAP !== true) return "Bearish";
  return "Neutral";
}

// ── Resolve input to a valid Yahoo Finance symbol ─────────────────────────
// Handles: "SBIN" → "SBIN.NS", "NSE:SBIN" → "SBIN.NS", "SBIN.NS" → "SBIN.NS",
//          "AAPL" → "AAPL" (US stocks pass through), "coalindia" → "COALINDIA.NS"
async function resolveSymbol(
  raw: string
): Promise<{ symbol: string; quote: Awaited<ReturnType<typeof yahooFinance.quote>> } | null> {
  // 1. Normalise input
  let input = raw.trim().toUpperCase();

  // Strip exchange prefixes: "NSE:SBIN" → "SBIN", "BSE:SBIN" → "SBIN"
  input = input.replace(/^(NSE|BSE|MCX)\s*[:|\s]\s*/, "");

  // 2. Build candidate list in priority order
  const candidates: string[] = [];

  if (input.endsWith(".NS") || input.endsWith(".BO")) {
    // Already has suffix — try as-is first, then the other exchange
    candidates.push(input);
    if (input.endsWith(".NS")) candidates.push(input.replace(/\.NS$/, ".BO"));
    else candidates.push(input.replace(/\.BO$/, ".NS"));
  } else {
    // No suffix — try NSE first (most common), then BSE, then bare (for US/global)
    candidates.push(`${input}.NS`, `${input}.BO`, input);
  }

  for (const sym of candidates) {
    try {
      const q = await yahooFinance.quote(sym, {}, { validateResult: false });
      if (q?.regularMarketPrice) return { symbol: sym, quote: q };
    } catch {
      // try next candidate
    }
  }
  return null;
}

router.get("/insights/search", async (req, res) => {
  const raw = (req.query.q as string || "").trim();
  if (!raw) {
    res.status(400).json({ error: "Query parameter 'q' is required" });
    return;
  }

  try {
    const resolved = await resolveSymbol(raw);
    if (!resolved) {
      res.status(404).json({ error: `Stock '${raw}' not found. Try a valid NSE symbol like SBIN, RELIANCE, or COALINDIA.` });
      return;
    }
    const { symbol: q, quote } = resolved;

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 90);

    const [chart, searchResult] = await Promise.allSettled([
      yahooFinance.chart(q, { period1: start.toISOString().split("T")[0], interval: "1d" }, { validateResult: false }),
      yahooFinance.search(q, { newsCount: 20 }, { validateResult: false }),
    ]);

    // yahoo-finance2 returns `unknown` for chart()/search() when validateResult
    // is false (skips runtime schema validation), so we cast to the documented
    // response shape ourselves, only once each promise is confirmed fulfilled.
    const chartValue = chart.status === "fulfilled"
      ? (chart.value as { quotes?: Array<{ date: Date; close: number | null; volume: number | null }> })
      : undefined;
    const searchValue = searchResult.status === "fulfilled"
      ? (searchResult.value as { news?: unknown })
      : undefined;

    const candles: { date: string; close: number; volume: number }[] = [];
    if (chartValue?.quotes) {
      for (const c of chartValue.quotes) {
        if (c.close != null) candles.push({ date: new Date(c.date).toISOString().split("T")[0], close: c.close, volume: c.volume ?? 0 });
      }
    }

    const closes = candles.map((c) => c.close);
    const rsi = calcRSI(closes);
    const vwap = calcVWAP(candles);
    const price = quote.regularMarketPrice ?? 0;
    const change = quote.regularMarketChange ?? 0;
    const changePercent = quote.regularMarketChangePercent ?? 0;

    const rawNews: Array<{ title?: string; link?: string; publisher?: string; providerPublishTime?: Date | number; thumbnail?: { resolutions?: Array<{ url?: string }> } }> =
      Array.isArray(searchValue?.news)
        ? (searchValue.news as typeof rawNews)
        : [];

    const news = rawNews.slice(0, 15).map((n) => ({
      title: n.title ?? "Untitled",
      description: "",
      url: n.link ?? "",
      source: n.publisher ?? "Unknown",
      publishedAt: n.providerPublishTime
        ? new Date(Number(n.providerPublishTime) * 1000).toISOString()
        : new Date().toISOString(),
      thumbnail: n.thumbnail?.resolutions?.[0]?.url ?? "",
    }));

    const { score: sentimentScore, label: sentiment } = deriveSentimentWithScore(news);
    const forecast = deriveForecast(rsi, price, vwap);

    // Strip Yahoo Finance exchange suffix for clean display (SBIN.NS → SBIN)
    const displaySymbol = q.replace(/\.(NS|BO)$/, "");

    res.json({
      symbol: displaySymbol,
      name: quote.longName ?? quote.shortName ?? displaySymbol,
      price,
      change,
      changePercent,
      rsi,
      vwap: Math.round(vwap * 100) / 100,
      forecast,
      sentiment,
      sentimentScore,
      currency: quote.currency ?? "INR",
      marketCap: quote.marketCap ?? 0,
      volume: quote.regularMarketVolume ?? 0,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? 0,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? 0,
      priceHistory: candles,
      news,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[insights] error:", msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
