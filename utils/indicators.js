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
 * Рассчитывает базовые индикаторы и линии по последним 2 фракталам
 */
export function calculateIndicators(candles) {
  const closes = candles.map(c => parseFloat(c[4]));
  if (closes.length < 30) {
    return { indicators: { error: "Недостаточно данных." } };
  }

  const highs = candles.map(c => parseFloat(c[2]));
  const lows = candles.map(c => parseFloat(c[3]));
  
  const ma26 = average(closes.slice(-26));
  const allHighFractals = findFractals(highs, 'high');
  const allLowFractals = findFractals(lows, 'low');
  
  let support = null;
  let resistance = null;
  const currentCandleIndex = candles.length - 1;

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
 * Проверяет все типы сигналов в соответствии с новым ТЗ
 */
export function checkSignals(indicators, lastSignal, candles, currentPrice) {
    const { ma26, support, resistance, allHighFractals, allLowFractals, prevCandle } = indicators;
    if (!prevCandle || !currentPrice || candles.length < 5) return null;

    let newSignal = null;
    const newlyConfirmedFractalIndex = candles.length - 3;

    // --- БЛОК 1: Информационные сигналы о фракталах ---
    const newHighFractal = allHighFractals.find(f => f.index === newlyConfirmedFractalIndex);
    if (newHighFractal) {
        const prevHighFractal = allHighFractals.find(f => f.index < newlyConfirmedFractalIndex);
        if (!prevHighFractal || newHighFractal.value > prevHighFractal.value) {
            newSignal = { type: 'info_peak_high', message: `📈 Сформирован новый пиковый фрактал сверху (${newHighFractal.value.toFixed(4)}).`, index: newHighFractal.index };
        } else {
            newSignal = { type: 'info_line_high', message: `🔴 Сформирован новый фрактал сверху, построена наклонная (${newHighFractal.value.toFixed(4)}).`, index: newHighFractal.index };
        }
    }

    const newLowFractal = allLowFractals.find(f => f.index === newlyConfirmedFractalIndex);
    if (newLowFractal) {
        const prevLowFractal = allLowFractals.find(f => f.index < newlyConfirmedFractalIndex);
        if (!prevLowFractal || newLowFractal.value < prevLowFractal.value) {
            newSignal = { type: 'info_peak_low', message: `📉 Сформирован новый пиковый фрактал снизу (${newLowFractal.value.toFixed(4)}).`, index: newLowFractal.index };
        } else {
            newSignal = { type: 'info_line_low', message: `🟢 Сформирован новый фрактал снизу, построена наклонная (${newLowFractal.value.toFixed(4)}).`, index: newLowFractal.index };
        }
    }

    // --- БЛОК 2: Торговые сигналы ---
    if (!newSignal) {
        // MA26
        if (prevCandle.close < ma26 && currentPrice > ma26) {
            newSignal = { type: 'ma_buy', message: `📈 MA Покупка: Цена (${currentPrice.toFixed(4)}) пересекла MA26.` };
        } else if (prevCandle.close > ma26 && currentPrice < ma26) {
            newSignal = { type: 'ma_sell', message: `📉 MA Продажа: Цена (${currentPrice.toFixed(4)}) пересекла MA26.` };
        }

        // Наклонные
        const lastHigh = allHighFractals.at(-1);
        const prevHigh = allHighFractals.at(-2);
        if (resistance && prevHigh && lastHigh && prevHigh.value > lastHigh.value && prevCandle.close < resistance && currentPrice > resistance) {
            newSignal = { type: 'trend_buy', message: `📈 Тренд Покупка: Цена (${currentPrice.toFixed(4)}) пробила нисходящее сопротивление.` };
        }
        
        const lastLow = allLowFractals.at(-1);
        const prevLow = allLowFractals.at(-2);
        if (support && prevLow && lastLow && prevLow.value < lastLow.value && prevCandle.close > support && currentPrice < support) {
            newSignal = { type: 'trend_sell', message: `📉 Тренд Продажа: Цена (${currentPrice.toFixed(4)}) пробила восходящую поддержку.` };
        }
    }

    // Улучшенная проверка на дублирование, чтобы не пропускать новые фракталы
    if (newSignal) {
        if (!lastSignal || lastSignal.type !== newSignal.type || lastSignal.index !== newSignal.index) {
            return newSignal;
        }
    }

    return null;
}
