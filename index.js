import dotenv from 'dotenv';
dotenv.config();

import { Telegraf } from 'telegraf';
import { getCandles } from './utils/binance.js';
import { calculateIndicators, checkSignals } from './utils/indicators.js';
import { getUser, saveUser, updateUserSignal } from './utils/db.js';

// Проверка наличия токена
if (!process.env.BOT_TOKEN) {
    throw new Error('"BOT_TOKEN" env variable is required!');
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// --- Обработчики команд и сообщений ---

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


// --- Основная логика проверки сигналов ---

const checkAllUsers = async () => {
    const users = await getUser();
    for (const user of users) {
        const { telegram_id, symbol, timeframe, last_signal } = user;
        if (!symbol || !timeframe) continue;

        try {
            // Запрашиваем достаточное количество свечей для расчетов
            const candles = await getCandles(symbol, timeframe, 200);
            
            if (candles.length < 30) continue;

            const indicators = calculateIndicators(candles);
            if (indicators.error) {
                console.error(`Ошибка расчета для ${telegram_id}:`, indicators.error);
                continue;
            }

            const newSignal = checkSignals(indicators, last_signal);

            if (newSignal) {
                await bot.telegram.sendMessage(telegram_id, `📢 Сигнал (${symbol}, ${timeframe}):\n${newSignal.message}`);
                await updateUserSignal(telegram_id, newSignal);
            }
        } catch (e) {
            console.error('Ошибка при обработке пользователя', telegram_id, e.message);
        }
    }
};

// Запускаем периодическую проверку.
// Для продакшена на бесплатных тарифах хостинга (которые могут "засыпать")
// рекомендуется использовать внешний крон-сервис.
setInterval(checkAllUsers, 5 * 60 * 1000); // Проверка каждые 5 минут


// --- Запуск бота ---

// Корректная остановка бота
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Запуск в режиме Webhook для продакшена (напр. Render)
if (process.env.WEBHOOK_URL) {
    const port = process.env.PORT || 8080;
    bot.launch({
        webhook: {
            domain: process.env.WEBHOOK_URL,
            port: port
        }
    }).then(() => {
        console.log(`Бот запущен в режиме webhook на порту ${port}`);
    });
} else {
    // Запуск в режиме Polling для локальной разработки
    bot.launch().then(() => {
        console.log('Бот запущен в режиме polling');
    });
    console.log('Для запуска в режиме webhook, установите переменную окружения WEBHOOK_URL');
}
