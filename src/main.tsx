import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/**
 * Mises à jour : le service worker vérifie le serveur à l'ouverture, au retour au premier
 * plan et toutes les heures. Dès qu'une nouvelle version est prête, l'app se recharge
 * (registerType: 'autoUpdate'). Les données sont dans IndexedDB : elles survivent à la mise à jour.
 */
if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return
      const check = () => { if (navigator.onLine) void reg.update().catch(() => {}) }
      setInterval(check, 60 * 60 * 1000)
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
    },
  })
}
