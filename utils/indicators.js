// Вспомогательные функции (без изменений)
function getLineValue(p1, p2, currentX) {
  if (!p1 || !p2 || p1.index === p2.index) return null;
  const slope = (p2.value - p1.value) / (p2.index - p1.index);
  return slope * (currentX - p1.index) + p1.value;
}
function findFractals(data, type) {
  const fractals = [];
  for (let i = 2; i < data.length - 2; i++) {
    const isHigh = type === 'high' && data[i]>=data[i-1] && data[i]>=data[i-2] && data[i]>=data[i+1] && data[i]>=data[i+2];
    const isLow = type === 'low' && data[i]<=data[i-1] && data[i]<=data[i-2] && data[i]<=data[i+1] && data[i]<=data[i+2];
    if ((isHigh && (data[i]>data[i-1] || data[i]>data[i+1])) || (isLow && (data[i]<data[i-1] || data[i]<data[i+1]))) {
      fractals.push({ index: i, value: data[i] });
    }
  }
  return fractals;
}
function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * ГЛАВНАЯ ФУНКЦИЯ С НОВОЙ ЛОГИКОЙ ПОСТРОЕНИЯ ЛИНИЙ
 */
export function calculateIndicators(candles, line_anchors) {
  const closes = candles.map(c => parseFloat(c[4]));
  const highs = candles.map(c => parseFloat(c[2]));
  const lows = candles.map(c => parseFloat(c[3]));

  if (candles.length < 30) {
    return { indicators: { error: "Недостаточно данных." } };
  }

  const ma26 = average(closes.slice(-26));
  const allHighFractals = findFractals(highs, 'high');
  const allLowFractals = findFractals(lows, 'low');
  
  let support = null;
  let resistance = null;

  // --- ЛОГИКА ДЛЯ ЯКОРЕЙ И ЛИНИЙ ---
  let currentAnchors = line_anchors || {}; // Загружаем якоря или создаем новый объект
  let newAnchorHigh = currentAnchors.high;
  let newAnchorLow = currentAnchors.low;

  // --- Линия сопротивления (Highs) ---
  if (allHighFractals.length > 0) {
    const lastHighFractal = allHighFractals.at(-1);
    // 1. Обновляем якорный (пиковый) максимум, если нужно
    if (!newAnchorHigh || lastHighFractal.value > newAnchorHigh.value) {
      newAnchorHigh = lastHighFractal;
    }
    // 2. Ищем вторую точку для построения линии
    const secondPointCandidates = allHighFractals.filter(f => f.index > newAnchorHigh.index && f.value < newAnchorHigh.value);
    if (secondPointCandidates.length > 0) {
      const secondPoint = secondPointCandidates.at(-1); // Берем самый последний подходящий фрактал
      resistance = getLineValue(newAnchorHigh, secondPoint, candles.length - 1);
    }
  }
  
  // --- Линия поддержки (Lows) ---
  if (allLowFractals.length > 0) {
    const lastLowFractal = allLowFractals.at(-1);
    // 1. Обновляем якорный (пиковый) минимум
    if (!newAnchorLow || lastLowFractal.value < newAnchorLow.value) {
      newAnchorLow = lastLowFractal;
    }
    // 2. Ищем вторую точку
    const secondPointCandidates = allLowFractals.filter(f => f.index > newAnchorLow.index && f.value > newAnchorLow.value);
    if (secondPointCandidates.length > 0) {
      const secondPoint = secondPointCandidates.at(-1);
      support = getLineValue(newAnchorLow, secondPoint, candles.length - 1);
    }
  }
  
  const indicators = {
    ma26, support, resistance, allHighFractals, allLowFractals,
    lastCandle: { close: closes.at(-1) },
    prevCandle: { close: closes.at(-2) },
  };
  
  const new_anchors = { high: newAnchorHigh, low: newAnchorLow };

  return { indicators, new_anchors };
}

/**
 * Проверка сигналов (с исправлением дубликатов)
 */
export function checkSignals(indicators, lastSignal, candles, currentPrice) {
    const { ma26, support, resistance, allHighFractals, allLowFractals, prevCandle } = indicators;
    if (!prevCandle || !currentPrice || candles.length < 5) return null;

    let newSignal = null;

    // --- Информационные сигналы о подтвержденных фракталах ---
    const newlyConfirmedFractalIndex = candles.length - 3;
    const newHighFractal = allHighFractals.find(f => f.index === newlyConfirmedFractalIndex);
    if (newHighFractal) {
        newSignal = { type: 'info_high_confirmed', message: `✅ Сформирован фрактал сверху (${newHighFractal.value.toFixed(4)}).`, index: newHighFractal.index };
    }
    const newLowFractal = allLowFractals.find(f => f.index === newlyConfirmedFractalIndex);
    if (newLowFractal) {
        newSignal = { type: 'info_low_confirmed', message: `✅ Сформирован фрактал снизу (${newLowFractal.value.toFixed(4)}).`, index: newLowFractal.index };
    }
    
    // --- Торговые сигналы ---
    if (!newSignal) {
        if (prevCandle.close < ma26 && currentPrice > ma26) {
            newSignal = { type: 'ma_buy', message: `📈 MA Покупка: Цена (${currentPrice.toFixed(4)}) пересекла MA26.` };
        } else if (prevCandle.close > ma26 && currentPrice < ma26) {
            newSignal = { type: 'ma_sell', message: `📉 MA Продажа: Цена (${currentPrice.toFixed(4)}) пересекла MA26.` };
        } else if (resistance && prevCandle.close < resistance && currentPrice > resistance) {
            newSignal = { type: 'trend_buy', message: `📈 Тренд Покупка: Цена (${currentPrice.toFixed(4)}) пробила сопротивление.` };
        } else if (support && prevCandle.close > support && currentPrice < support) {
            newSignal = { type: 'trend_sell', message: `📉 Тренд Продажа: Цена (${currentPrice.toFixed(4)}) пробила поддержку.` };
        }
    }

    // Улучшенная проверка на дублирование
    if (newSignal) {
        if (!lastSignal || lastSignal.type !== newSignal.type || lastSignal.index !== newSignal.index) {
            return newSignal;
        }
    }

    return null;
}
