import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Using a persistent location or fallback to current dir
const dbDir = process.env.RENDER ? '/var/data' : process.cwd();
if (process.env.RENDER && !fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'mafia_juno.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nickname TEXT,
    avatar TEXT DEFAULT '',
    coins INTEGER DEFAULT 0,
    status TEXT DEFAULT 'IN_MENU',
    is_banned INTEGER DEFAULT 0
  )
`);

try {
  db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '';`);
} catch (e) {
  // Ignore if column already exists
}

export interface DBUser {
  id: string;
  nickname: string;
  avatar: string;
  coins: number;
  status: string;
  is_banned: number;
}

export function getUser(id: string): DBUser | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DBUser | undefined;
}

export function createUser(id: string, nickname: string, avatar: string = ''): DBUser {
  db.prepare('INSERT OR IGNORE INTO users (id, nickname, avatar, coins, status, is_banned) VALUES (?, ?, ?, 0, ?, 0)')
    .run(id, nickname, avatar, 'IN_MENU');
  return getUser(id)!;
}

export function updateProfileInDb(id: string, nickname: string, avatar: string) {
  db.prepare('UPDATE users SET nickname = ?, avatar = ? WHERE id = ?').run(nickname, avatar, id);
}

export function updateUserStatus(id: string, status: string) {
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
}

export function banUser(id: string) {
   db.prepare('UPDATE users SET is_banned = 1 WHERE id = ?').run(id);
}

export function unbanUser(id: string) {
   db.prepare('UPDATE users SET is_banned = 0 WHERE id = ?').run(id);
}

export function getAllUsers(): DBUser[] {
  return db.prepare('SELECT * FROM users').all() as DBUser[];
}

export default db;
