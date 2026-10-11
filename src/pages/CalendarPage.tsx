import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { pct, useHabits, useLogIndex, useToday, useWeekStart, STATUS_FR } from '../ui/hooks'
import { addMonths, endOfMonth, endOfWeek, longDate, monthLabel, startOfMonth, startOfWeek, eachDay, weekdayShort } from '../domain/dates'
import { dayOccurrences, dayScore, dayStatus, habitStats, type DayStatus } from '../domain/stats'
import { isQuota, isActiveOn, valueOn } from '../domain/habits'
import { HabitRow } from '../ui/HabitRow'
import { IconButton, PageHeader, Button } from '../ui/kit'

const COLORS: Record<DayStatus, string> = {
  success: 'var(--green)', partial: 'var(--accent)', missed: 'var(--danger)', none: 'transparent', future: 'transparent', pending: 'transparent',
}

export default function CalendarPage() {
  const { t, locale } = useT()
  const today = useToday()
  const weekStart = useWeekStart()
  const idx = useLogIndex()
  const { active } = useHabits()
  const { journal, categories } = useApp()
  const [month, setMonth] = useState(startOfMonth(today))
  const [sel, setSel] = useState(today)

  const days = useMemo(() => eachDay(startOfWeek(month, weekStart), endOfWeek(endOfMonth(month), weekStart)), [month, weekStart])
  const heads = [0, 1, 2, 3, 4, 5, 6].map((i) => (weekStart + i) % 7)
  const score = dayScore(active, idx, sel)
  const occ = dayOccurrences(active, idx, sel)
  const fixedHabits = occ.map((o) => o.habit)
  const quotas = active.filter((h) => isQuota(h) && isActiveOn(h, sel) && !fixedHabits.some((x) => x.id === h.id))
  const note = journal.find((j) => j.date === sel)
  const stats = useMemo(() => new Map(active.map((h) => [h.id, habitStats(h, idx, today, weekStart)])), [active, idx, today, weekStart])
  const future = sel > today

  return (
    <div>
      <PageHeader title={t('Calendrier')} actions={month !== startOfMonth(today) ? <Button small onClick={() => { setMonth(startOfMonth(today)); setSel(today) }}>{t('Aujourd’hui')}</Button> : undefined} />
      <div className="mb-3 flex items-center justify-between">
        <IconButton label={t('Mois précédent')} onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft size={20} /></IconButton>
        <h2 className="font-medium capitalize" aria-live="polite">{monthLabel(month, locale)}</h2>
        <IconButton label={t('Mois suivant')} onClick={() => setMonth(addMonths(month, 1))}><ChevronRight size={20} /></IconButton>
      </div>

      <div className="card p-2 sm:p-3">
        <div className="grid grid-cols-7 text-center text-[11px] uppercase text-muted">
          {heads.map((d) => <span key={d} className="py-1">{weekdayShort(d, locale).slice(0, 3)}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1" role="grid">
          {days.map((d) => {
            const st = dayStatus(active, idx, d, today)
            const inMonth = d.slice(0, 7) === month.slice(0, 7)
            const filled = st === 'success' || st === 'partial' || st === 'missed'
            return (
              <button key={d} type="button" role="gridcell" onClick={() => setSel(d)} aria-selected={d === sel} aria-label={`${longDate(d, locale)} — ${t(STATUS_FR[st])}`}
                className={`relative flex aspect-square items-center justify-center rounded-xl text-sm transition ${inMonth ? '' : 'opacity-35'} ${d === sel ? 'ring-2 ring-accent' : ''} ${d === today ? 'font-bold' : ''}`}
                style={{ background: filled ? `color-mix(in srgb, ${COLORS[st]} ${st === 'missed' ? 28 : 85}%, var(--surface))` : 'var(--surface2)', color: filled && st !== 'missed' ? '#10141a' : st === 'future' ? 'var(--muted)' : undefined,
                  border: st === 'pending' ? '1.5px dashed var(--accent)' : undefined }}>
                {Number(d.slice(8))}
              </button>
            )
          })}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label={t('Légende')}>
          <li><span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-green" />{t('Réussi')}</li>
          <li><span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-accent" />{t('Partiel')}</li>
          <li><span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-danger/40" />{t('Prévu, non terminé')}</li>
          <li><span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-surface2" />{t('Rien de prévu / futur')}</li>
        </ul>
      </div>

      <section className="mt-5" aria-live="polite">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-medium first-letter:uppercase">{longDate(sel, locale)}</h2>
          <span className="text-sm text-muted">{future ? t('À venir') : score.planned === 0 ? t('Rien de prévu') : `${pct(score.rate)} · ${score.done}/${score.planned}`}</span>
        </div>
        {fixedHabits.length + quotas.length === 0 ? (
          <p className="card p-4 text-sm text-muted">{t('Aucune habitude programmée ce jour-là.')}</p>
        ) : (
          <ul className="space-y-2.5">
            {[...fixedHabits, ...quotas].map((h) => (
              <HabitRow key={h.id} habit={h} date={sel} value={valueOn(idx, h.id, sel)} stats={stats.get(h.id)!} categoryName={categories.find((c) => c.id === h.categoryId)?.name} disabled={future} />
            ))}
          </ul>
        )}
        <div className="card mt-3 p-4 text-sm">
          <h3 className="mb-1 font-medium">{t('Notes de la journée')}</h3>
          {note && (note.note || note.win || note.difficulty || note.tomorrow) ? (
            <div className="space-y-1 text-muted">
              {note.win && <p><b className="text-ink">{t('Réussite')} :</b> {note.win}</p>}
              {note.difficulty && <p><b className="text-ink">{t('Difficulté')} :</b> {note.difficulty}</p>}
              {note.note && <p>{note.note}</p>}
              {note.tomorrow && <p><b className="text-ink">{t('Demain')} :</b> {note.tomorrow}</p>}
            </div>
          ) : <p className="text-muted">{t('Aucune note pour ce jour.')}</p>}
          <Link to={`/journal?d=${sel}`} className="mt-2 inline-block text-accent-ink underline">{note ? t('Modifier dans le journal') : t('Écrire dans le journal')}</Link>
        </div>
      </section>
    </div>
  )
}
