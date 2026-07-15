import { db, mirrorToLocalStorage } from '../db/database';
import { format } from 'date-fns';

const SETTINGS_KEY = 'fightClubSettings';

export async function downloadBackup(): Promise<void> {
  const [members, subscriptions, attendance, payments, sessionPacks] = await Promise.all([
    db.members.toArray(),
    db.subscriptions.toArray(),
    db.attendance.toArray(),
    db.payments.toArray(),
    db.sessionPacks.toArray(),
  ]);

  const settings = localStorage.getItem(SETTINGS_KEY);

  const backup = {
    members,
    subscriptions,
    attendance,
    payments,
    sessionPacks,
    settings: settings ? JSON.parse(settings) : null,
    exportedAt: new Date().toISOString(),
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const a = document.createElement('a');
  a.href = url;
  a.download = `fight-club-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  await mirrorToLocalStorage();
}

export function readBackupFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read backup file'));
    reader.readAsText(file);
  });
}
