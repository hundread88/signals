import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, '../data/db.json');

// Убедимся, что папка и файл существуют
if (!fs.existsSync(join(__dirname, '../data'))) {
  fs.mkdirSync(join(__dirname, '../data'), { recursive: true });
}
if (!fs.existsSync(file)) {
  fs.writeFileSync(file, JSON.stringify({ users: [] }, null, 2));
}

const adapter = new JSONFile(file);
const db = new Low(adapter);

await db.read();
db.data ||= { users: [] };
await db.write();

export async function getUser() {
  await db.read();
  return db.data.users;
}

export async function saveUser(id, data) {
  await db.read();
  let user = db.data.users.find(u => u.telegram_id === id);
  if (!user) {
    user = { telegram_id: id };
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
