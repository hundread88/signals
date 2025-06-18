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

const ensureDbData = () => {
    if (!db.data || !Array.isArray(db.data.users)) {
        db.data = defaultData;
    }
};

async function initializeDatabase() {
    await db.read();
    ensureDbData();
    await db.write();
}

await initializeDatabase();

export async function getUser() {
    await db.read();
    ensureDbData();
    return db.data.users;
}

// ... функции ensureDbData, initializeDatabase, getUser ...

export async function saveUser(id, data) {
    await db.read();
    ensureDbData();
    
    let user = db.data.users.find(u => u.telegram_id === id);
    if (!user) {
        // Инициализируем пользователя с пустым кэшем сигналов
        user = { 
            telegram_id: id, 
            signal_cache: { period_timestamp: 0, sent_types: [] } 
        };
        db.data.users.push(user);
    }
    Object.assign(user, data);
    await db.write();
}

// updateUserSignal теперь будет обновлять кэш
export async function updateUserSignal(id, new_cache) {
    await db.read();
    ensureDbData();

    const user = db.data.users.find(u => u.telegram_id === id);
    if (user) {
        user.signal_cache = new_cache;
        await db.write();
    }
}
