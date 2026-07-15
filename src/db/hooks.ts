import { useState, useEffect, useCallback } from 'react';
import { liveQuery } from 'dexie';
import { addDays, format } from 'date-fns';
import {
  db,
  mirrorToLocalStorage,
  type Member,
  type Subscription,
  type Attendance,
  type Payment,
  type SessionPack,
} from './database';

// ---------------------------------------------------------------------------
// Custom useLiveQuery (avoids dexie-react-hooks dependency)
// ---------------------------------------------------------------------------

function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  deps: unknown[] = [],
  defaultValue?: T,
): T | undefined {
  const [result, setResult] = useState<T | undefined>(defaultValue);

  useEffect(() => {
    const observable = liveQuery(querier);
    const subscription = observable.subscribe({
      next: (val) => setResult(val),
      error: (err) => console.error('[useLiveQuery]', err),
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return result;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'fightClubSettings';

export interface AppSettings {
  upiId: string;
  coachPhone: string;
  monthlyFee: number;
  classDays: Array<{ day: string; type: 'boxing' | 'kickboxing' }>;
  lastBackupDate?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  upiId: '',
  coachPhone: '',
  monthlyFee: 4500,
  classDays: [
    { day: 'tuesday', type: 'boxing' },
    { day: 'thursday', type: 'kickboxing' },
    { day: 'saturday', type: 'kickboxing' },
  ],
};

function loadSettings(): AppSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveAppSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function useAppSettings(): [AppSettings, (s: AppSettings) => void] {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const save = useCallback((updated: AppSettings) => {
    saveAppSettings(updated);
    setSettings(updated);
  }, []);

  return [settings, save];
}

// ---------------------------------------------------------------------------
// Subscription status helper
// ---------------------------------------------------------------------------

export interface SubscriptionWithStatus extends Subscription {
  status: 'active' | 'expired';
}

function computeStatus(sub: Subscription): SubscriptionWithStatus {
  const today = format(new Date(), 'yyyy-MM-dd');
  let status: 'active' | 'expired';

  if (sub.planType === 'monthly') {
    status = sub.endDate && today <= sub.endDate ? 'active' : 'expired';
  } else {
    status =
      sub.usedSessions !== undefined &&
      sub.totalSessions !== undefined &&
      sub.usedSessions < sub.totalSessions
        ? 'active'
        : 'expired';
  }

  return { ...sub, status };
}

// ---------------------------------------------------------------------------
// Read hooks
// ---------------------------------------------------------------------------

export function useMembers(): Member[] | undefined {
  return useLiveQuery(() => db.members.toArray(), []);
}

export function useMember(id: number | undefined): Member | undefined {
  return useLiveQuery(() => (id !== undefined ? db.members.get(id) : undefined), [id]);
}

export function useSubscriptions(memberId?: number): SubscriptionWithStatus[] | undefined {
  return useLiveQuery(
    async () => {
      const subs = memberId !== undefined
        ? await db.subscriptions.where('memberId').equals(memberId).toArray()
        : await db.subscriptions.toArray();
      return subs.map(computeStatus);
    },
    [memberId],
  );
}

export function useActiveSubscription(
  memberId: number | undefined,
): SubscriptionWithStatus | undefined {
  return useLiveQuery(
    async () => {
      if (memberId === undefined) return undefined;
      const subs = await db.subscriptions
        .where('memberId')
        .equals(memberId)
        .reverse()
        .sortBy('startDate');
      const withStatus = subs.map(computeStatus);
      return withStatus.find((s) => s.status === 'active');
    },
    [memberId],
  );
}

export function useAttendance(memberId?: number, date?: string): Attendance[] | undefined {
  return useLiveQuery(
    async () => {
      let collection = db.attendance.toCollection();
      if (memberId !== undefined && date !== undefined) {
        return db.attendance.where({ memberId, date }).toArray();
      }
      if (memberId !== undefined) {
        collection = db.attendance.where('memberId').equals(memberId);
      }
      if (date !== undefined) {
        collection = db.attendance.where('date').equals(date);
      }
      return collection.toArray();
    },
    [memberId, date],
  );
}

export function useAttendanceByDate(date: string): Attendance[] | undefined {
  return useLiveQuery(() => db.attendance.where('date').equals(date).toArray(), [date]);
}

export function usePayments(memberId?: number): Payment[] | undefined {
  return useLiveQuery(
    async () =>
      memberId !== undefined
        ? db.payments.where('memberId').equals(memberId).toArray()
        : db.payments.toArray(),
    [memberId],
  );
}

export function useSessionPacks(): SessionPack[] | undefined {
  return useLiveQuery(() => db.sessionPacks.toArray(), []);
}

// ---------------------------------------------------------------------------
// Write actions
// ---------------------------------------------------------------------------

export async function addMember(
  data: Omit<Member, 'id' | 'createdAt'>,
): Promise<number> {
  const id = await db.members.add({
    ...data,
    createdAt: new Date().toISOString(),
  });
  await mirrorToLocalStorage();
  return id;
}

export async function updateMember(
  id: number,
  data: Partial<Omit<Member, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.members.update(id, data);
  await mirrorToLocalStorage();
}

export async function deleteMember(id: number): Promise<void> {
  await db.transaction(
    'rw',
    [db.members, db.subscriptions, db.attendance, db.payments],
    async () => {
      await db.attendance.where('memberId').equals(id).delete();
      await db.payments.where('memberId').equals(id).delete();
      await db.subscriptions.where('memberId').equals(id).delete();
      await db.members.delete(id);
    },
  );
  await mirrorToLocalStorage();
}

export async function addSubscription(
  data: Omit<Subscription, 'id' | 'createdAt'>,
): Promise<number> {
  const record: Omit<Subscription, 'id'> = {
    ...data,
    createdAt: new Date().toISOString(),
  };

  if (data.planType === 'monthly' && !data.endDate) {
    record.endDate = format(addDays(new Date(data.startDate), 30), 'yyyy-MM-dd');
  }

  if (data.planType === 'sessions' && data.usedSessions === undefined) {
    record.usedSessions = 0;
  }

  const id = await db.subscriptions.add(record as Subscription);
  await mirrorToLocalStorage();
  return id;
}

export async function addAttendance(
  memberId: number,
  date: string,
  classType: 'boxing' | 'kickboxing',
): Promise<number> {
  const id = await db.attendance.add({ memberId, date, classType });

  const activeSub = await findActiveSessionsSub(memberId);

  if (activeSub?.id !== undefined) {
    await db.subscriptions.update(activeSub.id, {
      usedSessions: (activeSub.usedSessions ?? 0) + 1,
    });
  }

  await mirrorToLocalStorage();
  return id;
}

export async function removeAttendance(memberId: number, date: string): Promise<void> {
  const record = await db.attendance.where({ memberId, date }).first();
  if (!record?.id) return;

  await db.attendance.delete(record.id);

  const matches = await db.subscriptions
    .where('memberId')
    .equals(memberId)
    .filter((s) => s.planType === 'sessions' && (s.usedSessions ?? 0) > 0)
    .toArray();

  const activeSub = matches.sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

  if (activeSub?.id !== undefined) {
    await db.subscriptions.update(activeSub.id, {
      usedSessions: Math.max((activeSub.usedSessions ?? 0) - 1, 0),
    });
  }

  await mirrorToLocalStorage();
}

export async function updateSubscription(
  id: number,
  data: Partial<Omit<Subscription, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.subscriptions.update(id, data);
  await mirrorToLocalStorage();
}

/** End any currently-active plans for a member before renewing. */
export async function expireActiveSubscriptions(
  memberId: number,
  asOfDate?: string,
): Promise<void> {
  const today = asOfDate ?? format(new Date(), 'yyyy-MM-dd');
  const dayBefore = format(addDays(new Date(today), -1), 'yyyy-MM-dd');
  const subs = await db.subscriptions.where('memberId').equals(memberId).toArray();

  for (const sub of subs) {
    if (sub.id === undefined) continue;
    const withStatus = computeStatus(sub);
    if (withStatus.status !== 'active') continue;

    if (sub.planType === 'monthly') {
      await db.subscriptions.update(sub.id, { endDate: dayBefore });
    } else {
      await db.subscriptions.update(sub.id, {
        usedSessions: sub.totalSessions ?? sub.usedSessions ?? 0,
      });
    }
  }

  await mirrorToLocalStorage();
}

/**
 * Mark paid → continue one monthly period.
 * If current monthly endDate is still ahead, next month starts the day after.
 * Otherwise starts today. Records payment and clears home alerts.
 */
export async function markPaidRenewMonthly(
  memberId: number,
  amount: number,
  currentEndDate?: string | null,
): Promise<number> {
  const today = format(new Date(), 'yyyy-MM-dd');
  let startDate = today;

  if (currentEndDate && currentEndDate >= today) {
    startDate = format(addDays(new Date(currentEndDate + 'T00:00:00'), 1), 'yyyy-MM-dd');
  }

  await expireActiveSubscriptions(memberId, startDate);

  const endDate = format(addDays(new Date(startDate + 'T00:00:00'), 30), 'yyyy-MM-dd');
  const subId = await addSubscription({
    memberId,
    planType: 'monthly',
    startDate,
    endDate,
    amount,
  });

  await addPayment({
    memberId,
    subscriptionId: subId,
    amount,
    date: today,
    notes: 'Monthly renewal — marked paid',
  });

  return subId;
}

async function findActiveSessionsSub(memberId: number): Promise<Subscription | undefined> {
  const matches = await db.subscriptions
    .where('memberId')
    .equals(memberId)
    .filter(
      (s) =>
        s.planType === 'sessions' &&
        s.usedSessions !== undefined &&
        s.totalSessions !== undefined &&
        s.usedSessions < s.totalSessions,
    )
    .toArray();

  if (matches.length === 0) return undefined;
  return matches.sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

export async function addPayment(data: Omit<Payment, 'id'>): Promise<number> {
  const id = await db.payments.add(data);
  await mirrorToLocalStorage();
  return id;
}

export async function addSessionPack(data: Omit<SessionPack, 'id'>): Promise<number> {
  const id = await db.sessionPacks.add(data);
  await mirrorToLocalStorage();
  return id;
}

export async function updateSessionPack(
  id: number,
  data: Partial<Omit<SessionPack, 'id'>>,
): Promise<void> {
  await db.sessionPacks.update(id, data);
  await mirrorToLocalStorage();
}

export async function deleteSessionPack(id: number): Promise<void> {
  await db.sessionPacks.delete(id);
  await mirrorToLocalStorage();
}

// ---------------------------------------------------------------------------
// Bulk export / import
// ---------------------------------------------------------------------------

export async function exportAllData(): Promise<void> {
  const [members, subscriptions, attendance, payments, sessionPacks] = await Promise.all([
    db.members.toArray(),
    db.subscriptions.toArray(),
    db.attendance.toArray(),
    db.payments.toArray(),
    db.sessionPacks.toArray(),
  ]);

  const settings = localStorage.getItem(SETTINGS_KEY);

  const payload = {
    members,
    subscriptions,
    attendance,
    payments,
    sessionPacks,
    settings: settings ? JSON.parse(settings) : null,
    exportedAt: new Date().toISOString(),
  };

  const json = JSON.stringify(payload, null, 2);
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
}

export async function importAllData(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString) as {
    members?: Member[];
    subscriptions?: Subscription[];
    attendance?: Attendance[];
    payments?: Payment[];
    sessionPacks?: SessionPack[];
    settings?: AppSettings | null;
  };

  await db.transaction(
    'rw',
    [db.members, db.subscriptions, db.attendance, db.payments, db.sessionPacks],
    async () => {
      await db.members.clear();
      await db.subscriptions.clear();
      await db.attendance.clear();
      await db.payments.clear();
      await db.sessionPacks.clear();

      if (data.members?.length) await db.members.bulkAdd(data.members);
      if (data.subscriptions?.length) await db.subscriptions.bulkAdd(data.subscriptions);
      if (data.attendance?.length) await db.attendance.bulkAdd(data.attendance);
      if (data.payments?.length) await db.payments.bulkAdd(data.payments);
      if (data.sessionPacks?.length) await db.sessionPacks.bulkAdd(data.sessionPacks);
    },
  );

  if (data.settings) {
    saveAppSettings(data.settings);
  }

  await mirrorToLocalStorage();
}
