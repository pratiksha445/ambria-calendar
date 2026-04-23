import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import en from './en.js'
import hi from './hi.js'

const dictionaries = { en, hi }
const LanguageContext = createContext()

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  // Update PWA theme-color meta tag
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#1A1A1A' : '#E85D75')
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('ambria_lang') || 'en')
  const [theme, setThemeState] = useState(() => {
    const stored = localStorage.getItem('ambria_theme')
    return stored === 'dark' ? 'dark' : 'light'
  })

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const changeLang = useCallback((l) => {
    setLang(l)
    localStorage.setItem('ambria_lang', l)
  }, [])

  const setTheme = useCallback((t) => {
    setThemeState(t)
    localStorage.setItem('ambria_theme', t)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  const t = useCallback((key, params) => {
    if (!key) return ''
    const dict = dictionaries[lang] || dictionaries.en
    let str = dict[key] ?? dictionaries.en[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
      }
    }
    return str
  }, [lang])

  // Localized month / day arrays
  const monthNames = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => t(`month_${i}`)), [t])
  const shortMonths = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => t(`month_short_${i}`)), [t])
  const dayNames = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => t(`day_short_${i}`)), [t])
  const dowHeaders = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => t(`dow_${i}`)), [t])

  // Localized date formatters
  const formatMonthYear = useCallback((d) =>
    `${monthNames[d.getMonth()]} ${d.getFullYear()}`, [monthNames])

  const formatDayHeader = useCallback((d) =>
    `${dayNames[d.getDay()]} ${d.getDate()} ${shortMonths[d.getMonth()]}`, [dayNames, shortMonths])

  const dayLabel = useCallback((d) => dayNames[d.getDay()], [dayNames])

  const formatTimestampIST = useCallback((ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000))
    const day = ist.getUTCDate()
    const month = shortMonths[ist.getUTCMonth()]
    const year = ist.getUTCFullYear()
    let h = ist.getUTCHours()
    const m = String(ist.getUTCMinutes()).padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    if (h === 0) h = 12
    else if (h > 12) h -= 12
    return `${day} ${month} ${year}, ${h}:${m} ${ampm}`
  }, [shortMonths])

  const formatShortDate = useCallback((iso) => {
    if (!iso || typeof iso !== 'string') return null
    const [, mo, d] = iso.split('-').map(Number)
    if (!mo || !d) return null
    return `${d} ${shortMonths[mo - 1]}`
  }, [shortMonths])

  const value = useMemo(() => ({
    lang, setLang: changeLang, t,
    theme, setTheme, toggleTheme,
    formatMonthYear, formatDayHeader, dayLabel,
    formatTimestampIST, formatShortDate,
    dowHeaders, shortMonths,
  }), [lang, changeLang, t, theme, setTheme, toggleTheme, formatMonthYear, formatDayHeader, dayLabel, formatTimestampIST, formatShortDate, dowHeaders, shortMonths])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
