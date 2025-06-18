import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { Telegraf } from 'telegraf';
import { getCandles, getCurrentPrice } from './utils/binance.js'; 
import { calculateIndicators, checkSignals } from './utils/indicators.js';
import { getUser, saveUser, updateUserSignal } from './utils/db.js';

if (!process.env.BOT_TOKEN) {
    throw new Error('"BOT_TOKEN" env variable is required!');
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
const port = process.env.PORT || 8080;

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

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
    await ctx.reply('Отлично! Я начну отслеживать сигналы. Проверка будет выполняться каждую минуту.');
});


// ... импорты и код бота ...

const checkAllUsers = async () => {
    const users = await getUser();
    if (!Array.isArray(users)) return;

    for (const user of users) {
        // Достаем signal_cache вместо last_signal
        const { telegram_id, symbol, timeframe, signal_cache } = user;
        if (!symbol || !timeframe) continue;

        try {
            const [candles, currentPrice] = await Promise.all([
                getCandles(symbol, timeframe, 200),
                getCurrentPrice(symbol)
            ]);
            
            if (candles.length < 30) continue;
            
            const { indicators } = calculateIndicators(candles); 
            if (indicators.error) continue;

            // Передаем старый кэш и получаем новый
            const { newSignal, updatedCache } = checkSignals(indicators, signal_cache, candles, currentPrice); 
            
            // Всегда обновляем кэш в БД, даже если нового сигнала не было
            await updateUserSignal(telegram_id, updatedCache); 

            if (newSignal) {
                await bot.telegram.sendMessage(telegram_id, `📢 Сигнал (${symbol}, ${timeframe}):\n${newSignal.message}`);
            }
        } catch (e) {
            console.error(`Ошибка при обработке ${symbol}: ${e.message}`);
        }
    }
};

// ... остальной код ...

setInterval(checkAllUsers, 1 * 60 * 1000); 

const startBot = async () => {
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    if (process.env.WEBHOOK_URL) {
        app.use(await bot.createWebhook({ domain: process.env.WEBHOOK_URL }));
        app.listen(port, () => {
            console.log(`Бот запущен в режиме webhook на порту ${port}`);
        });
    } else {
        await bot.launch();
        console.log('Бот запущен в режиме polling');
    }
};

startBot();
