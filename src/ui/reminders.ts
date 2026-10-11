import { useEffect } from 'react'
import { useApp } from '../store/app'
import { buildLogIndex, isDone, isFixedScheduledOn, isQuota, valueOn } from '../domain/habits'
import { todayStr, weekdayOf } from '../domain/dates'
import { translate } from '../i18n'
import { toast } from './kit'

const FIRED = 'momentum.reminders.fired'
const WINDOW_MIN = 15

function readFired(): Record<string, true> {
  try { return JSON.parse(localStorage.getItem(FIRED) ?? '{}') } catch { return {} }
}
function writeFired(m: Record<string, true>) {
  try {
    const t = todayStr()
    // purge des jours passés
    const keep = Object.fromEntries(Object.entries(m).filter(([k]) => k.endsWith(t)))
    localStorage.setItem(FIRED, JSON.stringify(keep))
  } catch { /* stockage indisponible : on risque au pire un doublon dans la session */ }
}

/**
 * Rappels : uniquement tant que l'application est ouverte (PWA sans serveur push).
 * Une clé « rappel + date » garantit qu'un rappel n'est notifié qu'une fois par jour,
 * même avec plusieurs onglets ou après un rechargement.
 */
export function useReminderScheduler() {
  useEffect(() => {
    const check = () => {
      const s = useApp.getState()
      if (!s.ready || !s.prefs.notifications) return
      const now = new Date()
      const today = todayStr(now)
      const minutes = now.getHours() * 60 + now.getMinutes()
      const fired = readFired()
      const idx = buildLogIndex(s.logs)
      for (const r of s.reminders) {
        if (!r.enabled) continue
        const h = s.habits.find((x) => x.id === r.habitId)
        if (!h || h.archived) continue
        if (r.days.length && !r.days.includes(weekdayOf(today))) continue
        if (!isQuota(h) && !isFixedScheduledOn(h, today)) continue
        if (isQuota(h) && h.startDate > today) continue
        const [hh, mm] = r.time.split(':').map(Number)
        const at = hh * 60 + mm
        if (minutes < at || minutes > at + WINDOW_MIN) continue
        const key = `${r.id}_${today}`
        if (fired[key]) continue
        if (isDone(h, valueOn(idx, h.id, today)) && !r.remindIfDone) continue
        fired[key] = true
        writeFired(fired)
        const title = translate(s.prefs.lang, 'Momentum — rappel')
        const body = h.name
        if ('Notification' in window && Notification.permission === 'granted') {
          try { new Notification(title, { body, tag: key, icon: 'icon.svg' }) } catch { toast(`${title} : ${body}`) }
        } else toast(`${title} : ${body}`)
      }
    }
    check()
    const id = setInterval(check, 30_000)
    document.addEventListener('visibilitychange', check)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', check) }
  }, [])
}
