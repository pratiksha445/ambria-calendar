import { useState, useEffect, useRef } from 'react'
import {
  fetchUsers, createUser, updateUser, deleteUser,
  toggleUserActive, approveUser, rejectUser, resetPin, adminSetPin,
} from '../lib/users.js'
import { logAction } from '../lib/audit.js'
import { COUNTRY_CODES, getCodeFromValue, parsePhoneCode, DEPARTMENTS, SALES_TYPES, SALES_DEPARTMENTS } from '../config/formFields.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const ROLES = ['admin', 'gm', 'staff']
const ROLE_COLORS = { admin: '#E85D75', gm: '#7C3AED', staff: '#95A5A6' }
const ROLE_LABELS = { admin: 'Admin', gm: 'GM', staff: 'Staff' }
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
  const { t } = useLanguage()
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
      <button className="btn-xs btn-approve" onClick={() => onSave(pin)} disabled={!valid}>{t('Save')}</button>
      <button className="btn-xs btn-ghost" onClick={onCancel}>{t('Cancel')}</button>
    </div>
  )
}

export default function UserManagement({ currentUser, showToast, onMenu }) {
  const { t } = useLanguage()
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [deptFilter, setDeptFilter] = useState('')
  const [salesTypeFilter, setSalesTypeFilter] = useState('')
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
  // Role change inline UI
  const [changingRoleFor, setChangingRoleFor] = useState(null)
  const [pendingRole, setPendingRole] = useState('')
  const [confirmRoleChange, setConfirmRoleChange] = useState(null)

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
    if (deptFilter && u.department !== deptFilter) return false
    if (salesTypeFilter) {
      if (salesTypeFilter === '_none') {
        if (u.sales_type) return false
      } else if (u.sales_type !== salesTypeFilter) return false
    }
    const q = search.trim().toLowerCase()
    if (!q) return true
    const words = q.split(/\s+/).filter(Boolean)
    const hay = [u.name, u.phone, u.role, u.department, u.sales_type].filter(Boolean).join(' ').toLowerCase()
    return words.every((w) => hay.includes(w))
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
    setForm({ firstName: '', lastName: '', phone_code: '+91', phone: '', role: 'staff', department: '', sales_type: '' })
    setFormError(null)
  }

  const openEdit = (user) => {
    const parsed = parsePhoneCode(user.phone)
    const { firstName, lastName } = splitName(user.name)
    setEditing(user)
    setForm({ firstName, lastName, phone_code: parsed.value, phone: parsed.number, role: user.role, department: user.department || '', sales_type: user.sales_type || '' })
    setFormError(null)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setFormError(null)
    if (!form.firstName.trim()) { setFormError(t('First name is required')); return }
    if (!form.lastName.trim()) { setFormError(t('Last name is required')); return }
    if (!form.phone.trim()) { setFormError(t('Phone is required')); return }

    const code = getCodeFromValue(form.phone_code || '+91')
    const fullPhone = code + ' ' + form.phone.replace(/[^\d\s]/g, '').trim()
    const fullName = form.firstName.trim() + ' ' + form.lastName.trim()

    setSaving(true)
    try {
      const isSalesDept = SALES_DEPARTMENTS.includes(form.department)
      const salesType = isSalesDept && form.sales_type ? form.sales_type : null

      if (editing === 'new') {
        const row = await createUser({ name: fullName, phone: fullPhone, role: form.role, department: form.department || null, sales_type: salesType })
        await logAction(currentUser.id, currentUser.name, 'create', 'user', row.id, {
          summary: `Created user: ${row.name}`, name: row.name, role: row.role,
        })
        showToast?.(t('User created'))
      } else {
        const patch = { name: fullName, phone: fullPhone, role: form.role, department: form.department || null, sales_type: salesType }
        const row = await updateUser(editing.id, patch)
        await logAction(currentUser.id, currentUser.name, 'update', 'user', row.id, {
          summary: `Updated user: ${row.name}`, name: row.name, role: row.role,
        })
        showToast?.(t('User updated'))
      }
      setEditing(null)
      await loadUsers()
    } catch (err) {
      const msg = err?.message ?? String(err)
      if (msg.includes('duplicate') || msg.includes('unique')) setFormError(t('Phone number already exists'))
      else setFormError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (user) => {
    try {
      await deleteUser(user.id)
      await logAction(currentUser.id, currentUser.name, 'delete', 'user', user.id, {
        summary: `Deleted user: ${user.name}`, name: user.name, role: user.role,
      })
      setConfirmDelete(null)
      showToast?.(t('User deleted'))
      await loadUsers()
    } catch (err) { console.error(err) }
  }

  const handleToggle = async (user) => {
    try {
      await toggleUserActive(user.id, !user.is_active)
      await logAction(currentUser.id, currentUser.name, 'update', 'user', user.id, {
        summary: `${user.is_active ? 'Deactivated' : 'Activated'} user: ${user.name}`,
        name: user.name, is_active: !user.is_active,
      })
      showToast?.(t(user.is_active ? 'User deactivated' : 'User activated'))
      await loadUsers()
    } catch (err) { console.error(err) }
  }

  const handleApprove = async (user) => {
    try {
      const row = await approveUser(user.id, currentUser.id)
      await logAction(currentUser.id, currentUser.name, 'approve', 'user', row.id, { summary: `Approved user: ${row.name}`, name: row.name })
      showToast?.(t('{name} approved', { name: user.name }))
      await loadUsers()
    } catch (err) { console.error(err) }
  }

  const handleReject = async (user) => {
    try {
      const row = await rejectUser(user.id, rejectReason.trim())
      await logAction(currentUser.id, currentUser.name, 'reject', 'user', row.id, {
        summary: `Rejected user: ${row.name}${rejectReason.trim() ? ` (reason: ${rejectReason.trim()})` : ''}`,
        name: row.name, reason: rejectReason.trim() || null,
      })
      setRejectingId(null)
      setRejectReason('')
      showToast?.(t('{name} rejected', { name: user.name }))
      await loadUsers()
    } catch (err) { console.error(err) }
  }

  const handleResetPin = async (user) => {
    try {
      await resetPin(user.id)
      await logAction(currentUser.id, currentUser.name, 'update', 'user', user.id, {
        summary: `Reset PIN for user: ${user.name}`,
        action: 'pin_reset', user_name: user.name, reset_to: 'default',
      })
      setConfirmResetPin(null)
      showToast?.(t('PIN reset to 0000 — user will set new PIN on next login'))
      await loadUsers()
    } catch (err) {
      setConfirmResetPin(null)
      showToast?.(err?.message || t('PIN reset failed'))
    }
  }

  const handleSetPin = async (user, pin) => {
    try {
      await adminSetPin(user.id, pin)
      await logAction(currentUser.id, currentUser.name, 'update', 'user', user.id, {
        summary: `Set PIN for user: ${user.name}`,
        action: 'pin_set', user_name: user.name,
      })
      setSettingPinFor(null)
      showToast?.(t('PIN updated'))
      await loadUsers()
    } catch (err) {
      setSettingPinFor(null)
      showToast?.(err?.message || t('PIN update failed'))
    }
  }

  const handleEditFormResetPin = async () => {
    if (!editing || editing === 'new') return
    try {
      await resetPin(editing.id)
      await logAction(currentUser.id, currentUser.name, 'update', 'user', editing.id, {
        summary: `Reset PIN for user: ${editing.name}`,
        action: 'pin_reset', user_name: editing.name, reset_to: 'default',
      })
      showToast?.(t('PIN reset to 0000 — user will set new PIN on next login'))
      await loadUsers()
      const refreshed = (await fetchUsers()).find((u) => u.id === editing.id)
      if (refreshed) setEditing(refreshed)
    } catch (err) {
      showToast?.(err?.message || t('PIN reset failed'))
    }
  }

  const handleEditFormSetPin = async (pin) => {
    if (!editing || editing === 'new') return
    try {
      await adminSetPin(editing.id, pin)
      await logAction(currentUser.id, currentUser.name, 'update', 'user', editing.id, {
        summary: `Set PIN for user: ${editing.name}`,
        action: 'pin_set', user_name: editing.name,
      })
      showToast?.(t('PIN updated'))
      await loadUsers()
      const refreshed = (await fetchUsers()).find((u) => u.id === editing.id)
      if (refreshed) setEditing(refreshed)
    } catch (err) {
      showToast?.(err?.message || t('PIN update failed'))
    }
  }

  // Inline role change
  const startRoleChange = (user) => {
    setChangingRoleFor(user.id)
    setPendingRole(user.role)
    setConfirmRoleChange(null)
  }

  const cancelRoleChange = () => {
    setChangingRoleFor(null)
    setPendingRole('')
    setConfirmRoleChange(null)
  }

  const handleRoleSelect = (user, newRole) => {
    if (newRole === user.role) { cancelRoleChange(); return }
    setPendingRole(newRole)
    setConfirmRoleChange(user)
  }

  const confirmAndSaveRole = async () => {
    const user = confirmRoleChange
    if (!user) return
    const oldRole = user.role
    try {
      await updateUser(user.id, { role: pendingRole })
      await logAction(currentUser.id, currentUser.name, 'update', 'user', user.id, {
        summary: `Changed role for ${user.name} from ${ROLE_LABELS[oldRole]} to ${ROLE_LABELS[pendingRole]}`,
        name: user.name,
        changes: [{ field: 'role', field_label: 'Role', old_value: ROLE_LABELS[oldRole], new_value: ROLE_LABELS[pendingRole] }],
      }, currentUser.role)
      cancelRoleChange()
      showToast?.(t('Role updated'))
      await loadUsers()
    } catch (err) { console.error(err) }
  }

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

  const renderApprovalBadge = (status) => {
    const colors = { pending: '#F59E0B', approved: '#22C55E', rejected: '#E85D75' }
    return (
      <span className="approval-badge" style={{ background: colors[status] }}>{t(status)}</span>
    )
  }

  const renderUserCard = (u, section) => {
    const isSelf = u.id === currentUser.id
    const isChangingRole = changingRoleFor === u.id

    return (
    <div key={u.id} className={`user-row ${!u.is_active ? 'inactive' : ''}`}>
      <div className="user-info">
        <div className="user-name-line">
          <span className="user-name">{u.name}</span>
          <span className="role-badge" style={{ background: ROLE_COLORS[u.role] }}>{t(ROLE_LABELS[u.role] || u.role)}</span>
          {renderApprovalBadge(u.approval_status)}
          {!u.is_active && u.approval_status === 'approved' && <span className="status-badge-inactive">{t('Inactive')}</span>}
        </div>
        <div className="user-phone">{u.phone}</div>
        {u.department && (
          <div className="user-department">
            {t(u.department)}
            {u.sales_type && <span className="sales-type-tag">{t(u.sales_type)}</span>}
          </div>
        )}
        <div className="pin-display-box">
          <span className="pin-display-label">{t('PIN:')}</span>
          <span className="pin-display-value">{u.pin}</span>
        </div>
        <div className="user-date">
          {u.approval_status === 'pending' && u.requested_at
            ? t('Requested {date}', { date: formatDate(u.requested_at) })
            : t('Joined {date}', { date: formatDate(u.created_at) })}
        </div>
        {u.approval_status === 'rejected' && u.rejection_reason && (
          <div className="reject-reason-text">{t('Reason: {reason}', { reason: u.rejection_reason })}</div>
        )}
      </div>
      <div className="user-actions">
        {/* PIN actions — single Reset PIN with inline options */}
        {confirmResetPin === u.id ? (
          <div className="reset-pin-panel">
            <button className="btn-outline btn-sm" onClick={() => handleResetPin(u)}>{t('Reset to default (0000)')}</button>
            <div className="reset-pin-or">{t('or set custom:')}</div>
            <InlinePinInput
              onSave={(pin) => handleSetPin(u, pin)}
              onCancel={() => setConfirmResetPin(null)}
            />
          </div>
        ) : (
          <div className="pin-action-row">
            <button className="btn-outline btn-sm" onClick={() => { setConfirmResetPin(u.id); setSettingPinFor(null) }}>{t('Reset PIN')}</button>
          </div>
        )}

        {/* Section-specific actions */}
        {section === 'pending' && (
          <>
            <button className="btn-xs btn-approve" onClick={() => handleApprove(u)}>{t('Approve')}</button>
            {rejectingId === u.id ? (
              <div className="reject-reason-row">
                <input
                  type="text"
                  className="reject-reason-input"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('Reason (optional)')}
                  autoFocus
                />
                <button className="btn-xs btn-reject" onClick={() => handleReject(u)}>{t('Confirm')}</button>
                <button className="btn-xs btn-ghost" onClick={() => { setRejectingId(null); setRejectReason('') }}>{t('Cancel')}</button>
              </div>
            ) : (
              <button className="btn-xs btn-reject" onClick={() => setRejectingId(u.id)}>{t('Reject')}</button>
            )}
          </>
        )}
        {section === 'approved' && (
          <>
            {/* Inline role change */}
            {isChangingRole ? (
              <div className="role-change-row">
                <select
                  className="role-change-select"
                  value={pendingRole}
                  onChange={(e) => handleRoleSelect(u, e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <button className="btn-xs btn-ghost" onClick={cancelRoleChange}>{t('Cancel')}</button>
              </div>
            ) : (
              <button
                className="btn-ghost btn-sm"
                onClick={() => startRoleChange(u)}
                disabled={isSelf}
                title={isSelf ? t('You cannot change your own role') : ''}
              >
                {t('Change Role')}
              </button>
            )}
            <button className="btn-ghost btn-sm" onClick={() => openEdit(u)}>{t('Edit')}</button>
            <button className="btn-ghost btn-sm" onClick={() => handleToggle(u)}>
              {t(u.is_active ? 'Deactivate' : 'Activate')}
            </button>
            {confirmDelete === u.id ? (
              <div className="inline-confirm">
                <span>{t('Remove {name}?', { name: u.name })}</span>
                <button className="btn-danger btn-sm" onClick={() => handleDelete(u)}>{t('Yes')}</button>
                <button className="btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>{t('No')}</button>
              </div>
            ) : (
              <button
                className="btn-ghost btn-sm danger-text"
                onClick={() => setConfirmDelete(u.id)}
                disabled={u.id === currentUser.id}
                title={u.id === currentUser.id ? t('Cannot delete yourself') : ''}
              >
                {t('Delete')}
              </button>
            )}
          </>
        )}
        {section === 'rejected' && (
          <>
            <button className="btn-xs btn-approve" onClick={() => handleApprove(u)}>{t('Re-approve')}</button>
            {confirmDelete === u.id ? (
              <div className="inline-confirm">
                <span>{t('Remove {name}?', { name: u.name })}</span>
                <button className="btn-danger btn-sm" onClick={() => handleDelete(u)}>{t('Yes')}</button>
                <button className="btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>{t('No')}</button>
              </div>
            ) : (
              <button
                className="btn-ghost btn-sm danger-text"
                onClick={() => setConfirmDelete(u.id)}
                disabled={u.id === currentUser.id}
              >
                {t('Delete')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
    )
  }

  return (
    <div className="panel-page">
      <div className="panel-header">
        <button className="icon-btn header-menu" onClick={onMenu} aria-label="Open menu">
          <MenuIcon />
        </button>
        <h2>{t('Manage Users')}</h2>
        <button className="book-btn" onClick={openNew}>{t('+ Add User')}</button>
      </div>

      <div className="um-tabs" role="tablist">
        {TABS.map((tabKey) => (
          <button
            key={tabKey}
            role="tab"
            aria-selected={tab === tabKey}
            className={`um-tab ${tab === tabKey ? 'active' : ''}`}
            onClick={() => setTab(tabKey)}
          >
            {t(tabKey.charAt(0).toUpperCase() + tabKey.slice(1))}
            <span className="um-tab-count">{counts[tabKey]}</span>
          </button>
        ))}
      </div>

      <div className="panel-search um-filters">
        <input
          type="search"
          placeholder={t('Search by name or phone…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="um-dept-filter"
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
        >
          <option value="">{t('All Departments')}</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{t(d)}</option>
          ))}
        </select>
        <select
          className="um-dept-filter"
          value={salesTypeFilter}
          onChange={(e) => setSalesTypeFilter(e.target.value)}
        >
          <option value="">{t('All Sales Types')}</option>
          {SALES_TYPES.map((st) => (
            <option key={st} value={st}>{t(st)}</option>
          ))}
        </select>
      </div>

      <div className="user-list">
        {tab === 'all' ? (
          <>
            {pendingUsers.length > 0 && (
              <div className="um-section">
                <div className="um-section-title">
                  {t('Pending Requests')}
                  <span className="um-tab-count">{pendingUsers.length}</span>
                </div>
                {pendingUsers.map((u) => renderUserCard(u, 'pending'))}
              </div>
            )}
            {approvedUsers.length > 0 && (
              <div className="um-section">
                <div className="um-section-title">{t('Approved Users')}</div>
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
                  {t('Rejected')}
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
        {filtered.length === 0 && <div className="empty-state">{t('No users found')}</div>}
      </div>

      {/* Role change confirmation modal */}
      {confirmRoleChange && (
        <div className="modal-root" role="dialog" aria-modal="true">
          <div className="modal-backdrop" onClick={cancelRoleChange} />
          <div className="panel-form-card role-confirm-card">
            <h3>{t('Change Role')}</h3>
            <p className="role-confirm-text">
              {t('Change {name} from {old} to {new}? This affects what they can edit and access.', {
                name: confirmRoleChange.name,
                old: ROLE_LABELS[confirmRoleChange.role],
                new: ROLE_LABELS[pendingRole],
              })}
            </p>
            <div className="panel-form-actions">
              <button type="button" className="btn-ghost" onClick={cancelRoleChange}>{t('Cancel')}</button>
              <button type="button" className="btn-save" onClick={confirmAndSaveRole}>{t('Confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-root" role="dialog" aria-modal="true">
          <div className="modal-backdrop" onClick={() => setEditing(null)} />
          <div className="panel-form-card">
            <h3>{t(editing === 'new' ? 'Add User' : 'Edit User')}</h3>
            <form onSubmit={handleSave} noValidate>
              <div className="name-row">
                <div className="pf-field">
                  <label className="field-label">{t('First Name')} <span className="required-star">*</span></label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value.replace(/[^a-zA-Z\s]/g, '') })}
                    placeholder={t('First name')}
                  />
                </div>
                <div className="pf-field">
                  <label className="field-label">{t('Last Name')} <span className="required-star">*</span></label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value.replace(/[^a-zA-Z\s]/g, '') })}
                    placeholder={t('Last name')}
                  />
                </div>
              </div>
              <div className="pf-field">
                <label className="field-label">{t('Phone')} <span className="required-star">*</span></label>
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
                  <label className="field-label">{t('PIN')}</label>
                  <div className="pin-default-note">{t('Default PIN is 0000 — user will set their own on first login')}</div>
                </div>
              ) : (
                <div className="pf-field">
                  <label className="field-label">{t('PIN')}</label>
                  <div className="edit-pin-section">
                    <div className="pin-display-box">
                      <span className="pin-display-label">{t('Current:')}</span>
                      <span className="pin-display-value">{editing.pin}</span>
                    </div>
                    {form._resetPinOpen ? (
                      <div className="reset-pin-panel">
                        <button type="button" className="btn-outline btn-sm" onClick={handleEditFormResetPin}>
                          {t('Reset to default (0000)')}
                        </button>
                        <div className="reset-pin-or">{t('or set custom:')}</div>
                        <InlinePinInput
                          onSave={(pin) => {
                            handleEditFormSetPin(pin)
                            setForm((f) => ({ ...f, _resetPinOpen: false }))
                          }}
                          onCancel={() => setForm((f) => ({ ...f, _resetPinOpen: false }))}
                        />
                      </div>
                    ) : (
                      <div className="edit-pin-actions">
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          onClick={() => setForm((f) => ({ ...f, _resetPinOpen: true }))}
                        >
                          {t('Reset PIN')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pf-field">
                <label className="field-label">{t('Role')}</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{t(ROLE_LABELS[r])}</option>
                  ))}
                </select>
              </div>
              <div className="pf-field">
                <label className="field-label">{t('Department')}</label>
                <select value={form.department} onChange={(e) => {
                  const dept = e.target.value
                  const isSales = SALES_DEPARTMENTS.includes(dept)
                  setForm({ ...form, department: dept, sales_type: isSales ? form.sales_type : '' })
                }}>
                  <option value="">{t('— Select —')}</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{t(d)}</option>
                  ))}
                </select>
              </div>
              {SALES_DEPARTMENTS.includes(form.department) && (
                <div className="pf-field">
                  <label className="field-label">{t('Sales Type')}</label>
                  <select value={form.sales_type} onChange={(e) => setForm({ ...form, sales_type: e.target.value })}>
                    <option value="">{t('— Select —')}</option>
                    {SALES_TYPES.map((st) => (
                      <option key={st} value={st}>{t(st)}</option>
                    ))}
                  </select>
                </div>
              )}
              {formError && <div className="login-error">{formError}</div>}
              <div className="panel-form-actions">
                <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>{t('Cancel')}</button>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving ? t('Saving…') : t(editing === 'new' ? 'Create User' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
