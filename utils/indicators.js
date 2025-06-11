/**
 * Вычисляет значение на линии тренда для текущей свечи.
 */
function getLineValue(p1, p2, currentX) {
  if (!p1 || !p2 || p1.index === p2.index) return null;
  const slope = (p2.value - p1.value) / (p2.index - p1.index);
  return slope * (currentX - p1.index) + p1.value;
}

/**
 * Находит фракталы (локальные максимумы и минимумы).
 */
function findFractals(data, type) {
  const fractals = [];
  for (let i = 2; i < data.length - 2; i++) {
    const isHigh = type === 'high' &&
      data[i] > data[i - 1] && data[i] > data[i - 2] &&
      data[i] > data[i + 1] && data[i] > data[i + 2];
    const isLow = type === 'low' &&
      data[i] < data[i - 1] && data[i] < data[i - 2] &&
      data[i] < data[i + 1] && data[i] < data[i + 2];
    if (isHigh || isLow) {
      fractals.push({ index: i, value: data[i] });
    }
  }
  return fractals;
}

/**
 * Рассчитывает простое скользящее среднее (SMA).
 */
function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * Основная функция для расчета всех индикаторов.
 */
export function calculateIndicators(candles) {
  const closes = candles.map(c => parseFloat(c[4]));
  const highs = candles.map(c => parseFloat(c[2]));
  const lows = candles.map(c => parseFloat(c[3]));

  if (closes.length < 30) {
    return { error: "Недостаточно данных для расчета." };
  }

  // --- Скользящие средние и тренд ---
  const ma7 = average(closes.slice(-7));
  const ma26 = average(closes.slice(-26));
  const trend = ma7 > ma26 ? 'up' : ma7 < ma26 ? 'down' : 'sideways';

  // --- Фракталы ---
  const allHighFractals = findFractals(highs, 'high');
  const allLowFractals = findFractals(lows, 'low');

  const lastCandleIndex = candles.length - 1;
  let resistance = null;
  let support = null;

  // --- Расчет линии сопротивления (строго по вашему ТЗ) ---
  if (allHighFractals.length >= 1) {
    const maxHighFractal = allHighFractals.reduce((max, f) => f.value > max.value ? f : max, allHighFractals[0]);
    const fractalsAfterMax = allHighFractals.filter(f => f.index > maxHighFractal.index);
    if (fractalsAfterMax.length > 0) {
        const minHighFractalAfterMax = fractalsAfterMax.reduce((min, f) => f.value < min.value ? f : min, fractalsAfterMax[0]);
        resistance = getLineValue(maxHighFractal, minHighFractalAfterMax, lastCandleIndex);
    }
  }

  // --- Расчет линии поддержки (строго по вашему ТЗ) ---
  if (allLowFractals.length >= 1) {
    const minLowFractal = allLowFractals.reduce((min, f) => f.value < min.value ? f : min, allLowFractals[0]);
    const fractalsAfterMin = allLowFractals.filter(f => f.index > minLowFractal.index);
     if (fractalsAfterMin.length > 0) {
        const maxLowFractalAfterMin = fractalsAfterMin.reduce((max, f) => f.value > max.value ? f : max, fractalsAfterMin[0]);
        support = getLineValue(minLowFractal, maxLowFractalAfterMin, lastCandleIndex);
    }
  }

  return {
    ma26,
    trend,
    support,
    resistance,
    lastCandle: { close: parseFloat(candles.at(-1)[4]) },
    prevCandle: { close: parseFloat(candles.at(-2)[4]) },
    message: `MA7: ${ma7.toFixed(2)}, MA26: ${ma26.toFixed(2)}, Trend: ${trend}`
  };
}

/**
 * Проверяет наличие сигналов на основе рассчитанных индикаторов.
 * (Эта функция не изменилась, так как логика проверки пересечения корректна).
 */
export function checkSignals(indicators, lastSignal) {
    const { ma26, support, resistance, lastCandle, prevCandle } = indicators;
    
    if (!lastCandle || !prevCandle) return null;

    const newSignal = { type: 'none', message: '' };

    // --- Сигналы по MA26 ---
    if (prevCandle.close < ma26 && lastCandle.close > ma26) {
        newSignal.type = 'ma_buy';
        newSignal.message = `📈 Сигнал на покупку (MA)\nЦена пересекла MA26 снизу вверх. Текущая цена: ${lastCandle.close.toFixed(4)}`;
    } else if (prevCandle.close > ma26 && lastCandle.close < ma26) {
        newSignal.type = 'ma_sell';
        newSignal.message = `📉 Сигнал на продажу (MA)\nЦена пересекла MA26 сверху вниз. Текущая цена: ${lastCandle.close.toFixed(4)}`;
    }
    // --- Сигналы по наклонным линиям тренда ---
    else if (resistance && prevCandle.close < resistance && lastCandle.close > resistance) {
        newSignal.type = 'trend_buy';
        newSignal.message = `📈 Сигнал на покупку (Тренд)\nЦена пробила линию сопротивления. Текущая цена: ${lastCandle.close.toFixed(4)}`;
    }
    else if (support && prevCandle.close > support && lastCandle.close < support) {
        newSignal.type = 'trend_sell';
        newSignal.message = `📉 Сигнал на продажу (Тренд)\nЦена пробила линию поддержки. Текущая цена: ${lastCandle.close.toFixed(4)}`;
    }

    if (newSignal.type !== 'none' && (!lastSignal || newSignal.type !== lastSignal.type)) {
        return newSignal;
    }

    return null;
}
