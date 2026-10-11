import { useMemo } from 'react'
import { addDays, startOfWeek, longDate } from '../domain/dates'
import { useT } from '../i18n'

/** Calendrier thermique : une colonne par semaine, intensité = taux (0..100) ; null = rien de prévu. */
export function Heatmap({ weeks = 18, rateOn, today, weekStart }: { weeks?: number; rateOn: (d: string) => number | null; today: string; weekStart: number }) {
  const { t, locale } = useT()
  const cols = useMemo(() => {
    const lastWeek = startOfWeek(today, weekStart)
    return Array.from({ length: weeks }, (_, w) => {
      const ws = addDays(lastWeek, -(weeks - 1 - w) * 7)
      return Array.from({ length: 7 }, (_, i) => addDays(ws, i))
    })
  }, [weeks, today, weekStart])
  return (
    <div className="overflow-x-auto" role="img" aria-label={t('Calendrier thermique de régularité')}>
      <div className="inline-flex gap-1">
        {cols.map((col, i) => (
          <div key={i} className="flex flex-col gap-1">
            {col.map((d) => {
              const r = d > today ? null : rateOn(d)
              const bg = d > today ? 'transparent' : r === null ? 'var(--surface2)' : `color-mix(in srgb, var(--green) ${Math.max(18, r)}%, var(--surface2))`
              return <div key={d} title={`${longDate(d, locale)} — ${d > today ? t('futur') : r === null ? t('rien de prévu') : `${Math.round(r)} %`}`} className="h-3.5 w-3.5 rounded-[4px]" style={{ background: bg, outline: d === today ? '1.5px solid var(--accent)' : undefined }} />
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
