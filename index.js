import dotenv from 'dotenv';
dotenv.config();
import { Telegraf } from 'telegraf';
import { getCandles } from './utils/binance.js';
import { calculateIndicators, checkSignals } from './utils/indicators.js';
import { getUser, saveUser, updateUserSignal } from './utils/db.js';

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(async (ctx) => {
  const id = ctx.from.id;
  await ctx.reply('Выбери криптовалюту:', {
    reply_markup: { keyboard: [['BTCUSDT', 'ETHUSDT', 'SOLUSDT']], one_time_keyboard: true }
  });
});

bot.hears(['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], async (ctx) => {
  const id = ctx.from.id;
  await saveUser(id, { symbol: ctx.message.text });
  await ctx.reply('Выбери таймфрейм:', {
    reply_markup: { keyboard: [['5m', '15m', '30m'], ['1h', '4h', '1d']], one_time_keyboard: true }
  });
});

bot.hears(['5m', '15m', '30m', '1h', '4h', '1d'], async (ctx) => {
  const id = ctx.from.id;
  await saveUser(id, { timeframe: ctx.message.text });
  await ctx.reply('Отлично! Я начну отслеживать сигналы и уведомлю тебя.');
});

setInterval(async () => {
  const users = await getUser();
  if (Array.isArray(users)) {
  for (const user of users) {
    const { telegram_id, symbol, timeframe, last_signal } = user;
    if (!symbol || !timeframe) continue;
    try {
      const candles = await getCandles(symbol, timeframe);
      const signal = calculateIndicators(candles);
      const shouldNotify = checkSignals(signal, candles.at(-1), last_signal);
      if (shouldNotify) {
        await bot.telegram.sendMessage(telegram_id,
          `📢 Сигнал (${symbol}, ${timeframe}):\n${signal.message}`);
        await updateUserSignal(telegram_id, signal);
      }
    } catch (e) {
      console.error('Ошибка при получении данных для пользователя', telegram_id, e.message);
    }
  }
  }
}, 60 * 1000);

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
