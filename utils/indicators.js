/**
 * Вычисляет значение на линии тренда для текущей свечи.
 * Линия строится по двум точкам p1(индекс, значение) и p2(индекс, значение).
 */
function getLineValue(p1, p2, currentX) {
  if (!p1 || !p2 || p1.index === p2.index) return null;
  const slope = (p2.value - p1.value) / (p2.index - p1.index);
  // Уравнение прямой: y = m * (x - x1) + y1
  return slope * (currentX - p1.index) + p1.value;
}

/**
 * Находит фракталы (локальные максимумы и минимумы).
 */
function findFractals(data, type) {
  const fractals = [];
  // Для поиска фрактала нужно 2 свечи слева и 2 справа
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

  // Скользящие средние
  const ma7 = average(closes.slice(-7));
  const ma26 = average(closes.slice(-26));
  const trend = ma7 > ma26 ? 'up' : ma7 < ma26 ? 'down' : 'sideways';

  // Фракталы
  const frHighs = findFractals(highs, 'high');
  const frLows = findFractals(lows, 'low');
  
  const lastCandleIndex = candles.length - 1;

  // Расчет линии сопротивления по двум последним фракталам high
  let resistance = null;
  if (frHighs.length >= 2) {
    resistance = getLineValue(frHighs.at(-2), frHighs.at(-1), lastCandleIndex);
  }

  // Расчет линии поддержки по двум последним фракталам low
  let support = null;
  if (frLows.length >= 2) {
    support = getLineValue(frLows.at(-2), frLows.at(-1), lastCandleIndex);
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
 */
export function checkSignals(indicators, lastSignal) {
    const { ma26, support, resistance, lastCandle, prevCandle } = indicators;
    
    // Проверяем, что все нужные данные есть
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

    // --- Сигналы по линиям тренда ---
    // Пробой линии сопротивления (сигнал на покупку)
    else if (resistance && prevCandle.close < resistance && lastCandle.close > resistance) {
        newSignal.type = 'trend_buy';
        newSignal.message = `📈 Сигнал на покупку (Тренд)\nЦена пробила линию сопротивления. Текущая цена: ${lastCandle.close.toFixed(4)}`;
    }
    // Пробой линии поддержки (сигнал на продажу)
    else if (support && prevCandle.close > support && lastCandle.close < support) {
        newSignal.type = 'trend_sell';
        newSignal.message = `📉 Сигнал на продажу (Тренд)\nЦена пробила линию поддержки. Текущая цена: ${lastCandle.close.toFixed(4)}`;
    }

    // Отправляем сигнал, только если он новый и отличается от предыдущего
    if (newSignal.type !== 'none' && (!lastSignal || newSignal.type !== lastSignal.type)) {
        return newSignal;
    }

    return null; // Новых сигналов нет
}
