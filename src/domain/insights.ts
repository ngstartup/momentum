import type { DateStr, Habit } from './types'
import { addDays, weekdayOf } from './dates'
import type { LogIndex } from './habits'
import { dayOccurrences, habitStats, periodScore } from './stats'

export interface Insight {
  /** phrase française (clé i18n) avec {param} */
  text: string
  params: Record<string, string | number>
}

const MIN_OCC = 5 // en dessous, trop peu de données pour conclure

/**
 * Observations descriptives calculées uniquement à partir des occurrences réelles.
 * Aucune causalité n'est affirmée ; chaque phrase précise la période analysée.
 */
export function buildInsights(habits: Habit[], idx: LogIndex, today: DateStr, weekStart: number, locale = 'fr-FR'): Insight[] {
  const out: Insight[] = []
  const w1 = periodScore(habits, idx, addDays(today, -6), today, today, weekStart)
  const w0 = periodScore(habits, idx, addDays(today, -13), addDays(today, -7), today, weekStart)
  if (w1.rate !== null && w1.planned >= MIN_OCC) {
    out.push({ text: 'Sur les 7 derniers jours, tu as terminé {p} % de tes occurrences prévues ({d}/{n}).', params: { p: Math.round(w1.rate), d: w1.done, n: w1.planned } })
    if (w0.rate !== null && w0.planned >= MIN_OCC) {
      const diff = Math.round(w1.rate - w0.rate)
      if (Math.abs(diff) >= 5)
        out.push({ text: diff > 0 ? 'Ta régularité a progressé de {x} points par rapport aux 7 jours précédents.' : 'Ta régularité a baissé de {x} points par rapport aux 7 jours précédents : une semaine plus chargée, peut-être ?', params: { x: Math.abs(diff) } })
    }
  }

  const per = habits
    .map((h) => ({ h, s: periodScore([h], idx, addDays(today, -29), today, today, weekStart) }))
    .filter((x) => x.s.rate !== null && x.s.planned >= MIN_OCC)
  if (per.length >= 2) {
    const sorted = [...per].sort((a, b) => a.s.rate! - b.s.rate!)
    const low = sorted[0], high = sorted[sorted.length - 1]
    if (low.s.rate! < high.s.rate!) {
      out.push({ text: '« {name} » est ton habitude la plus régulière sur les 30 derniers jours ({p} %).', params: { name: high.h.name, p: Math.round(high.s.rate!) } })
      out.push({ text: '« {name} » est ton habitude la moins régulière sur les 30 derniers jours ({p} %).', params: { name: low.h.name, p: Math.round(low.s.rate!) } })
    }
  }

  // meilleur jour de la semaine sur 56 jours (il faut assez d'occurrences par jour)
  const byDay = new Map<number, { p: number; d: number }>()
  for (let i = 0; i < 56; i++) {
    const day = addDays(today, -i)
    const occ = dayOccurrences(habits, idx, day)
    if (day === today && occ.some((o) => !o.done)) continue
    const e = byDay.get(weekdayOf(day)) ?? { p: 0, d: 0 }
    e.p += occ.length
    e.d += occ.filter((o) => o.done).length
    byDay.set(weekdayOf(day), e)
  }
  const ranked = [...byDay.entries()].filter(([, v]) => v.p >= 8).map(([k, v]) => ({ k, r: (v.d / v.p) * 100 })).sort((a, b) => b.r - a.r)
  if (ranked.length >= 3 && ranked[0].r - ranked[ranked.length - 1].r >= 15)
    out.push({ text: 'Sur les 8 dernières semaines, le jour où tu termines le plus d’habitudes est le {day} ({p} %).', params: { day: new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + ranked[0].k))), p: Math.round(ranked[0].r) } })

  const bests = habits.map((h) => ({ h, s: habitStats(h, idx, today, weekStart) })).filter((x) => x.s.currentStreak >= 7).sort((a, b) => b.s.currentStreak - a.s.currentStreak)
  if (bests[0]) out.push({ text: 'Série en cours : « {name} » depuis {n} {u}.', params: { name: bests[0].h.name, n: bests[0].s.currentStreak, u: bests[0].s.streakUnit === 'week' ? 'sem.' : 'j' } })
  return out
}
