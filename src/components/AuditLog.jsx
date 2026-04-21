import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

const ACTION_COLORS = {
  create: '#22C55E', update: '#4A90D9', delete: '#E85D75',
  soft_delete: '#E85D75', bulk_delete: '#E85D75',
  login: '#95A5A6', logout: '#95A5A6',
}

const ACTION_LABELS = {
  create: 'Created', update: 'Updated', delete: 'Deleted',
  soft_delete: 'Deleted', bulk_delete: 'Bulk Delete',
  login: 'Login', logout: 'Logout',
}

const ROLE_COLORS = { admin: '#E85D75', manager: '#4A90D9', staff: '#95A5A6' }

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export default function AuditLog({ onMenu }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [filterUser, setFilterUser] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [users, setUsers] = useState([])

  useEffect(() => {
    supabase.from('users').select('id, name, role').order('name')
      .then(({ data }) => setUsers(data ?? []))
  }, [])

  useEffect(() => { loadEntries(true) }, [filterUser, filterAction, filterFrom, filterTo])

  async function loadEntries(reset = false) {
    setLoading(true)
    const offset = reset ? 0 : entries.length
    let q = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + 49)

    if (filterUser) q = q.eq('user_id', filterUser)
    if (filterAction) q = q.eq('action', filterAction)
    if (filterFrom) q = q.gte('created_at', filterFrom + 'T00:00:00')
    if (filterTo) q = q.lte('created_at', filterTo + 'T23:59:59')

    const { data, error } = await q
    if (error) { console.error(error); setLoading(false); return }
    const rows = data ?? []
    if (reset) setEntries(rows)
    else setEntries((prev) => [...prev, ...rows])
    setHasMore(rows.length === 50)
    setLoading(false)
  }

  const formatTime = (ts) => {
    const d = new Date(ts)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const describeEntity = (entry) => {
    if (entry.entity_type === 'session') {
      return entry.action === 'login' ? 'Logged in' : 'Logged out'
    }
    if (entry.entity_type === 'user') {
      const name = entry.details?.name || 'Unknown'
      const role = entry.details?.role || ''
      return `User \u2014 ${name}${role ? ` (${role})` : ''}`
    }
    if (entry.entity_type === 'event') {
      const d = entry.details
      if (!d) return 'Event'
      if (entry.action === 'bulk_delete') {
        return `Bulk delete \u2014 ${d.count || '?'} events`
      }
      const title = d.title || d.new?.title || ''
      const venue = d.venue_id || d.new?.venue_id || ''
      return `${title}${venue ? ' | ' + venue.toUpperCase() : ''}`
    }
    return entry.entity_type
  }

  const getUserRole = (entry) => {
    const u = users.find((x) => x.id === entry.user_id)
    return u?.role || null
  }

  return (
    <div className="panel-page">
      <div className="panel-header">
        <button className="icon-btn header-menu" onClick={onMenu} aria-label="Open menu">
          <MenuIcon />
        </button>
        <h2>Audit Log</h2>
        <div className="panel-header-spacer" />
      </div>

      <div className="audit-filters">
        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
          <option value="">All users</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
          <option value="">All actions</option>
          <option value="create">Created</option>
          <option value="update">Updated</option>
          <option value="delete">Deleted</option>
          <option value="login">Login</option>
          <option value="logout">Logout</option>
        </select>
        <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
        <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
      </div>

      <div className="audit-list">
        {entries.map((entry) => {
          const role = getUserRole(entry)
          return (
            <div
              key={entry.id}
              className={`audit-entry ${expanded === entry.id ? 'expanded' : ''}`}
              onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
            >
              <div className="audit-entry-main">
                <div className="audit-top-row">
                  <span className="audit-time">{formatTime(entry.created_at)}</span>
                  <span
                    className="action-badge"
                    style={{ background: ACTION_COLORS[entry.action] || '#95A5A6' }}
                  >
                    {ACTION_LABELS[entry.action] || entry.action}
                  </span>
                </div>
                <div className="audit-who">
                  <span className="audit-user-name">{entry.user_name || 'System'}</span>
                  {role && (
                    <span className="role-badge sm" style={{ background: ROLE_COLORS[role] }}>{role}</span>
                  )}
                </div>
                <div className="audit-desc">{describeEntity(entry)}</div>
              </div>
              {expanded === entry.id && entry.details && (
                <pre className="audit-details">{JSON.stringify(entry.details, null, 2)}</pre>
              )}
            </div>
          )
        })}
        {entries.length === 0 && !loading && <div className="empty-state">No audit entries found</div>}
      </div>

      {loading && <div className="loading">Loading\u2026</div>}
      {hasMore && !loading && entries.length > 0 && (
        <button className="btn-ghost load-more" onClick={() => loadEntries(false)}>Load more</button>
      )}
    </div>
  )
}
