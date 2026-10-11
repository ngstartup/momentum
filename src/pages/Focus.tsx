import { useEffect, useState } from 'react'
import { Pause, Play, Square, Trash2 } from 'lucide-react'
import { create } from 'zustand'
import { useApp, uid } from '../store/app'
import { useT } from '../i18n'
import { useFmtDate, useHabits, useToday } from '../ui/hooks'
import { Button, Empty, Field, IconButton, PageHeader, Ring, Segmented, confirmDialog, toast } from '../ui/kit'

type Mode = 'focus' | 'short' | 'long'
interface Run {
  mode: Mode
  plannedSec: number
  /** ms accumulées avant le segment en cours */
  accMs: number
  /** début du segment en cours (ms epoch) ou null si en pause */
  startedAt: number | null
  habitId: string | null
  label: string
  /** dernier signe de vie : détecte une fermeture de l'app pendant la session */
  lastSeen: number
}

const KEY = 'momentum.focus.run'
const STALE_MS = 30_000

function load(): Run | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Run | null
    if (!r) return null
    if (r.startedAt !== null && Date.now() - r.lastSeen > STALE_MS) {
      // l'app a été fermée : la session est interrompue, jamais « terminée » automatiquement
      return { ...r, accMs: r.accMs + Math.max(0, r.lastSeen - r.startedAt), startedAt: null }
    }
    return r
  } catch { return null }
}
function persist(r: Run | null) {
  try { r ? localStorage.setItem(KEY, JSON.stringify(r)) : localStorage.removeItem(KEY) } catch { /* ignore */ }
}

const useRun = create<{ run: Run | null; set: (r: Run | null) => void }>((set) => ({ run: load(), set: (run) => { persist(run); set({ run }) } }))

