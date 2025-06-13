import dotenv from 'dotenv';
dotenv.config();

import { Telegraf } from 'telegraf';
import { getCandles, getCurrentPrice } from './utils/binance.js';
import { calculateIndicators, checkSignals } from './utils/indicators.js';
import { getUser, saveUser, updateUserSignal } from './utils/db.js';

if (!process.env.BOT_TOKEN) {
    throw new Error('"BOT_TOKEN" env variable is required!');
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// --- Обработчики команд ---

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
    await ctx.reply('Отлично! Я начну отслеживать сигналы. Проверка будет выполняться каждые 5 минут.');
});

// --- Основная логика проверки сигналов (обновлена) ---
const checkAllUsers = async () => {
    const users = await getUser();
    if (!Array.isArray(users)) return;

    for (const user of users) {
        const { telegram_id, symbol, timeframe, last_signal } = user;
        if (!symbol || !timeframe) continue;

        try {
            // Одновременно запрашиваем и свечи, и текущую цену
            const [candles, currentPrice] = await Promise.all([
                getCandles(symbol, timeframe, 200),
                getCurrentPrice(symbol)
            ]);
            
            if (candles.length < 30) continue;
            
            const indicators = calculateIndicators(candles);
            if (indicators.error) continue;

            // Передаем currentPrice для проверки "в моменте"
            const newSignal = checkSignals(indicators, last_signal, candles, currentPrice); 
            
            if (newSignal) {
                await bot.telegram.sendMessage(telegram_id, `📢 Сигнал (${symbol}, ${timeframe}):\n${newSignal.message}`);
                await updateUserSignal(telegram_id, newSignal);
            }
        } catch (e) {
            // Убрал вывод ошибки в консоль, чтобы не засорять лог при временных сбоях сети
        }
    }
};

// УМЕНЬШАЕМ ИНТЕРВАЛ до 1 минуты для проверки "в моменте"
setInterval(checkAllUsers, 1 * 60 * 1000); 

// --- УЛУЧШЕННАЯ ЛОГИКА ЗАПУСКА БОТА ---

const startBot = async () => {
    // Корректная остановка
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    if (process.env.WEBHOOK_URL) {
        // --- РЕЖИМ WEBHOOK (ДЛЯ RENDER) ---
        const port = process.env.PORT || 8080;
        try {
            // Устанавливаем вебхук на стороне Telegram
            await bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}/telegraf/${bot.secretPathComponent()}`);
            // Запускаем сервер для приема обновлений
            await bot.startWebhook(`/telegraf/${bot.secretPathComponent()}`, null, port);
            console.log(`Бот запущен в режиме webhook на порту ${port}`);
        } catch (e) {
            console.error('Не удалось запустить бота в режиме webhook:', e);
        }
    } else {
        // --- РЕЖИМ POLLING (ДЛЯ ЛОКАЛЬНОЙ РАЗРАБОТКИ) ---
        try {
            // Сначала удаляем вебхук, чтобы избежать конфликта 409
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            console.log('Вебхук удален. Запуск в режиме polling...');
            // Запускаем бот в режиме опроса
            await bot.launch();
            console.log('Бот запущен в режиме polling');
        } catch (e) {
            console.error('Не удалось запустить бота в режиме polling:', e);
        }
    }
};

// Запускаем бота
startBot();
