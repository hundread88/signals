import axios from 'axios';

// Эта функция без изменений
export async function getCandles(symbol, interval, limit = 200) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const response = await axios.get(url);
  return response.data;
}

// НОВАЯ ФУНКЦИЯ для получения текущей цены
export async function getCurrentPrice(symbol) {
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
  const response = await axios.get(url);
  return parseFloat(response.data.price);
}
