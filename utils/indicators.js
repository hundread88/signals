// Вспомогательная функция getLineValue без изменений
function getLineValue(p1, p2, currentX) {
  if (!p1 || !p2 || p1.index === p2.index) return null;
  const slope = (p2.value - p1.value) / (p2.index - p1.index);
  return slope * (currentX - p1.index) + p1.value;
}

// ИЗМЕНЕНИЕ: Используем `>=` и `<=` для более мягкого определения фракталов
function findFractals(data, type) {
  const fractals = [];
  for (let i = 2; i < data.length - 2; i++) {
    const isHigh = type === 'high' && data[i] >= data[i-1] && data[i] >= data[i-2] && data[i] > data[i+1] && data[i] > data[i+2];
    const isLow = type === 'low' && data[i] <= data[i-1] && data[i] <= data[i-2] && data[i] < data[i+1] && data[i] < data[i+2];
    if (isHigh || isLow) {
      fractals.push({ index: i, value: data[i] });
    }
  }
  return fractals;
}

// average и calculateIndicators без изменений
function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

export function calculateIndicators(candles) {
  const closes = candles.map(c => parseFloat(c[4]));
  const highs = candles.map(c => parseFloat(c[2]));
  const lows = candles.map(c => parseFloat(c[3]));

  if (closes.length < 30) {
    return { error: "Недостаточно данных." };
  }

  const ma26 = average(closes.slice(-26));
  const allHighFractals = findFractals(highs, 'high');
  const allLowFractals = findFractals(lows, 'low');
  let resistance = null, support = null;

  if (allHighFractals.length >= 2) {
      resistance = getLineValue(allHighFractals.at(-2), allHighFractals.at(-1), candles.length - 1);
  }
  if (allLowFractals.length >= 2) {
      support = getLineValue(allLowFractals.at(-2), allLowFractals.at(-1), candles.length - 1);
  }

  return {
    ma26, support, resistance,
    lastCandle: { close: closes.at(-1) },
    prevCandle: { close: closes.at(-2) },
  };
}


/**
 * Главная функция проверки сигналов (логика "в моменте")
 */
export function checkSignals(indicators, lastSignal, candles, currentPrice) {
    const { ma26, support, resistance, prevCandle } = indicators;
    
    // Проверяем, что у нас есть все данные, включая текущую цену
    if (!prevCandle || !currentPrice) return null;

    let newSignal = null;

    // --- Логика сигналов "в моменте" ---
    
    // Пересечение MA26 снизу вверх
    if (prevCandle.close < ma26 && currentPrice > ma26) {
        newSignal = { type: 'ma_buy', message: `📈 MA Покупка: Цена (${currentPrice.toFixed(4)}) пересекла MA26 (${ma26.toFixed(4)}) снизу вверх.` };
    } 
    // Пересечение MA26 сверху вниз
    else if (prevCandle.close > ma26 && currentPrice < ma26) {
        newSignal = { type: 'ma_sell', message: `📉 MA Продажа: Цена (${currentPrice.toFixed(4)}) пересекла MA26 (${ma26.toFixed(4)}) сверху вниз.` };
    } 
    // Пробой сопротивления
    else if (resistance && prevCandle.close < resistance && currentPrice > resistance) {
        newSignal = { type: 'trend_buy', message: `📈 Тренд Покупка: Цена (${currentPrice.toFixed(4)}) пробила сопротивление (${resistance.toFixed(4)}).` };
    } 
    // Пробой поддержки
    else if (support && prevCandle.close > support && currentPrice < support) {
        newSignal = { type: 'trend_sell', message: `📉 Тренд Продажа: Цена (${currentPrice.toFixed(4)}) пробила поддержку (${support.toFixed(4)}).` };
    }

    // Финальная проверка на дублирование
    if (newSignal && (!lastSignal || newSignal.type !== lastSignal.type)) {
        return newSignal;
    }

    return null;
}
