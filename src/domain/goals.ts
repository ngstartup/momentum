import type { Challenge, DateStr, Goal, Habit } from './types'
import type { LogIndex } from './habits'
import { periodScore, totalCompletions } from './stats'

export interface Progress {
  /** 0..1 plafonné, null si non calculable (ex. aucune occurrence prévue) */
  ratio: number | null
  current: number
  target: number | null
}

/**
 * Règles explicites (jamais « habitude faite = objectif atteint ») :
 * - manual : valeur saisie / cible ;
 * - completions : validations des habitudes liées depuis la création / cible ;
 * - rate : taux de réussite des habitudes liées depuis la création (plus c'est stable, plus c'est fiable).
 */
export function goalProgress(goal: Goal, habits: Habit[], idx: LogIndex, today: DateStr, weekStart: number): Progress {
  const linked = habits.filter((h) => goal.habitIds.includes(h.id))
  const r = goal.rule
  if (r.kind === 'manual') return { ratio: r.target > 0 ? Math.min(1, r.current / r.target) : null, current: r.current, target: r.target }
  if (r.kind === 'completions') {
    const n = totalCompletions(linked, idx, goal.createdDate, today)
    return { ratio: r.target > 0 ? Math.min(1, n / r.target) : null, current: n, target: r.target }
  }
  const s = periodScore(linked, idx, goal.createdDate, today, today, weekStart)
  return { ratio: s.rate === null ? null : s.rate / 100, current: s.done, target: s.planned }
}

export function challengeProgress(c: Challenge, habits: Habit[], idx: LogIndex, today: DateStr): Progress & { over: boolean } {
  const pool = c.habitId ? habits.filter((h) => h.id === c.habitId) : habits
  const n = totalCompletions(pool, idx, c.startDate, c.endDate < today ? c.endDate : today)
  return { ratio: c.target > 0 ? Math.min(1, n / c.target) : null, current: n, target: c.target, over: c.endDate < today }
}
