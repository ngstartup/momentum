import type { DateStr, Habit } from './types'
import { addDays, eachDay, endOfWeek, maxDate, minDate, startOfWeek } from './dates'
import { type LogIndex, isActiveOn, isDone, isFixedScheduledOn, isQuota, valueOn } from './habits'

/* ------------------------------------------------------------------ */
/* Jour                                                                */
/* ------------------------------------------------------------------ */

export interface DayOccurrence {
  habit: Habit
  value: number
  done: boolean
}

/**
 * Occurrences comptées pour un jour : habitudes à jour imposé + habitudes à quota
 * uniquement si elles ont été réalisées ce jour-là (un quota n'impose aucun jour,
 * ne pas le faire un jour donné n'est pas un échec).
 * Les jours futurs n'ont jamais d'occurrence « manquée » : l'appelant gère `today`.
 */
export function dayOccurrences(habits: Habit[], idx: LogIndex, date: DateStr): DayOccurrence[] {
  const out: DayOccurrence[] = []
  for (const h of habits) {
    const value = valueOn(idx, h.id, date)
    const done = isDone(h, value)
    if (isFixedScheduledOn(h, date)) out.push({ habit: h, value, done })
    else if (isQuota(h) && isActiveOn(h, date) && done) out.push({ habit: h, value, done })
  }
  return out
}

export interface DayScore {
  planned: number
  done: number
  /** pourcentage 0..100, null s'il n'y a rien de prévu */
  rate: number | null
}

export function rateOf(done: number, planned: number): number | null {
  if (planned <= 0) return null
  return Math.min(100, (done / planned) * 100)
}

export function dayScore(habits: Habit[], idx: LogIndex, date: DateStr): DayScore {
  const occ = dayOccurrences(habits, idx, date)
  const done = occ.filter((o) => o.done).length
  return { planned: occ.length, done, rate: rateOf(done, occ.length) }
}

export type DayStatus = 'future' | 'none' | 'success' | 'partial' | 'missed' | 'pending'

export function dayStatus(habits: Habit[], idx: LogIndex, date: DateStr, today: DateStr): DayStatus {
  if (date > today) return 'future'
  const s = dayScore(habits, idx, date)
  if (s.planned === 0) return 'none'
  if (s.done === s.planned) return 'success'
  if (s.done > 0) return 'partial'
  return date === today ? 'pending' : 'missed'
}

/* ------------------------------------------------------------------ */
/* Quotas hebdomadaires                                                */
/* ------------------------------------------------------------------ */

export interface QuotaWeek {
  weekStart: DateStr
  weekEnd: DateStr
  quota: number
  count: number
  /** met : quota atteint · pending : semaine en cours non atteinte · missed : semaine finie non atteinte */
  status: 'met' | 'pending' | 'missed'
}

export function quotaWeeks(habit: Habit, idx: LogIndex, today: DateStr, weekStart: number): QuotaWeek[] {
  if (habit.schedule.kind !== 'weekly_quota') return []
  const perWeek = habit.schedule.timesPerWeek
  const weeks: QuotaWeek[] = []
  const last = startOfWeek(today, weekStart)
  for (let ws = startOfWeek(habit.startDate, weekStart); ws <= last; ws = addDays(ws, 7)) {
    const we = endOfWeek(ws, weekStart)
    const days = eachDay(ws, we).filter((d) => isActiveOn(habit, d))
    if (days.length === 0) continue
    const quota = Math.min(perWeek, days.length)
    const count = days.filter((d) => d <= today && isDone(habit, valueOn(idx, habit.id, d))).length
    const status = count >= quota ? 'met' : we >= today ? 'pending' : 'missed'
    weeks.push({ weekStart: ws, weekEnd: we, quota, count, status })
  }
  return weeks
}

/** Nombre de validations de la semaine contenant `date` (pour l'affichage d'un quota). */
export function quotaProgressForWeek(
  habit: Habit,
  idx: LogIndex,
  date: DateStr,
  weekStart: number,
): { count: number; quota: number } {
  if (habit.schedule.kind !== 'weekly_quota') return { count: 0, quota: 0 }
  const ws = startOfWeek(date, weekStart)
  const count = eachDay(ws, endOfWeek(ws, weekStart)).filter(
    (d) => isActiveOn(habit, d) && isDone(habit, valueOn(idx, habit.id, d)),
  ).length
  return { count, quota: habit.schedule.timesPerWeek }
}

/* ------------------------------------------------------------------ */
/* Statistiques d'une habitude                                         */
/* ------------------------------------------------------------------ */

export interface HabitStats {
  currentStreak: number
  bestStreak: number
  /** unité des séries : jours (habitudes à jours imposés) ou semaines (quota) */
  streakUnit: 'day' | 'week'
  /** nombre de validations enregistrées (jusqu'à aujourd'hui) */
  totalDone: number
  planned: number
  done: number
  rate: number | null
}

function runs(flags: boolean[]): { current: number; best: number } {
  let best = 0
  let run = 0
  for (const f of flags) {
    run = f ? run + 1 : 0
    if (run > best) best = run
  }
  let current = 0
  for (let i = flags.length - 1; i >= 0 && flags[i]; i--) current++
  return { current, best }
}

