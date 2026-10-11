import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Plus, Search as SearchIcon } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { useHabits, useLogIndex, useToday, useWeekStart } from '../ui/hooks'
import { habitStats } from '../domain/stats'
import type { Habit } from '../domain/types'
import { Button, Chip, Empty, IconButton, PageHeader, Segmented } from '../ui/kit'
import { HabitIcon } from '../ui/icons'
import { HabitForm } from '../ui/HabitForm'
import { SampleLibrary } from '../ui/SampleLibrary'

export function scheduleLabel(h: Habit, t: (s: string, p?: Record<string, string | number>) => string, weekdayName: (d: number) => string): string {
  const s = h.schedule
  if (s.kind === 'daily') return t('Tous les jours')
  if (s.kind === 'weekdays') return s.weekdays.map(weekdayName).join(' · ')
  if (s.kind === 'weekly_quota') return t('{n} fois / semaine', { n: s.timesPerWeek })
  return t('{n} date(s) précise(s)', { n: s.dates.length })
}

export default function Habits() {
  const { t, locale } = useT()
  const { all } = useHabits()
  const { categories, reorderHabits } = useApp()
  const idx = useLogIndex()
  const today = useToday()
  const weekStart = useWeekStart()
  const [status, setStatus] = useState<'active' | 'archived'>('active')
  const [cat, setCat] = useState<string | null>(null)
  const [freq, setFreq] = useState<string>('all')
  const [sort, setSort] = useState<'custom' | 'name' | 'created'>('custom')
  const [q, setQ] = useState('')
  const [form, setForm] = useState(false)

  const wd = (d: number) => new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + d)))
  const filtered = useMemo(() => {
    let l = all.filter((h) => (status === 'active' ? !h.archived : h.archived))
    if (cat) l = l.filter((h) => h.categoryId === cat)
    if (freq !== 'all') l = l.filter((h) => h.schedule.kind === freq)
    if (q.trim()) l = l.filter((h) => h.name.toLowerCase().includes(q.trim().toLowerCase()))
    if (sort === 'name') l = [...l].sort((a, b) => a.name.localeCompare(b.name, locale))
    if (sort === 'created') l = [...l].sort((a, b) => b.createdAt - a.createdAt)
    return l
  }, [all, status, cat, freq, q, sort, locale])

  const canReorder = sort === 'custom' && !cat && freq === 'all' && !q.trim() && status === 'active'
  const move = (id: string, dir: -1 | 1) => {
    const ids = filtered.map((h) => h.id)
    const i = ids.indexOf(id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    void reorderHabits(ids)
  }

  return (
    <div>
      <PageHeader title={t('Habitudes')} subtitle={t('{n} habitude(s) active(s)', { n: all.filter((h) => !h.archived).length })}
        actions={<><Link to="/search" aria-label={t('Rechercher')} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface2 hover:text-ink"><SearchIcon size={20} /></Link>
          <Button variant="primary" small onClick={() => setForm(true)}><Plus size={16} />{t('Nouvelle')}</Button></>} />

      <div className="mb-3 space-y-3">
        <input type="search" aria-label={t('Rechercher une habitude')} placeholder={t('Rechercher une habitude')} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label={t('Statut')} value={status} onChange={setStatus} options={[{ value: 'active', label: t('Actives') }, { value: 'archived', label: t('Archivées') }]} />
          <select aria-label={t('Fréquence')} value={freq} onChange={(e) => setFreq(e.target.value)} className="!w-auto">
            <option value="all">{t('Toutes fréquences')}</option>
            <option value="daily">{t('Tous les jours')}</option>
            <option value="weekdays">{t('Jours précis')}</option>
            <option value="weekly_quota">{t('Quota par semaine')}</option>
            <option value="dates">{t('Dates précises')}</option>
          </select>
          <select aria-label={t('Tri')} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="!w-auto">
            <option value="custom">{t('Ordre personnalisé')}</option>
            <option value="name">{t('Nom')}</option>
            <option value="created">{t('Date de création')}</option>
          </select>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t('Filtrer par catégorie')}>
          <Chip active={cat === null} onClick={() => setCat(null)}>{t('Toutes')}</Chip>
          {[...categories].sort((a, b) => a.order - b.order).map((c) => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)}>{c.name}</Chip>)}
        </div>
      </div>

      {filtered.length === 0 ? (
        all.length === 0
          ? <Empty title={t('Aucune habitude')} text={t('Créez votre première habitude pour commencer à suivre vos progrès.')} action={<Button variant="primary" onClick={() => setForm(true)}><Plus size={18} />{t('Créer une habitude')}</Button>} />
          : <Empty title={t('Aucun résultat')} text={status === 'archived' ? t('Aucune habitude archivée.') : t('Aucune habitude ne correspond à ces filtres.')} />
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((h, i) => {
            const st = habitStats(h, idx, today, weekStart)
            return (
              <li key={h.id} className="card flex items-center gap-3 p-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${h.color}26`, color: h.color }}><HabitIcon name={h.icon} /></span>
                <Link to={`/habits/${h.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{h.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {scheduleLabel(h, t, wd)} · {st.rate === null ? t('pas encore de données') : `${Math.round(st.rate)} %`}
                    {st.currentStreak > 0 && ` · 🔥 ${st.currentStreak}${st.streakUnit === 'week' ? ' sem.' : ' j'}`}
                  </span>
                </Link>
                {canReorder && (
                  <div className="flex">
                    <IconButton label={t('Monter')} disabled={i === 0} onClick={() => move(h.id, -1)}><ArrowUp size={16} /></IconButton>
                    <IconButton label={t('Descendre')} disabled={i === filtered.length - 1} onClick={() => move(h.id, 1)}><ArrowDown size={16} /></IconButton>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {status === 'active' && <SampleLibrary />}
      <HabitForm open={form} onClose={() => setForm(false)} />
    </div>
  )
}
