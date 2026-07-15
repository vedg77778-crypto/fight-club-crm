import { format, parseISO, differenceInDays, addDays, getDay } from 'date-fns';

interface ClassDay {
  day: string;
  type: 'boxing' | 'kickboxing';
}

const DAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function getTodayClassType(classDays: ClassDay[]): 'boxing' | 'kickboxing' | null {
  return getClassTypeForDate(new Date(), classDays);
}

export function getClassTypeForDate(
  date: Date | string,
  classDays: ClassDay[],
): 'boxing' | 'kickboxing' | null {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const dayIndex = getDay(d);
  const match = classDays.find((cd) => DAY_NAME_TO_INDEX[cd.day.toLowerCase()] === dayIndex);
  return match?.type ?? null;
}

export function isClassDay(date: Date | string, classDays: ClassDay[]): boolean {
  return getClassTypeForDate(date, classDays) !== null;
}

export function getNextClassDate(classDays: ClassDay[]): Date {
  let candidate = addDays(new Date(), 1);
  for (let i = 0; i < 7; i++) {
    if (isClassDay(candidate, classDays)) return candidate;
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'd MMM yyyy');
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yy');
}

export function daysRemaining(endDate: string): number {
  return differenceInDays(parseISO(endDate), new Date());
}
