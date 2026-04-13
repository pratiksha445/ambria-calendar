import { VENUES } from '../config/venues.js'

const SOURCES = [
  { id: 'crm', label: 'CRM', color: '#22C55E' },
  { id: 'manual', label: 'Manual', color: '#E85D75' },
]

export default function Sidebar({
  open,
  onClose,
  search,
  onSearch,
  activeFilters,
  onToggleFilter,
  onSelectAllVenues,
  onSelectNoVenues,
  activeSources,
  onToggleSource,
  events,
  totalCount,
  shownCount,
}) {
  const venueCounts = events.reduce((acc, ev) => {
    acc[ev.venue_id] = (acc[ev.venue_id] ?? 0) + 1
    return acc
  }, {})
  const sourceCounts = events.reduce((acc, ev) => {
    acc[ev.source] = (acc[ev.source] ?? 0) + 1
    return acc
  }, {})

  return (
    <>
      <div
        className={`sidebar-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`sidebar ${open ? 'open' : ''}`}
        aria-hidden={!open}
      >
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">A</div>
            <div className="brand-text">Ambria</div>
          </div>
          <button className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="sidebar-search">
          <div className="search-wrap">
            <input
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search events…"
            />
            {search && (
              <button
                className="search-clear"
                onClick={() => onSearch('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="sidebar-section-head">
          <span className="sidebar-section-title">Categories</span>
          <div className="filter-quick">
            <button type="button" onClick={onSelectAllVenues}>All</button>
            <span className="filter-quick-sep">·</span>
            <button type="button" onClick={onSelectNoVenues}>None</button>
          </div>
        </div>
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
                  <span
                    className="filter-dot"
                    style={
                      isOn
                        ? { background: v.color, borderColor: v.color }
                        : { background: 'transparent', borderColor: v.color }
                    }
                  />
                  <span className="filter-name">{v.short}</span>
                  <span className="filter-count">{venueCounts[v.id] ?? 0}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="sidebar-section-head">
          <span className="sidebar-section-title">Source</span>
        </div>
        <ul className="filter-list">
          {SOURCES.map((s) => {
            const isOn = activeSources.has(s.id)
            return (
              <li key={s.id}>
                <button
                  className={`filter-row ${isOn ? 'on' : 'off'}`}
                  onClick={() => onToggleSource(s.id)}
                  aria-pressed={isOn}
                >
                  <span
                    className="filter-dot"
                    style={
                      isOn
                        ? { background: s.color, borderColor: s.color }
                        : { background: 'transparent', borderColor: s.color }
                    }
                  />
                  <span className="filter-name">{s.label}</span>
                  <span className="filter-count">{sourceCounts[s.id] ?? 0}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="sidebar-footer">
          {shownCount === totalCount
            ? `${totalCount} ${totalCount === 1 ? 'event' : 'events'} this month`
            : `${shownCount} of ${totalCount} events shown`}
        </div>
      </aside>
    </>
  )
}
