import type { DateStr, FocusSession, DailyJournal, Habit } from './types'
import { type LogIndex, isDone } from './habits'
import { dayOccurrences, habitStats } from './stats'
import { eachDay, maxDate } from './dates'

export const POINTS_PER_COMPLETION = 10

export interface BadgeDef { id: string; label: string; desc: string }
export const BADGES: BadgeDef[] = [
  { id: 'first', label: 'Premier pas', desc: 'Valider une habitude pour la première fois.' },
  { id: 'streak7', label: 'Une semaine', desc: 'Série de 7 jours ou semaines sur une habitude.' },
  { id: 'streak30', label: 'Un mois constant', desc: 'Série de 30 sur une habitude.' },
  { id: 'streak100', label: 'Centurion', desc: 'Série de 100 sur une habitude.' },
  { id: 'perfect', label: 'Journée complète', desc: 'Terminer toutes les occurrences prévues d’un jour (au moins 3).' },
  { id: 'done100', label: '100 validations', desc: 'Cumuler 100 validations.' },
  { id: 'done500', label: '500 validations', desc: 'Cumuler 500 validations.' },
  { id: 'focus10', label: '10 h de concentration', desc: 'Cumuler 10 heures de sessions de concentration.' },
  { id: 'journal7', label: 'Plume régulière', desc: 'Écrire 7 entrées de journal.' },
]

export interface GameState {
  points: number
  level: number
  levelFloor: number
  nextAt: number
  earned: string[]
  records: { bestStreak: { name: string; n: number; unit: 'day' | 'week' } | null; bestDay: { date: DateStr; n: number } | null; longestFocus: number }
  totalDone: number
}

/** Niveau n atteint à 50·(n-1)² points : progression douce, tout vient de validations réelles. */
export function levelFor(points: number) {
  const level = Math.floor(Math.sqrt(points / 50)) + 1
  return { level, floor: 50 * (level - 1) ** 2, next: 50 * level ** 2 }
}

export function computeGame(habits: Habit[], idx: LogIndex, focus: FocusSession[], journal: DailyJournal[], today: DateStr, weekStart: number): GameState {
  let totalDone = 0
  const perDay = new Map<DateStr, number>()
  for (const h of habits) {
    const m = idx.get(h.id)
    if (!m) continue
    for (const [d, l] of m) if (d <= today && isDone(h, l.value)) { totalDone++; perDay.set(d, (perDay.get(d) ?? 0) + 1) }
  }
  let bestStreak: GameState['records']['bestStreak'] = null
  for (const h of habits) {
    const s = habitStats(h, idx, today, weekStart)
    if (s.bestStreak > 0 && (!bestStreak || s.bestStreak > bestStreak.n)) bestStreak = { name: h.name, n: s.bestStreak, unit: s.streakUnit }
  }
  let bestDay: GameState['records']['bestDay'] = null
  for (const [date, n] of perDay) if (!bestDay || n > bestDay.n) bestDay = { date, n }

  const first = habits.reduce((m, h) => { const ds = [...(idx.get(h.id)?.keys() ?? [])]; return ds.length ? (m ? (ds.sort()[0] < m ? ds[0] : m) : ds[0]) : m }, '' as string)
  let perfect = false
  if (first) {
    for (const d of eachDay(maxDate(first, '1970-01-01'), today)) {
      const occ = dayOccurrences(habits, idx, d)
      if (occ.length >= 3 && occ.every((o) => o.done) && d <= today) { perfect = true; break }
    }
  }
  const focusSec = focus.reduce((a, f) => a + f.seconds, 0)
  const earned: string[] = []
  if (totalDone >= 1) earned.push('first')
  const bs = bestStreak?.n ?? 0
  if (bs >= 7) earned.push('streak7')
  if (bs >= 30) earned.push('streak30')
  if (bs >= 100) earned.push('streak100')
  if (perfect) earned.push('perfect')
  if (totalDone >= 100) earned.push('done100')
  if (totalDone >= 500) earned.push('done500')
  if (focusSec >= 36000) earned.push('focus10')
  if (journal.filter((j) => j.note || j.win || j.difficulty || j.tomorrow || j.mood || j.energy).length >= 7) earned.push('journal7')

  const points = totalDone * POINTS_PER_COMPLETION
  const lv = levelFor(points)
  return { points, level: lv.level, levelFloor: lv.floor, nextAt: lv.next, earned, records: { bestStreak, bestDay, longestFocus: focus.reduce((m, f) => Math.max(m, f.seconds), 0) }, totalDone }
}