const elapsedMs = (r: Run, now: number) => r.accMs + (r.startedAt !== null ? now - r.startedAt : 0)
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function Focus() {
  const { t } = useT()
  const today = useToday()
  const fmt = useFmtDate()
  const { prefs, focusSessions, saveItem, removeItem } = useApp()
  const { active } = useHabits()
  const { run, set } = useRun()
  const [now, setNow] = useState(Date.now())
  const [mode, setMode] = useState<Mode>('focus')
  const [minutes, setMinutes] = useState('')
  const [habitId, setHabitId] = useState('')
  const [label, setLabel] = useState('')

  const defaults = { focus: prefs.focusMinutes, short: prefs.shortBreakMinutes, long: prefs.longBreakMinutes }
  const running = run?.startedAt != null

  useEffect(() => {
    const tick = () => {
      const n = Date.now()
      setNow(n)
      const r = useRun.getState().run
      if (r && r.startedAt !== null) {
        if (elapsedMs(r, n) >= r.plannedSec * 1000) void finish(r, true)
        else persist({ ...r, lastSeen: n })
      }
    }
    const id = setInterval(tick, 500)
    document.addEventListener('visibilitychange', tick) // au retour au premier plan, on recalcule depuis les horodatages
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function finish(r: Run, completed: boolean) {
    set(null)
    if (r.mode !== 'focus') { toast(t('Pause terminée.')); return }
    const sec = completed ? r.plannedSec : Math.floor(elapsedMs(r, Date.now()) / 1000)
    if (sec < 1) return
    await saveItem('focusSessions', { id: uid(), date: today, startedAt: Date.now() - sec * 1000, seconds: sec, plannedSeconds: r.plannedSec, completed, habitId: r.habitId ?? undefined, label: r.label || undefined })
    toast(completed ? t('Session terminée : bravo !') : t('Session partielle enregistrée.'))
    if (completed && prefs.notifications && 'Notification' in window && Notification.permission === 'granted') { try { new Notification('Momentum', { body: t('Session de concentration terminée.') }) } catch { /* ignore */ } }
  }

  function start() {
    const m = Number(minutes || defaults[mode])
    if (!(m > 0 && m <= 600)) return toast(t('Durée invalide (1 à 600 minutes).'))
    set({ mode, plannedSec: Math.round(m * 60), accMs: 0, startedAt: Date.now(), habitId: habitId || null, label: label.trim(), lastSeen: Date.now() })
  }
  const pause = () => run && set({ ...run, accMs: elapsedMs(run, Date.now()), startedAt: null })
  const resume = () => run && set({ ...run, startedAt: Date.now(), lastSeen: Date.now() })
  async function stop() {
    if (!run) return
    const el = Math.floor(elapsedMs(run, Date.now()) / 1000)
    if (run.mode === 'focus' && el >= 1) {
      // l'utilisateur choisit : enregistrer la session partielle ou l'abandonner
      const keep = await confirmDialog(t('Arrêter la session ?'), t('{m} min {s} s effectuées. Enregistrer cette session partielle ? (Elle ne sera pas comptée comme terminée.)', { m: Math.floor(el / 60), s: el % 60 }), t('Enregistrer et arrêter'))
      if (keep) return void finish(run, false)
      set(null)
      toast(t('Session abandonnée, rien n’a été enregistré.'))
      return
    }
    set(null)
  }

  const remaining = run ? Math.max(0, run.plannedSec - elapsedMs(run, now) / 1000) : 0
  const ratio = run ? Math.min(1, elapsedMs(run, now) / 1000 / run.plannedSec) : 0
  const todaySec = focusSessions.filter((s) => s.date === today).reduce((a, s) => a + s.seconds, 0)
  const totalSec = focusSessions.reduce((a, s) => a + s.seconds, 0)
  const hm = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : `${Math.floor(s / 60)} min`)

  return (
    <div>
      <PageHeader title={t('Concentration')} subtitle={t('Minuteur de type Pomodoro. Une session interrompue n’est jamais comptée comme terminée.')} />
      <section className="card mb-4 flex flex-col items-center gap-5 p-6">
        {run ? (
          <>
            <Ring ratio={ratio} size={200} stroke={12}>
              <span className="text-4xl font-semibold tabular-nums" role="timer" aria-live="off">{mmss(remaining)}</span>
              <span className="text-xs text-muted">{run.mode === 'focus' ? t('Concentration') : run.mode === 'short' ? t('Pause courte') : t('Pause longue')}{!running && ` · ${t('en pause')}`}</span>
            </Ring>
            {(run.habitId || run.label) && <p className="text-sm text-muted">{run.habitId ? active.find((h) => h.id === run.habitId)?.name : ''} {run.label}</p>}
            <div className="flex gap-2">
              {running ? <Button onClick={pause}><Pause size={18} />{t('Pause')}</Button> : <Button variant="primary" onClick={resume}><Play size={18} />{t('Reprendre')}</Button>}
              <Button variant="danger" onClick={stop}><Square size={16} />{t('Arrêter')}</Button>
            </div>
          </>
        ) : (
          <>
            <Segmented label={t('Type')} value={mode} onChange={(m) => { setMode(m); setMinutes('') }} options={[{ value: 'focus', label: t('Concentration') }, { value: 'short', label: t('Pause courte') }, { value: 'long', label: t('Pause longue') }]} />
            <Ring ratio={0} size={200} stroke={12}><span className="text-4xl font-semibold tabular-nums">{mmss(Number(minutes || defaults[mode]) * 60 || 0)}</span></Ring>
            <div className="grid w-full max-w-sm grid-cols-2 gap-3">
              <Field label={t('Minutes')}><input inputMode="numeric" value={minutes} placeholder={String(defaults[mode])} onChange={(e) => setMinutes(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
              {mode === 'focus' && <Field label={t('Habitude (facultatif)')}><select value={habitId} onChange={(e) => setHabitId(e.target.value)}><option value="">—</option>{active.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>}
              {mode === 'focus' && <div className="col-span-2"><Field label={t('Projet / libellé (facultatif)')}><input value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} /></Field></div>}
            </div>
            <Button variant="primary" onClick={start}><Play size={18} />{t('Démarrer')}</Button>
          </>
        )}
      </section>

      <section className="mb-4 grid grid-cols-2 gap-2.5">
        <div className="card p-3"><p className="text-xs text-muted">{t('Aujourd’hui')}</p><p className="text-lg font-semibold">{hm(todaySec)}</p></div>
        <div className="card p-3"><p className="text-xs text-muted">{t('Temps total')}</p><p className="text-lg font-semibold">{hm(totalSec)}</p></div>
      </section>

      <h2 className="mb-2 font-medium">{t('Historique')}</h2>
      {focusSessions.length === 0 ? <Empty title={t('Aucune session')} text={t('Vos sessions de concentration apparaîtront ici.')} /> : (
        <ul className="space-y-2">
          {[...focusSessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 30).map((s) => (
            <li key={s.id} className="card flex items-center justify-between p-3 text-sm">
              <div><p>{fmt(s.date)} · {hm(s.seconds)} <span className="text-xs text-muted">{s.completed ? t('terminée') : t('partielle')}</span></p>
                <p className="text-xs text-muted">{[active.find((h) => h.id === s.habitId)?.name, s.label].filter(Boolean).join(' · ')}</p></div>
              <IconButton label={t('Supprimer')} className="hover:!text-danger" onClick={async () => { if (await confirmDialog(t('Supprimer cette session ?'), undefined, t('Supprimer'))) await removeItem('focusSessions', s.id) }}><Trash2 size={16} /></IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
