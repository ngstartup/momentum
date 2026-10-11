import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useApp, uid } from '../store/app'
import type { Habit, HabitSchedule, TrackingType } from '../domain/types'
import { validateSchedule } from '../domain/habits'
import { isValidDateStr, todayStr, weekdayShort } from '../domain/dates'
import { useT } from '../i18n'
import { Button, Chip, Field, Segmented, Sheet, toast } from './kit'
import { COLOR_CHOICES, HABIT_ICON_CHOICES, HabitIcon } from './icons'

type SchedKind = HabitSchedule['kind']

export function HabitForm({ open, onClose, habit, defaults }: { open: boolean; onClose: () => void; habit?: Habit; defaults?: Partial<Habit> }) {
  const { t, locale } = useT()
  const { categories, prefs, reminders, addHabit, updateHabit, saveItem, removeItem } = useApp()
  const existingReminder = habit ? reminders.find((r) => r.habitId === habit.id) : undefined

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('target')
  const [color, setColor] = useState(COLOR_CHOICES[0])
  const [categoryId, setCategoryId] = useState<string>('')
  const [tracking, setTracking] = useState<TrackingType>('binary')
  const [target, setTarget] = useState('')
  const [unit, setUnit] = useState('')
  const [kind, setKind] = useState<SchedKind>('daily')
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5])
  const [quota, setQuota] = useState(3)
  const [dates, setDates] = useState<string[]>([])
  const [newDate, setNewDate] = useState('')
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState('')
  const [remTime, setRemTime] = useState('')
  const [remIfDone, setRemIfDone] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const src = habit ?? { ...defaults }
    setName(src.name ?? '')
    setDescription(src.description ?? '')
    setIcon(src.icon ?? 'target')
    setColor(src.color ?? COLOR_CHOICES[0])
    setCategoryId(src.categoryId ?? '')
    setTracking(src.tracking ?? 'binary')
    setTarget(src.target ? String(src.target) : '')
    setUnit(src.unit ?? '')
    const s = src.schedule ?? { kind: 'daily' as const }
    setKind(s.kind)
    setWeekdays(s.kind === 'weekdays' ? s.weekdays : [1, 2, 3, 4, 5])
    setQuota(s.kind === 'weekly_quota' ? s.timesPerWeek : 3)
    setDates(s.kind === 'dates' ? s.dates : [])
    setStartDate(src.startDate ?? todayStr())
    setEndDate(src.endDate ?? '')
    setRemTime(existingReminder?.time ?? '')
    setRemIfDone(existingReminder?.remindIfDone ?? false)
    setErrors({})
    setBusy(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, habit?.id])

  const order = [0, 1, 2, 3, 4, 5, 6].map((i) => (prefs.weekStart + i) % 7)

  async function submit() {
    if (busy) return
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = t('Le nom est obligatoire.')
    const schedule: HabitSchedule =
      kind === 'daily' ? { kind } : kind === 'weekdays' ? { kind, weekdays: [...weekdays].sort() } : kind === 'weekly_quota' ? { kind, timesPerWeek: quota } : { kind, dates: [...dates].sort() }
    const se = validateSchedule(schedule)
    if (se === 'schedule.weekdays') e.schedule = t('Choisissez au moins un jour.')
    if (se === 'schedule.quota') e.schedule = t('Le quota doit être compris entre 1 et 7.')
    if (se === 'schedule.dates') e.schedule = t('Ajoutez au moins une date.')
    if (tracking !== 'binary' && !(Number(target) > 0)) e.target = t('Indiquez un objectif supérieur à 0.')
    if (!isValidDateStr(startDate)) e.startDate = t('Date de début invalide.')
    if (endDate && (!isValidDateStr(endDate) || endDate < startDate)) e.endDate = t('La fin doit suivre le début.')
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      const payload = {
        name, description: description.trim() || undefined, icon, color, categoryId: categoryId || null, tracking,
        target: tracking === 'binary' ? undefined : Number(target), unit: tracking === 'duration' ? 'min' : unit.trim() || undefined,
        schedule, startDate, endDate: endDate || null,
      }
      const saved = habit ? (await updateHabit(habit.id, payload), habit) : await addHabit(payload)
      const hid = saved.id
      if (remTime) await saveItem('reminders', { id: existingReminder?.id ?? uid(), habitId: hid, time: remTime, days: [], enabled: true, remindIfDone: remIfDone })
      else if (existingReminder) await removeItem('reminders', existingReminder.id)
      toast(habit ? t('Habitude mise à jour.') : t('Habitude créée.'))
      onClose()
    } catch {
      setErrors({ form: t('Enregistrement impossible. Réessayez.') })
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={habit ? t('Modifier l’habitude') : t('Nouvelle habitude')}
      footer={<><Button className="flex-1" onClick={onClose}>{t('Annuler')}</Button><Button variant="primary" className="flex-1" disabled={busy} onClick={submit}>{t('Enregistrer')}</Button></>}>
      {errors.form && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{errors.form}</p>}
      <Field label={t('Nom')} error={errors.name}>
        <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={t('Ex. Lire 10 pages')} />
      </Field>
      <Field label={t('Description (facultatif)')}>
        <textarea rows={2} value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-muted">{t('Icône')}</span>
        <div className="flex flex-wrap gap-1.5">
          {HABIT_ICON_CHOICES.map((i) => (
            <button key={i} type="button" aria-label={i} aria-pressed={icon === i} onClick={() => setIcon(i)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${icon === i ? 'border-accent bg-surface2' : 'border-line'}`} style={{ color: icon === i ? color : undefined }}>
              <HabitIcon name={i} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-muted">{t('Couleur')}</span>
        <div className="flex flex-wrap gap-2">
          {COLOR_CHOICES.map((c) => (
            <button key={c} type="button" aria-label={c} aria-pressed={color === c} onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full border-2 ${color === c ? 'border-ink' : 'border-transparent'}`} style={{ background: c }} />
          ))}
        </div>
      </div>
      <Field label={t('Catégorie')}>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">{t('Aucune')}</option>
          {[...categories].sort((a, b) => a.order - b.order).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-muted">{t('Type de suivi')}</span>
        <Segmented label={t('Type de suivi')} value={tracking} onChange={setTracking}
          options={[{ value: 'binary', label: t('Fait / pas fait') }, { value: 'quantity', label: t('Quantité') }, { value: 'duration', label: t('Durée') }]} />
      </div>
      {tracking !== 'binary' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={tracking === 'duration' ? t('Objectif (minutes)') : t('Objectif')} error={errors.target}>
            <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(',', '.'))} />
          </Field>
          {tracking === 'quantity' && <Field label={t('Unité')}><input value={unit} maxLength={20} placeholder={t('pages, L, reps…')} onChange={(e) => setUnit(e.target.value)} /></Field>}
        </div>
      )}

      <div>
        <span className="mb-1.5 block text-sm font-medium text-muted">{t('Fréquence')}</span>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={kind === 'daily'} onClick={() => setKind('daily')}>{t('Tous les jours')}</Chip>
          <Chip active={kind === 'weekdays'} onClick={() => setKind('weekdays')}>{t('Jours précis')}</Chip>
          <Chip active={kind === 'weekly_quota'} onClick={() => setKind('weekly_quota')}>{t('Quota par semaine')}</Chip>
          <Chip active={kind === 'dates'} onClick={() => setKind('dates')}>{t('Dates précises')}</Chip>
        </div>
        {kind === 'weekdays' && (
          <div className="mt-3 flex gap-1.5">
            {order.map((d) => (
              <button key={d} type="button" aria-pressed={weekdays.includes(d)}
                onClick={() => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))}
                className={`h-10 flex-1 rounded-xl border text-sm capitalize ${weekdays.includes(d) ? 'border-transparent bg-accent text-on-accent' : 'border-line bg-surface2 text-muted'}`}>
                {weekdayShort(d, locale).slice(0, 3)}
              </button>
            ))}
          </div>
        )}
        {kind === 'weekly_quota' && (
          <div className="mt-3 flex items-center gap-3">
            <input type="number" min={1} max={7} value={quota} onChange={(e) => setQuota(Number(e.target.value))} className="!w-20" aria-label={t('Fois par semaine')} />
            <span className="text-sm text-muted">{t('fois par semaine, quels que soient les jours')}</span>
          </div>
        )}
        {kind === 'dates' && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} aria-label={t('Ajouter une date')} />
              <Button onClick={() => { if (isValidDateStr(newDate) && !dates.includes(newDate)) setDates([...dates, newDate]); setNewDate('') }}>{t('Ajouter')}</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...dates].sort().map((d) => (
                <span key={d} className="inline-flex items-center gap-1 rounded-full bg-surface2 px-2.5 py-1 text-xs">
                  {d}
                  <button type="button" aria-label={t('Retirer')} onClick={() => setDates(dates.filter((x) => x !== d))}><X size={12} /></button>
                </span>
              ))}
            </div>
          </div>
        )}
        {errors.schedule && <p role="alert" className="mt-1 text-xs text-danger">{errors.schedule}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('Date de début')} error={errors.startDate}><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
        <Field label={t('Date de fin (facultatif)')} error={errors.endDate}><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
      </div>

      <Field label={t('Rappel (facultatif)')} hint={t('Rappel affiché quand Momentum est ouvert — voir Paramètres pour les limites.')}>
        <div className="flex gap-2">
          <input type="time" value={remTime} onChange={(e) => setRemTime(e.target.value)} />
          {remTime && <Button onClick={() => setRemTime('')}>{t('Retirer')}</Button>}
        </div>
      </Field>
      {remTime && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={remIfDone} onChange={(e) => setRemIfDone(e.target.checked)} />
          {t('Me rappeler même si l’habitude est déjà terminée')}
        </label>
      )}
    </Sheet>
  )
}
