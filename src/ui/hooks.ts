import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store/app'
import { buildLogIndex } from '../domain/habits'
import { formatDate, todayStr } from '../domain/dates'

/** Date locale du jour, rafraîchie pour franchir minuit sans recharger. */
export function useToday(): string {
  const [t, setT] = useState(todayStr())
  useEffect(() => {
    const tick = () => setT((cur) => { const n = todayStr(); return n === cur ? cur : n })
    const id = setInterval(tick, 20_000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [])
  return t
}

export function useLogIndex() {
  const logs = useApp((s) => s.logs)
  return useMemo(() => buildLogIndex(logs), [logs])
}

export function useHabits() {
  const all = useApp((s) => s.habits)
  return useMemo(() => {
    const sorted = [...all].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
    return { all: sorted, active: sorted.filter((h) => !h.archived), archived: sorted.filter((h) => h.archived) }
  }, [all])
}

export function useFmtDate() {
  const f = useApp((s) => s.prefs.dateFormat)
  return (d: string) => formatDate(d, f)
}

export function useWeekStart() {
  return useApp((s) => s.prefs.weekStart)
}

export function pct(rate: number | null, digits = 0): string {
  return rate === null ? '—' : `${rate.toFixed(digits).replace('.', ',')} %`
}

export const STATUS_FR: Record<string, string> = { success: 'réussi', partial: 'partiel', missed: 'prévu, non terminé', none: 'rien de prévu', future: 'à venir', pending: 'en attente' }
