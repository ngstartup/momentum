import type { DateStr, Habit, HabitLog, HabitSchedule } from './types'
import { weekdayOf } from './dates'

export type LogIndex = Map<string, Map<DateStr, HabitLog>>

export function buildLogIndex(logs: HabitLog[]): LogIndex {
  const idx: LogIndex = new Map()
  for (const l of logs) {
    let m = idx.get(l.habitId)
    if (!m) idx.set(l.habitId, (m = new Map()))
    m.set(l.date, l)
  }
  return idx
}

export const logId = (habitId: string, date: DateStr) => `${habitId}_${date}`

export function valueOn(idx: LogIndex, habitId: string, date: DateStr): number {
  return idx.get(habitId)?.get(date)?.value ?? 0
}

/**
 * Règle d'atteinte : binaire → valeur ≥ 1 ; quantitatif / durée → valeur ≥ objectif
 * (si l'objectif est absent ou nul, toute valeur > 0 compte).
 */
export function isDone(habit: Habit, value: number): boolean {
  if (habit.tracking === 'binary') return value >= 1
  const t = habit.target ?? 0
  return t > 0 ? value >= t : value > 0
}

/** Ratio de progression 0..1 (plafonné) pour l'affichage. */
export function progressRatio(habit: Habit, value: number): number {
  if (habit.tracking === 'binary') return value >= 1 ? 1 : 0
  const t = habit.target ?? 0
  if (t <= 0) return value > 0 ? 1 : 0
  return Math.min(1, value / t)
}

export function isPausedOn(habit: Habit, d: DateStr): boolean {
  return habit.pauses.some((p) => d >= p.from && (p.to === null || d <= p.to))
}

/** L'habitude « existe » ce jour-là (dans sa période de vie, hors pauses/archivage). */
export function isActiveOn(habit: Habit, d: DateStr): boolean {
  if (d < habit.startDate) return false
  if (habit.endDate && d > habit.endDate) return false
  return !isPausedOn(habit, d)
}

export function isQuota(habit: Habit): boolean {
  return habit.schedule.kind === 'weekly_quota'
}

/** Jour imposé par le calendrier de l'habitude (les quotas n'imposent aucun jour). */
export function isFixedScheduledOn(habit: Habit, d: DateStr): boolean {
  if (!isActiveOn(habit, d)) return false
  const s = habit.schedule
  switch (s.kind) {
    case 'daily':
      return true
    case 'weekdays':
      return s.weekdays.includes(weekdayOf(d))
    case 'dates':
      return s.dates.includes(d)
    case 'weekly_quota':
      return false
  }
}

export function validateSchedule(s: HabitSchedule): string | null {
  if (s.kind === 'weekdays' && (s.weekdays.length === 0 || s.weekdays.some((n) => n < 0 || n > 6)))
    return 'schedule.weekdays'
  if (s.kind === 'weekly_quota' && (!Number.isInteger(s.timesPerWeek) || s.timesPerWeek < 1 || s.timesPerWeek > 7))
    return 'schedule.quota'
  if (s.kind === 'dates' && s.dates.length === 0) return 'schedule.dates'
  return null
}
