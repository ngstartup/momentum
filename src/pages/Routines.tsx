import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useApp, uid } from '../store/app'
import { useT } from '../i18n'
import { useHabits, useLogIndex, useToday } from '../ui/hooks'
import type { Routine, RoutineLog, RoutinePeriod, RoutineStep } from '../domain/types'
import { addDays, eachDay, weekdayShort, weekdayOf } from '../domain/dates'
import { isDone, valueOn, type LogIndex } from '../domain/habits'
import { Button, Empty, Field, IconButton, PageHeader, Sheet, confirmDialog, toast } from '../ui/kit'

const PERIODS: RoutinePeriod[] = ['morning', 'afternoon', 'evening']

/** Une étape liée à une habitude est faite quand l'habitude l'est : une seule source de vérité, pas de double comptage. */
export function stepDone(step: RoutineStep, log: RoutineLog | undefined, date: string, idx: LogIndex, habits: { id: string; tracking: 'binary' | 'quantity' | 'duration'; target?: number }[]) {
  if (step.habitId) {
    const h = habits.find((x) => x.id === step.habitId)
    return h ? isDone(h as never, valueOn(idx, h.id, date)) : false
  }
  return log?.doneStepIds.includes(step.id) ?? false
}

export default function Routines() {
  const { t, locale } = useT()
  const today = useToday()
  const idx = useLogIndex()
  const { all } = useHabits()
  const { routines, routineLogs, saveItem, removeItem, toggleHabit } = useApp()
  const [editor, setEditor] = useState<{ open: boolean; routine?: Routine }>({ open: false })
  const periodName = (p: RoutinePeriod) => (p === 'morning' ? t('Matin') : p === 'afternoon' ? t('Après-midi') : t('Soir'))

  async function toggleStep(r: Routine, s: RoutineStep) {
    if (s.habitId) return void toggleHabit(s.habitId, today)
    const id = `${r.id}_${today}`
    const cur = routineLogs.find((l) => l.id === id)
    const set = new Set(cur?.doneStepIds ?? [])
    set.has(s.id) ? set.delete(s.id) : set.add(s.id)
    const allDone = r.steps.every((st) => (st.habitId ? stepDone(st, undefined, today, idx, all) : set.has(st.id)))
    await saveItem('routineLogs', { id, routineId: r.id, date: today, doneStepIds: [...set], completedAt: allDone ? Date.now() : undefined })
  }

  const completedOn = (r: Routine, d: string) => {
    const log = routineLogs.find((l) => l.id === `${r.id}_${d}`)
    return r.steps.length > 0 && r.steps.every((s) => stepDone(s, log, d, idx, all))
  }

  return (
    <div>
      <PageHeader title={t('Routines')} subtitle={t('Matin, après-midi, soir : des étapes ordonnées à cocher.')}
        actions={<Button variant="primary" small onClick={() => setEditor({ open: true })}><Plus size={16} />{t('Nouvelle')}</Button>} />
      {routines.length === 0 ? (
        <Empty title={t('Aucune routine')} text={t('Regroupez des habitudes existantes et des étapes libres. Une étape liée à une habitude est comptée une seule fois dans les statistiques.')}
          action={<Button variant="primary" onClick={() => setEditor({ open: true })}><Plus size={18} />{t('Créer une routine')}</Button>} />
      ) : PERIODS.map((p) => {
        const list = routines.filter((r) => r.period === p)
        if (!list.length) return null
        return (
          <section key={p} className="mb-6">
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">{periodName(p)}</h2>
            <ul className="space-y-3">
              {list.map((r) => {
                const log = routineLogs.find((l) => l.id === `${r.id}_${today}`)
                const doneCount = r.steps.filter((s) => stepDone(s, log, today, idx, all)).length
                const minutes = r.steps.reduce((a, s) => a + s.minutes, 0)
                const last7 = eachDay(addDays(today, -6), today)
                return (
                  <li key={r.id} className="card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div><h3 className="font-medium">{r.name}</h3><p className="text-xs text-muted">{doneCount}/{r.steps.length} · ~{minutes} min</p></div>
                      <div className="flex">
                        <IconButton label={t('Modifier')} onClick={() => setEditor({ open: true, routine: r })}><Pencil size={16} /></IconButton>
                        <IconButton label={t('Supprimer')} className="hover:!text-danger" onClick={async () => { if (await confirmDialog(t('Supprimer cette routine ?'), t('Son historique est supprimé ; les habitudes liées restent.'), t('Supprimer'))) await removeItem('routines', r.id) }}><Trash2 size={16} /></IconButton>
                      </div>
                    </div>
                    {r.steps.length === 0 ? <p className="mt-2 text-sm text-muted">{t('Aucune étape.')}</p> : (
                      <ul className="mt-3 space-y-1.5">
                        {r.steps.map((s) => {
                          const d = stepDone(s, log, today, idx, all)
                          const h = s.habitId ? all.find((x) => x.id === s.habitId) : undefined
                          return (
                            <li key={s.id}>
                              <button type="button" onClick={() => toggleStep(r, s)} aria-pressed={d} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface2">
                                <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${d ? 'border-transparent bg-green text-bg' : 'border-line'}`}>{d && <Check size={14} strokeWidth={3} />}</span>
                                <span className={`flex-1 text-sm ${d ? 'text-muted line-through' : ''}`}>{h ? h.name : s.title}{h && <span className="ml-1.5 text-[11px] text-muted">({t('habitude')})</span>}</span>
                                <span className="text-xs text-muted">{s.minutes} min</span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    <div className="mt-3 flex items-center gap-1" aria-label={t('Historique sur 7 jours')}>
                      {last7.map((d) => (
                        <span key={d} title={d} className="flex flex-col items-center text-[10px] text-muted">
                          <span className="mb-0.5 h-3 w-5 rounded" style={{ background: completedOn(r, d) ? 'var(--green)' : 'var(--surface2)' }} />
                          {weekdayShort(weekdayOf(d), locale).slice(0, 2)}
                        </span>
                      ))}
                      <span className="ml-2 text-xs text-muted">{last7.filter((d) => completedOn(r, d)).length}/7 {t('terminées')}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      <RoutineSheet key={editor.routine?.id ?? 'new'} open={editor.open} routine={editor.routine} onClose={() => setEditor({ open: false })} />
    </div>
  )
}

function RoutineSheet({ open, onClose, routine }: { open: boolean; onClose: () => void; routine?: Routine }) {
  const { t } = useT()
  const { active } = useHabits()
  const saveItem = useApp((s) => s.saveItem)
  const [name, setName] = useState(routine?.name ?? '')
  const [period, setPeriod] = useState<RoutinePeriod>(routine?.period ?? 'morning')
  const [steps, setSteps] = useState<RoutineStep[]>(routine?.steps ?? [])
  const [title, setTitle] = useState('')
  const [min, setMin] = useState('5')
  const [habit, setHabit] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const addStep = () => {
    const h = active.find((x) => x.id === habit)
    const label = h ? h.name : title.trim()
    const m = Number(min)
    if (!label) return setErr(t('Donnez un titre à l’étape ou choisissez une habitude.'))
    if (!(m >= 0)) return setErr(t('Durée invalide.'))
    if (h && steps.some((s) => s.habitId === h.id)) return setErr(t('Cette habitude est déjà dans la routine.'))
    setErr(null)
    setSteps([...steps, { id: uid(), title: label, minutes: m, habitId: h?.id }])
    setTitle(''); setHabit('')
  }
  const move = (i: number, d: -1 | 1) => { const s = [...steps]; const j = i + d; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; setSteps(s) }

  async function submit() {
    if (!name.trim()) return setErr(t('Le nom est obligatoire.'))
    await saveItem('routines', { id: routine?.id ?? uid(), name: name.trim(), period, steps, createdAt: routine?.createdAt ?? Date.now() })
    toast(t('Routine enregistrée.'))
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title={routine ? t('Modifier la routine') : t('Nouvelle routine')}
      footer={<><Button className="flex-1" onClick={onClose}>{t('Annuler')}</Button><Button variant="primary" className="flex-1" onClick={submit}>{t('Enregistrer')}</Button></>}>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <Field label={t('Nom')}><input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={t('Routine du matin')} /></Field>
      <Field label={t('Moment')}><select value={period} onChange={(e) => setPeriod(e.target.value as RoutinePeriod)}><option value="morning">{t('Matin')}</option><option value="afternoon">{t('Après-midi')}</option><option value="evening">{t('Soir')}</option></select></Field>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-muted">{t('Étapes')}</span>
        <ul className="space-y-1.5">
          {steps.map((s, i) => (
            <li key={s.id} className="flex items-center gap-1 rounded-xl bg-surface2 px-3 py-1.5 text-sm">
              <span className="flex-1 truncate">{s.title}{s.habitId && <span className="ml-1 text-[11px] text-muted">({t('habitude')})</span>}</span>
              <span className="text-xs text-muted">{s.minutes} min</span>
              <IconButton label={t('Monter')} className="!h-7 !w-7" onClick={() => move(i, -1)}><ArrowUp size={14} /></IconButton>
              <IconButton label={t('Descendre')} className="!h-7 !w-7" onClick={() => move(i, 1)}><ArrowDown size={14} /></IconButton>
              <IconButton label={t('Retirer')} className="!h-7 !w-7" onClick={() => setSteps(steps.filter((x) => x.id !== s.id))}><X size={14} /></IconButton>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-2 rounded-xl border border-line p-3">
          <select aria-label={t('Habitude existante')} value={habit} onChange={(e) => setHabit(e.target.value)}>
            <option value="">{t('— Étape libre —')}</option>
            {active.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <div className="flex gap-2">
            {!habit && <input aria-label={t('Titre de l’étape')} placeholder={t('Titre de l’étape')} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />}
            <input aria-label={t('Minutes')} inputMode="numeric" className="!w-20" value={min} onChange={(e) => setMin(e.target.value)} />
            <Button onClick={addStep}>{t('Ajouter')}</Button>
          </div>
        </div>
      </div>
    </Sheet>
  )
}
