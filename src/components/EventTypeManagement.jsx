import { useState, useEffect } from 'react'
import {
  fetchEventTypes, createEventType, updateEventType, deleteEventType,
} from '../lib/eventTypes.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export default function EventTypeManagement({ currentUser, showToast, onMenu }) {
  const { t } = useLanguage()
  const [items, setItems] = useState([])
  const [newName, setNewName] = useState('')
  const [newNameHi, setNewNameHi] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editNameHi, setEditNameHi] = useState('')
  const [adding, setAdding] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchEventTypes()
      .then((rows) => { if (!cancelled) setItems(rows) })
      .catch((e) => { if (!cancelled) { console.error(e); setError(e?.message ?? String(e)) } })
    return () => { cancelled = true }
  }, [])

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    (item.name_hi || '').includes(search)
  )

  const handleAdd = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    if (items.some((it) => it.name.toLowerCase() === name.toLowerCase())) {
      setError(t('Event type already exists'))
      return
    }
    setAdding(true)
    setError(null)
    try {
      const row = await createEventType(name, newNameHi.trim(), currentUser)
      setItems((prev) => [...prev, row].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      setNewNameHi('')
      showToast?.(t('Event type added'))
    } catch (err) {
      console.error(err)
      const msg = err?.message ?? String(err)
      if (msg.includes('duplicate') || msg.includes('unique')) setError(t('Event type already exists'))
      else setError(msg)
    } finally {
      setAdding(false)
    }
  }

  const handleSaveEdit = async (id) => {
    const name = editName.trim()
    if (!name) return
    setSavingId(id)
    setError(null)
    try {
      const row = await updateEventType(id, { name, name_hi: editNameHi.trim() || null }, currentUser)
      setItems((prev) => prev.map((it) => it.id === id ? { ...it, ...row } : it).sort((a, b) => a.name.localeCompare(b.name)))
      setEditingId(null)
      showToast?.(t('Event type renamed'))
    } catch (err) {
      console.error(err)
      const msg = err?.message ?? String(err)
      if (msg.includes('duplicate') || msg.includes('unique')) setError(t('Event type already exists'))
      else setError(msg)
    } finally {
      setSavingId(null)
    }
  }

  const handleDelete = async (item) => {
    if (item.name === 'Other' || item.is_protected) {
      alert(t('Cannot delete the Other event type'))
      return
    }
    if (!window.confirm(t('Delete') + ` "${item.name}"?`)) return
    setError(null)
    try {
      await deleteEventType(item.id, currentUser)
      setItems((prev) => prev.filter((it) => it.id !== item.id))
      showToast?.(t('Event type deleted'))
    } catch (err) {
      console.error(err)
      setError(err?.message ?? String(err))
    }
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setEditName(item.name)
    setEditNameHi(item.name_hi || '')
  }

  const isProtected = (item) => item.name === 'Other' || item.is_protected

  return (
    <div className="panel-page">
      <div className="panel-header">
        <button className="icon-btn header-menu" onClick={onMenu} aria-label="Open menu">
          <MenuIcon />
        </button>
        <h2>{t('Event Types')}</h2>
        <div className="panel-header-spacer" />
      </div>

      <div className="panel-search">
        <input
          type="search"
          placeholder={t('Search event types…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <form className="et-add-form element-add-form" onSubmit={handleAdd}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('New event type name…')}
          className="et-add-input"
        />
        <input
          type="text"
          value={newNameHi}
          onChange={(e) => setNewNameHi(e.target.value)}
          placeholder={t('Hindi Name')}
          className="et-add-input"
        />
        <button type="submit" className="btn-save et-add-btn" disabled={adding}>
          {adding ? t('Adding…') : t('Add')}
        </button>
      </form>

      {error && (
        <div className="et-error-banner">
          {error}
          <button type="button" className="btn-ghost btn-sm" onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="et-list">
        {filtered.map((item) => (
          <div key={item.id} className="et-row">
            <div className="et-name-col">
              {editingId === item.id ? (
                <div className="et-inline-edit element-inline-edit">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    placeholder={t('New event type name…')}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(item.id) }}
                  />
                  <input
                    type="text"
                    value={editNameHi}
                    onChange={(e) => setEditNameHi(e.target.value)}
                    placeholder={t('Hindi Name')}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(item.id) }}
                  />
                  <button className="btn-xs btn-approve" onClick={() => handleSaveEdit(item.id)} disabled={savingId === item.id}>
                    {savingId === item.id ? '…' : t('Save')}
                  </button>
                  <button className="btn-xs btn-ghost" onClick={() => setEditingId(null)}>{t('Cancel')}</button>
                </div>
              ) : (
                <>
                  <span className="et-name">{item.name}</span>
                  {item.name_hi && <span className="element-name-hi">{item.name_hi}</span>}
                </>
              )}
            </div>
            <div className="et-actions">
              {editingId !== item.id && !isProtected(item) && (
                <>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => startEdit(item)}>{t('Edit')}</button>
                  <button type="button" className="btn-ghost btn-sm danger-text" onClick={() => handleDelete(item)}>{t('Delete')}</button>
                </>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && !error && <div className="empty-state">{t('No event types found')}</div>}
        {items.length > 0 && filtered.length === 0 && (
          <div className="empty-state">{t('No matching event types')}</div>
        )}
      </div>
    </div>
  )
}
