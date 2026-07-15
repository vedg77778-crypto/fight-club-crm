import Dexie, { type Table } from 'dexie';

export interface Member {
  id?: number;
  name: string;
  phone: string;
  joinDate: string;
  notes?: string;
  createdAt: string;
}

export interface Subscription {
  id?: number;
  memberId: number;
  planType: 'monthly' | 'sessions';
  startDate: string;
  endDate?: string;
  totalSessions?: number;
  usedSessions?: number;
  amount: number;
  createdAt: string;
}

export interface Attendance {
  id?: number;
  memberId: number;
  date: string;
  classType: 'boxing' | 'kickboxing';
}

export interface Payment {
  id?: number;
  memberId: number;
  subscriptionId?: number;
  amount: number;
  date: string;
  notes?: string;
}

export interface SessionPack {
  id?: number;
  sessionCount: number;
  price: number;
}

const BACKUP_KEY = 'fightClubBackup';

class FightClubDB extends Dexie {
  members!: Table<Member, number>;
  subscriptions!: Table<Subscription, number>;
  attendance!: Table<Attendance, number>;
  payments!: Table<Payment, number>;
  sessionPacks!: Table<SessionPack, number>;

  constructor() {
    super('fightClubDB');

    this.version(1).stores({
      members: '++id, name, phone',
      subscriptions: '++id, memberId, startDate',
      attendance: '++id, memberId, date, [memberId+date]',
      payments: '++id, memberId, subscriptionId, date',
      sessionPacks: '++id',
    });
  }

  async restoreFromBackupIfEmpty(): Promise<void> {
    const counts = await Promise.all([
      this.members.count(),
      this.subscriptions.count(),
      this.attendance.count(),
      this.payments.count(),
      this.sessionPacks.count(),
    ]);

    const allEmpty = counts.every((c) => c === 0);
    if (!allEmpty) return;

    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return;

    try {
      const backup = JSON.parse(raw) as {
        members?: Member[];
        subscriptions?: Subscription[];
        attendance?: Attendance[];
        payments?: Payment[];
        sessionPacks?: SessionPack[];
      };

      await this.transaction(
        'rw',
        [this.members, this.subscriptions, this.attendance, this.payments, this.sessionPacks],
        async () => {
          if (backup.members?.length) await this.members.bulkAdd(backup.members);
          if (backup.subscriptions?.length) await this.subscriptions.bulkAdd(backup.subscriptions);
          if (backup.attendance?.length) await this.attendance.bulkAdd(backup.attendance);
          if (backup.payments?.length) await this.payments.bulkAdd(backup.payments);
          if (backup.sessionPacks?.length) await this.sessionPacks.bulkAdd(backup.sessionPacks);
        },
      );

      console.log('[FightClubDB] Restored data from localStorage backup');
    } catch (err) {
      console.error('[FightClubDB] Failed to restore from localStorage backup:', err);
    }
  }
}

export const db = new FightClubDB();

db.open()
  .then(() => db.restoreFromBackupIfEmpty())
  .catch((err) => console.error('[FightClubDB] Failed to open database:', err));

export async function mirrorToLocalStorage(): Promise<void> {
  const [members, subscriptions, attendance, payments, sessionPacks] = await Promise.all([
    db.members.toArray(),
    db.subscriptions.toArray(),
    db.attendance.toArray(),
    db.payments.toArray(),
    db.sessionPacks.toArray(),
  ]);

  localStorage.setItem(
    BACKUP_KEY,
    JSON.stringify({ members, subscriptions, attendance, payments, sessionPacks }),
  );
}

// ---------------------------------------------------------------------------
// Automatic weekly backup (single rolling snapshot — never grows)
// ---------------------------------------------------------------------------

const WEEKLY_BACKUP_KEY = 'fightClubWeeklyBackup';
const SETTINGS_KEY = 'fightClubSettings';
const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Saves one recoverable snapshot of all data once every 7 days. Only a single
 * copy is kept (it overwrites the previous one), so it never grows over time.
 * Runs silently on app open; safe to call often — it no-ops until 7 days pass.
 */
export async function runWeeklyAutoBackup(): Promise<void> {
  try {
    const raw = localStorage.getItem(WEEKLY_BACKUP_KEY);
    if (raw) {
      const savedAt = new Date(JSON.parse(raw)?.savedAt ?? 0).getTime();
      if (Date.now() - savedAt < WEEKLY_MS) return;
    }

    const [members, subscriptions, attendance, payments, sessionPacks] = await Promise.all([
      db.members.toArray(),
      db.subscriptions.toArray(),
      db.attendance.toArray(),
      db.payments.toArray(),
      db.sessionPacks.toArray(),
    ]);

    if (members.length + subscriptions.length + attendance.length + payments.length === 0) {
      return; // nothing worth backing up yet
    }

    const settings = localStorage.getItem(SETTINGS_KEY);
    const snapshot = {
      savedAt: new Date().toISOString(),
      data: {
        members,
        subscriptions,
        attendance,
        payments,
        sessionPacks,
        settings: settings ? JSON.parse(settings) : null,
      },
    };

    localStorage.setItem(WEEKLY_BACKUP_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.error('[FightClubDB] weekly auto-backup failed:', err);
  }
}

export function getWeeklyBackupDate(): string | null {
  try {
    const raw = localStorage.getItem(WEEKLY_BACKUP_KEY);
    return raw ? (JSON.parse(raw)?.savedAt ?? null) : null;
  } catch {
    return null;
  }
}

export function getWeeklyBackupJSON(): string | null {
  try {
    const raw = localStorage.getItem(WEEKLY_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data ? JSON.stringify(parsed.data) : null;
  } catch {
    return null;
  }
}
