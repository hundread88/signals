import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Структура данных по умолчанию
const defaultData = { users: [] };

// Настройка путей
const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
const file = join(dataDir, 'db.json');

const adapter = new JSONFile(file);
const db = new Low(adapter);

/**
 * Инициализирует базу данных: читает файл и устанавливает
 * данные по умолчанию, если файл пуст или отсутствует.
 */
async function initializeDatabase() {
    await db.read();
    db.data ||= defaultData;
    await db.write();
}

// Вызываем инициализацию при первой загрузке модуля
await initializeDatabase();


// --- Экспортируемые функции ---

export async function getUser() {
    await db.read(); // Всегда читаем свежие данные
    db.data ||= defaultData; // Гарантируем, что db.data не null/undefined
    return db.data.users;
}

export async function saveUser(id, data) {
    await db.read();
    db.data ||= defaultData; // Гарантируем, что db.data не null/undefined
    let user = db.data.users.find(u => u.telegram_id === id);
    if (!user) {
        user = { telegram_id: id, last_signal: { type: 'none' } };
        // Убедимся, что массив users существует
        if (!db.data.users) {
            db.data.users = [];
        }
        db.data.users.push(user);
    }
    Object.assign(user, data);
    await db.write();
}

export async function updateUserSignal(id, signal) {
    await db.read();
    db.data ||= defaultData; // Гарантируем, что db.data не null/undefined
    // Убедимся, что массив users существует
    if (!db.data.users) return;
    const user = db.data.users.find(u => u.telegram_id === id);
    if (user) {
        user.last_signal = signal;
        await db.write();
    }
}
