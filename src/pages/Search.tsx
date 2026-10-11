import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { useFmtDate } from '../ui/hooks'
import { Empty, PageHeader } from '../ui/kit'

export default function Search() {
  const { t } = useT()
  const fmt = useFmtDate()
  const { habits, categories, goals, routines, journal } = useApp()
  const [q, setQ] = useState('')
  const n = q.trim().toLowerCase()
  const m = (...s: (string | undefined)[]) => s.some((x) => x?.toLowerCase().includes(n))

  type Item = { id: string; label: string; sub?: string; to: string }
  const groups: { title: string; items: Item[] }[] = n.length < 2 ? [] : [
    { title: t('Habitudes'), items: habits.filter((h) => m(h.name, h.description)).map((h) => ({ id: h.id, label: h.name, sub: h.archived ? t('Archivée') : undefined, to: `/habits/${h.id}` })) },
    { title: t('Catégories'), items: categories.filter((c) => m(c.name)).map((c) => ({ id: c.id, label: c.name, to: '/profile' })) },
    { title: t('Objectifs'), items: goals.filter((g) => m(g.title, g.description)).map((g) => ({ id: g.id, label: g.title, to: '/goals' })) },
    { title: t('Routines'), items: routines.filter((r) => m(r.name, ...r.steps.map((s) => s.title))).map((r) => ({ id: r.id, label: r.name, to: '/routines' })) },
    { title: t('Journal'), items: journal.filter((j) => m(j.note, j.win, j.difficulty, j.tomorrow)).map((j) => ({ id: j.id, label: fmt(j.date), sub: (j.note ?? j.win ?? j.difficulty ?? j.tomorrow ?? '').slice(0, 80), to: `/journal?d=${j.date}` })) },
  ].filter((g) => g.items.length)

  return (
    <div>
      <PageHeader title={t('Recherche')} />
      <input type="search" autoFocus aria-label={t('Rechercher')} placeholder={t('Habitudes, catégories, objectifs, routines, journal…')} value={q} onChange={(e) => setQ(e.target.value)} className="mb-4" />
      {n.length < 2 ? <p className="text-sm text-muted">{t('Saisissez au moins 2 caractères.')}</p>
        : groups.length === 0 ? <Empty title={t('Aucun résultat')} text={t('Essayez un autre mot.')} />
        : groups.map((g) => (
          <section key={g.title} className="mb-5">
            <h2 className="mb-2 text-sm font-medium text-muted">{g.title}</h2>
            <ul className="space-y-2">{g.items.map((i) => (
              <li key={i.id}><Link to={i.to} className="card block p-3 text-sm hover:brightness-110"><span className="font-medium">{i.label}</span>{i.sub && <span className="block truncate text-xs text-muted">{i.sub}</span>}</Link></li>
            ))}</ul>
          </section>
        ))}
    </div>
  )
}
