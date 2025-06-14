// Вспомогательная функция getLineValue без изменений
function getLineValue(p1, p2, currentX) {
  if (!p1 || !p2 || p1.index === p2.index) return null;
  const slope = (p2.value - p1.value) / (p2.index - p1.index);
  return slope * (currentX - p1.index) + p1.value;
}

// --- ИЗМЕНЕНИЕ 1: "Смягчаем" правила для более надежного обнаружения ---
function findFractals(data, type) {
  const fractals = [];
  for (let i = 2; i < data.length - 2; i++) {
    // Используем "больше/меньше или равно", чтобы не пропускать фракталы с одинаковыми значениями
    const isHigh = type === 'high' &&
      data[i] >= data[i - 1] && data[i] >= data[i - 2] &&
      data[i] >= data[i + 1] && data[i] >= data[i + 2];
    
    const isLow = type === 'low' &&
      data[i] <= data[i - 1] && data[i] <= data[i - 2] &&
      data[i] <= data[i + 1] && data[i] <= data[i + 2];

    // Дополнительная проверка, чтобы исключить фракталы на абсолютно ровных участках
    if ((isHigh && (data[i] > data[i - 1] || data[i] > data[i + 1])) || 
        (isLow && (data[i] < data[i - 1] || data[i] < data[i + 1]))) {
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
    ma26, support, resistance, allHighFractals, allLowFractals,
    lastCandle: { close: closes.at(-1) },
    prevCandle: { close: closes.at(-2) },
  };
}

/**
 * Главная функция проверки сигналов (с режимом отладки)
 */
export function checkSignals(indicators, lastSignal, candles, currentPrice) {
    const { ma26, support, resistance, allHighFractals, allLowFractals, prevCandle } = indicators;
    
    if (!prevCandle || !currentPrice || candles.length < 5) return null;

    let newSignal = null;

    // --- ИЗМЕНЕНИЕ 2: РЕЖИМ ОТЛАДКИ ---
    const DEBUG_MODE = true; // Установите false, чтобы отключить подробные логи
    if (DEBUG_MODE) {
        const index = candles.length - 3; // Индекс свечи, которая могла стать подтвержденным фракталом
        const highSlice = candles.slice(index - 2, index + 3).map(c => parseFloat(c[2]));
        const lowSlice = candles.slice(index - 2, index + 3).map(c => parseFloat(c[3]));
        console.log(`[DEBUG] Проверка фрактала на индексе ${index}. Highs: [${highSlice.join(', ')}]. Lows: [${lowSlice.join(', ')}]`);
    }

    // --- БЛОК 1: Сигналы о ПОДТВЕРЖДЕННЫХ фракталах ---
    const newlyConfirmedFractalIndex = candles.length - 3;
    
    const newHighFractal = allHighFractals.find(f => f.index === newlyConfirmedFractalIndex);
    if (newHighFractal) {
        newSignal = { type: 'info_high_confirmed', message: `✅ Сформирован подтвержденный фрактал сверху (${newHighFractal.value.toFixed(4)}).` };
    }

    const newLowFractal = allLowFractals.find(f => f.index === newlyConfirmedFractalIndex);
    if (newLowFractal) {
        newSignal = { type: 'info_low_confirmed', message: `✅ Сформирован подтвержденный фрактал снизу (${newLowFractal.value.toFixed(4)}).` };
    }
    
    // --- БЛОК 2: Торговые сигналы ---
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

    // Финальная проверка на дублирование
    if (newSignal && (!lastSignal || newSignal.type !== lastSignal.type)) {
        return newSignal;
    }

    return null;
}
