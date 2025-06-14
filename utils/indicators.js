// Вспомогательные функции (без изменений)
function getLineValue(p1, p2, currentX) {
  if (!p1 || !p2 || p1.index === p2.index) return null;
  const slope = (p2.value - p1.value) / (p2.index - p1.index);
  return slope * (currentX - p1.index) + p1.value;
}

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

function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

// Функция calculateIndicators без изменений
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
 * Главная функция проверки сигналов (с новым блоком предварительных сигналов)
 */
export function checkSignals(indicators, lastSignal, candles, currentPrice) {
    const { ma26, support, resistance, prevCandle } = indicators;
    
    if (!prevCandle || !currentPrice || candles.length < 5) return null;

    let newSignal = null;
    const highs = candles.map(c => parseFloat(c[2]));
    const lows = candles.map(c => parseFloat(c[3]));

    // --- БЛОК 1: ПРЕДВАРИТЕЛЬНЫЕ (УПРЕЖДАЮЩИЕ) СИГНАЛЫ О ФРАКТАЛАХ ---
    // Проверяем свечу, которая закрылась 2 периода назад (i = length - 2)
    // Сигнал приходит при открытии следующей свечи (length - 1)
    const provisionalFractalIndex = candles.length - 2;

    // Условие для предварительного фрактала сверху: пик выше 2-х свечей слева и 1-й справа
    const isProvHigh = highs[provisionalFractalIndex] >= highs[provisionalFractalIndex - 1] &&
                       highs[provisionalFractalIndex] >= highs[provisionalFractalIndex - 2] &&
                       highs[provisionalFractalIndex] > highs[provisionalFractalIndex + 1];

    if (isProvHigh) {
        const fractalValue = highs[provisionalFractalIndex];
        newSignal = { type: 'prov_high', message: `⚠️ Обнаружен предварительный фрактал сверху (${fractalValue.toFixed(4)}).` };
    }

    // Условие для предварительного фрактала снизу
    const isProvLow = lows[provisionalFractalIndex] <= lows[provisionalFractalIndex - 1] &&
                      lows[provisionalFractalIndex] <= lows[provisionalFractalIndex - 2] &&
                      lows[provisionalFractalIndex] < lows[provisionalFractalIndex + 1];

    if (isProvLow) {
        const fractalValue = lows[provisionalFractalIndex];
        newSignal = { type: 'prov_low', message: `⚠️ Обнаружен предварительный фрактал снизу (${fractalValue.toFixed(4)}).` };
    }
    
    // --- БЛОК 2: ТОРГОВЫЕ СИГНАЛЫ "В МОМЕНТЕ" ---
    // Они будут проверяться, только если не было предварительного сигнала о фрактале
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
