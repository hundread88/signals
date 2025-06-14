import dotenv from 'dotenv';
dotenv.config();

import express from 'express'; // Импортируем express
import { Telegraf } from 'telegraf';
import { getCandles, getCurrentPrice } from './utils/binance.js'; 
import { calculateIndicators, checkSignals } from './utils/indicators.js';
import { getUser, saveUser, updateUserSignal } from './utils/db.js';

if (!process.env.BOT_TOKEN) {
    throw new Error('"BOT_TOKEN" env variable is required!');
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express(); // Создаем приложение express
const port = process.env.PORT || 8080;

// --- Роут для UptimeRobot ---
// Этот URL будет всегда отвечать "OK", чтобы UptimeRobot был доволен
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// ... (код обработчиков bot.start, bot.hears без изменений) ...
bot.start(async (ctx) => {
    await ctx.reply('Добро пожаловать! Я бот для крипто-сигналов. Выбери криптовалюту:', {
        reply_markup: { keyboard: [['BTCUSDT', 'ETHUSDT', 'SOLUSDT']], one_time_keyboard: true, resize_keyboard: true }
    });
});
bot.hears(['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], async (ctx) => {
    const id = ctx.from.id;
    await saveUser(id, { symbol: ctx.message.text });
    await ctx.reply('Выбери таймфрейм:', {
        reply_markup: { keyboard: [['5m', '15m', '30m'], ['1h', '4h', '1d']], one_time_keyboard: true, resize_keyboard: true }
    });
});
bot.hears(['5m', '15m', '30m', '1h', '4h', '1d'], async (ctx) => {
    const id = ctx.from.id;
    await saveUser(id, { timeframe: ctx.message.text });
    await ctx.reply('Отлично! Я начну отслеживать сигналы. Проверка будет выполняться каждую минуту для получения сигналов "в моменте".');
});

// --- Основная логика проверки сигналов (без изменений) ---
const checkAllUsers = async () => {
    const users = await getUser();
    if (!Array.isArray(users)) return;

    for (const user of users) {
        const { telegram_id, symbol, timeframe, last_signal } = user;
        if (!symbol || !timeframe) continue;

        try {
            const [candles, currentPrice] = await Promise.all([
                getCandles(symbol, timeframe, 200),
                getCurrentPrice(symbol)
            ]);
            
            if (candles.length < 30) continue;
            
            const indicators = calculateIndicators(candles);
            if (indicators.error) continue;

            const newSignal = checkSignals(indicators, last_signal, candles, currentPrice); 
            
            if (newSignal) {
                await bot.telegram.sendMessage(telegram_id, `📢 Сигнал (${symbol}, ${timeframe}):\n${newSignal.message}`);
                await updateUserSignal(telegram_id, newSignal);
            }
        } catch (e) {
            console.error(`Ошибка при обработке ${symbol}: ${e.message}`);
        }
    }
};

// Запускаем цикл проверки
setInterval(checkAllUsers, 1 * 60 * 1000); 

// --- Логика запуска бота через Express ---
const startBot = async () => {
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    if (process.env.WEBHOOK_URL) {
        // Устанавливаем вебхук для Telegraf
        app.use(await bot.createWebhook({ domain: process.env.WEBHOOK_URL }));

        app.listen(port, () => {
            console.log(`Бот запущен в режиме webhook на порту ${port}`);
        });
    } else {
        // Локальный запуск
        await bot.launch();
        console.log('Бот запущен в режиме polling');
    }
};

startBot();
