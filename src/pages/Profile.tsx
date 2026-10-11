import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, BookHeart, Download, ListChecks, Pencil, Plus, Search, Target, Timer, Trash2, Upload } from 'lucide-react'
import { useApp, uid } from '../store/app'
import { useT } from '../i18n'
import { useHabits, useLogIndex, useToday, useWeekStart } from '../ui/hooks'
import { logsToCsv, parseBackup } from '../domain/backup'
import { BADGES, computeGame } from '../domain/gamification'
import { weekdayShort } from '../domain/dates'
import type { Category, DateFormat, UserPreferences } from '../domain/types'
import { Button, Field, IconButton, Segmented, Sheet, confirmDialog, toast } from '../ui/kit'
import { COLOR_CHOICES } from '../ui/icons'

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function Profile() {
  const { t, locale } = useT()
  const s = useApp()
  const { prefs, setPrefs } = s
  const { all } = useHabits()
  const idx = useLogIndex()
  const today = useToday()
  const weekStart = useWeekStart()
  const [catEdit, setCatEdit] = useState<{ open: boolean; cat?: Category }>({ open: false })
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const game = useMemo(() => computeGame(all, idx, s.focusSessions, s.journal, today, weekStart), [all, idx, s.focusSessions, s.journal, today, weekStart])
  const set = (p: Partial<UserPreferences>) => void setPrefs(p)
  const cats = [...s.categories].sort((a, b) => a.order - b.order)

  async function toggleNotifications(on: boolean) {
    if (!on) return set({ notifications: false })
    if (!('Notification' in window)) { toast(t('Les notifications système ne sont pas disponibles ici : les rappels s’afficheront dans l’application.')); return set({ notifications: true }) }
    if (Notification.permission === 'default') await Notification.requestPermission()
    if (Notification.permission === 'denied') toast(t('Notifications système refusées : les rappels s’afficheront dans l’application ouverte.'))
    set({ notifications: true })
  }

  async function onFile(f: File | undefined) {
    if (!f) return
    setImporting(true)
    try {
      const text = await f.text()
      const res = parseBackup(text) // validation avant toute modification
      if (!res.ok || !res.backup) {
        await confirmDialog(t('Fichier refusé'), res.errors.join('\n'), t('OK'))
        return
      }
      const d = res.backup.data
      const ok = await confirmDialog(t('Restaurer cette sauvegarde ?'),
        t('Elle contient {h} habitudes et {l} entrées. Vos données actuelles seront REMPLACÉES. Conseil : exportez-les d’abord.', { h: d.habits.length, l: d.logs.length }) + (res.warnings.length ? `\n${res.warnings.join(' ')}` : ''), t('Remplacer mes données'))
      if (!ok) return
      const r = await s.restoreBackup(text)
      toast(r.ok ? t('Sauvegarde restaurée.') : r.errors[0])
    } finally { setImporting(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function erase() {
    if (!(await confirmDialog(t('Tout effacer ?'), t('Toutes vos habitudes, historiques, objectifs, journaux et réglages seront supprimés de cet appareil. Irréversible sans sauvegarde.'), t('Continuer')))) return
    if (!(await confirmDialog(t('Dernière confirmation'), t('Confirmez-vous la suppression définitive de toutes vos données ?'), t('Tout effacer')))) return
    await s.eraseAll(); toast(t('Données effacées.'))
  }

  async function moveCat(id: string, d: -1 | 1) {
    const ids = cats.map((c) => c.id); const i = ids.indexOf(id); const j = i + d
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    await s.reorderCategories(ids)
  }

  async function removeCat(c: Category) {
    const count = all.filter((h) => h.categoryId === c.id).length
    const ok = await confirmDialog(t('Supprimer la catégorie « {name} » ?', { name: c.name }), count ? t('{n} habitude(s) seront conservées et deviendront « sans catégorie ».', { n: count }) : undefined, t('Supprimer'))
    if (ok) await s.deleteCategory(c.id, null)
  }

  const section = 'card mb-4 space-y-4 p-4'
  const h2 = 'text-lg font-semibold'

  return (
    <div>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">{t('Profil et paramètres')}</h1>

      <nav className="mb-4 grid grid-cols-4 gap-2" aria-label={t('Espaces')}>
        {[[Target, t('Objectifs'), '/goals'], [ListChecks, t('Routines'), '/routines'], [BookHeart, t('Journal'), '/journal'], [Timer, t('Focus'), '/focus']].map(([I, l, to]) => {
          const Icon = I as typeof Target
          return <Link key={to as string} to={to as string} className="card flex flex-col items-center gap-1 py-3 text-xs text-muted hover:text-ink"><Icon size={20} />{l as string}</Link>
        })}
      </nav>
      <Link to="/search" className="card mb-4 flex items-center gap-2 p-3 text-sm text-muted"><Search size={16} />{t('Rechercher dans Momentum')}</Link>

      {prefs.gamification && (
        <section className={section} aria-label={t('Progression')}>
          <h2 className={h2}>{t('Niveau {n}', { n: game.level })}</h2>
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted"><span>{game.points} {t('points')}</span><span>{game.nextAt} {t('pour le niveau suivant')}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-accent" style={{ width: `${((game.points - game.levelFloor) / (game.nextAt - game.levelFloor)) * 100}%` }} /></div>
            <p className="mt-1 text-xs text-muted">{t('10 points par occurrence réellement terminée. Rien d’autre ne rapporte de points.')}</p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted">{t('Badges')}</h3>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BADGES.map((b) => {
                const got = game.earned.includes(b.id)
                return <li key={b.id} className={`rounded-xl border border-line p-2.5 text-sm ${got ? '' : 'opacity-50'}`}><b>{got ? '🏅 ' : '🔒 '}{t(b.label)}</b><span className="block text-xs text-muted">{t(b.desc)}</span></li>
              })}
            </ul>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-medium text-muted">{t('Records personnels')}</h3>
            <ul className="space-y-0.5 text-sm">
              <li>{t('Meilleure série')} : {game.records.bestStreak ? `${game.records.bestStreak.n} ${game.records.bestStreak.unit === 'week' ? t('semaines') : t('jours')} (${game.records.bestStreak.name})` : '—'}</li>
              <li>{t('Plus de validations en un jour')} : {game.records.bestDay ? `${game.records.bestDay.n} (${game.records.bestDay.date})` : '—'}</li>
              <li>{t('Plus longue session de concentration')} : {game.records.longestFocus ? `${Math.round(game.records.longestFocus / 60)} min` : '—'}</li>
            </ul>
          </div>
        </section>
      )}

      <section className={section}>
        <h2 className={h2}>{t('Préférences')}</h2>
        <Field label={t('Nom d’affichage')}><input value={prefs.displayName} maxLength={40} onChange={(e) => set({ displayName: e.target.value })} /></Field>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div><span className="mb-1.5 block text-sm font-medium text-muted">{t('Thème')}</span><Segmented label={t('Thème')} value={prefs.theme} onChange={(theme) => set({ theme })} options={[{ value: 'dark', label: t('Sombre') }, { value: 'light', label: t('Clair') }]} /></div>
          <div><span className="mb-1.5 block text-sm font-medium text-muted">{t('Langue')}</span><Segmented label={t('Langue')} value={prefs.lang} onChange={(lang) => set({ lang })} options={[{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]} /></div>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-muted">{t('Couleur d’accent')}</span>
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_CHOICES.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={prefs.accent === c} onClick={() => set({ accent: c })} className={`h-8 w-8 rounded-full border-2 ${prefs.accent === c ? 'border-ink' : 'border-transparent'}`} style={{ background: c }} />)}
            <input type="color" aria-label={t('Couleur personnalisée')} className="!w-12" value={prefs.accent} onChange={(e) => set({ accent: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('Format de date')}><select value={prefs.dateFormat} onChange={(e) => set({ dateFormat: e.target.value as DateFormat })}><option value="dmy">31/12/2026</option><option value="mdy">12/31/2026</option><option value="iso">2026-12-31</option></select></Field>
          <Field label={t('Premier jour de la semaine')}><select value={prefs.weekStart} onChange={(e) => set({ weekStart: Number(e.target.value) as 0 | 1 | 6 })}>{[1, 0, 6].map((d) => <option key={d} value={d}>{weekdayShort(d, locale)}</option>)}</select></Field>
        </div>
        <Field label={t('Page de démarrage')}><select value={prefs.startPage} onChange={(e) => set({ startPage: e.target.value as UserPreferences['startPage'] })}><option value="today">{t('Aujourd’hui')}</option><option value="habits">{t('Habitudes')}</option><option value="calendar">{t('Calendrier')}</option><option value="stats">{t('Statistiques')}</option></select></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('Focus (min)')}><input inputMode="numeric" value={prefs.focusMinutes} onChange={(e) => { const n = Number(e.target.value); if (n >= 1 && n <= 180) set({ focusMinutes: n }) }} /></Field>
          <Field label={t('Pause courte')}><input inputMode="numeric" value={prefs.shortBreakMinutes} onChange={(e) => { const n = Number(e.target.value); if (n >= 1 && n <= 60) set({ shortBreakMinutes: n }) }} /></Field>
          <Field label={t('Pause longue')}><input inputMode="numeric" value={prefs.longBreakMinutes} onChange={(e) => { const n = Number(e.target.value); if (n >= 1 && n <= 120) set({ longBreakMinutes: n }) }} /></Field>
        </div>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={prefs.gamification} onChange={(e) => set({ gamification: e.target.checked })} /><span><b>{t('Gamification')}</b><span className="block text-xs text-muted">{t('Points, niveaux, badges, défis. Désactivable à tout moment ; rien n’est perdu.')}</span></span></label>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={prefs.notifications} onChange={(e) => toggleNotifications(e.target.checked)} /><span><b>{t('Rappels')}</b>
          <span className="block text-xs text-muted">{t('Limite réelle : une application web ne peut pas garantir de notification lorsqu’elle est fermée. Les rappels se déclenchent tant que Momentum est ouvert (onglet ou application installée en arrière-plan), au plus une fois par jour et par rappel, et jamais pour une habitude déjà terminée (sauf choix contraire).')}</span></span></label>
      </section>

      <section className={section}>
        <div className="flex items-center justify-between"><h2 className={h2}>{t('Catégories')}</h2><Button small onClick={() => setCatEdit({ open: true })}><Plus size={16} />{t('Ajouter')}</Button></div>
        {cats.length === 0 ? <p className="text-sm text-muted">{t('Aucune catégorie.')}</p> : (
          <ul className="space-y-1.5">
            {cats.map((c, i) => (
              <li key={c.id} className="flex items-center gap-2 rounded-xl bg-surface2 px-3 py-1.5 text-sm">
                <span className="h-3 w-3 rounded-full" style={{ background: c.color }} /><span className="flex-1 truncate">{c.name}</span>
                <IconButton label={t('Monter')} className="!h-8 !w-8" disabled={i === 0} onClick={() => moveCat(c.id, -1)}><ArrowUp size={14} /></IconButton>
                <IconButton label={t('Descendre')} className="!h-8 !w-8" disabled={i === cats.length - 1} onClick={() => moveCat(c.id, 1)}><ArrowDown size={14} /></IconButton>
                <IconButton label={t('Modifier')} className="!h-8 !w-8" onClick={() => setCatEdit({ open: true, cat: c })}><Pencil size={14} /></IconButton>
                <IconButton label={t('Supprimer')} className="!h-8 !w-8 hover:!text-danger" onClick={() => removeCat(c)}><Trash2 size={14} /></IconButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={section}>
        <h2 className={h2}>{t('Données, sauvegarde et confidentialité')}</h2>
        <p className="text-sm text-muted">{t('Vos données restent sur cet appareil (IndexedDB) : aucun compte, aucune synchronisation cloud. Si l’appareil est perdu ou réinitialisé, elles ne sont pas récupérables : faites des sauvegardes régulières.')}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { download(`momentum-sauvegarde-${today}.json`, JSON.stringify(s.exportBackup(), null, 2), 'application/json'); toast(t('Sauvegarde exportée.')) }}><Download size={16} />{t('Sauvegarde JSON')}</Button>
          <Button onClick={() => { download(`momentum-historique-${today}.csv`, logsToCsv(s), 'text/csv'); toast(t('CSV exporté.')) }}><Download size={16} />{t('Historique CSV')}</Button>
          <Button disabled={importing} onClick={() => fileRef.current?.click()}><Upload size={16} />{t('Restaurer…')}</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-label={t('Fichier de sauvegarde')} onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        <Button variant="danger" onClick={erase}><Trash2 size={16} />{t('Tout effacer')}</Button>
      </section>

      <p className="pb-4 text-center text-xs text-muted">Momentum · {t('Deviens constant. Construis ta meilleure version.')}</p>
      <CategorySheet key={catEdit.cat?.id ?? 'new'} open={catEdit.open} cat={catEdit.cat} onClose={() => setCatEdit({ open: false })} />
    </div>
  )
}

function CategorySheet({ open, onClose, cat }: { open: boolean; onClose: () => void; cat?: Category }) {
  const { t } = useT()
  const save = useApp((s) => s.saveCategory)
  const [name, setName] = useState(cat?.name ?? '')
  const [color, setColor] = useState(cat?.color ?? COLOR_CHOICES[0])
  const [err, setErr] = useState<string | null>(null)
  async function submit() {
    if (!name.trim()) return setErr(t('Le nom est obligatoire.'))
    await save({ id: cat?.id ?? uid(), name, color, icon: cat?.icon ?? 'shapes', order: cat?.order })
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title={cat ? t('Modifier la catégorie') : t('Nouvelle catégorie')} footer={<><Button className="flex-1" onClick={onClose}>{t('Annuler')}</Button><Button variant="primary" className="flex-1" onClick={submit}>{t('Enregistrer')}</Button></>}>
      <Field label={t('Nom')} error={err}><input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="flex flex-wrap gap-2">{COLOR_CHOICES.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={color === c} onClick={() => setColor(c)} className={`h-8 w-8 rounded-full border-2 ${color === c ? 'border-ink' : 'border-transparent'}`} style={{ background: c }} />)}</div>
    </Sheet>
  )
}
