import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const defaultData = { users: [] };

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
const file = join(dataDir, 'db.json');

const adapter = new JSONFile(file);
const db = new Low(adapter, defaultData);

/**
 * Максимально надежная функция для проверки и восстановления данных.
 * Гарантирует, что db.data всегда является объектом с массивом users.
 */
const ensureDbData = () => {
    if (db.data === null || typeof db.data !== 'object') {
        db.data = { users: [] }; // Если данные null или не объект, сбрасываем
        return;
    }
    if (!Array.isArray(db.data.users)) {
        db.data.users = []; // Если объект есть, но в нем нет массива users, добавляем
    }
};

/**
 * Инициализирует базу данных
 */
async function initializeDatabase() {
    await db.read();
    ensureDbData();
    await db.write();
}

await initializeDatabase();


// --- Экспортируемые функции с самой надежной проверкой ---

export async function getUser() {
    await db.read();
    ensureDbData();
    return db.data.users;
}

export async function saveUser(id, data) {
    await db.read();
    ensureDbData();
    
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
    ensureDbData();

    const user = db.data.users.find(u => u.telegram_id === id);
    if (user) {
        user.last_signal = signal;
        await db.write();
    }
}
