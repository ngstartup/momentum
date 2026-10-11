import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { useFmtDate, useHabits, useLogIndex, useToday } from '../ui/hooks'
import { addDays, isValidDateStr, longDate } from '../domain/dates'
import { dayScore } from '../domain/stats'
import type { DailyJournal } from '../domain/types'
import { Button, Field, IconButton, PageHeader, toast } from '../ui/kit'

const FACES = ['😞', '😕', '😐', '🙂', '😄']

export default function Journal() {
  const { t, locale } = useT()
  const today = useToday()
  const fmt = useFmtDate()
  const [params, setParams] = useSearchParams()
  const q = params.get('d')
  const date = q && isValidDateStr(q) && q <= today ? q : today
  const { journal, saveItem, removeItem } = useApp()
  const idx = useLogIndex()
  const { active } = useHabits()
  const entry = journal.find((j) => j.id === date)
  const [draft, setDraft] = useState<Partial<DailyJournal>>({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => { setDraft(entry ?? {}); setDirty(false) }, [date, entry?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof DailyJournal>(k: K, v: DailyJournal[K] | undefined) => { setDraft((d) => ({ ...d, [k]: v })); setDirty(true) }
  const s = dayScore(active, idx, date)
  const go = (d: string) => setParams(d === today ? {} : { d })
  const isEmpty = !draft.mood && !draft.energy && !draft.win?.trim() && !draft.difficulty?.trim() && !draft.note?.trim() && !draft.tomorrow?.trim()

  async function save() {
    if (isEmpty) { if (entry) await removeItem('journal', entry.id); setDirty(false); return toast(t('Entrée vide : rien à enregistrer.')) }
    await saveItem('journal', { id: date, date, mood: draft.mood, energy: draft.energy, win: draft.win?.trim() || undefined, difficulty: draft.difficulty?.trim() || undefined, note: draft.note?.trim() || undefined, tomorrow: draft.tomorrow?.trim() || undefined, updatedAt: Date.now() })
    setDirty(false)
    toast(t('Journal enregistré.'))
  }
  const recent = [...journal].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)

  const scale = (k: 'mood' | 'energy', label: string, faces?: boolean) => (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-muted">{label} <span className="font-normal">({t('facultatif')})</span></span>
      <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={draft[k] === n} onClick={() => set(k, draft[k] === n ? undefined : (n as 1))}
            className={`h-11 flex-1 rounded-xl border text-lg ${draft[k] === n ? 'border-accent bg-surface2' : 'border-line'}`}>{faces ? FACES[n - 1] : n}</button>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <PageHeader title={t('Journal')} subtitle={t('Privé, stocké uniquement sur cet appareil. Jamais obligatoire.')} />
      <div className="mb-4 flex items-center justify-between">
        <IconButton label={t('Jour précédent')} onClick={() => go(addDays(date, -1))}><ChevronLeft size={20} /></IconButton>
        <div className="text-center"><p className="font-medium first-letter:uppercase">{longDate(date, locale)}</p>
          <p className="text-xs text-muted">{s.planned > 0 ? t('{d} sur {p} habitudes terminées', { d: s.done, p: s.planned }) : t('Aucune habitude prévue')}</p></div>
        <IconButton label={t('Jour suivant')} disabled={date >= today} onClick={() => go(addDays(date, 1))}><ChevronRight size={20} /></IconButton>
      </div>

      <div className="card space-y-4 p-4">
        {scale('mood', t('Humeur'), true)}
        {scale('energy', t('Énergie'))}
        <Field label={t('Meilleure réussite du jour')}><input value={draft.win ?? ''} maxLength={200} onChange={(e) => set('win', e.target.value)} /></Field>
        <Field label={t('Difficulté principale')}><input value={draft.difficulty ?? ''} maxLength={200} onChange={(e) => set('difficulty', e.target.value)} /></Field>
        <Field label={t('Note libre')}><textarea rows={5} value={draft.note ?? ''} onChange={(e) => set('note', e.target.value)} /></Field>
        <Field label={t('Intention pour demain')}><input value={draft.tomorrow ?? ''} maxLength={200} onChange={(e) => set('tomorrow', e.target.value)} /></Field>
        <div className="flex items-center gap-3">
          <Button variant="primary" disabled={!dirty} onClick={save}>{t('Enregistrer')}</Button>
          {dirty && <span className="text-xs text-muted">{t('Modifications non enregistrées')}</span>}
        </div>
      </div>

      {recent.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-medium">{t('Entrées récentes')}</h2>
          <ul className="space-y-2">
            {recent.map((j) => (
              <li key={j.id}><button type="button" onClick={() => go(j.date)} className="card w-full p-3 text-left text-sm hover:brightness-110">
                <span className="font-medium">{fmt(j.date)} {j.mood ? FACES[j.mood - 1] : ''}</span>
                <span className="mt-0.5 block truncate text-muted">{j.note || j.win || j.difficulty || j.tomorrow || '—'}</span>
              </button></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
