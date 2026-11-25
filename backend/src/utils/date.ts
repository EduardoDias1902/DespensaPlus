/**
 * Utilitários de data no padrão brasileiro (DD/MM/YYYY e MM/YYYY)
 * Atende ao RNF02 (tolerância a formatos carimbados em embalagens no Brasil).
 */

export function formatDateBR(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatTimeNow(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function formatTimeWithSeconds(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(
    now.getSeconds()
  ).padStart(2, '0')}`;
}

export function addDaysToToday(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return formatDateBR(date);
}

/**
 * Normaliza entradas no formato DD/MM/AAAA, DD/MM/AA, MM/AAAA, MM/AA ou YYYY-MM-DD
 * para o padrão canônico DD/MM/AAAA. Quando apenas MM/AAAA é informado (carimbo comum
 * em suplementos e secos), assume o último dia daquele mês.
 */
export function normalizeBrazilianDate(raw: string): string | null {
  const cleaned = raw.trim().replace(/[-.]/g, '/');

  // Formato ISO YYYY/MM/DD
  const isoMatch = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(cleaned);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return validateAndFormat(day, month, year);
  }

  // Formato DD/MM/AAAA ou DD/MM/AA
  const fullMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(cleaned);
  if (fullMatch) {
    const day = Number(fullMatch[1]);
    const month = Number(fullMatch[2]);
    const rawYear = Number(fullMatch[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return validateAndFormat(day, month, year);
  }

  // Formato MM/AAAA ou MM/AA (último dia do mês)
  const monthYearMatch = /^(\d{1,2})\/(\d{2,4})$/.exec(cleaned);
  if (monthYearMatch) {
    const month = Number(monthYearMatch[1]);
    const rawYear = Number(monthYearMatch[2]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    if (month < 1 || month > 12) return null;
    const lastDay = new Date(year, month, 0).getDate();
    return validateAndFormat(lastDay, month, year);
  }

  return null;
}

function validateAndFormat(day: number, month: number, year: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) {
    return null;
  }
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }
  return formatDateBR(candidate);
}

export function brDateToIso(dateStr: string): string {
  const normalized = normalizeBrazilianDate(dateStr);
  if (!normalized) {
    throw new Error(`Data inválida: "${dateStr}". Use DD/MM/AAAA ou MM/AAAA.`);
  }
  const [dd, mm, yyyy] = normalized.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

export function isoDateToBr(isoStr: string): string {
  if (!isoStr) return addDaysToToday(0);
  const datePart = isoStr.slice(0, 10);
  const normalized = normalizeBrazilianDate(datePart);
  return normalized ?? addDaysToToday(0);
}

export function calculateDaysRemaining(dateStr: string, referenceDate?: Date): number {
  const normalized = normalizeBrazilianDate(dateStr);
  if (!normalized) return 0;
  const [dd, mm, yyyy] = normalized.split('/').map(Number);
  const expDate = new Date(yyyy, mm - 1, dd);
  const today = referenceDate ? new Date(referenceDate) : new Date();
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
