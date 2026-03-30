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

function deriveSentiment(articles: Array<{ title?: string; description?: string }>): "Positive" | "Negative" | "Neutral" {
  const pos = ["surge", "rally", "gain", "record", "beat", "profit", "rise", "bullish", "growth", "up", "strong", "high", "buy", "upgrade", "opportunity", "boost"];
  const neg = ["fall", "drop", "loss", "miss", "decline", "crash", "bearish", "weak", "sell", "downgrade", "risk", "down", "slump", "cut", "warn", "below"];
  let score = 0;
  for (const a of articles.slice(0, 10)) {
    const text = ((a.title ?? "") + " " + (a.description ?? "")).toLowerCase();
    for (const w of pos) if (text.includes(w)) score++;
    for (const w of neg) if (text.includes(w)) score--;
  }
  if (score > 1) return "Positive";
  if (score < -1) return "Negative";
  return "Neutral";
}

function deriveForecast(rsi: number, price: number, vwap: number): "Bullish" | "Bearish" | "Neutral" {
  const aboveVWAP = vwap > 0 ? price > vwap : null;
  if (rsi >= 60 && aboveVWAP !== false) return "Bullish";
  if (rsi <= 40 && aboveVWAP !== true) return "Bearish";
  return "Neutral";
}

router.get("/insights/search", async (req, res) => {
  const q = (req.query.q as string || "").trim().toUpperCase();
  if (!q) {
    res.status(400).json({ error: "Query parameter 'q' is required" });
    return;
  }

  try {
    const quote = await yahooFinance.quote(q, {}, { validateResult: false });
    if (!quote || !quote.regularMarketPrice) {
      res.status(404).json({ error: `Symbol '${q}' not found` });
      return;
    }

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 90);

    const [chart, searchResult] = await Promise.allSettled([
      yahooFinance.chart(q, { period1: start.toISOString().split("T")[0], interval: "1d" }, { validateResult: false }),
      yahooFinance.search(q, { newsCount: 20 }, { validateResult: false }),
    ]);

    const candles: { date: string; close: number; volume: number }[] = [];
    if (chart.status === "fulfilled" && chart.value?.quotes) {
      for (const c of chart.value.quotes) {
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
      searchResult.status === "fulfilled" && Array.isArray(searchResult.value?.news)
        ? (searchResult.value.news as typeof rawNews)
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

    const sentiment = deriveSentiment(news);
    const forecast = deriveForecast(rsi, price, vwap);

    res.json({
      symbol: q,
      name: quote.longName ?? quote.shortName ?? q,
      price,
      change,
      changePercent,
      rsi,
      vwap: Math.round(vwap * 100) / 100,
      forecast,
      sentiment,
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
