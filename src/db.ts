import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Используем текущую директорию вместо закрытой /var/data на бесплатных тарифах
const dbPath = path.join(process.cwd(), 'mafia_juno.db');
let db;
try {
  db = new Database(dbPath);
} catch (e) {
  console.warn(`Failed to open database at ${dbPath}, falling back to in-memory database.`);
  db = new Database(':memory:');
}

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nickname TEXT,
    avatar TEXT DEFAULT '',
    coins INTEGER DEFAULT 0,
    status TEXT DEFAULT 'IN_MENU',
    is_banned INTEGER DEFAULT 0,
    vip_color TEXT DEFAULT ''
  )
`);

try {
  db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '';`);
} catch (e) {
  // Ignore if column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN vip_color TEXT DEFAULT '';`);
} catch (e) {
  // Ignore
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN matches_played INTEGER DEFAULT 0;`);
  db.exec(`ALTER TABLE users ADD COLUMN wins INTEGER DEFAULT 0;`);
} catch (e) {
  // Ignore
}

export interface DBUser {
  id: string;
  nickname: string;
  avatar: string;
  coins: number;
  status: string;
  is_banned: number;
  vip_color: string;
  matches_played: number;
  wins: number;
  is_admin: number;
}

try {
  db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;`);
} catch (e) {
  // Ignore
}

export function addStats(id: string, isWin: boolean) {
   db.prepare('UPDATE users SET matches_played = matches_played + 1, wins = wins + ? WHERE id = ?').run(isWin ? 1 : 0, id);
}

export function getUser(id: string): DBUser | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DBUser | undefined;
}

export function createUser(id: string, nickname: string, avatar: string = ''): DBUser {
  db.prepare("INSERT OR IGNORE INTO users (id, nickname, avatar, coins, status, is_banned, vip_color) VALUES (?, ?, ?, 0, ?, 0, '')")
    .run(id, nickname, avatar, 'IN_MENU');
  return getUser(id)!;
}

export function updateProfileInDb(id: string, nickname: string, avatar: string) {
  db.prepare('UPDATE users SET nickname = ?, avatar = ? WHERE id = ?').run(nickname, avatar, id);
}

export function updateVipColor(id: string, color: string) {
  db.prepare('UPDATE users SET vip_color = ? WHERE id = ?').run(color, id);
}

export function spendCoins(id: string, amount: number): boolean {
  const user = getUser(id);
  if (!user || user.coins < amount) return false;
  db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(amount, id);
  return true;
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
