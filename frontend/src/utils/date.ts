import type { EnrichedPantryItem, PantryItem, PantryStatus } from '../types/pantry';

export function formatDateBR(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function addDaysToToday(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return formatDateBR(date);
}

/**
 * RNF02: Aceita DD/MM/AAAA, DD/MM/AA, MM/AAAA, MM/AA e ISO YYYY-MM-DD.
 */
export function normalizeBrazilianDate(raw: string): string | null {
  const cleaned = raw.trim().replace(/[-.]/g, '/');

  const isoMatch = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(cleaned);
  if (isoMatch) {
    return validateDate(Number(isoMatch[3]), Number(isoMatch[2]), Number(isoMatch[1]));
  }

  const fullMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(cleaned);
  if (fullMatch) {
    const rawYear = Number(fullMatch[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return validateDate(Number(fullMatch[1]), Number(fullMatch[2]), year);
  }

  const monthYearMatch = /^(\d{1,2})\/(\d{2,4})$/.exec(cleaned);
  if (monthYearMatch) {
    const month = Number(monthYearMatch[1]);
    const rawYear = Number(monthYearMatch[2]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    if (month < 1 || month > 12) return null;
    const lastDay = new Date(year, month, 0).getDate();
    return validateDate(lastDay, month, year);
  }

  return null;
}

function validateDate(day: number, month: number, year: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) {
    return null;
  }
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return formatDateBR(d);
}

export function calculateDaysRemaining(dateStr: string): number {
  const normalized = normalizeBrazilianDate(dateStr);
  if (!normalized) return 0;
  const [dd, mm, yyyy] = normalized.split('/').map(Number);
  const expDate = new Date(yyyy, mm - 1, dd);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expDate.setHours(0, 0, 0, 0);
  const diffMs = expDate.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function shiftDateString(dateStr: string, deltaDays: number): string {
  const normalized = normalizeBrazilianDate(dateStr);
  if (!normalized) return dateStr;
  const [dd, mm, yyyy] = normalized.split('/').map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  d.setDate(d.getDate() + deltaDays);
  return formatDateBR(d);
}

export function enrichPantryItem(item: PantryItem): EnrichedPantryItem {
  const diasRestantes = calculateDaysRemaining(item.data_validade);
  let computedStatus: PantryStatus = item.status;
  if (item.status === 'Em estoque' && diasRestantes < 0) {
    computedStatus = 'Vencido';
  }
  return {
    ...item,
    diasRestantes,
    computedStatus,
  };
}
