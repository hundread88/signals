import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Автоматически определяем путь к директории и создаем ее, если нужно
const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const file = join(dataDir, 'db.json');
const adapter = new JSONFile(file);

// Инициализируем БД, передавая данные по умолчанию ({ users: [] })
const db = new Low(adapter, { users: [] });

// Считываем данные из файла при старте
await db.read();
// Записываем данные, чтобы создать файл db.json, если его не было
await db.write();


export async function getUser() {
    await db.read();
    return db.data.users;
}

export async function saveUser(id, data) {
    await db.read();
    let user = db.data.users.find(u => u.telegram_id === id);
    if (!user) {
        // При создании нового пользователя сразу задаем ему пустой последний сигнал
        user = { telegram_id: id, last_signal: { type: 'none' } };
        db.data.users.push(user);
    }
    Object.assign(user, data);
    await db.write();
}

export async function updateUserSignal(id, signal) {
    await db.read();
    const user = db.data.users.find(u => u.telegram_id === id);
    if (user) {
        user.last_signal = signal;
        await db.write();
    }
}
