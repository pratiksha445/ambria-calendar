import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

// Searchable dropdown for fields that need type-to-filter.
// Options: [{ value, label, searchTerms? }]
// - value: stored value (e.g. "Wedding")
// - label: display text (e.g. "Wedding (WD)")
// - searchTerms: extra strings to match against (e.g. ["WD"])

export default function SearchableSelect({ id, value, options, disabled, onChange, placeholder }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  const selected = options.find((o) => o.value === value)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filtered = query
    ? options.filter((o) => {
        const q = query.toLowerCase()
        if (o.label.toLowerCase().includes(q)) return true
        if (o.value.toLowerCase().includes(q)) return true
        if (o.searchTerms) return o.searchTerms.some((st) => st.toLowerCase().includes(q))
        return false
      })
    : options

  const handleOpen = () => {
    if (disabled) return
    setQuery('')
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const handleSelect = (opt) => {
    onChange(opt.value)
    setOpen(false)
    setQuery('')
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange('')
    setOpen(false)
    setQuery('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
    if (e.key === 'Enter' && filtered.length === 1) {
      e.preventDefault()
      handleSelect(filtered[0])
    }
  }

  return (
    <div className="ss-wrap" ref={wrapRef}>
      {/* Closed state — shows selected value or placeholder */}
      {!open && (
        <div
          className={`ss-display ${disabled ? 'ss-disabled' : ''} ${!value ? 'ss-placeholder' : ''}`}
          onClick={handleOpen}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen() } }}
          id={id}
        >
          <span className="ss-display-text">
            {selected ? t(selected.label) : (placeholder || t('— Select —'))}
          </span>
          {value && !disabled && (
            <button type="button" className="ss-clear" onClick={handleClear} aria-label="Clear" tabIndex={-1}>×</button>
          )}
          <span className="ss-chevron">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      )}

      {/* Open state — search input + dropdown */}
      {open && (
        <>
          <input
            ref={inputRef}
            type="text"
            className="ss-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('Type to search…')}
            autoComplete="off"
          />
          <div className="ss-dropdown">
            {filtered.length === 0 && (
              <div className="ss-no-results">{t('No matches')}</div>
            )}
            {filtered.map((opt) => (
              <div
                key={opt.value}
                className={`ss-option ${opt.value === value ? 'ss-option-selected' : ''}`}
                onClick={() => handleSelect(opt)}
                role="option"
                aria-selected={opt.value === value}
              >
                {t(opt.label)}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
