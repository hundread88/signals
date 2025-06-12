/**
 * Вспомогательные функции (без изменений)
 */
function getLineValue(p1, p2, currentX) {
  if (!p1 || !p2 || p1.index === p2.index) return null;
  const slope = (p2.value - p1.value) / (p2.index - p1.index);
  return slope * (currentX - p1.index) + p1.value;
}

function findFractals(data, type) {
  const fractals = [];
  for (let i = 2; i < data.length - 2; i++) {
    const isHigh = type === 'high' && data[i] > data[i-1] && data[i] > data[i-2] && data[i] > data[i+1] && data[i] > data[i+2];
    const isLow = type === 'low' && data[i] < data[i-1] && data[i] < data[i-2] && data[i] < data[i+1] && data[i] < data[i+2];
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

/**
 * Функция расчета индикаторов (теперь возвращает и списки фракталов)
 */
export function calculateIndicators(candles) {
  const closes = candles.map(c => parseFloat(c[4]));
  const highs = candles.map(c => parseFloat(c[2]));
  const lows = candles.map(c => parseFloat(c[3]));

  if (closes.length < 30) {
    return { error: "Недостаточно данных." };
  }

  const ma7 = average(closes.slice(-7));
  const ma26 = average(closes.slice(-26));
  const trend = ma7 > ma26 ? 'up' : ma7 < ma26 ? 'down' : 'sideways';

  const allHighFractals = findFractals(highs, 'high');
  const allLowFractals = findFractals(lows, 'low');

  // Логика расчета наклонных остается для старых сигналов
  let resistance = null, support = null;
  if (allHighFractals.length >= 2) {
      resistance = getLineValue(allHighFractals.at(-2), allHighFractals.at(-1), candles.length - 1);
  }
  if (allLowFractals.length >= 2) {
      support = getLineValue(allLowFractals.at(-2), allLowFractals.at(-1), candles.length - 1);
  }

  return {
    ma26, support, resistance,
    allHighFractals, allLowFractals, // Возвращаем полные списки
    lastCandle: { close: closes.at(-1) },
    prevCandle: { close: closes.at(-2) },
  };
}

/**
 * Главная функция проверки сигналов (полностью переработана)
 */
export function checkSignals(indicators, lastSignal, candles) {
    const { ma26, support, resistance, allHighFractals, allLowFractals, lastCandle, prevCandle } = indicators;
    if (!lastCandle || !prevCandle) return null;

    let newSignal = null;

    // --- БЛОК 1: Информационные сигналы о формировании фракталов ---
    const newlyConfirmedFractalIndex = candles.length - 3; // Фрактал подтверждается через 2 свечи
    
    // Проверка на новый ВЕРХНИЙ фрактал
    const newHighFractal = allHighFractals.find(f => f.index === newlyConfirmedFractalIndex);
    if (newHighFractal) {
        const previousHighs = allHighFractals.filter(f => f.index < newlyConfirmedFractalIndex).slice(-5);
        if (previousHighs.length > 0) {
            const isHighest = previousHighs.every(pf => newHighFractal.value > pf.value);
            const isLower = previousHighs.some(pf => newHighFractal.value < pf.value);

            if (isHighest) {
                newSignal = { type: 'info_new_high_peak', message: `📈 Новый пиковый фрактал сверху (${newHighFractal.value.toFixed(4)}). Наклонная отсутствует/сломана.` };
            } else if (isLower) {
                newSignal = { type: 'info_new_high_trend', message: `🔴 Сформирован новый фрактал сверху (${newHighFractal.value.toFixed(4)}), ниже предыдущих. Вероятно формирование нисходящей наклонной.` };
            }
        }
    }

    // Проверка на новый НИЖНИЙ фрактал (только если не было сигнала о верхнем)
    if (!newSignal) {
        const newLowFractal = allLowFractals.find(f => f.index === newlyConfirmedFractalIndex);
        if (newLowFractal) {
            const previousLows = allLowFractals.filter(f => f.index < newlyConfirmedFractalIndex).slice(-5);
            if (previousLows.length > 0) {
                const isLowest = previousLows.every(pf => newLowFractal.value < pf.value);
                const isHigher = previousLows.some(pf => newLowFractal.value > pf.value);

                if (isLowest) {
                    newSignal = { type: 'info_new_low_peak', message: `📉 Новый пиковый фрактал снизу (${newLowFractal.value.toFixed(4)}). Наклонная отсутствует/сломана.` };
                } else if (isHigher) {
                    newSignal = { type: 'info_new_low_trend', message: `🟢 Сформирован новый фрактал снизу (${newLowFractal.value.toFixed(4)}), выше предыдущих. Вероятно формирование восходящей наклонной.` };
                }
            }
        }
    }
    
    // --- БЛОК 2: Торговые сигналы (MA и пересечение наклонных) ---
    // Они будут проверяться, только если не было информационного сигнала о фрактале
    if (!newSignal) {
        if (prevCandle.close < ma26 && lastCandle.close > ma26) {
            newSignal = { type: 'ma_buy', message: `📈 Сигнал на покупку (MA)\nЦена пересекла MA26 снизу вверх.` };
        } else if (prevCandle.close > ma26 && lastCandle.close < ma26) {
            newSignal = { type: 'ma_sell', message: `📉 Сигнал на продажу (MA)\nЦена пересекла MA26 сверху вниз.` };
        } else if (resistance && prevCandle.close < resistance && lastCandle.close > resistance) {
            newSignal = { type: 'trend_buy', message: `📈 Сигнал на покупку (Тренд)\nЦена пробила линию сопротивления.` };
        } else if (support && prevCandle.close > support && lastCandle.close < support) {
            newSignal = { type: 'trend_sell', message: `📉 Сигнал на продажу (Тренд)\nЦена пробила линию поддержки.` };
        }
    }

    // Финальная проверка: отправляем сигнал, только если он новый и отличается от предыдущего
    if (newSignal && (!lastSignal || newSignal.type !== lastSignal.type)) {
        return newSignal;
    }

    return null;
}
