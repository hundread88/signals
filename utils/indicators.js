
export function calculateIndicators(candles) {
  const closes = candles.map(c => parseFloat(c[4]));
  const highs = candles.map(c => parseFloat(c[2]));
  const lows = candles.map(c => parseFloat(c[3]));

  const ma7 = average(closes.slice(-7));
  const ma26 = average(closes.slice(-26));

  const frHighs = findFractals(highs, 'high');
  const frLows = findFractals(lows, 'low');

  const trend = ma7 > ma26 ? 'up' : ma7 < ma26 ? 'down' : 'sideways';

  const lastClose = closes.at(-1);
  const message = `MA7: ${ma7.toFixed(2)}, MA26: ${ma26.toFixed(2)}, Trend: ${trend}`;

  return { ma7, ma26, frHighs, frLows, trend, message, lastClose };
}

function average(arr) {
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function findFractals(data, type) {
  const fractals = [];
  for (let i = 2; i < data.length - 2; i++) {
    if (type === 'high' &&
        data[i] > data[i - 1] && data[i] > data[i - 2] &&
        data[i] > data[i + 1] && data[i] > data[i + 2]) {
      fractals.push({ index: i, value: data[i] });
    }
    if (type === 'low' &&
        data[i] < data[i - 1] && data[i] < data[i - 2] &&
        data[i] < data[i + 1] && data[i] < data[i + 2]) {
      fractals.push({ index: i, value: data[i] });
    }
  }
  return fractals.slice(-5);
}

export function checkSignals(signal, candle, lastSignal) {
  const { lastClose, ma26 } = signal;
  if (!lastSignal || lastSignal.lastClose !== lastClose) {
    if (lastClose > ma26 && (!lastSignal || lastSignal.type !== 'buy')) {
      signal.type = 'buy';
      return true;
    } else if (lastClose < ma26 && (!lastSignal || lastSignal.type !== 'sell')) {
      signal.type = 'sell';
      return true;
    }
  }
  return false;
}
