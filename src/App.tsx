import { Suspense, lazy, useEffect } from 'react'
import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { CalendarDays, CheckCircle2, ListTodo, BarChart3, UserRound } from 'lucide-react'
import { useApp } from './store/app'
import { useT } from './i18n'
import { ConfirmHost, ToastHost, toast } from './ui/kit'
import { useReminderScheduler } from './ui/reminders'
import Today from './pages/Today'

const Habits = lazy(() => import('./pages/Habits'))
const HabitDetail = lazy(() => import('./pages/HabitDetail'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const Stats = lazy(() => import('./pages/Stats'))
const Profile = lazy(() => import('./pages/Profile'))
const Goals = lazy(() => import('./pages/Goals'))
const Routines = lazy(() => import('./pages/Routines'))
const Journal = lazy(() => import('./pages/Journal'))
const Focus = lazy(() => import('./pages/Focus'))
const Search = lazy(() => import('./pages/Search'))

function Shell() {
  const { t } = useT()
  const { prefs, error, clearError } = useApp()
  useReminderScheduler()

  useEffect(() => {
    const r = document.documentElement
    r.dataset.theme = prefs.theme
    r.style.setProperty('--accent', prefs.accent)
    r.lang = prefs.lang
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', prefs.theme === 'dark' ? '#0D1117' : '#F6F4EF')
  }, [prefs.theme, prefs.accent, prefs.lang])

  useEffect(() => {
    if (error) { toast(t('Une erreur est survenue : la dernière modification n’a pas pu être enregistrée.')); clearError() }
  }, [error, clearError, t])

  const nav = [
    { to: '/today', label: t('Aujourd’hui'), icon: CheckCircle2 },
    { to: '/habits', label: t('Habitudes'), icon: ListTodo },
    { to: '/calendar', label: t('Calendrier'), icon: CalendarDays },
    { to: '/stats', label: t('Statistiques'), icon: BarChart3 },
    { to: '/profile', label: t('Profil'), icon: UserRound },
  ]
  const link = (active: boolean, extra = '') => `${extra} ${active ? 'text-accent-ink' : 'text-muted hover:text-ink'}`

  return (
    <div className="min-h-full md:flex">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:p-4">
        <div className="mb-6 px-2 pt-2">
          <p className="text-xl font-semibold tracking-tight text-accent-ink">Momentum</p>
          <p className="text-xs text-muted">{t('Deviens constant. Construis ta meilleure version.')}</p>
        </div>
        <nav aria-label={t('Navigation principale')} className="space-y-1">
          {nav.map(({ to, label, icon: I }) => (
            <NavLink key={to} to={to} className={({ isActive }) => link(isActive, `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition ${isActive ? 'bg-surface2' : ''}`)}>
              <I size={20} aria-hidden />{label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 pt-safe md:px-8 md:pb-10">
        <Suspense fallback={<p className="py-20 text-center text-sm text-muted" role="status">{t('Chargement…')}</p>}>
          <Routes>
            <Route path="/" element={<Navigate to={`/${prefs.startPage}`} replace />} />
            <Route path="/today" element={<Today />} />
            <Route path="/habits" element={<Habits />} />
            <Route path="/habits/:id" element={<HabitDetail />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/routines" element={<Routines />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/focus" element={<Focus />} />
            <Route path="/search" element={<Search />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
        </Suspense>
      </main>

      <nav aria-label={t('Navigation principale')} className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {nav.map(({ to, label, icon: I }) => (
            <li key={to}>
              <NavLink to={to} className={({ isActive }) => link(isActive, 'flex flex-col items-center gap-0.5 py-2.5 text-[11px]')}>
                <I size={22} aria-hidden />{label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <ConfirmHost />
      <ToastHost />
    </div>
  )
}

export default function App() {
  const ready = useApp((s) => s.ready)
  const init = useApp((s) => s.init)
  useEffect(() => { void init() }, [init])
  if (!ready) return <div className="flex h-full items-center justify-center text-sm text-muted" role="status">Momentum…</div>
  return <HashRouter><Shell /></HashRouter>
}
