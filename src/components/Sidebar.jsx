import { VENUES } from '../config/venues.js'

export default function Sidebar({
  open,
  onClose,
  search,
  onSearch,
  activeFilters,
  onToggleFilter,
  events,
}) {
  const countsByVenue = events.reduce((acc, ev) => {
    acc[ev.venue_id] = (acc[ev.venue_id] ?? 0) + 1
    return acc
  }, {})

  return (
    <>
      <div
        className={`sidebar-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">A</div>
            <div className="brand-text">Ambria</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="sidebar-search">
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search events…"
          />
        </div>

        <div className="sidebar-section-title">Categories</div>
        <ul className="filter-list">
          {VENUES.map((v) => {
            const isOn = activeFilters.has(v.id)
            return (
              <li key={v.id}>
                <button
                  className={`filter-row ${isOn ? 'on' : 'off'}`}
                  onClick={() => onToggleFilter(v.id)}
                  aria-pressed={isOn}
                >
                  <span className="filter-dot" style={{ background: v.color }} />
                  <span className="filter-name">{v.name}</span>
                  <span className="filter-count">{countsByVenue[v.id] ?? 0}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>
    </>
  )
}
