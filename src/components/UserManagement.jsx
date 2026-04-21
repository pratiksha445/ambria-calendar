import { useState, useEffect, useRef } from 'react'
import {
  fetchUsers, createUser, updateUser, deleteUser,
  toggleUserActive, approveUser, rejectUser, resetPin, adminSetPin,
} from '../lib/users.js'
import { logAction } from '../lib/audit.js'
import { COUNTRY_CODES, getCodeFromValue, parsePhoneCode } from '../config/formFields.js'

const ROLES = ['admin', 'manager', 'staff']
const ROLE_COLORS = { admin: '#E85D75', manager: '#4A90D9', staff: '#95A5A6' }
const TABS = ['all', 'pending', 'approved', 'rejected']

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function InlinePinInput({ onSave, onCancel }) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const refs = [useRef(), useRef(), useRef(), useRef()]

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[i] = val
    setDigits(next)
    if (val && i < 3) refs[i + 1].current?.focus()
  }
  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs[i - 1].current?.focus()
  }
  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (!text) return
    e.preventDefault()
    const next = ['', '', '', '']
    for (let j = 0; j < text.length; j++) next[j] = text[j]
    setDigits(next)
    refs[Math.min(text.length, 3)].current?.focus()
  }
  const pin = digits.join('')
  const valid = /^\d{4}$/.test(pin)

  return (
    <div className="inline-set-pin">
      <div className="pin-boxes pin-boxes-sm">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={refs[i]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            className="pin-box pin-box-sm"
            autoComplete="off"
            autoFocus={i === 0}
          />
        ))}
      </div>
      <button className="btn-xs btn-approve" onClick={() => onSave(pin)} disabled={!valid}>Save</button>
      <button className="btn-xs btn-ghost" onClick={onCancel}>Cancel</button>
    </div>
  )
}

