import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { BACKUPS_DIR, getSettings } from './db';

export function createDatabaseBackup(db: DatabaseSync, label: string = 'manual'): { filePath: string; fileName: string; createdAt: string } {
  const settings = getSettings(db);
  const targetDir = settings.backupFolder || BACKUPS_DIR;
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `study_corner_backup_${stamp}_${safeLabel}.sqlite`;
  const filePath = path.join(targetDir, fileName);

  // Use SQLite VACUUM INTO for a consistent, atomic snapshot even while the DB is open
  const escapedPath = filePath.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${escapedPath}';`);

  return {
    filePath,
    fileName,
    createdAt: now.toISOString(),
  };
}

export function listBackups(db: DatabaseSync): Array<{ fileName: string; filePath: string; sizeBytes: number; createdAt: string }> {
  const settings = getSettings(db);
  const targetDir = settings.backupFolder || BACKUPS_DIR;
  if (!fs.existsSync(targetDir)) return [];

  return fs
    .readdirSync(targetDir)
    .filter((f) => f.endsWith('.sqlite') || f.endsWith('.db'))
    .map((fileName) => {
      const full = path.join(targetDir, fileName);
      const stat = fs.statSync(full);
      return {
        fileName,
        filePath: full,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
