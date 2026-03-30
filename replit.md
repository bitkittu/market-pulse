# NSE Pulse — Stock Market Dashboard

## Overview

Full-stack NSE India stock market dashboard built with React + Vite (frontend) and Express (backend). Features Gift Nifty tracking, NSE market movers, sector performance, portfolio management with VWAP/RSI indicators, and Upstox API integration.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Frontend**: React + Vite, Tailwind CSS, Recharts, React Query

## Features

- **Home Dashboard**: Today's Top Pick hero card with **live NSE prices** (animated confidence ring, signal badge, risk level, price grid, AI rationale), Gift Nifty futures (real Nifty 50 index via Yahoo Finance) + 3-month chart, NSE top 10 gainers & losers with live prices, all 12 NSE sector performance with real indices. Manual Refresh button + 90-second auto-cache.
- **Intraday Tab**: AI intraday picks backed by **live Yahoo Finance prices** with confidence bar, risk level badge, signal filter chips, sort-by-confidence, top-3 row gold/silver/bronze glow
- **Options Tab**: CE/PE filter tabs with live underlying prices for stock options, OI Trend badges (Increasing/Decreasing/Stable), HIGH IV warning, IV/OI tooltips
- **Performance Tab**: Historical trade log (20 trades), win rate/avg return stats, recharts BarChart + LineChart for weekly/cumulative P&L
- **Portfolio Tab**: Add NSE/BSE stocks, 10-column sticky table, AI target/stop-loss/signal/RSI/VWAP/news sentiment/P&L%, SL Distance % with color coding, total P&L summary card
- **Insights Tab**: Real-time stock search using Yahoo Finance API (no key needed). Shows price, RSI gauge, VWAP card, AI forecast, weighted news sentiment score (0-100 with progress bar), 3M price chart, and up to 15 latest news articles. Works for NSE stocks (e.g. TCS.NS) and global stocks (AAPL, TSLA, MSFT)
- **Upstox API Integration**: Login with your Upstox API credentials for live NSE data

## Structure

```text
artifacts/
  api-server/         # Express 5 API server
    src/
      lib/nseData.ts  # NSE stock data simulation + Gift Nifty + VWAP/RSI calculations
      routes/nse.ts   # All market data + portfolio + Upstox settings routes
  stock-dashboard/    # React + Vite frontend
    src/
      pages/
        Home.tsx             # TopPickHero + Gift Nifty chart + Market Movers + Sector Performance
        IntradayDashboard.tsx # AI intraday picks, signal chips, confidence bar, risk badges
        OptionsDashboard.tsx  # Options CE/PE tabs, OI trend badges, IV/OI tooltips
        Performance.tsx       # Trading performance, recharts bar+line charts, trade log
        Portfolio.tsx         # Portfolio table, SL distance %, P&L summary card
        Insights.tsx          # Stock search via Yahoo Finance — RSI/VWAP/forecast/sentiment/news
        Settings.tsx          # Upstox API connection
      App.tsx         # Main app with tab navigation + IST clock
lib/
  api-spec/openapi.yaml   # OpenAPI 3.1 spec
  api-client-react/       # Generated React Query hooks
  api-zod/                # Generated Zod schemas
  db/
    schema/
      portfolio.ts    # Portfolio stocks table
      upstox.ts       # Upstox API credentials table
      watchlist.ts    # Watchlist table
```

## API Endpoints

- `GET /api/gift-nifty/quote` — Gift Nifty current price + yesterday H/L
- `GET /api/gift-nifty/history?period=3M` — Price history (1M/3M/6M)
- `GET /api/nse/movers` — Top 10 gainers & losers (NSE stocks)
- `GET /api/nse/sectors` — All NSE sector performance (NIFTY BANK, IT, AUTO, etc.)
- `GET /api/nse/quote/:symbol` — Individual NSE stock quote
- `GET /api/nse/history/:symbol?period=1M` — Stock price history
- `GET /api/portfolio` — User portfolio stocks
- `POST /api/portfolio` — Add stock to portfolio
- `DELETE /api/portfolio/:symbol` — Remove stock
- `GET /api/portfolio/:symbol/indicators` — VWAP + RSI indicators
- `GET /api/settings/upstox` — Upstox connection status
- `POST /api/settings/upstox` — Save Upstox credentials
- `POST /api/settings/upstox/disconnect` — Disconnect Upstox

## NSE Stocks Covered

50 major NSE stocks including: RELIANCE, TCS, HDFCBANK, BHARTIARTL, ICICIBANK, INFY, SBIN, HINDUNILVR, ITC, LT, KOTAKBANK, BAJFINANCE, MARUTI, WIPRO, HCLTECH, SUNPHARMA, TATAMOTORS, NTPC, TITAN, JSWSTEEL, ADANIENT and many more.
