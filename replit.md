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

- **Home Dashboard**: Gift Nifty futures price + 3-month chart with yesterday's H/L/%, NSE top 10 gainers & losers, all 12 NSE sector performance
- **Portfolio Tab**: Add NSE/BSE stocks, VWAP Smart Money Tracker, RSI Momentum Flow with interactive charts
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
        Home.tsx      # Gift Nifty + Market Movers + Sector Performance
        Portfolio.tsx # Portfolio stocks with VWAP/RSI cards
        Settings.tsx  # Upstox API connection
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
