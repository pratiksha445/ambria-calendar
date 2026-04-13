import { formatMonthYear } from '../lib/dates.js'

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
}) {
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

        <button className="book-btn" onClick={onAdd}>+ Book</button>
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
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <button className="today-pill" onClick={onToday}>Today</button>
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
