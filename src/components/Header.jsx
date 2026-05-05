import { useState, useRef, useEffect } from 'react'
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
  onSelectMonth,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(currentDate.getFullYear())
  const { t, formatMonthYear, shortMonths } = useLanguage()
  const pickerRef = useRef(null)

  // Sync picker year when currentDate changes externally
  useEffect(() => {
    if (!pickerOpen) setPickerYear(currentDate.getFullYear())
  }, [currentDate, pickerOpen])

  const togglePicker = () => {
    if (!pickerOpen) setPickerYear(currentDate.getFullYear())
    setPickerOpen((p) => !p)
  }

  const selectMonth = (monthIndex) => {
    onSelectMonth?.(new Date(pickerYear, monthIndex, 1))
    setPickerOpen(false)
  }

  const isCurrentMonth = (monthIndex) =>
    currentDate.getFullYear() === pickerYear && currentDate.getMonth() === monthIndex

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
          <div className="month-picker-wrap" ref={pickerRef}>
            <button
              type="button"
              className="month-label month-label-btn"
              onClick={togglePicker}
              aria-expanded={pickerOpen}
              aria-haspopup="true"
            >
              {formatMonthYear(currentDate)}
              <span className="month-chevron" aria-hidden="true">&#9662;</span>
            </button>
            {pickerOpen && (
              <>
                <div className="month-picker-backdrop" onClick={() => setPickerOpen(false)} />
                <div className="month-picker-dropdown">
                  <div className="month-picker-year-row">
                    <button
                      type="button"
                      className="icon-btn sm"
                      onClick={() => setPickerYear((y) => y - 1)}
                      aria-label="Previous year"
                    >
                      <ChevronIcon dir="left" />
                    </button>
                    <span className="month-picker-year">{pickerYear}</span>
                    <button
                      type="button"
                      className="icon-btn sm"
                      onClick={() => setPickerYear((y) => y + 1)}
                      aria-label="Next year"
                    >
                      <ChevronIcon dir="right" />
                    </button>
                  </div>
                  <div className="month-picker-grid">
                    {shortMonths.map((name, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`month-picker-cell${isCurrentMonth(i) ? ' month-picker-active' : ''}`}
                        onClick={() => selectMonth(i)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <button className="icon-btn sm" onClick={onNext} aria-label="Next">
            <ChevronIcon dir="right" />
          </button>
        </div>

        <div className="header-actions">
          <button className="icon-btn sm" onClick={onExport} aria-label={t('Export Bookings')}>
            <ExportIcon />
          </button>
          <button className="book-btn" onClick={onAdd}>+<span className="book-btn-label"> {t('Book')}</span></button>
          {onClearMonth && (
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
                    <button
                      className="header-menu-item danger"
                      onClick={() => { setMenuOpen(false); onClearMonth() }}
                    >
                      <TrashIcon />
                      {t('Clear Month')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
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
