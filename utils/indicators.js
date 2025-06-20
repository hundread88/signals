// Вспомогательные функции и calculateIndicators без изменений

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
export function calculateIndicators(candles) {
  const closes = candles.map(c => parseFloat(c[4]));
  if (closes.length < 30) { return { indicators: { error: "Недостаточно данных." } }; }
  const highs = candles.map(c => parseFloat(c[2]));
  const lows = candles.map(c => parseFloat(c[3]));
  const ma26 = average(closes.slice(-26));
  const allHighFractals = findFractals(highs, 'high');
  const allLowFractals = findFractals(lows, 'low');
  let support = null, resistance = null;
  
  // ВАЖНО: Мы вычисляем линию для КОНКРЕТНОГО МОМЕНТА ВРЕМЕНИ, для `currentPrice`
  // Поэтому индекс для проекции будет `candles.length`, а не `length - 1`
  const currentCandleIndex = candles.length;

  if (allHighFractals.length >= 2) {
    resistance = getLineValue(allHighFractals.at(-2), allHighFractals.at(-1), currentCandleIndex);
  }
  if (allLowFractals.length >= 2) {
    support = getLineValue(allLowFractals.at(-2), allLowFractals.at(-1), currentCandleIndex);
  }
  const indicators = {
    ma26, support, resistance, allHighFractals, allLowFractals,
    lastCandle: { close: closes.at(-1) },
    prevCandle: { close: closes.at(-2) },
  };
  return { indicators };
}

/**
 * Главная функция проверки сигналов (ФИНАЛЬНАЯ ВЕРСИЯ)
 */
export function checkSignals(indicators, signal_cache, candles, currentPrice) {
    const { ma26, allHighFractals, allLowFractals, prevCandle } = indicators;
    if (!prevCandle || !currentPrice || candles.length < 5) {
        return { newSignals: [], updatedCache: signal_cache };
    }

    const lastCandleOpenTime = candles.at(-1)[0]; 
    let currentCache = signal_cache || { period_timestamp: 0, sent_types: [] };
    if (currentCache.period_timestamp !== lastCandleOpenTime) {
        currentCache = { period_timestamp: lastCandleOpenTime, sent_types: [] };
    }

    const potentialSignals = [];
    const newlyConfirmedFractalIndex = candles.length - 3;

    // --- БЛОК 1: Информационные сигналы о фракталах (проверяются всегда) ---
    const newHighFractal = allHighFractals.find(f => f.index === newlyConfirmedFractalIndex);
    if (newHighFractal) {
        const prevHighFractal = allHighFractals.filter(f => f.index < newHighFractal.index).at(-1);
        if (!prevHighFractal || newHighFractal.value > prevHighFractal.value) {
            potentialSignals.push({ type: 'info_peak_high', message: `📈 Сформирован новый пиковый фрактал сверху (${newHighFractal.value.toFixed(4)}).` });
        } else {
            potentialSignals.push({ type: 'info_line_high', message: `🔴 Сформирован новый фрактал сверху, построена наклонная (${newHighFractal.value.toFixed(4)}).` });
        }
    }
    const newLowFractal = allLowFractals.find(f => f.index === newlyConfirmedFractalIndex);
    if (newLowFractal) {
        const prevLowFractal = allLowFractals.filter(f => f.index < newLowFractal.index).at(-1);
        if (!prevLowFractal || newLowFractal.value < prevLowFractal.value) {
            potentialSignals.push({ type: 'info_peak_low', message: `📉 Сформирован новый пиковый фрактал снизу (${newLowFractal.value.toFixed(4)}).` });
        } else {
            potentialSignals.push({ type: 'info_line_low', message: `🟢 Сформирован новый фрактал снизу, построена наклонная (${newLowFractal.value.toFixed(4)}).` });
        }
    }

    // --- БЛОК 2: Торговые сигналы по MA26 (проверяются всегда) ---
    if (prevCandle.close < ma26 && currentPrice > ma26) {
        potentialSignals.push({ type: 'ma_buy', message: `📈 MA Покупка: Цена (${currentPrice.toFixed(4)}) пересекла MA26.` });
    } else if (prevCandle.close > ma26 && currentPrice < ma26) {
        potentialSignals.push({ type: 'ma_sell', message: `📉 MA Продажа: Цена (${currentPrice.toFixed(4)}) пересекла MA26.` });
    }
    
    // --- БЛОК 3: Торговые сигналы по наклонным (проверяются всегда) ---
    // Для сопротивления
    if (allHighFractals.length >= 2) {
        const lastHigh = allHighFractals.at(-1);
        const prevHigh = allHighFractals.at(-2);
        // Проверяем, что линия была нисходящей
        if (prevHigh.value > lastHigh.value) {
            const resistanceLineValue = getLineValue(prevHigh, lastHigh, candles.length); // Проекция на текущий момент
            const prevResistanceLineValue = getLineValue(prevHigh, lastHigh, candles.length - 1); // Проекция на прошлую свечу
            if (prevCandle.close < prevResistanceLineValue && currentPrice > resistanceLineValue) {
                potentialSignals.push({ type: 'trend_buy', message: `📈 Тренд Покупка: Цена (${currentPrice.toFixed(4)}) пробила нисходящее сопротивление.` });
            }
        }
    }
    
    // Для поддержки
    if (allLowFractals.length >= 2) {
        const lastLow = allLowFractals.at(-1);
        const prevLow = allLowFractals.at(-2);
        // Проверяем, что линия была восходящей
        if (prevLow.value < lastLow.value) {
            const supportLineValue = getLineValue(prevLow, lastLow, candles.length);
            const prevSupportLineValue = getLineValue(prevLow, lastLow, candles.length - 1);
            if (prevCandle.close > prevSupportLineValue && currentPrice < supportLineValue) {
                potentialSignals.push({ type: 'trend_sell', message: `📉 Тренд Продажа: Цена (${currentPrice.toFixed(4)}) пробила восходящую поддержку.` });
            }
        }
    }

    // --- Финальная обработка и фильтрация ---
    const newSignalsToSend = [];
    for (const signal of potentialSignals) {
        if (!currentCache.sent_types.includes(signal.type)) {
            newSignalsToSend.push(signal);
            currentCache.sent_types.push(signal.type);
        }
    }
    
    return { newSignals: newSignalsToSend, updatedCache: currentCache };
}
