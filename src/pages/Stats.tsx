import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Lightbulb } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { pct, useFmtDate, useHabits, useLogIndex, useToday, useWeekStart } from '../ui/hooks'
import { addDays, diffDays, isValidDateStr, minDate } from '../domain/dates'
import { dailySeries, habitStats, monthlySeries, periodScore, totalCompletions, weeklySeries } from '../domain/stats'
import { buildInsights } from '../domain/insights'
import { Chip, Empty, Field, PageHeader, Segmented } from '../ui/kit'
import { Heatmap } from '../ui/Heatmap'
import { HabitIcon } from '../ui/icons'

type Range = '7' | '30' | '90' | '180' | 'year' | 'custom'

export default function Stats() {
  const { t, locale } = useT()
  const today = useToday()
  const weekStart = useWeekStart()
  const fmt = useFmtDate()
  const idx = useLogIndex()
  const { all, active } = useHabits()
  const { categories } = useApp()
  const [range, setRange] = useState<Range>('30')
  const [cFrom, setCFrom] = useState(addDays(today, -29))
  const [cTo, setCTo] = useState(today)
  const [gran, setGran] = useState<'auto' | 'day' | 'week' | 'month'>('auto')

  const [from, to] = useMemo<[string, string]>(() => {
    if (range === 'custom') return isValidDateStr(cFrom) && isValidDateStr(cTo) && cFrom <= cTo ? [cFrom, cTo] : [addDays(today, -29), today]
    if (range === 'year') return [`${today.slice(0, 4)}-01-01`, today]
    return [addDays(today, -(Number(range) - 1)), today]
  }, [range, cFrom, cTo, today])

  const span = diffDays(to, from) + 1
  const g = gran === 'auto' ? (span <= 31 ? 'day' : span <= 200 ? 'week' : 'month') : gran
  const series = useMemo(() => {
    const f = g === 'day' ? dailySeries : g === 'week' ? weeklySeries : monthlySeries
    return f(all, idx, from, to, today, weekStart).map((b) => ({ ...b, rate: b.score.rate === null ? null : Math.round(b.score.rate * 10) / 10 }))
  }, [all, idx, from, to, today, weekStart, g])

  const overall = periodScore(all, idx, from, to, today, weekStart)
  const s7 = periodScore(all, idx, addDays(today, -6), today, today, weekStart)
  const s30 = periodScore(all, idx, addDays(today, -29), today, today, weekStart)
  const total = totalCompletions(all, idx, from, minDate(to, today))
  const perHabit = useMemo(() => all.map((h) => ({ h, st: habitStats(h, idx, today, weekStart), p: periodScore([h], idx, from, to, today, weekStart) })), [all, idx, today, weekStart, from, to])
  const bestStreak = perHabit.reduce((m, x) => Math.max(m, x.st.bestStreak), 0)
  const perCat = categories.map((c) => ({ c, p: periodScore(all.filter((h) => h.categoryId === c.id), idx, from, to, today, weekStart) })).filter((x) => x.p.planned > 0)
  const insights = useMemo(() => buildInsights(all, idx, today, weekStart, locale), [all, idx, today, weekStart, locale])
  const rateOnDay = (d: string) => periodScore(all, idx, d, d, today, weekStart).rate
  const labelOf = (d: string) => (g === 'month' ? d.slice(0, 7) : fmt(d).slice(0, g === 'day' ? 5 : 10))

  if (all.length === 0) return (
    <div><PageHeader title={t('Statistiques')} />
      <Empty title={t('Pas encore de statistiques')} text={t('Créez une habitude et validez-la : vos statistiques apparaîtront ici, calculées uniquement à partir de vos données.')} action={<Link to="/habits" className="text-accent-ink underline">{t('Créer une habitude')}</Link>} /></div>
  )

  const axis = { stroke: 'var(--muted)', fontSize: 11 }
  const tip = { contentStyle: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)' }, labelStyle: { color: 'var(--muted)' } }
  const tiles: [string, string][] = [
    [t('Taux de réussite'), pct(overall.rate, 1)],
    [t('Habitudes actives'), String(active.length)],
    [t('Validations'), String(total)],
    [t('Meilleure série'), String(bestStreak)],
    [t('7 derniers jours'), pct(s7.rate)],
    [t('30 derniers jours'), pct(s30.rate)],
  ]

  return (
    <div>
      <PageHeader title={t('Statistiques')} subtitle={`${fmt(from)} → ${fmt(to)}`} />
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t('Période')}>
        {([['7', t('7 jours')], ['30', t('30 jours')], ['90', t('3 mois')], ['180', t('6 mois')], ['year', t('Cette année')], ['custom', t('Personnalisée')]] as [Range, string][]).map(([k, l]) => (
          <Chip key={k} active={range === k} onClick={() => setRange(k)}>{l}</Chip>
        ))}
      </div>
      {range === 'custom' && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Field label={t('Du')}><input type="date" max={cTo} value={cFrom} onChange={(e) => setCFrom(e.target.value)} /></Field>
          <Field label={t('Au')} error={cFrom > cTo ? t('La fin doit suivre le début.') : null}><input type="date" min={cFrom} value={cTo} onChange={(e) => setCTo(e.target.value)} /></Field>
        </div>
      )}

      <section className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label={t('Indicateurs')}>
        {tiles.map(([k, v]) => <div key={k} className="card p-3"><p className="text-xs text-muted">{k}</p><p className="mt-0.5 text-xl font-semibold">{v}</p></div>)}
      </section>
      <p className="mb-5 text-xs text-muted">
        {overall.planned === 0 ? t('Aucune occurrence prévue sur cette période : pas de taux affiché.') : t('{d} occurrences terminées sur {p} prévues. Mesure de régularité, pas de valeur personnelle.', { d: overall.done, p: overall.planned })}
      </p>

      <section className="card mb-4 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">{t('Régularité dans le temps')}</h2>
          <Segmented label={t('Granularité')} value={gran} onChange={setGran} options={[{ value: 'auto', label: 'Auto' }, { value: 'day', label: t('Jour') }, { value: 'week', label: t('Semaine') }, { value: 'month', label: t('Mois') }]} />
        </div>
        <div className="h-56" role="img" aria-label={t('Graphique de régularité')}>
          <ResponsiveContainer>
            {g === 'day' ? (
              <LineChart data={series} margin={{ left: -20, right: 8, top: 5 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tickFormatter={labelOf} {...axis} minTickGap={24} />
                <YAxis domain={[0, 100]} unit="%" {...axis} />
                <Tooltip {...tip} labelFormatter={(l) => fmt(String(l))} formatter={(v) => [`${v} %`, t('Taux')]} />
                <Line type="monotone" dataKey="rate" stroke="var(--accent)" strokeWidth={2.5} dot={false} connectNulls />
              </LineChart>
            ) : (
              <BarChart data={series} margin={{ left: -20, right: 8, top: 5 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tickFormatter={labelOf} {...axis} minTickGap={24} />
                <YAxis domain={[0, 100]} unit="%" {...axis} />
                <Tooltip {...tip} labelFormatter={(l) => fmt(String(l))} formatter={(v) => [`${v} %`, t('Taux')]} cursor={{ fill: 'var(--surface2)' }} />
                <Bar dataKey="rate" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted">{t('Les périodes sans occurrence prévue n’ont pas de valeur (aucun zéro artificiel).')}</p>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-3 font-medium">{t('Calendrier thermique')}</h2>
        <Heatmap rateOn={rateOnDay} today={today} weekStart={weekStart} />
      </section>

      {perCat.length > 0 && (
        <section className="card mb-4 p-4">
          <h2 className="mb-3 font-medium">{t('Par catégorie')}</h2>
          <ul className="space-y-3">
            {perCat.map(({ c, p }) => (
              <li key={c.id}>
                <div className="mb-1 flex justify-between text-sm"><span>{c.name}</span><span className="text-muted">{pct(p.rate)} · {p.done}/{p.planned}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full" style={{ width: `${p.rate ?? 0}%`, background: c.color }} /></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mb-4 p-4">
        <h2 className="mb-3 font-medium">{t('Par habitude')}</h2>
        <ul className="divide-y divide-line">
          {perHabit.map(({ h, st, p }) => (
            <li key={h.id}>
              <Link to={`/habits/${h.id}`} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${h.color}26`, color: h.color }}><HabitIcon name={h.icon} size={18} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{h.name}{h.archived ? ` (${t('archivée')})` : ''}</span>
                  <span className="text-xs text-muted">{t('Série')} {st.currentStreak} · {t('record')} {st.bestStreak}</span></span>
                <span className="text-sm">{pct(p.rate)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-4" aria-label={t('Observations')}>
        <h2 className="mb-2 flex items-center gap-2 font-medium"><Lightbulb size={18} className="text-accent-ink" />{t('Observations')}</h2>
        {insights.length === 0
          ? <p className="text-sm text-muted">{t('Pas assez de données pour formuler des observations fiables (au moins 5 occurrences prévues sont nécessaires).')}</p>
          : <ul className="list-disc space-y-1.5 pl-5 text-sm">{insights.map((i, k) => <li key={k}>{t(i.text, i.params)}</li>)}</ul>}
        <p className="mt-3 text-xs text-muted">{t('Ces observations décrivent vos données ; elles n’établissent aucune cause.')}</p>
      </section>
    </div>
  )
}