export function habitStats(habit: Habit, idx: LogIndex, today: DateStr, weekStart: number): HabitStats {
  const logs = idx.get(habit.id)
  let totalDone = 0
  if (logs) for (const [d, l] of logs) if (d <= today && isDone(habit, l.value)) totalDone++

  if (isQuota(habit)) {
    const weeks = quotaWeeks(habit, idx, today, weekStart)
    // une semaine en cours non atteinte n'interrompt pas la série, elle n'est pas encore jouée
    const played = weeks.filter((w) => w.status !== 'pending')
    const r = runs(played.map((w) => w.status === 'met'))
    const planned = played.reduce((a, w) => a + w.quota, 0)
    const done = played.reduce((a, w) => a + Math.min(w.count, w.quota), 0)
    return {
      currentStreak: r.current,
      bestStreak: r.best,
      streakUnit: 'week',
      totalDone,
      planned,
      done,
      rate: rateOf(done, planned),
    }
  }

  const flags: boolean[] = []
  const last = habit.endDate ? minDate(habit.endDate, today) : today
  for (const d of eachDay(habit.startDate, last)) {
    if (!isFixedScheduledOn(habit, d)) continue
    const done = isDone(habit, valueOn(idx, habit.id, d))
    if (d === today && !done) continue // aujourd'hui n'est pas encore perdu
    flags.push(done)
  }
  const r = runs(flags)
  const done = flags.filter(Boolean).length
  return {
    currentStreak: r.current,
    bestStreak: r.best,
    streakUnit: 'day',
    totalDone,
    planned: flags.length,
    done,
    rate: rateOf(done, flags.length),
  }
}

/* ------------------------------------------------------------------ */
/* Score de régularité sur une période                                 */
/* ------------------------------------------------------------------ */

export interface PeriodScore {
  planned: number
  done: number
  rate: number | null
}

/**
 * Taux calculé à partir des occurrences réelles prévues/terminées (jamais une
 * moyenne de moyennes). Les jours > today sont ignorés.
 * Quotas : une semaine est rattachée à la période qui contient son dernier jour
 * (borné à aujourd'hui) ; une semaine en cours non atteinte n'est pas comptée.
 */
export function periodScore(
  habits: Habit[],
  idx: LogIndex,
  from: DateStr,
  to: DateStr,
  today: DateStr,
  weekStart: number,
): PeriodScore {
  const end = minDate(to, today)
  let planned = 0
  let done = 0
  if (from <= end) {
    for (const h of habits) {
      if (isQuota(h)) continue
      for (const d of eachDay(maxDate(from, h.startDate), end)) {
        if (!isFixedScheduledOn(h, d)) continue
        planned++
        if (isDone(h, valueOn(idx, h.id, d))) done++
      }
    }
    for (const h of habits) {
      for (const w of quotaWeeks(h, idx, today, weekStart)) {
        if (w.status === 'pending') continue
        const attach = minDate(w.weekEnd, today)
        if (attach < from || attach > end) continue
        planned += w.quota
        done += Math.min(w.count, w.quota)
      }
    }
  }
  return { planned, done, rate: rateOf(done, planned) }
}

export interface Bucket {
  label: DateStr
  from: DateStr
  to: DateStr
  score: PeriodScore
}

export function dailySeries(habits: Habit[], idx: LogIndex, from: DateStr, to: DateStr, today: DateStr, weekStart: number): Bucket[] {
  return eachDay(from, to).map((d) => ({
    label: d,
    from: d,
    to: d,
    score: d > today ? { planned: 0, done: 0, rate: null } : periodScore(habits, idx, d, d, today, weekStart),
  }))
}

export function weeklySeries(habits: Habit[], idx: LogIndex, from: DateStr, to: DateStr, today: DateStr, weekStart: number): Bucket[] {
  const out: Bucket[] = []
  for (let ws = startOfWeek(from, weekStart); ws <= to; ws = addDays(ws, 7)) {
    const we = endOfWeek(ws, weekStart)
    out.push({ label: ws, from: ws, to: we, score: periodScore(habits, idx, maxDate(ws, from), minDate(we, to), today, weekStart) })
  }
  return out
}

export function monthlySeries(habits: Habit[], idx: LogIndex, from: DateStr, to: DateStr, today: DateStr, weekStart: number): Bucket[] {
  const out: Bucket[] = []
  let ms = from.slice(0, 8) + '01'
  while (ms <= to) {
    const [y, m] = ms.split('-').map(Number)
    const me = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    out.push({ label: ms, from: ms, to: me, score: periodScore(habits, idx, maxDate(ms, from), minDate(me, to), today, weekStart) })
    ms = addDays(me, 1)
  }
  return out
}

/** Total des validations (toutes habitudes passées en paramètre) dans [from, to]. */
export function totalCompletions(habits: Habit[], idx: LogIndex, from: DateStr, to: DateStr): number {
  let n = 0
  for (const h of habits) {
    const m = idx.get(h.id)
    if (!m) continue
    for (const [d, l] of m) if (d >= from && d <= to && isDone(h, l.value)) n++
  }
  return n
}
