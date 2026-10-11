import type { DateStr, DateFormat } from './types'

/**
 * Toute l'arithmétique de dates travaille sur des chaînes YYYY-MM-DD et passe par
 * Date.UTC uniquement comme calendrier abstrait : aucun décalage de fuseau ni
 * de changement d'heure possible.
 */

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayStr(now: Date = new Date()): DateStr {
  return toDateStr(now)
}

export function isValidDateStr(s: unknown): s is DateStr {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

function toUTC(s: DateStr): number {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUTC(ms: number): DateStr {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function addDays(s: DateStr, n: number): DateStr {
  return fromUTC(toUTC(s) + n * 86400000)
}

export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((toUTC(a) - toUTC(b)) / 86400000)
}

/** 0 = dimanche … 6 = samedi */
export function weekdayOf(s: DateStr): number {
  return new Date(toUTC(s)).getUTCDay()
}

export function startOfWeek(s: DateStr, weekStart: number): DateStr {
  const delta = (weekdayOf(s) - weekStart + 7) % 7
  return addDays(s, -delta)
}

export function endOfWeek(s: DateStr, weekStart: number): DateStr {
  return addDays(startOfWeek(s, weekStart), 6)
}

export function startOfMonth(s: DateStr): DateStr {
  return s.slice(0, 8) + '01'
}

export function endOfMonth(s: DateStr): DateStr {
  const [y, m] = s.split('-').map(Number)
  return fromUTC(Date.UTC(y, m, 0))
}

export function addMonths(s: DateStr, n: number): DateStr {
  const [y, m] = s.split('-').map(Number)
  return fromUTC(Date.UTC(y, m - 1 + n, 1))
}

export function eachDay(from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

export function maxDate(a: DateStr, b: DateStr): DateStr {
  return a > b ? a : b
}
export function minDate(a: DateStr, b: DateStr): DateStr {
  return a < b ? a : b
}

export function formatDate(s: DateStr, fmt: DateFormat): string {
  const [y, m, d] = s.split('-')
  if (fmt === 'iso') return s
  if (fmt === 'mdy') return `${m}/${d}/${y}`
  return `${d}/${m}/${y}`
}

export function longDate(s: DateStr, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(toUTC(s)))
}

export function monthLabel(s: DateStr, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(toUTC(s)),
  )
}

export function weekdayShort(day: number, locale: string): string {
  // 2024-01-07 est un dimanche
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, 7 + day)),
  )
}
