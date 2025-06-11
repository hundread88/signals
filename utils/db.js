import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Структура данных по умолчанию, к которой мы будем все приводить
const defaultData = { users: [] };

// Настройка путей
const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
const file = join(dataDir, 'db.json');

const adapter = new JSONFile(file);
const db = new Low(adapter, defaultData);

/**
 * Более надежная функция для проверки и восстановления данных
 */
const ensureDbData = () => {
    // Проверяем не просто на null, а на наличие ключевого массива 'users'
    if (!db.data || !Array.isArray(db.data.users)) {
        db.data = defaultData;
    }
};

/**
 * Инициализирует базу данных: читает файл и гарантирует,
 * что данные существуют и файл записан на диск.
 */
async function initializeDatabase() {
    await db.read();
    ensureDbData(); // Используем новую надежную проверку
    await db.write();
}

// Вызываем инициализацию при первой загрузке модуля
await initializeDatabase();


// --- Экспортируемые функции с новой проверкой ---

export async function getUser() {
    await db.read();
    ensureDbData(); // Надежная проверка
    return db.data.users;
}

export async function saveUser(id, data) {
    await db.read();
    ensureDbData(); // Надежная проверка
    
    let user = db.data.users.find(u => u.telegram_id === id);
    if (!user) {
        user = { telegram_id: id, last_signal: { type: 'none' } };
        db.data.users.push(user);
    }
    Object.assign(user, data);
    await db.write();
}

export async function updateUserSignal(id, signal) {
    await db.read();
    ensureDbData(); // Надежная проверка

    const user = db.data.users.find(u => u.telegram_id === id);
    if (user) {
        user.last_signal = signal;
        await db.write();
    }
}
