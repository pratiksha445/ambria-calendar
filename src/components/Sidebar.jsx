import { useMemo, useState } from 'react'
import { VENUES, VENUE_BY_ID, AE_VALENCIA, AM_ALSTONIA, stripeGradient } from '../config/venues.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const SOURCES = [
  { id: 'crm', labelKey: 'CRM' },
  { id: 'manual', labelKey: 'Manual' },
]

const ROLE_COLORS = { admin: '#E85D75', staff: '#95A5A6' }

// Sub-venue legend definitions for AM and AE
const SUB_VENUE_LEGENDS = {
  am: () => {
    const base = VENUE_BY_ID.am?.color ?? '#E08E45'
    return [
      { color: base, label: 'Emerald / GH' },
      { color: AM_ALSTONIA, label: 'Alstonia / Banana' },
      { color: stripeGradient(base, AM_ALSTONIA), label: 'Full Venue', striped: true },
    ]
  },
  ae: () => {
    const base = VENUE_BY_ID.ae?.color ?? '#A3785E'
    return [
      { color: base, label: 'Aura' },
      { color: AE_VALENCIA, label: 'Valencia' },
      { color: stripeGradient(base, AE_VALENCIA), label: 'Full Venue', striped: true },
    ]
  },
}

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
  user,
  currentView,
  onNavigate,
  onLogout,
  onChangePin,
}) {
  const { t, lang, setLang, theme, toggleTheme } = useLanguage()
  const [expandedLegend, setExpandedLegend] = useState({}) // { am: true, ae: false }
  const venueCounts = useMemo(() => events.reduce((acc, ev) => {
    acc[ev.venue_id] = (acc[ev.venue_id] ?? 0) + 1
    return acc
  }, {}), [events])
  const sourceCounts = useMemo(() => events.reduce((acc, ev) => {
    acc[ev.source] = (acc[ev.source] ?? 0) + 1
    return acc
  }, {}), [events])

  const toggleLegend = (id, e) => {
    e.stopPropagation()
    setExpandedLegend((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <>
      <div
        className={`sidebar-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`sidebar ${open ? 'open' : ''}`}
      >
        <div className="sidebar-header">
          <div className="brand">
            <img src={import.meta.env.BASE_URL + (theme === 'dark' ? 'logo-dark.png' : 'logo.png')} alt="Ambria" className="sidebar-logo" />
            <div className="lang-toggle">
              <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
              <span className="lang-sep">|</span>
              <button className={`lang-btn ${lang === 'hi' ? 'active' : ''}`} onClick={() => setLang('hi')}>हि</button>
            </div>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('Light mode') : t('Dark mode')}
              title={theme === 'dark' ? t('Light mode') : t('Dark mode')}
            >
              {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
          </div>
          <button className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <div className="sidebar-nav">
          <button
            className={`nav-item ${currentView === 'calendar' ? 'active' : ''}`}
            onClick={() => onNavigate('calendar')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {t('Calendar')}
          </button>
          {user?.role === 'admin' && (
            <button
              className={`nav-item ${currentView === 'users' ? 'active' : ''}`}
              onClick={() => onNavigate('users')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {t('Manage Users')}
            </button>
          )}
          {user?.role === 'admin' && (
            <button
              className={`nav-item ${currentView === 'event-types' ? 'active' : ''}`}
              onClick={() => onNavigate('event-types')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              {t('Event Types')}
            </button>
          )}
          {user?.role === 'admin' && (
            <button
              className={`nav-item ${currentView === 'categories' ? 'active' : ''}`}
              onClick={() => onNavigate('categories')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
              {t('Manage Categories')}
            </button>
          )}
          {user?.role === 'admin' && (
            <button
              className={`nav-item ${currentView === 'elements' ? 'active' : ''}`}
              onClick={() => onNavigate('elements')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {t('Manage Elements')}
            </button>
          )}
          {user?.role === 'admin' && (
            <button
              className={`nav-item ${currentView === 'venue-managers' ? 'active' : ''}`}
              onClick={() => onNavigate('venue-managers')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {t('Venue Managers')}
            </button>
          )}
          {user?.role === 'admin' && (
            <button
              className={`nav-item ${currentView === 'event-list' ? 'active' : ''}`}
              onClick={() => onNavigate('event-list')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <line x1="8" y1="10" x2="16" y2="10" />
                <line x1="8" y1="14" x2="16" y2="14" />
                <line x1="8" y1="18" x2="12" y2="18" />
              </svg>
              {t('Event List')}
            </button>
          )}
          {user?.role === 'admin' && (
            <button
              className={`nav-item ${currentView === 'audit' ? 'active' : ''}`}
              onClick={() => onNavigate('audit')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {t('Audit Log')}
            </button>
          )}
        </div>

        {/* Calendar filters — only when on calendar view */}
        {currentView === 'calendar' && (
          <>
            <div className="sidebar-search">
              <div className="search-wrap">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder={t('Search events…')}
                />
                {search && (
                  <button
                    className="search-clear"
                    onClick={() => onSearch('')}
                    aria-label="Clear search"
                  >
                    {"×"}
                  </button>
                )}
              </div>
            </div>

            <div className="sidebar-section-head">
              <span className="sidebar-section-title">{t('Categories')}</span>
              <div className="filter-quick">
                <button type="button" onClick={onSelectAllVenues}>{t('All')}</button>
                <span className="filter-quick-sep">|</span>
                <button type="button" onClick={onSelectNoVenues}>{t('None')}</button>
              </div>
            </div>
            <ul className="filter-list">
              {VENUES.map((v) => {
                const isOn = activeFilters.has(v.id)
                const hasLegend = SUB_VENUE_LEGENDS[v.id]
                const legendOpen = !!expandedLegend[v.id]
                return (
                  <li key={v.id}>
                    <button
                      className={`filter-row ${isOn ? 'on' : 'off'}`}
                      onClick={() => onToggleFilter(v.id)}
                      aria-pressed={isOn}
                    >
                      <span className="filter-pill" style={{ background: v.color, color: v.textColor }}>
                        {v.short} — {t(v.name)}
                      </span>
                      {hasLegend && (
                        <button
                          type="button"
                          className={`legend-toggle-btn${legendOpen ? ' legend-open' : ''}`}
                          onClick={(e) => toggleLegend(v.id, e)}
                          aria-label="Toggle sub-venue legend"
                          aria-expanded={legendOpen}
                        >
                          <span className="legend-chevron">&#9662;</span>
                        </button>
                      )}
                      <span className="filter-count">{venueCounts[v.id] ?? 0}</span>
                    </button>
                    {hasLegend && (
                      <div className={`sv-legend${legendOpen ? ' sv-legend-open' : ''}`}>
                        {SUB_VENUE_LEGENDS[v.id]().map((item) => (
                          <div key={item.label} className="sv-legend-item">
                            <span
                              className="sv-legend-dot"
                              style={{ background: item.color }}
                            />
                            <span className="sv-legend-label">{item.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>

            <div className="sidebar-section-head">
              <span className="sidebar-section-title">{t('Source')}</span>
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
                      <span className="filter-pill source-pill">
                        {t(s.labelKey)}
                      </span>
                      <span className="filter-count">{sourceCounts[s.id] ?? 0}</span>
                    </button>
                  </li>
                )
              })}
            </ul>

            <div className="sidebar-events-count">
              {shownCount === totalCount
                ? (totalCount === 1
                  ? t('{count} event this month', { count: totalCount })
                  : t('{count} events this month', { count: totalCount }))
                : t('{shown} of {total} events shown', { shown: shownCount, total: totalCount })}
            </div>
          </>
        )}

        {/* User info + Change PIN + Logout — pinned to bottom */}
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{(user?.name || '').split(/\s+/)[0]}</span>
            {user?.role && (
              <span className="role-badge" style={{ background: ROLE_COLORS[user.role] || '#95A5A6' }}>
                {t(user.role)}
              </span>
            )}
          </div>
          <button className="sidebar-action-row" onClick={onChangePin}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {t('Change PIN')}
          </button>
          <button className="sidebar-action-row" onClick={onLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {t('Sign Out')}
          </button>
          <span className="sidebar-version">v {__APP_VERSION__}</span>
        </div>
      </aside>
    </>
  )
}
