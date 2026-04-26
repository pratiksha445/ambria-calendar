import { useRegisterSW } from 'virtual:pwa-register/react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const INTERVAL = 60 * 1000 // check for updates every 60 seconds

export default function ReloadPrompt() {
  const { t } = useLanguage()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      setInterval(() => { registration.update() }, INTERVAL)
    },
    onRegisterError(error) {
      console.error('[SW] registration error', error)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="reload-prompt">
      <span>{t('New version available')}</span>
      <button className="reload-prompt-btn" onClick={() => updateServiceWorker(true)}>
        {t('Refresh')}
      </button>
    </div>
  )
}