export default function UserManagement({ currentUser, showToast, onMenu }) {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmResetPin, setConfirmResetPin] = useState(null)
  const [settingPinFor, setSettingPinFor] = useState(null)
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectedOpen, setRejectedOpen] = useState(false)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    try { setUsers(await fetchUsers()) } catch (e) { console.error(e) }
  }

  const counts = {
    all: users.length,
    pending: users.filter((u) => u.approval_status === 'pending').length,
    approved: users.filter((u) => u.approval_status === 'approved').length,
    rejected: users.filter((u) => u.approval_status === 'rejected').length,
  }

  const filtered = users.filter((u) => {
    if (tab !== 'all' && u.approval_status !== tab) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return u.name.toLowerCase().includes(q) || u.phone.includes(q)
  })

  const pendingUsers = filtered.filter((u) => u.approval_status === 'pending')
  const approvedUsers = filtered.filter((u) => u.approval_status === 'approved')
  const rejectedUsers = filtered.filter((u) => u.approval_status === 'rejected')

  function splitName(fullName) {
    const parts = (fullName || '').trim().split(/\s+/)
    return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' }
  }

  const openNew = () => {
    setEditing('new')
    setForm({ firstName: '', lastName: '', phone_code: '+91', phone: '', role: 'staff' })
    setFormError(null)
  }

  const openEdit = (user) => {
    const parsed = parsePhoneCode(user.phone)
    const { firstName, lastName } = splitName(user.name)
    setEditing(user)
    setForm({ firstName, lastName, phone_code: parsed.value, phone: parsed.number, role: user.role })
    setFormError(null)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setFormError(null)
    if (!form.firstName.trim()) { setFormError('First name is required'); return }
    if (!form.lastName.trim()) { setFormError('Last name is required'); return }
    if (!form.phone.trim()) { setFormError('Phone is required'); return }

    const code = getCodeFromValue(form.phone_code || '+91')
    const fullPhone = code + ' ' + form.phone.replace(/[^\d\s]/g, '').trim()
    const fullName = form.firstName.trim() + ' ' + form.lastName.trim()

    setSaving(true)
    try {
      if (editing === 'new') {
        const row = await createUser({ name: fullName, phone: fullPhone, role: form.role })
        await logAction(currentUser.id, currentUser.name, 'create', 'user', row.id, {
          name: row.name, role: row.role,
        })
        showToast?.('User created')
      } else {
        const patch = { name: fullName, phone: fullPhone, role: form.role }
        const row = await updateUser(editing.id, patch)
        await logAction(currentUser.id, currentUser.name, 'update', 'user', row.id, {
          name: row.name, role: row.role,
        })
        showToast?.('User updated')
      }
      setEditing(null)
      await loadUsers()
    } catch (err) {
      const msg = err?.message ?? String(err)
      if (msg.includes('duplicate') || msg.includes('unique')) setFormError('Phone number already exists')
      else setFormError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (user) => {
    try {
      await deleteUser(user.id)
      await logAction(currentUser.id, currentUser.name, 'delete', 'user', user.id, {
        name: user.name, role: user.role,
      })
      setConfirmDelete(null)
      showToast?.('User deleted')
      await loadUsers()
    } catch (err) { console.error(err) }
  }

  const handleToggle = async (user) => {
    try {
      await toggleUserActive(user.id, !user.is_active)
      await logAction(currentUser.id, currentUser.name, 'update', 'user', user.id, {
        name: user.name, is_active: !user.is_active,
      })
      showToast?.(user.is_active ? 'User deactivated' : 'User activated')
      await loadUsers()
    } catch (err) { console.error(err) }
  }

  const handleApprove = async (user) => {
    try {
      const row = await approveUser(user.id, currentUser.id)
      await logAction(currentUser.id, currentUser.name, 'approve', 'user', row.id, { name: row.name })
      showToast?.(`${user.name} approved`)
      await loadUsers()
    } catch (err) { console.error(err) }
  }

  const handleReject = async (user) => {
    try {
      const row = await rejectUser(user.id, rejectReason.trim())
      await logAction(currentUser.id, currentUser.name, 'reject', 'user', row.id, {
        name: row.name, reason: rejectReason.trim() || null,
      })
      setRejectingId(null)
      setRejectReason('')
      showToast?.(`${user.name} rejected`)
      await loadUsers()
    } catch (err) { console.error(err) }
  }

  const handleResetPin = async (user) => {
    try {
      await resetPin(user.id)
      await logAction(currentUser.id, currentUser.name, 'update', 'user', user.id, {
        action: 'pin_reset', user_name: user.name, reset_to: 'default',
      })
      setConfirmResetPin(null)
      showToast?.('PIN reset to 0000 \u2014 user will set new PIN on next login')
      await loadUsers()
    } catch (err) { console.error(err) }
  }

  const handleSetPin = async (user, pin) => {
    try {
      await adminSetPin(user.id, pin)
      await logAction(currentUser.id, currentUser.name, 'update', 'user', user.id, {
        action: 'pin_set', user_name: user.name,
      })
      setSettingPinFor(null)
      showToast?.('PIN updated')
      await loadUsers()
    } catch (err) { console.error(err) }
  }

  const handleEditFormResetPin = async () => {
    if (!editing || editing === 'new') return
    try {
      await resetPin(editing.id)
      await logAction(currentUser.id, currentUser.name, 'update', 'user', editing.id, {
        action: 'pin_reset', user_name: editing.name, reset_to: 'default',
      })
      showToast?.('PIN reset to 0000')
      await loadUsers()
      // Refresh the editing object
      const refreshed = (await fetchUsers()).find((u) => u.id === editing.id)
      if (refreshed) setEditing(refreshed)
    } catch (err) { console.error(err) }
  }

  const handleEditFormSetPin = async (pin) => {
    if (!editing || editing === 'new') return
    try {
      await adminSetPin(editing.id, pin)
      await logAction(currentUser.id, currentUser.name, 'update', 'user', editing.id, {
        action: 'pin_set', user_name: editing.name,
      })
      showToast?.('PIN updated')
      await loadUsers()
      const refreshed = (await fetchUsers()).find((u) => u.id === editing.id)
      if (refreshed) setEditing(refreshed)
    } catch (err) { console.error(err) }
  }

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

  const renderApprovalBadge = (status) => {
    const colors = { pending: '#F59E0B', approved: '#22C55E', rejected: '#E85D75' }
    return (
      <span className="approval-badge" style={{ background: colors[status] }}>{status}</span>
    )
  }

  const renderUserCard = (u, section) => (
    <div key={u.id} className={`user-row ${!u.is_active ? 'inactive' : ''}`}>
      <div className="user-info">
        <div className="user-name-line">
          <span className="user-name">{u.name}</span>
          <span className="role-badge" style={{ background: ROLE_COLORS[u.role] }}>{u.role}</span>
          {renderApprovalBadge(u.approval_status)}
          {!u.is_active && u.approval_status === 'approved' && <span className="status-badge-inactive">Inactive</span>}
        </div>
        <div className="user-phone">{u.phone}</div>
        <div className="pin-display-box">
          <span className="pin-display-label">PIN:</span>
          <span className="pin-display-value">{u.pin}</span>
        </div>
        <div className="user-date">
          {u.approval_status === 'pending' && u.requested_at
            ? `Requested ${formatDate(u.requested_at)}`
            : `Joined ${formatDate(u.created_at)}`}
        </div>
        {u.approval_status === 'rejected' && u.rejection_reason && (
          <div className="reject-reason-text">Reason: {u.rejection_reason}</div>
        )}
      </div>
      <div className="user-actions">
        {/* PIN actions — all sections */}
        {confirmResetPin === u.id ? (
          <div className="inline-confirm">
            <span>Reset PIN to 0000?</span>
            <button className="btn-danger btn-sm" onClick={() => handleResetPin(u)}>Yes</button>
            <button className="btn-ghost btn-sm" onClick={() => setConfirmResetPin(null)}>No</button>
          </div>
        ) : settingPinFor === u.id ? (
          <InlinePinInput
            onSave={(pin) => handleSetPin(u, pin)}
            onCancel={() => setSettingPinFor(null)}
          />
        ) : (
          <div className="pin-action-row">
            <button className="btn-outline btn-sm" onClick={() => { setConfirmResetPin(u.id); setSettingPinFor(null) }}>Reset PIN</button>
            <button className="btn-outline btn-sm" onClick={() => { setSettingPinFor(u.id); setConfirmResetPin(null) }}>Set PIN</button>
          </div>
        )}

        {/* Section-specific actions */}
        {section === 'pending' && (
          <>
            <button className="btn-xs btn-approve" onClick={() => handleApprove(u)}>Approve</button>
            {rejectingId === u.id ? (
              <div className="reject-reason-row">
                <input
                  type="text"
                  className="reject-reason-input"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason (optional)"
                  autoFocus
                />
                <button className="btn-xs btn-reject" onClick={() => handleReject(u)}>Confirm</button>
                <button className="btn-xs btn-ghost" onClick={() => { setRejectingId(null); setRejectReason('') }}>Cancel</button>
              </div>
            ) : (
              <button className="btn-xs btn-reject" onClick={() => setRejectingId(u.id)}>Reject</button>
            )}
          </>
        )}
        {section === 'approved' && (
          <>
            <button className="btn-ghost btn-sm" onClick={() => openEdit(u)}>Edit</button>
            <button className="btn-ghost btn-sm" onClick={() => handleToggle(u)}>
              {u.is_active ? 'Deactivate' : 'Activate'}
            </button>
            {confirmDelete === u.id ? (
              <div className="inline-confirm">
                <span>Remove {u.name}?</span>
                <button className="btn-danger btn-sm" onClick={() => handleDelete(u)}>Yes</button>
                <button className="btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>No</button>
              </div>
            ) : (
              <button
                className="btn-ghost btn-sm danger-text"
                onClick={() => setConfirmDelete(u.id)}
                disabled={u.id === currentUser.id}
                title={u.id === currentUser.id ? 'Cannot delete yourself' : ''}
              >
                Delete
              </button>
            )}
          </>
        )}
        {section === 'rejected' && (
          <>
            <button className="btn-xs btn-approve" onClick={() => handleApprove(u)}>Re-approve</button>
            {confirmDelete === u.id ? (
              <div className="inline-confirm">
                <span>Remove {u.name}?</span>
                <button className="btn-danger btn-sm" onClick={() => handleDelete(u)}>Yes</button>
                <button className="btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>No</button>
              </div>
            ) : (
              <button
                className="btn-ghost btn-sm danger-text"
                onClick={() => setConfirmDelete(u.id)}
                disabled={u.id === currentUser.id}
              >
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="panel-page">
      <div className="panel-header">
        <button className="icon-btn header-menu" onClick={onMenu} aria-label="Open menu">
          <MenuIcon />
        </button>
        <h2>Manage Users</h2>
        <button className="book-btn" onClick={openNew}>+ Add User</button>
      </div>

      <div className="um-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`um-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span className="um-tab-count">{counts[t]}</span>
          </button>
        ))}
      </div>

      <div className="panel-search">
        <input
          type="search"
          placeholder="Search by name or phone\u2026"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="user-list">
        {tab === 'all' ? (
          <>
            {pendingUsers.length > 0 && (
              <div className="um-section">
                <div className="um-section-title">
                  Pending Requests
                  <span className="um-tab-count">{pendingUsers.length}</span>
                </div>
                {pendingUsers.map((u) => renderUserCard(u, 'pending'))}
              </div>
            )}
            {approvedUsers.length > 0 && (
              <div className="um-section">
                <div className="um-section-title">Approved Users</div>
                {approvedUsers.map((u) => renderUserCard(u, 'approved'))}
              </div>
            )}
            {rejectedUsers.length > 0 && (
              <div className="um-section um-collapsible">
                <button
                  type="button"
                  className="um-section-title um-section-toggle"
                  onClick={() => setRejectedOpen(!rejectedOpen)}
                >
                  Rejected
                  <span className="um-tab-count">{rejectedUsers.length}</span>
                  <span className={`um-chevron ${rejectedOpen ? 'open' : ''}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>
                {rejectedOpen && rejectedUsers.map((u) => renderUserCard(u, 'rejected'))}
              </div>
            )}
          </>
        ) : (
          <>{filtered.map((u) => renderUserCard(u, u.approval_status))}</>
        )}
        {filtered.length === 0 && <div className="empty-state">No users found</div>}
      </div>

      {editing && (
        <div className="modal-root" role="dialog" aria-modal="true">
          <div className="modal-backdrop" onClick={() => setEditing(null)} />
          <div className="panel-form-card">
            <h3>{editing === 'new' ? 'Add User' : 'Edit User'}</h3>
            <form onSubmit={handleSave} noValidate>
              <div className="name-row">
                <div className="pf-field">
                  <label className="field-label">First Name <span className="required-star">*</span></label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value.replace(/[^a-zA-Z\s]/g, '') })}
                    placeholder="First name"
                  />
                </div>
                <div className="pf-field">
                  <label className="field-label">Last Name <span className="required-star">*</span></label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value.replace(/[^a-zA-Z\s]/g, '') })}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className="pf-field">
                <label className="field-label">Phone <span className="required-star">*</span></label>
                <div className="phone-combo">
                  <select
                    className="phone-code-select"
                    value={form.phone_code}
                    onChange={(e) => setForm({ ...form, phone_code: e.target.value })}
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.value} value={c.value}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d\s]/g, '') })}
                    placeholder="98765 43210"
                    inputMode="tel"
                  />
                </div>
              </div>

              {/* PIN section */}
              {editing === 'new' ? (
                <div className="pf-field">
                  <label className="field-label">PIN</label>
                  <div className="pin-default-note">Default PIN is 0000 — user will set their own on first login</div>
                </div>
              ) : (
                <div className="pf-field">
                  <label className="field-label">PIN</label>
                  <div className="edit-pin-section">
                    <div className="pin-display-box">
                      <span className="pin-display-label">Current:</span>
                      <span className="pin-display-value">{editing.pin}</span>
                    </div>
                    <div className="edit-pin-actions">
                      <button type="button" className="btn-outline btn-sm" onClick={handleEditFormResetPin}>
                        Reset to 0000
                      </button>
                      {form._settingCustomPin ? (
                        <InlinePinInput
                          onSave={(pin) => {
                            handleEditFormSetPin(pin)
                            setForm((f) => ({ ...f, _settingCustomPin: false }))
                          }}
                          onCancel={() => setForm((f) => ({ ...f, _settingCustomPin: false }))}
                        />
                      ) : (
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          onClick={() => setForm((f) => ({ ...f, _settingCustomPin: true }))}
                        >
                          Set custom PIN
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="pf-field">
                <label className="field-label">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>
              {formError && <div className="login-error">{formError}</div>}
              <div className="panel-form-actions">
                <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving ? 'Saving\u2026' : editing === 'new' ? 'Create User' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
