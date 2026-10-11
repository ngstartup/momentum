import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookHeart, ChevronLeft, ChevronRight, Plus, Settings, Sparkles, Target, Timer, ListChecks } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { useFmtDate, useHabits, useLogIndex, useToday, useWeekStart, STATUS_FR } from '../ui/hooks'
import { addDays, endOfWeek, longDate, startOfWeek, eachDay, weekdayShort, weekdayOf } from '../domain/dates'
import { dayOccurrences, dayScore, dayStatus, habitStats, quotaProgressForWeek } from '../domain/stats'
import { isActiveOn, isQuota, valueOn } from '../domain/habits'
import { Button, Chip, Empty, IconButton, Ring } from '../ui/kit'
import { HabitRow } from '../ui/HabitRow'
import { HabitForm } from '../ui/HabitForm'
import { SAMPLE_HABITS } from '../domain/samples'
import { toast } from '../ui/kit'

const MESSAGES = [
  'Un petit pas aujourd’hui vaut mieux qu’un grand plan demain.',
  'La régularité construit ce que la motivation seule ne peut pas.',
  'Fais simple, fais-le aujourd’hui.',
  'Chaque validation est un vote pour la personne que tu deviens.',
  'Avance à ton rythme, mais avance.',
  'Un jour difficile ne défait pas tes progrès.',
  'Commence petit : le plus dur est de démarrer.',
]

