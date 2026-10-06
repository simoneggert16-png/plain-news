// Market data from Yahoo Finance public chart endpoint (no key needed).
// Runs only on the server (API routes), cached for 60s.

export const WATCHLIST = {
  indices: [
    ['^GSPC', 'S&P 500'], ['^IXIC', 'Nasdaq'], ['^DJI', 'Dow Jones'], ['^GDAXI', 'DAX'],
    ['^STOXX50E', 'Euro Stoxx 50'], ['^FTSE', 'FTSE 100'], ['^FCHI', 'CAC 40'], ['^N225', 'Nikkei 225'],
    ['^HSI', 'Hang Seng'], ['000001.SS', 'Shanghai'], ['^KS11', 'KOSPI'], ['^VIX', 'VIX'],
  ],
  stocks: [
    ['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['NVDA', 'Nvidia'], ['GOOGL', 'Alphabet'], ['AMZN', 'Amazon'],
    ['META', 'Meta'], ['TSLA', 'Tesla'], ['TSM', 'TSMC'], ['ASML', 'ASML'], ['SAP.DE', 'SAP'],
    ['SIE.DE', 'Siemens'], ['MC.PA', 'LVMH'], ['NOVO-B.CO', 'Novo Nordisk'], ['005930.KS', 'Samsung'],
    ['7203.T', 'Toyota'], ['0700.HK', 'Tencent'], ['BRK-B', 'Berkshire'], ['JPM', 'JPMorgan'],
  ],
  fx: [
    ['EURUSD=X', 'EUR/USD'], ['GBPUSD=X', 'GBP/USD'], ['USDJPY=X', 'USD/JPY'], ['USDCNY=X', 'USD/CNY'],
    ['EURCHF=X', 'EUR/CHF'], ['USDKRW=X', 'USD/KRW'],
  ],
  commodities: [
    ['GC=F', 'Gold'], ['SI=F', 'Silver'], ['CL=F', 'WTI Oil'], ['BZ=F', 'Brent'], ['NG=F', 'Nat. Gas'], ['HG=F', 'Copper'],
  ],
  crypto: [
    ['BTC-USD', 'Bitcoin'], ['ETH-USD', 'Ethereum'], ['SOL-USD', 'Solana'], ['XRP-USD', 'XRP'],
  ],
};

export const TICKER_STRIP = ['^GSPC', '^IXIC', '^GDAXI', '^STOXX50E', '^N225', '^HSI', 'EURUSD=X', 'GC=F', 'BZ=F', 'BTC-USD'];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

export async function fetchChart(symbol, range = '1d', interval) {
  const iv = interval || ({ '1d': '5m', '5d': '30m', '1mo': '1d', '6mo': '1d', '1y': '1wk', '5y': '1mo' }[range] || '1d');
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${iv}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  if (!r) throw new Error('No data');
  const m = r.meta;
  const closes = (r.indicators?.quote?.[0]?.close || []).map((v) => (v == null ? null : +v));
  const points = (r.timestamp || []).map((t, i) => [t, closes[i]]).filter((p) => p[1] != null);
  const price = m.regularMarketPrice;
  const prev = range === '1d' ? (m.chartPreviousClose ?? m.previousClose) : points[0]?.[1];
  const change = prev ? price - prev : 0;
  return {
    symbol: m.symbol,
    name: m.longName || m.shortName || m.symbol,
    currency: m.currency,
    exchange: m.fullExchangeName || m.exchangeName,
    price,
    change,
    changePct: prev ? (change / prev) * 100 : 0,
    marketTime: m.regularMarketTime,
    points,
  };
}

export async function fetchQuotes(symbols) {
  const results = await Promise.allSettled(symbols.map((s) => fetchChart(s, '1d')));
  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { symbol: symbols[i], error: true }
  );
}
