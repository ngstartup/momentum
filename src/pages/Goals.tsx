import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useApp, uid } from '../store/app'
import { useT } from '../i18n'
import { useFmtDate, useHabits, useLogIndex, useToday, useWeekStart } from '../ui/hooks'
import { challengeProgress, goalProgress } from '../domain/goals'
import type { Challenge, Goal, GoalProgressRule } from '../domain/types'
import { addDays, isValidDateStr } from '../domain/dates'
import { Button, Empty, Field, IconButton, PageHeader, Progress, Segmented, Sheet, confirmDialog, toast } from '../ui/kit'

export default function Goals() {
  const { t } = useT()
  const today = useToday()
  const fmt = useFmtDate()
  const idx = useLogIndex()
  const weekStart = useWeekStart()
  const { all, active } = useHabits()
  const { goals, challenges, saveItem, removeItem } = useApp()
  const [goalForm, setGoalForm] = useState<{ open: boolean; goal?: Goal }>({ open: false })
  const [chForm, setChForm] = useState(false)
  const prefsGame = useApp((s) => s.prefs.gamification)

  return (
    <div>
      <PageHeader title={t('Objectifs')} subtitle={t('Vos ambitions à long terme, avec une règle de progression explicite.')}
        actions={<Button variant="primary" small onClick={() => setGoalForm({ open: true })}><Plus size={16} />{t('Nouveau')}</Button>} />
      {goals.length === 0 ? (
        <Empty title={t('Aucun objectif')} text={t('Exemples : lire douze livres, étudier régulièrement, 3 séances de sport par semaine. Choisissez comment la progression est mesurée.')}
          action={<Button variant="primary" onClick={() => setGoalForm({ open: true })}><Plus size={18} />{t('Créer un objectif')}</Button>} />
      ) : (
        <ul className="space-y-3">
          {[...goals].sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.priority] - ({ high: 0, medium: 1, low: 2 })[b.priority]).map((g) => {
            const p = goalProgress(g, all, idx, today, weekStart)
            return (
              <li key={g.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium">{g.title}</h3>
                    <p className="text-xs text-muted">
                      {t(g.priority === 'high' ? 'Priorité haute' : g.priority === 'medium' ? 'Priorité moyenne' : 'Priorité basse')} · {t(g.status === 'active' ? 'En cours' : g.status === 'done' ? 'Atteint' : 'En pause')}
                      {g.deadline && ` · ${t('échéance')} ${fmt(g.deadline)}`}
                    </p>
                  </div>
                  <div className="flex">
                    <IconButton label={t('Modifier')} onClick={() => setGoalForm({ open: true, goal: g })}><Pencil size={16} /></IconButton>
                    <IconButton label={t('Supprimer')} className="hover:!text-danger" onClick={async () => { if (await confirmDialog(t('Supprimer cet objectif ?'), t('Les habitudes liées ne sont pas supprimées.'), t('Supprimer'))) await removeItem('goals', g.id) }}><Trash2 size={16} /></IconButton>
                  </div>
                </div>
                {g.description && <p className="mt-1 text-sm text-muted">{g.description}</p>}
                <div className="mt-3"><Progress ratio={p.ratio ?? 0} /></div>
                <p className="mt-1.5 text-xs text-muted">
                  {p.ratio === null ? t('Progression non calculable : aucune occurrence prévue pour les habitudes liées.') : `${Math.round(p.ratio * 100)} %`}
                  {g.rule.kind === 'manual' && ` · ${p.current}/${p.target} ${g.rule.unit ?? ''}`}
                  {g.rule.kind === 'completions' && ` · ${t('{n} validations sur {m}', { n: p.current, m: p.target ?? 0 })}`}
                  {g.rule.kind === 'rate' && p.target ? ` · ${p.current}/${p.target} ${t('occurrences')}` : ''}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">{g.rule.kind === 'manual' ? t('Règle : valeur saisie à la main.') : g.rule.kind === 'completions' ? t('Règle : validations des habitudes liées depuis la création.') : t('Règle : taux de réussite des habitudes liées depuis la création.')}</p>
                {g.rule.kind === 'manual' && (
                  <div className="mt-2 flex items-center gap-2">
                    <Button small onClick={() => saveItem('goals', { ...g, rule: { ...g.rule, current: Math.max(0, (g.rule as { current: number }).current - 1) } as GoalProgressRule })}>−1</Button>
                    <Button small onClick={() => saveItem('goals', { ...g, rule: { ...g.rule, current: (g.rule as { current: number }).current + 1 } as GoalProgressRule })}>+1</Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {prefsGame && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('Défis personnels')}</h2>
            <Button small onClick={() => setChForm(true)}><Plus size={16} />{t('Défi')}</Button>
          </div>
          {challenges.length === 0 ? <p className="card p-4 text-sm text-muted">{t('Aucun défi. Fixez-vous un nombre de validations sur une période, à votre rythme.')}</p> : (
            <ul className="space-y-3">
              {challenges.map((c) => {
                const p = challengeProgress(c, all, idx, today)
                return (
                  <li key={c.id} className="card p-4">
                    <div className="flex items-start justify-between">
                      <div><h3 className="font-medium">{c.title}</h3>
                        <p className="text-xs text-muted">{fmt(c.startDate)} → {fmt(c.endDate)} · {c.habitId ? all.find((h) => h.id === c.habitId)?.name : t('Toutes les habitudes')}</p></div>
                      <IconButton label={t('Supprimer')} className="hover:!text-danger" onClick={async () => { if (await confirmDialog(t('Supprimer ce défi ?'), undefined, t('Supprimer'))) await removeItem('challenges', c.id) }}><Trash2 size={16} /></IconButton>
                    </div>
                    <div className="mt-3"><Progress ratio={p.ratio ?? 0} /></div>
                    <p className="mt-1.5 text-xs text-muted">{p.current}/{p.target} {t('validations')}{p.over ? ` · ${p.ratio === 1 ? t('relevé !') : t('terminé')}` : ''}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      <GoalSheet key={goalForm.goal?.id ?? 'new'} open={goalForm.open} goal={goalForm.goal} onClose={() => setGoalForm({ open: false })} habits={active} today={today} save={saveItem} />
      <ChallengeSheet open={chForm} onClose={() => setChForm(false)} habits={active} today={today} save={saveItem} />
    </div>
  )
}

function GoalSheet({ open, onClose, goal, habits, today, save }: { open: boolean; onClose: () => void; goal?: Goal; habits: { id: string; name: string }[]; today: string; save: (s: 'goals', g: Goal) => Promise<void> }) {
  const { t } = useT()
  const [title, setTitle] = useState(goal?.title ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [priority, setPriority] = useState<Goal['priority']>(goal?.priority ?? 'medium')
  const [status, setStatus] = useState<Goal['status']>(goal?.status ?? 'active')
  const [habitIds, setHabitIds] = useState<string[]>(goal?.habitIds ?? [])
  const [kind, setKind] = useState<GoalProgressRule['kind']>(goal?.rule.kind ?? 'manual')
  const [target, setTarget] = useState(String(goal ? ((goal.rule as { target?: number }).target ?? '') : ''))
  const [unit, setUnit] = useState(goal?.rule.kind === 'manual' ? goal.rule.unit ?? '' : '')
  const [err, setErr] = useState<Record<string, string>>({})

  async function submit() {
    const e: Record<string, string> = {}
    if (!title.trim()) e.title = t('Le titre est obligatoire.')
    if (kind !== 'rate' && !(Number(target) > 0)) e.target = t('Indiquez une cible supérieure à 0.')
    if (kind !== 'manual' && habitIds.length === 0) e.habits = t('Liez au moins une habitude pour cette règle.')
    if (deadline && !isValidDateStr(deadline)) e.deadline = t('Date invalide.')
    setErr(e)
    if (Object.keys(e).length) return
    const rule: GoalProgressRule = kind === 'manual' ? { kind, current: goal?.rule.kind === 'manual' ? goal.rule.current : 0, target: Number(target), unit: unit.trim() || undefined } : kind === 'completions' ? { kind, target: Number(target) } : { kind }
    await save('goals', { id: goal?.id ?? uid(), title: title.trim(), description: description.trim() || undefined, deadline: deadline || null, priority, status, habitIds, rule, createdAt: goal?.createdAt ?? Date.now(), createdDate: goal?.createdDate ?? today })
    toast(t('Objectif enregistré.'))
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title={goal ? t('Modifier l’objectif') : t('Nouvel objectif')}
      footer={<><Button className="flex-1" onClick={onClose}>{t('Annuler')}</Button><Button variant="primary" className="flex-1" onClick={submit}>{t('Enregistrer')}</Button></>}>
      <Field label={t('Titre')} error={err.title}><input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder={t('Ex. Lire douze livres')} /></Field>
      <Field label={t('Description (facultatif)')}><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('Échéance (facultatif)')} error={err.deadline}><input type="date" min={addDays(today, 0)} value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
        <Field label={t('Priorité')}><select value={priority} onChange={(e) => setPriority(e.target.value as Goal['priority'])}><option value="high">{t('Haute')}</option><option value="medium">{t('Moyenne')}</option><option value="low">{t('Basse')}</option></select></Field>
      </div>
      <Field label={t('Statut')}><select value={status} onChange={(e) => setStatus(e.target.value as Goal['status'])}><option value="active">{t('En cours')}</option><option value="paused">{t('En pause')}</option><option value="done">{t('Atteint')}</option></select></Field>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-muted">{t('Comment mesurer la progression ?')}</span>
        <Segmented label={t('Règle')} value={kind} onChange={setKind} options={[{ value: 'manual', label: t('À la main') }, { value: 'completions', label: t('Validations') }, { value: 'rate', label: t('Taux') }]} />
      </div>
      {kind !== 'rate' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={kind === 'manual' ? t('Cible') : t('Validations visées')} error={err.target}><input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(',', '.'))} /></Field>
          {kind === 'manual' && <Field label={t('Unité')}><input value={unit} maxLength={20} onChange={(e) => setUnit(e.target.value)} placeholder={t('livres')} /></Field>}
        </div>
      )}
      <div>
        <span className="mb-1.5 block text-sm font-medium text-muted">{t('Habitudes associées')}</span>
        {habits.length === 0 ? <p className="text-sm text-muted">{t('Aucune habitude active.')}</p> : (
          <div className="space-y-1">{habits.map((h) => (
            <label key={h.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={habitIds.includes(h.id)} onChange={() => setHabitIds((l) => (l.includes(h.id) ? l.filter((x) => x !== h.id) : [...l, h.id]))} />{h.name}</label>
          ))}</div>
        )}
        {err.habits && <p role="alert" className="mt-1 text-xs text-danger">{err.habits}</p>}
      </div>
    </Sheet>
  )
}

function ChallengeSheet({ open, onClose, habits, today, save }: { open: boolean; onClose: () => void; habits: { id: string; name: string }[]; today: string; save: (s: 'challenges', c: Challenge) => Promise<void> }) {
  const { t } = useT()
  const [title, setTitle] = useState('')
  const [habitId, setHabitId] = useState('')
  const [target, setTarget] = useState('10')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(addDays(today, 29))
  const [err, setErr] = useState<Record<string, string>>({})
  async function submit() {
    const e: Record<string, string> = {}
    if (!title.trim()) e.title = t('Le titre est obligatoire.')
    if (!(Number(target) >= 1)) e.target = t('Indiquez au moins 1 validation.')
    if (!isValidDateStr(from) || !isValidDateStr(to) || to < from) e.dates = t('La fin doit suivre le début.')
    setErr(e)
    if (Object.keys(e).length) return
    await save('challenges', { id: uid(), title: title.trim(), habitId: habitId || null, target: Math.floor(Number(target)), startDate: from, endDate: to, createdAt: Date.now() })
    setTitle('')
    toast(t('Défi créé.'))
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('Nouveau défi')} footer={<><Button className="flex-1" onClick={onClose}>{t('Annuler')}</Button><Button variant="primary" className="flex-1" onClick={submit}>{t('Créer')}</Button></>}>
      <Field label={t('Titre')} error={err.title}><input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={t('Ex. 20 séances en 30 jours')} /></Field>
      <Field label={t('Habitude concernée')}><select value={habitId} onChange={(e) => setHabitId(e.target.value)}><option value="">{t('Toutes les habitudes')}</option>{habits.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
      <Field label={t('Validations visées')} error={err.target}><input inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('Du')} error={err.dates}><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label={t('Au')}><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
    </Sheet>
  )
}