export default function Today() {
  const { t, locale } = useT()
  const today = useToday()
  const [date, setDate] = useState<string | null>(null)
  const d = date ?? today
  const idx = useLogIndex()
  const weekStart = useWeekStart()
  const fmt = useFmtDate()
  const { active } = useHabits()
  const { categories, prefs, addHabit } = useApp()
  const [filter, setFilter] = useState<string | null>(null)
  const [form, setForm] = useState<{ open: boolean; id?: string }>({ open: false })
  const future = d > today

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name
  const fixedToday = useMemo(() => dayOccurrences(active, idx, d).map((o) => o.habit), [active, idx, d])
  // « Aujourd'hui » regroupe les habitudes à jour imposé ; les quotas sont listés à part
  const fixed = active.filter((h) => !isQuota(h) && fixedToday.some((x) => x.id === h.id) && (!filter || h.categoryId === filter))
  const quotas = active.filter((h) => isQuota(h) && isActiveOn(h, d) && (!filter || h.categoryId === filter))
  const score = dayScore(active, idx, d)
  const remaining = score.planned - score.done
  const stats = useMemo(() => new Map(active.map((h) => [h.id, habitStats(h, idx, today, weekStart)])), [active, idx, today, weekStart])

  const week = eachDay(startOfWeek(d, weekStart), endOfWeek(d, weekStart))
  const msg = MESSAGES[(Number(d.slice(8)) + Number(d.slice(5, 7))) % MESSAGES.length]
  const hour = new Date().getHours()
  const greet = hour < 5 ? t('Bonne nuit') : hour < 18 ? t('Bonjour') : t('Bonsoir')
  const name = prefs.displayName.trim()
  const usedCats = categories.filter((c) => active.some((h) => h.categoryId === c.id))

  async function addSample(key: string) {
    const s = SAMPLE_HABITS.find((x) => x.key === key)!
    const cat = categories.some((c) => c.id === s.input.categoryId) ? s.input.categoryId : null
    await addHabit({ ...s.input, categoryId: cat, startDate: today })
    toast(t('Habitude ajoutée.'))
  }

  const empty = active.length === 0

  return (
    <div>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted first-letter:uppercase">{longDate(d, locale)}{d === today ? '' : ` · ${fmt(d)}`}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{greet}{name ? `, ${name}` : ''}</h1>
          <p className="mt-1 max-w-md text-sm text-muted">{t(msg)}</p>
        </div>
        <Link to="/profile" aria-label={t('Paramètres')} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface2 hover:text-ink"><Settings size={20} /></Link>
      </header>

      <div className="mb-4 flex items-center gap-1">
        <IconButton label={t('Jour précédent')} onClick={() => setDate(addDays(d, -1))}><ChevronLeft size={20} /></IconButton>
        <input type="date" aria-label={t('Choisir une date')} value={d} onChange={(e) => e.target.value && setDate(e.target.value === today ? null : e.target.value)} className="!w-auto" />
        <IconButton label={t('Jour suivant')} onClick={() => setDate(addDays(d, 1) === today ? null : addDays(d, 1))}><ChevronRight size={20} /></IconButton>
        {d !== today && <Button small onClick={() => setDate(null)}>{t('Aujourd’hui')}</Button>}
      </div>

      {future && <p className="mb-4 rounded-xl border border-line bg-surface2 p-3 text-sm text-muted">{t('Cette date est dans le futur : elle ne compte pas encore et la validation est désactivée.')}</p>}

      {empty ? (
        <div className="space-y-4">
          <Empty icon={<Sparkles size={28} />} title={t('Bienvenue sur Momentum')}
            text={t('Créez votre première habitude, ou partez d’un exemple que vous pourrez modifier ou supprimer librement.')}
            action={<Button variant="primary" onClick={() => setForm({ open: true })}><Plus size={18} />{t('Créer une habitude')}</Button>} />
          <section className="card p-4">
            <h2 className="mb-1 font-medium">{t('Exemples à personnaliser')}</h2>
            <p className="mb-3 text-xs text-muted">{t('Ce ne sont pas des données : rien n’est ajouté sans votre action.')}</p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_HABITS.map((s) => <Button key={s.key} small onClick={() => addSample(s.key)}><Plus size={14} />{t(s.label)}</Button>)}
            </div>
          </section>
        </div>
      ) : (
        <>
          <section className="card mb-4 flex items-center gap-5 p-4" aria-label={t('Progression du jour')}>
            <Ring ratio={(score.rate ?? 0) / 100}>
              <span className="text-2xl font-semibold">{score.rate === null ? '—' : `${Math.round(score.rate)}%`}</span>
            </Ring>
            <div className="min-w-0">
              {score.planned === 0 ? (
                <><p className="font-medium">{t('Rien de programmé')}</p><p className="text-sm text-muted">{t('Aucune habitude n’est prévue ce jour-là. Ce n’est pas un échec.')}</p></>
              ) : (
                <>
                  <p className="font-medium">{t('{done} sur {planned} terminées', { done: score.done, planned: score.planned })}</p>
                  <p className="text-sm text-muted">{future ? t('À venir') : remaining > 0 ? t('{n} restante(s)', { n: remaining }) : t('Tout est terminé, bravo !')}</p>
                  <p className="mt-1 text-xs text-muted">{t('Score de régularité : {a} / {b} occurrences prévues', { a: score.done, b: score.planned })}</p>
                </>
              )}
            </div>
          </section>

          <nav aria-label={t('Raccourcis')} className="mb-4 grid grid-cols-4 gap-2">
            {[
              { to: `/journal?d=${d}`, icon: <BookHeart size={20} />, label: t('Bilan') },
              { to: '/goals', icon: <Target size={20} />, label: t('Objectifs') },
              { to: '/routines', icon: <ListChecks size={20} />, label: t('Routines') },
              { to: '/focus', icon: <Timer size={20} />, label: t('Focus') },
            ].map((s) => (
              <Link key={s.to} to={s.to} className="card flex flex-col items-center gap-1 py-3 text-xs text-muted transition hover:text-ink">{s.icon}{s.label}</Link>
            ))}
          </nav>

          <section className="card mb-4 p-3" aria-label={t('Semaine')}>
            <div className="grid grid-cols-7 gap-1 text-center">
              {week.map((day) => {
                const st = dayStatus(active, idx, day, today)
                const color = st === 'success' ? 'var(--green)' : st === 'partial' ? 'var(--accent)' : st === 'missed' ? 'var(--danger)' : 'var(--surface2)'
                return (
                  <button key={day} type="button" onClick={() => setDate(day === today ? null : day)} aria-label={`${longDate(day, locale)} — ${t(STATUS_FR[st])}`} aria-current={day === d ? 'date' : undefined}
                    className={`flex flex-col items-center gap-1 rounded-xl py-1.5 ${day === d ? 'bg-surface2' : ''}`}>
                    <span className="text-[11px] uppercase text-muted">{weekdayShort(weekdayOf(day), locale).slice(0, 3)}</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs" style={{ background: color, color: st === 'none' || st === 'future' || st === 'pending' ? 'var(--muted)' : '#10141a' }}>{day.slice(8)}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {usedCats.length > 1 && (
            <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t('Filtrer par catégorie')}>
              <Chip active={filter === null} onClick={() => setFilter(null)}>{t('Toutes')}</Chip>
              {usedCats.map((c) => <Chip key={c.id} active={filter === c.id} onClick={() => setFilter(filter === c.id ? null : c.id)}>{c.name}</Chip>)}
            </div>
          )}

          {fixed.length === 0 && quotas.length === 0 ? (
            <Empty title={t('Aucune habitude à afficher')} text={filter ? t('Aucune habitude de cette catégorie pour ce jour.') : t('Rien n’est programmé ce jour-là.')} />
          ) : (
            <ul className="space-y-2.5">
              {fixed.map((h) => (
                <HabitRow key={h.id} habit={h} date={d} value={valueOn(idx, h.id, d)} stats={stats.get(h.id)!} categoryName={catName(h.categoryId)} disabled={future} onEdit={() => setForm({ open: true, id: h.id })} />
              ))}
            </ul>
          )}

          {quotas.length > 0 && (
            <section className="mt-5">
              <h2 className="mb-1 text-sm font-medium text-muted">{t('Quotas de la semaine')}</h2>
              <p className="mb-2 text-xs text-muted">{t('Aucun jour imposé : ils ne comptent dans le score du jour que lorsque vous les réalisez.')}</p>
              <ul className="space-y-2.5">
                {quotas.map((h) => (
                  <HabitRow key={h.id} habit={h} date={d} value={valueOn(idx, h.id, d)} stats={stats.get(h.id)!} categoryName={catName(h.categoryId)}
                    quota={quotaProgressForWeek(h, idx, d, weekStart)} disabled={future} onEdit={() => setForm({ open: true, id: h.id })} />
                ))}
              </ul>
            </section>
          )}

          <div className="mt-5 flex justify-center">
            <Button onClick={() => setForm({ open: true })}><Plus size={18} />{t('Ajouter une habitude')}</Button>
          </div>
        </>
      )}

      <HabitForm open={form.open} habit={active.find((h) => h.id === form.id)} onClose={() => setForm({ open: false })} />
    </div>
  )
}
