
import axios from 'axios';

export async function getCandles(symbol, interval) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=100`;
  const response = await axios.get(url);
  return response.data;
}
