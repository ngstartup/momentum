import { describe, expect, it } from 'vitest'
import type { Habit, HabitLog, HabitSchedule } from './types'
import { buildLogIndex, isDone, logId } from './habits'
import { addDays, startOfWeek, weekdayOf, isValidDateStr, endOfMonth, diffDays } from './dates'
import { dayScore, dayStatus, habitStats, periodScore, quotaWeeks } from './stats'

const TODAY = '2026-10-14' // mercredi

function mk(over: Partial<Habit> & { schedule?: HabitSchedule } = {}): Habit {
  return {
    id: 'h1', name: 'H', icon: 'book', color: '#fff', categoryId: null, createdAt: 0,
    startDate: '2026-10-01', endDate: null, schedule: { kind: 'daily' }, tracking: 'binary',
    archived: false, pauses: [], order: 0, ...over,
  }
}
function logs(h: Habit, dates: string[], value = 1): HabitLog[] {
  return dates.map((date) => ({ id: logId(h.id, date), habitId: h.id, date, value, updatedAt: 0 }))
}

describe('dates', () => {
  it('arithmétique sans décalage', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30') // changement d'heure EU
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(diffDays('2026-03-30', '2026-03-28')).toBe(2)
    expect(weekdayOf(TODAY)).toBe(3)
    expect(startOfWeek(TODAY, 1)).toBe('2026-10-12')
    expect(startOfWeek(TODAY, 0)).toBe('2026-10-11')
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29')
    expect(isValidDateStr('2026-02-30')).toBe(false)
  })
})

describe('isDone', () => {
  it('quantitatif : atteint à partir de la cible', () => {
    const h = mk({ tracking: 'quantity', target: 10 })
    expect(isDone(h, 9)).toBe(false)
    expect(isDone(h, 10)).toBe(true)
  })
})

describe('habitude quotidienne', () => {
  const h = mk()
  it('série actuelle, meilleure série et taux', () => {
    // 1-5 faits, 6 manqué, 7-14 faits sauf 10
    const done = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
      '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14']
    const s = habitStats(h, buildLogIndex(logs(h, done)), TODAY, 1)
    expect(s.bestStreak).toBe(5)
    expect(s.currentStreak).toBe(4)
    expect(s.planned).toBe(14)
    expect(s.done).toBe(12)
    expect(s.rate).toBeCloseTo(85.71, 1)
  })
  it("aujourd'hui non fait ne casse pas la série", () => {
    const s = habitStats(h, buildLogIndex(logs(h, ['2026-10-12', '2026-10-13'])), TODAY, 1)
    expect(s.currentStreak).toBe(2) // 12 et 13 faits, aujourd'hui en attente
    const full = logs(h, Array.from({ length: 13 }, (_, i) => addDays('2026-10-01', i)))
    expect(habitStats(h, buildLogIndex(full), TODAY, 1).currentStreak).toBe(13)
  })
  it('jour manqué passé interrompt la série', () => {
    const s = habitStats(h, buildLogIndex(logs(h, ['2026-10-12', '2026-10-14'])), TODAY, 1)
    expect(s.currentStreak).toBe(1)
  })
  it('modification rétroactive recalcule', () => {
    const base = ['2026-10-11', '2026-10-13', '2026-10-14']
    expect(habitStats(h, buildLogIndex(logs(h, base)), TODAY, 1).currentStreak).toBe(2)
    expect(habitStats(h, buildLogIndex(logs(h, [...base, '2026-10-12'])), TODAY, 1).currentStreak).toBe(4)
  })
})

describe('jours spécifiques', () => {
  const h = mk({ schedule: { kind: 'weekdays', weekdays: [1, 3] } }) // lun, mer
  it('seuls les jours concernés comptent', () => {
    const idx = buildLogIndex(logs(h, ['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14']))
    const s = habitStats(h, idx, TODAY, 1)
    expect(s.planned).toBe(4) // 5, 7, 12, 14 ; le 1er oct (jeudi) hors planning
    expect(s.currentStreak).toBe(4)
    expect(dayStatus([h], idx, '2026-10-13', TODAY)).toBe('none')
  })
  it('un jour non programmé n’est pas un échec', () => {
    const idx = buildLogIndex([])
    expect(dayScore([h], idx, '2026-10-13').rate).toBeNull()
  })
})

describe('quota hebdomadaire', () => {
  const h = mk({ schedule: { kind: 'weekly_quota', timesPerWeek: 3 } })
  it('semaines atteintes / manquées / en cours', () => {
    const idx = buildLogIndex(logs(h, ['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-13']))
    const w = quotaWeeks(h, idx, TODAY, 1)
    expect(w.map((x) => x.status)).toEqual(['missed', 'met', 'pending'])
    // semaine du 28/09 : démarrée le 01/10 (4 jours actifs, quota 3), 0 fait → manquée
    const s = habitStats(h, idx, TODAY, 1)
    expect(s.streakUnit).toBe('week')
    expect(s.currentStreak).toBe(1)
    expect(s.bestStreak).toBe(1)
    expect(s.planned).toBe(6)
    expect(s.done).toBe(3)
  })
  it('semaine en cours atteinte compte dans la série', () => {
    const idx = buildLogIndex(logs(h, ['2026-10-12', '2026-10-13', '2026-10-14']))
    expect(quotaWeeks(h, idx, TODAY, 1).at(-1)?.status).toBe('met')
  })
  it('un quota fait ce jour est compté dans le score du jour', () => {
    const idx = buildLogIndex(logs(h, ['2026-10-13']))
    expect(dayScore([h], idx, '2026-10-13')).toMatchObject({ planned: 1, done: 1, rate: 100 })
    expect(dayScore([h], idx, '2026-10-12').rate).toBeNull()
  })
})

describe('score de période', () => {
  it('taux agrégé sur occurrences réelles, jamais > 100, futur ignoré', () => {
    const a = mk({ id: 'a' })
    const b = mk({ id: 'b', startDate: '2026-10-10' })
    const idx = buildLogIndex([...logs(a, ['2026-10-13', '2026-10-14']), ...logs(b, ['2026-10-14'])])
    const p = periodScore([a, b], idx, '2026-10-13', '2026-12-31', TODAY, 1)
    expect(p.planned).toBe(4)
    expect(p.done).toBe(3)
    expect(p.rate).toBe(75)
  })
  it('période sans prévu → null (pas de division par zéro)', () => {
    expect(periodScore([mk()], buildLogIndex([]), '2026-11-01', '2026-11-30', TODAY, 1).rate).toBeNull()
    expect(periodScore([], buildLogIndex([]), '2026-10-01', '2026-10-14', TODAY, 1).rate).toBeNull()
  })
  it('exemple 5/7 = 71,4 %', () => {
    const h = mk({ startDate: '2026-10-08' })
    const idx = buildLogIndex(logs(h, ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12']))
    const p = periodScore([h], idx, '2026-10-08', '2026-10-14', TODAY, 1)
    expect(p.rate).toBeCloseTo(71.43, 1)
  })
  it('jours futurs jamais en échec', () => {
    expect(dayStatus([mk()], buildLogIndex([]), '2026-10-20', TODAY)).toBe('future')
  })
  it('pause (archivage) retire les jours concernés', () => {
    const h = mk({ pauses: [{ from: '2026-10-05', to: '2026-10-10' }] })
    const p = periodScore([h], buildLogIndex([]), '2026-10-01', '2026-10-14', TODAY, 1)
    expect(p.planned).toBe(14 - 6)
  })
})
