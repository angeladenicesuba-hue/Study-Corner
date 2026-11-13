import type { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { DEFAULT_TIERS, DEFAULT_PLANS, DEFAULT_OPEN_HOUR, DEFAULT_CLOSE_HOUR } from '../../shared/billing';
import { AppSettings } from '../../shared/types';

const { DatabaseSync: SqliteDatabase } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');

export const DATA_DIR = path.resolve(process.cwd(), 'StudyCorner_Data');
export const DB_PATH = path.join(DATA_DIR, 'study_corner.sqlite');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

export function ensureDirectories() {
  for (const dir of [DATA_DIR, UPLOADS_DIR, BACKUPS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function createDatabase(dbFilePath: string = DB_PATH): DatabaseSync {
  ensureDirectories();
  const db = new SqliteDatabase(dbFilePath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier',
      pin TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      member_card_no TEXT,
      is_member INTEGER NOT NULL DEFAULT 0,
      phone TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plan_subs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      plan_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      price INTEGER NOT NULL,
      is_member INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      customer_name TEXT NOT NULL,
      member_card_no TEXT,
      is_member INTEGER NOT NULL DEFAULT 0,
      plan_sub_id INTEGER,
      time_in TEXT NOT NULL,
      time_out TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS visit_food_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_no TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      staff_name TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      is_member INTEGER NOT NULL DEFAULT 0,
      minutes_stayed INTEGER NOT NULL DEFAULT 0,
      subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid'
    );

    CREATE TABLE IF NOT EXISTS sale_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      item TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      method TEXT NOT NULL,
      amount INTEGER NOT NULL,
      tendered INTEGER,
      ref_no TEXT,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL,
      method TEXT NOT NULL DEFAULT 'cash',
      note TEXT NOT NULL DEFAULT '',
      staff_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opened_by TEXT NOT NULL,
      closed_by TEXT,
      opening_cash INTEGER NOT NULL,
      counted_cash INTEGER,
      expected_cash INTEGER,
      notes TEXT
    );
  `);

  seedInitialData(db);
  return db;
}

function seedInitialData(db: DatabaseSync) {
  // Default settings
  const defaultSettings: AppSettings = {
    shopName: 'Study Corner',
    branchName: 'Sta. Mesa / San Marcelino',
    address: '1943 Rd 5 Sta. Mesa / San Marcelino Ermita, Manila',
    openHour: DEFAULT_OPEN_HOUR,
    closeHour: DEFAULT_CLOSE_HOUR,
    membershipCardPrice: 100,
    qrPhImageUrl: '/uploads/default-qrph.svg',
    backupFolder: BACKUPS_DIR,
    tiers: DEFAULT_TIERS,
    plans: DEFAULT_PLANS,
  };

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('app_settings', JSON.stringify(defaultSettings));

  // Default QR Ph placeholder SVG if not exists
  const defaultQrPath = path.join(UPLOADS_DIR, 'default-qrph.svg');
  if (!fs.existsSync(defaultQrPath)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 360" width="320" height="360">
      <rect width="320" height="360" rx="16" fill="#ffffff" stroke="#1e293b" stroke-width="4"/>
      <rect x="20" y="20" width="280" height="44" rx="8" fill="#1e40af"/>
      <text x="160" y="48" font-family="sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">QR Ph • Study Corner</text>
      <rect x="50" y="80" width="220" height="220" fill="#f8fafc" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6,6"/>
      <rect x="70" y="100" width="50" height="50" fill="#0f172a"/>
      <rect x="80" y="110" width="30" height="30" fill="#ffffff"/>
      <rect x="88" y="118" width="14" height="14" fill="#0f172a"/>
      <rect x="200" y="100" width="50" height="50" fill="#0f172a"/>
      <rect x="210" y="110" width="30" height="30" fill="#ffffff"/>
      <rect x="218" y="118" width="14" height="14" fill="#0f172a"/>
      <rect x="70" y="230" width="50" height="50" fill="#0f172a"/>
      <rect x="80" y="240" width="30" height="30" fill="#ffffff"/>
      <rect x="88" y="248" width="14" height="14" fill="#0f172a"/>
      <rect x="135" y="165" width="50" height="50" rx="6" fill="#dc2626"/>
      <text x="160" y="196" font-family="sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">QR Ph</text>
      <text x="160" y="330" font-family="sans-serif" font-size="13" fill="#475569" text-anchor="middle">Upload official QR in Settings</text>
    </svg>`;
    fs.writeFileSync(defaultQrPath, svg, 'utf-8');
  }

  // Seed default staff
  const staffCount = db.prepare('SELECT COUNT(*) as cnt FROM staff').get() as { cnt: number };
  if (staffCount.cnt === 0) {
    const insertStaff = db.prepare('INSERT INTO staff (name, role, pin, active) VALUES (?, ?, ?, 1)');
    insertStaff.run('Owner / Manager', 'manager', '1234');
    insertStaff.run('Front Desk Staff', 'cashier', '0000');
  }

  // Seed official Study Corner menu items (from user's uploaded menu photos)
  const productCount = db.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number };
  if (productCount.cnt === 0) {
    const menuItems: Array<[string, string, number]> = [
      // Iced Coffee & Drinks
      ['Americano', 'iced_coffee', 60],
      ['Iced Latte', 'iced_coffee', 80],
      ['Vietnamese', 'iced_coffee', 95],
      ['Spanish Latte', 'iced_coffee', 95],
      ['Salted Caramel', 'iced_coffee', 95],
      ['Butterscotch', 'iced_coffee', 95],
      ['White Mocha', 'iced_coffee', 95],
      // Non-coffee iced drinks
      ['Lemon Sprite-Tea', 'non_coffee', 70],
      ['Milo Dinosaur', 'non_coffee', 85],
      ['Strawberry Milk', 'non_coffee', 90],
      ['Matcha Latte', 'non_coffee', 95],
      ['Milo Godzilla', 'non_coffee', 95],
      // Lunch & Dinner
      ['Beef Bulgogi', 'lunch_dinner', 169],
      ['Chicken Pastil w/ Egg', 'lunch_dinner', 80],
      ['Chicken Bulgogi', 'lunch_dinner', 169],
    ];
    const insertProd = db.prepare('INSERT INTO products (name, category, price, active) VALUES (?, ?, ?, 1)');
    for (const [name, category, price] of menuItems) {
      insertProd.run(name, category, price);
    }
  }
}

export function getSettings(db: DatabaseSync): AppSettings {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('app_settings') as { value: string } | undefined;
  if (!row) {
    throw new Error('Settings not initialized');
  }
  return JSON.parse(row.value) as AppSettings;
}

export function saveSettings(db: DatabaseSync, settings: AppSettings): AppSettings {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('app_settings', JSON.stringify(settings));
  return settings;
}
