import { useState, useEffect } from 'react'
import { fetchUsers, createUser, updateUser, deleteUser, toggleUserActive } from '../lib/users.js'
import { logAction } from '../lib/audit.js'
import { COUNTRY_CODES, getCodeFromValue, parsePhoneCode } from '../config/formFields.js'

const ROLES = ['admin', 'manager', 'staff']
const ROLE_COLORS = { admin: '#E85D75', manager: '#4A90D9', staff: '#95A5A6' }

export default function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | user object
  const [form, setForm] = useState({})
  const [showPin, setShowPin] = useState(false)
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    try { setUsers(await fetchUsers()) } catch (e) { console.error(e) }
  }

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return u.name.toLowerCase().includes(q) || u.phone.includes(q)
  })

  const openNew = () => {
    setEditing('new')
    setForm({ name: '', phone_code: '+91', phone: '', pin: '', role: 'staff' })
    setShowPin(false)
    setFormError(null)
  }

  const openEdit = (user) => {
    const parsed = parsePhoneCode(user.phone)
    setEditing(user)
    setForm({ name: user.name, phone_code: parsed.value, phone: parsed.number, pin: '', role: user.role })
    setShowPin(false)
    setFormError(null)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setFormError(null)
    if (!form.name.trim()) { setFormError('Name is required'); return }
    if (!form.phone.trim()) { setFormError('Phone is required'); return }
    const isNew = editing === 'new'
    if (isNew && (!/^\d{4}$/.test(form.pin))) {
      setFormError('PIN must be exactly 4 digits'); return
    }
    if (!isNew && form.pin && !/^\d{4}$/.test(form.pin)) {
      setFormError('PIN must be exactly 4 digits'); return
    }

    const code = getCodeFromValue(form.phone_code || '+91')
    const fullPhone = code + ' ' + form.phone.replace(/[^\d\s]/g, '').trim()

    setSaving(true)
    try {
      if (isNew) {
        const row = await createUser({
          name: form.name.trim(), phone: fullPhone, pin: form.pin, role: form.role,
        })
        await logAction(currentUser.id, currentUser.name, 'create', 'user', row.id, {
          name: row.name, role: row.role,
        })
      } else {
        const patch = { name: form.name.trim(), phone: fullPhone, role: form.role }
        if (form.pin) patch.pin = form.pin
        const row = await updateUser(editing.id, patch)
        await logAction(currentUser.id, currentUser.name, 'update', 'user', row.id, {
          name: row.name, role: row.role,
        })
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
      await loadUsers()
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggle = async (user) => {
    try {
      await toggleUserActive(user.id, !user.is_active)
      await logAction(currentUser.id, currentUser.name, 'update', 'user', user.id, {
        name: user.name, is_active: !user.is_active,
      })
      await loadUsers()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="panel-page">
      <div className="panel-header">
        <h2>Manage Users</h2>
        <button className="book-btn" onClick={openNew}>+ Add User</button>
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
        {filtered.map((u) => (
          <div key={u.id} className={`user-row ${!u.is_active ? 'inactive' : ''}`}>
            <div className="user-info">
              <div className="user-name-line">
                <span className="user-name">{u.name}</span>
                <span className="role-badge" style={{ background: ROLE_COLORS[u.role] }}>{u.role}</span>
                {!u.is_active && <span className="status-badge-inactive">Inactive</span>}
              </div>
              <div className="user-phone">{u.phone}</div>
              <div className="user-date">
                Joined {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <div className="user-actions">
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
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="empty-state">No users found</div>}
      </div>

      {editing && (
        <div className="modal-root" role="dialog" aria-modal="true">
          <div className="modal-backdrop" onClick={() => setEditing(null)} />
          <div className="panel-form-card">
            <h3>{editing === 'new' ? 'Add User' : 'Edit User'}</h3>
            <form onSubmit={handleSave} noValidate>
              <div className="pf-field">
                <label className="field-label">Name <span className="required-star">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
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
              <div className="pf-field">
                <label className="field-label">
                  PIN <span className="required-star">*</span>
                  {editing !== 'new' && <span className="pin-hint"> (leave blank to keep current)</span>}
                </label>
                <div className="pin-input-row">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={form.pin}
                    onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder={editing === 'new' ? '4-digit PIN' : '\u2022\u2022\u2022\u2022'}
                    inputMode="numeric"
                    maxLength={4}
                  />
                  <button type="button" className="pin-toggle" onClick={() => setShowPin(!showPin)}>
                    {showPin ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
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
