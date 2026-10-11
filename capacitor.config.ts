import type { CapacitorConfig } from '@capacitor/cli'

/**
 * L'APK est une coque native : elle charge le site publié sur GitHub Pages.
 * Chaque déploiement est donc reçu sans réinstaller l'APK, et le service worker
 * garde l'application utilisable hors-ligne après la première ouverture.
 */
const config: CapacitorConfig = {
  appId: 'com.ngstartup.momentum',
  appName: 'Momentum',
  webDir: 'dist',
  server: {
    url: 'https://ngstartup.github.io/momentum/',
    androidScheme: 'https',
  },
  android: { allowMixedContent: false },
}

export default config
