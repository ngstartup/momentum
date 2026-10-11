import { useState } from 'react'
import { Check, Flame, Minus, Plus, Settings2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Habit } from '../domain/types'
import { isDone, progressRatio } from '../domain/habits'
import type { HabitStats } from '../domain/stats'
import { useApp } from '../store/app'
import { useT } from '../i18n'
import { HabitIcon } from './icons'
import { IconButton, Progress } from './kit'

interface Props {
  habit: Habit
  date: string
  value: number
  stats: HabitStats
  categoryName?: string
  quota?: { count: number; quota: number }
  disabled?: boolean
  onEdit?: () => void
}

export function HabitRow({ habit, date, value, stats, categoryName, quota, disabled, onEdit }: Props) {
  const { t } = useT()
  const { toggleHabit, setLogValue } = useApp()
  const [draft, setDraft] = useState<string | null>(null)
  const done = isDone(habit, value)
  const binary = habit.tracking === 'binary'
  const unit = habit.tracking === 'duration' ? 'min' : habit.unit ?? ''
  const step = habit.tracking === 'duration' ? 5 : habit.target && habit.target >= 50 ? 10 : 1

  const commit = () => {
    if (draft === null) return
    const n = Number(draft.replace(',', '.'))
    setDraft(null)
    if (Number.isFinite(n) && n >= 0) void setLogValue(habit.id, date, n)
  }

  const streakLabel =
    stats.currentStreak > 0
      ? stats.streakUnit === 'week' ? t('{n} sem.', { n: stats.currentStreak }) : t('{n} j', { n: stats.currentStreak })
      : null

  return (
    <li className={`card flex items-center gap-3 p-3 transition ${done ? 'opacity-90' : ''}`}>
      <button type="button" disabled={disabled} onClick={() => toggleHabit(habit.id, date)}
        aria-label={done ? t('Annuler la validation de {name}', { name: habit.name }) : t('Valider {name}', { name: habit.name })}
        aria-pressed={done}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 transition active:scale-90 disabled:opacity-40"
        style={{ borderColor: habit.color, background: done ? habit.color : 'transparent', color: done ? '#10141a' : habit.color }}>
        {done ? <Check size={24} strokeWidth={3} /> : <HabitIcon name={habit.icon} size={22} />}
      </button>

      <div className="min-w-0 flex-1">
        <Link to={`/habits/${habit.id}`} className="block truncate font-medium hover:underline">{habit.name}</Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          {categoryName && <span>{categoryName}</span>}
          {!binary && <span>{t('Objectif')} : {habit.target} {unit}</span>}
          {quota && <span>{t('{c}/{q} cette semaine', { c: quota.count, q: quota.quota })}</span>}
          {streakLabel && (
            <span className="inline-flex items-center gap-0.5 text-accent-ink" title={t('Série actuelle')}>
              <Flame size={12} aria-hidden />{streakLabel}
            </span>
          )}
        </div>
        {!binary && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1"><Progress ratio={progressRatio(habit, value)} color={habit.color} /></div>
            <IconButton label={t('Diminuer')} className="!h-8 !w-8" disabled={disabled || value <= 0} onClick={() => setLogValue(habit.id, date, Math.max(0, value - step))}><Minus size={16} /></IconButton>
            <input aria-label={t('Valeur pour {name}', { name: habit.name })} inputMode="decimal" disabled={disabled}
              className="!w-16 !rounded-lg !px-2 !py-1 text-center !text-sm"
              value={draft ?? String(value)} onFocus={(e) => { setDraft(String(value)); e.target.select() }}
              onChange={(e) => setDraft(e.target.value)} onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
            <IconButton label={t('Augmenter')} className="!h-8 !w-8" disabled={disabled} onClick={() => setLogValue(habit.id, date, value + step)}><Plus size={16} /></IconButton>
          </div>
        )}
      </div>
      {onEdit && <IconButton label={t('Modifier {name}', { name: habit.name })} onClick={onEdit}><Settings2 size={18} /></IconButton>}
    </li>
  )
}
