import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const VIEWS = ['day', 'week', 'month']

export default function Header({
  currentDate,
  view,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onMenu,
  onAdd,
  onExport,
  onClearMonth,
  onSettings,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { t, formatMonthYear } = useLanguage()

  return (
    <header className="app-header">
      <div className="header-row">
        <button className="icon-btn header-menu" onClick={onMenu} aria-label="Open menu">
          <MenuIcon />
        </button>

        <div className="header-title">
          <button className="icon-btn sm" onClick={onPrev} aria-label="Previous">
            <ChevronIcon dir="left" />
          </button>
          <span className="month-label">{formatMonthYear(currentDate)}</span>
          <button className="icon-btn sm" onClick={onNext} aria-label="Next">
            <ChevronIcon dir="right" />
          </button>
        </div>

        <div className="header-actions">
          <button className="icon-btn sm" onClick={onExport} aria-label={t('Export Bookings')}>
            <ExportIcon />
          </button>
          <button className="book-btn" onClick={onAdd}>+<span className="book-btn-label"> {t('Book')}</span></button>
          <div className="header-more-wrap">
            <button
              className="icon-btn sm"
              onClick={() => setMenuOpen((p) => !p)}
              aria-label="More options"
            >
              <MoreIcon />
            </button>
            {menuOpen && (
              <>
                <div
                  className="header-menu-backdrop"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="header-menu-dropdown">
                  {onClearMonth && (
                    <button
                      className="header-menu-item danger"
                      onClick={() => { setMenuOpen(false); onClearMonth() }}
                    >
                      <TrashIcon />
                      {t('Clear Month')}
                    </button>
                  )}
                  <button
                    className="header-menu-item"
                    onClick={() => { setMenuOpen(false); onSettings?.() }}
                  >
                    <SettingsIcon />
                    {t('Settings')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="header-row sub">
        <div className="view-tabs" role="tablist">
          {VIEWS.map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              className={`view-tab ${view === v ? 'active' : ''}`}
              onClick={() => onViewChange(v)}
            >
              {t(v.charAt(0).toUpperCase() + v.slice(1))}
            </button>
          ))}
        </div>
        <button className="today-pill" onClick={onToday}>{t('Today')}</button>
      </div>
    </header>
  )
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function ChevronIcon({ dir }) {
  const points = dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points={points} />
    </svg>
  )
}

function ExportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
