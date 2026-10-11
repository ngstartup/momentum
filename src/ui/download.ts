import { Capacitor } from '@capacitor/core'

/**
 * Enregistre un fichier texte. Navigateur : téléchargement classique.
 * Application Android (WebView) : les téléchargements « blob » ne fonctionnent pas,
 * on écrit le fichier en cache puis on ouvre la feuille de partage (Drive, Fichiers, e-mail…).
 */
export async function saveFile(name: string, text: string, type: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 })
    await Share.share({ title: name, url: uri, dialogTitle: name })
    return
  }
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const isNativeApp = () => Capacitor.isNativePlatform()
