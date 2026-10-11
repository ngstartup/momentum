import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArchiveRestore, ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { pct, useFmtDate, useHabits, useLogIndex, useToday, useWeekStart } from '../ui/hooks'
import { habitStats, quotaWeeks, periodScore } from '../domain/stats'
import { isDone, isFixedScheduledOn, valueOn } from '../domain/habits'
import { addDays, eachDay } from '../domain/dates'
import { Button, Empty, Field, IconButton, confirmDialog, toast } from '../ui/kit'
import { HabitIcon } from '../ui/icons'
import { HabitForm } from '../ui/HabitForm'
import { Heatmap } from '../ui/Heatmap'
import { scheduleLabel } from './Habits'

export default function HabitDetail() {
  const { id } = useParams()
  const { t, locale } = useT()
  const nav = useNavigate()
  const { all } = useHabits()
  const habit = all.find((h) => h.id === id)
  const { categories, archiveHabit, restoreHabit, deleteHabit, setLogValue } = useApp()
  const idx = useLogIndex()
  const today = useToday()
  const weekStart = useWeekStart()
  const fmt = useFmtDate()
  const [edit, setEdit] = useState(false)
  const [fixDate, setFixDate] = useState(today)
  const [fixVal, setFixVal] = useState('')

  if (!habit) {
    return <Empty title={t('Habitude introuvable')} text={t('Elle a peut-être été supprimée.')} action={<Link to="/habits" className="text-accent-ink underline">{t('Retour aux habitudes')}</Link>} />
  }
  const stats = habitStats(habit, idx, today, weekStart)
  const cat = categories.find((c) => c.id === habit.categoryId)
  const unit = habit.tracking === 'duration' ? 'min' : habit.unit ?? ''
  const wd = (d: number) => new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + d)))
  const unitW = stats.streakUnit === 'week' ? t('semaines') : t('jours')
  const recent = eachDay(addDays(today, -13), today).reverse().filter((d) => d >= habit.startDate)
  const weeks = quotaWeeks(habit, idx, today, weekStart).slice(-8).reverse()

  const rateOn = (d: string) => {
    const s = periodScore([habit], idx, d, d, today, weekStart)
    return s.rate
  }

  async function del() {
    if (await confirmDialog(t('Supprimer « {name} » ?', { name: habit!.name }), t('Cette action supprime aussi tout son historique et est irréversible. Pour le conserver, archivez-la plutôt.'), t('Supprimer définitivement'))) {
      await deleteHabit(habit!.id)
      toast(t('Habitude supprimée.'))
      nav('/habits')
    }
  }
  async function arch() {
    if (habit!.archived) { await restoreHabit(habit!.id); toast(t('Habitude restaurée.')) }
    else if (await confirmDialog(t('Archiver « {name} » ?', { name: habit!.name }), t('Elle disparaît d’Aujourd’hui mais son historique est conservé. Vous pourrez la restaurer.'), t('Archiver'))) {
      await archiveHabit(habit!.id); toast(t('Habitude archivée.'))
    }
  }
  async function saveFix() {
    const v = habit!.tracking === 'binary' ? (fixVal === '0' ? 0 : 1) : Number(fixVal.replace(',', '.'))
    if (!Number.isFinite(v) || v < 0) return toast(t('Valeur invalide.'))
    if (fixDate > today) return toast(t('Impossible d’enregistrer une date future.'))
    await setLogValue(habit!.id, fixDate, v)
    toast(t('Entrée corrigée.'))
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <IconButton label={t('Retour')} onClick={() => nav(-1)}><ArrowLeft size={20} /></IconButton>
        <div className="flex gap-1">
          <IconButton label={t('Modifier')} onClick={() => setEdit(true)}><Pencil size={18} /></IconButton>
          <IconButton label={habit.archived ? t('Restaurer') : t('Archiver')} onClick={arch}>{habit.archived ? <ArchiveRestore size={18} /> : <Archive size={18} />}</IconButton>
          <IconButton label={t('Supprimer')} onClick={del} className="hover:!text-danger"><Trash2 size={18} /></IconButton>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: `${habit.color}26`, color: habit.color }}><HabitIcon name={habit.icon} size={30} /></span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{habit.name}</h1>
          <p className="text-sm text-muted">{[cat?.name, scheduleLabel(habit, t, wd), habit.archived ? t('Archivée') : null].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      {habit.description && <p className="mb-4 text-sm text-muted">{habit.description}</p>}

      <section className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label={t('Statistiques')}>
        {[
          [t('Série actuelle'), `${stats.currentStreak} ${unitW}`],
          [t('Meilleure série'), `${stats.bestStreak} ${unitW}`],
          [t('Taux de réussite'), pct(stats.rate, 1)],
          [t('Occurrences prévues'), String(stats.planned)],
          [t('Occurrences terminées'), String(stats.done)],
          [t('Total des validations'), String(stats.totalDone)],
        ].map(([k, v]) => (
          <div key={k} className="card p-3"><p className="text-xs text-muted">{k}</p><p className="mt-0.5 text-lg font-semibold">{v}</p></div>
        ))}
      </section>
      <p className="mb-5 text-xs text-muted">{t('Le taux compare les occurrences terminées aux occurrences réellement prévues, hors jours futurs et hors suspensions.')}</p>

      <section className="card mb-4 p-4">
        <h2 className="mb-3 font-medium">{t('Régularité (18 dernières semaines)')}</h2>
        <Heatmap rateOn={rateOn} today={today} weekStart={weekStart} />
      </section>

      {weeks.length > 0 && (
        <section className="card mb-4 p-4">
          <h2 className="mb-2 font-medium">{t('Semaines récentes')}</h2>
          <ul className="space-y-1 text-sm">
            {weeks.map((w) => (
              <li key={w.weekStart} className="flex justify-between"><span>{fmt(w.weekStart)} → {fmt(w.weekEnd)}</span>
                <span className={w.status === 'met' ? 'text-green' : w.status === 'missed' ? 'text-danger' : 'text-muted'}>{w.count}/{w.quota} · {w.status === 'met' ? t('atteint') : w.status === 'missed' ? t('manqué') : t('en cours')}</span></li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mb-4 p-4">
        <h2 className="mb-2 font-medium">{t('14 derniers jours')}</h2>
        <ul className="divide-y divide-line text-sm">
          {recent.map((d) => {
            const v = valueOn(idx, habit.id, d)
            const sched = isFixedScheduledOn(habit, d)
            return (
              <li key={d} className="flex items-center justify-between py-1.5">
                <span>{fmt(d)} {!sched && habit.schedule.kind !== 'weekly_quota' && <span className="text-xs text-muted">({t('non programmé')})</span>}</span>
                <span className={isDone(habit, v) ? 'text-green' : 'text-muted'}>{habit.tracking === 'binary' ? (v >= 1 ? t('Fait') : '—') : `${v} ${unit}`}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card mb-4 space-y-3 p-4">
        <h2 className="font-medium">{t('Corriger une entrée passée')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('Date')}><input type="date" max={today} min={habit.startDate} value={fixDate} onChange={(e) => setFixDate(e.target.value)} /></Field>
          {habit.tracking === 'binary'
            ? <Field label={t('Résultat')}><select value={fixVal || String(valueOn(idx, habit.id, fixDate) >= 1 ? 1 : 0)} onChange={(e) => setFixVal(e.target.value)}><option value="1">{t('Fait')}</option><option value="0">{t('Pas fait')}</option></select></Field>
            : <Field label={`${t('Valeur')} ${unit}`}><input inputMode="decimal" placeholder={String(valueOn(idx, habit.id, fixDate))} value={fixVal} onChange={(e) => setFixVal(e.target.value)} /></Field>}
        </div>
        <Button variant="primary" onClick={saveFix}>{t('Enregistrer la correction')}</Button>
        <p className="text-xs text-muted">{t('Seule cette date est modifiée ; les autres entrées restent intactes.')}</p>
      </section>

      <HabitForm open={edit} habit={habit} onClose={() => setEdit(false)} />
    </div>
  )
}
