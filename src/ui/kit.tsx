import { type ReactNode, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { create } from 'zustand'
import { useT } from '../i18n'

/* ---------- Boutons ---------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'soft'; small?: boolean }
export function Button({ variant = 'soft', small, className = '', ...p }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none'
  const size = small ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-[15px]'
  const v = {
    primary: 'bg-accent text-on-accent hover:brightness-110',
    soft: 'bg-surface2 text-ink hover:brightness-125 border border-line',
    ghost: 'text-muted hover:text-ink hover:bg-surface2',
    danger: 'bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30',
  }[variant]
  return <button type="button" {...p} className={`${base} ${size} ${v} ${className}`} />
}

export function IconButton({ label, className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...p}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted transition hover:bg-surface2 hover:text-ink active:scale-95 ${className}`} />
  )
}

/* ---------- Mise en page ---------- */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
    </header>
  )
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && <div className="text-accent-ink">{icon}</div>}
      <h3 className="font-medium">{title}</h3>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  )
}

export function Chip({ active, onClick, children, color }: { active?: boolean; onClick?: () => void; children: ReactNode; color?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition ${active ? 'border-transparent bg-accent text-on-accent' : 'border-line bg-surface2 text-muted hover:text-ink'}`}
      style={active && color ? { background: color } : undefined}>
      {children}
    </button>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-surface2 p-1">
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm transition ${o.value === value ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Progress({ ratio, color }: { ratio: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, ratio * 100)}%`, background: color ?? 'var(--accent)' }} />
    </div>
  )
}

export function Ring({ ratio, size = 120, stroke = 10, children }: { ratio: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, ratio)))} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

/* ---------- Feuille modale ---------- */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const { t } = useT()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLElement>('input,textarea,select')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title}
        className="anim-pop pb-safe flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-line bg-surface shadow-[var(--shadow)] sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <IconButton label={t('Fermer')} onClick={onClose}><X size={20} /></IconButton>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------- Confirmation ---------- */
interface ConfirmState { open: boolean; title: string; text?: string; confirmLabel?: string; resolve?: (v: boolean) => void }
const useConfirmStore = create<ConfirmState>(() => ({ open: false, title: '' }))

export function confirmDialog(title: string, text?: string, confirmLabel?: string): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.setState({ open: true, title, text, confirmLabel, resolve }))
}

export function ConfirmHost() {
  const s = useConfirmStore()
  const { t } = useT()
  const close = (v: boolean) => { s.resolve?.(v); useConfirmStore.setState({ open: false, resolve: undefined }) }
  return (
    <Sheet open={s.open} onClose={() => close(false)} title={s.title}
      footer={<><Button className="flex-1" onClick={() => close(false)}>{t('Annuler')}</Button><Button variant="danger" className="flex-1" onClick={() => close(true)}>{s.confirmLabel ?? t('Confirmer')}</Button></>}>
      {s.text && <p className="text-sm text-muted">{s.text}</p>}
    </Sheet>
  )
}

/* ---------- Toasts ---------- */
interface ToastState { msg: string | null }
const useToastStore = create<ToastState>(() => ({ msg: null }))
let toastTimer: ReturnType<typeof setTimeout> | undefined
export function toast(msg: string) {
  useToastStore.setState({ msg })
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => useToastStore.setState({ msg: null }), 3200)
}
export function ToastHost() {
  const msg = useToastStore((s) => s.msg)
  if (!msg) return null
  return (
    <div role="status" aria-live="polite" className="anim-pop pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 md:bottom-8">
      <div className="pointer-events-auto rounded-2xl border border-line bg-surface2 px-4 py-2.5 text-sm shadow-[var(--shadow)]">{msg}</div>
    </div>
  )
}
