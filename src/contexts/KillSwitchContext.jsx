import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { fetchSetting, updateSetting } from '../lib/appSettings.js'
import { logAction } from '../lib/audit.js'

const KillSwitchCtx = createContext({
  killSwitch: false,
  toggleKillSwitch: async () => {},
})

export function KillSwitchProvider({ children }) {
  const [killSwitch, setKillSwitch] = useState(false)

  // Fetch on mount
  useEffect(() => {
    fetchSetting('kill_switch', 'off')
      .then((val) => setKillSwitch(val === 'on'))
      .catch(() => {/* offline — default off */})
  }, [])

  const toggleKillSwitch = useCallback(async (user) => {
    const next = !killSwitch
    const nextVal = next ? 'on' : 'off'
    await updateSetting('kill_switch', nextVal, user.id)
    setKillSwitch(next)
    await logAction(
      user.id,
      user.name,
      next ? 'kill_switch_on' : 'kill_switch_off',
      'app_settings',
      null,
      { summary: next ? 'Kill switch activated — all data hidden' : 'Kill switch deactivated — data restored' },
      user.role,
    )
  }, [killSwitch])

  return (
    <KillSwitchCtx.Provider value={{ killSwitch, toggleKillSwitch }}>
      {children}
    </KillSwitchCtx.Provider>
  )
}

export function useKillSwitch() {
  return useContext(KillSwitchCtx)
}
