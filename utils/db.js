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

// --- ГЛАВНОЕ ИСПРАВЛЕНИЕ ---
// Передаем данные по умолчанию (defaultData) ВТОРЫМ АРГУМЕНТОМ.
// Это устраняет ошибку "lowdb: missing default data" при запуске.
const db = new Low(adapter, defaultData);

/**
 * Инициализирует базу данных: читает файл и гарантирует,
 * что данные существуют и файл записан на диск.
 */
async function initializeDatabase() {
    await db.read();
    // Эта строка является дополнительной защитой на случай, если файл db.json
    // существует, но он пустой. В этом случае db.data может стать null.
    db.data ||= defaultData;
    await db.write();
}

// Вызываем инициализацию при первой загрузке модуля
await initializeDatabase();


// --- Экспортируемые функции ---

export async function getUser() {
    await db.read();
    db.data ||= defaultData;
    return db.data.users;
}

export async function saveUser(id, data) {
    await db.read();
    db.data ||= defaultData;
    let user = db.data.users.find(u => u.telegram_id === id);
    if (!user) {
        user = { telegram_id: id, last_signal: { type: 'none' } };
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
    db.data ||= defaultData;
    if (!db.data.users) return;
    const user = db.data.users.find(u => u.telegram_id === id);
    if (user) {
        user.last_signal = signal;
        await db.write();
    }
}
