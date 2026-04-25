import { useState, useEffect } from 'react'
import {
  fetchEventTypes, createEventType, updateEventType,
  deleteEventType, reorderEventTypes,
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
  const [types, setTypes] = useState([])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoadError(null)
    try {
      setTypes(await fetchEventTypes())
    } catch (e) {
      console.error('[EventTypeManagement] load error:', e)
      setLoadError(e?.message ?? String(e))
      showToast?.(t('Failed to load event types'))
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    console.log('[ET] handleAdd start:', name)
    setSaving(true)
    // Safety: auto-reset saving after 15s in case something hangs
    const safetyTimer = setTimeout(() => {
      console.warn('[ET] handleAdd safety timeout — resetting saving state')
      setSaving(false)
    }, 15000)
    try {
      await createEventType(name, currentUser)
      console.log('[ET] createEventType succeeded')
      setNewName('')
      showToast?.(t('Event type added'))
      await load()
    } catch (err) {
      console.error('[ET] handleAdd error:', err)
      const msg = err?.message ?? String(err)
      if (msg.includes('duplicate') || msg.includes('unique')) showToast?.(t('Event type already exists'))
      else showToast?.(t('Error:') + ' ' + msg)
    } finally {
      clearTimeout(safetyTimer)
      setSaving(false)
      console.log('[ET] handleAdd done, saving=false')
    }
  }

  const handleRename = async (id) => {
    const name = editName.trim()
    if (!name) return
    try {
      await updateEventType(id, { name }, currentUser)
      setEditingId(null)
      setEditName('')
      showToast?.(t('Event type renamed'))
      await load()
    } catch (err) {
      console.error('[EventTypeManagement] rename error:', err)
      const msg = err?.message ?? String(err)
      if (msg.includes('duplicate') || msg.includes('unique')) showToast?.(t('Event type already exists'))
      else showToast?.(t('Error:') + ' ' + msg)
    }
  }

  const handleToggleActive = async (item) => {
    if (item.name === 'Other') return
    try {
      await updateEventType(item.id, { is_active: !item.is_active }, currentUser)
      showToast?.(t(item.is_active ? 'Deactivated' : 'Activated'))
      await load()
    } catch (err) { console.error(err) }
  }

  const handleDelete = async (item) => {
    if (item.name === 'Other') return
    try {
      await deleteEventType(item.id, currentUser)
      setConfirmDeleteId(null)
      showToast?.(t('Event type deleted'))
      await load()
    } catch (err) {
      console.error('[EventTypeManagement] delete error:', err)
      showToast?.(t('Error:') + ' ' + (err?.message ?? String(err)))
    }
  }

  const moveUp = async (index) => {
    if (index <= 0) return
    const ids = types.map((t) => t.id)
    ;[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]
    await reorderEventTypes(ids, currentUser)
    await load()
  }

  const moveDown = async (index) => {
    if (index >= types.length - 1) return
    const ids = types.map((t) => t.id)
    ;[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]
    await reorderEventTypes(ids, currentUser)
    await load()
  }

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

      <form className="et-add-form" onSubmit={handleAdd}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('New event type name…')}
          className="et-add-input"
        />
        <button type="submit" className="btn-save et-add-btn" disabled={saving || !newName.trim()}>
          {saving ? t('Adding…') : t('Add')}
        </button>
      </form>

      {loadError && (
        <div className="et-error-banner">
          {t('Could not load event types.')} {loadError}
          <button type="button" className="btn-ghost btn-sm" onClick={load}>{t('Retry')}</button>
        </div>
      )}

      <div className="et-list">
        {types.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())).map((item, index) => {
          const isOther = item.name === 'Other'
          return (
            <div key={item.id} className={`et-row ${!item.is_active ? 'inactive' : ''}`}>
              <div className="et-reorder">
                <button
                  type="button"
                  className="et-arrow"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="et-arrow"
                  onClick={() => moveDown(index)}
                  disabled={index === types.length - 1}
                  aria-label="Move down"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>

              <div className="et-name-col">
                {editingId === item.id ? (
                  <div className="et-inline-edit">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRename(item.id) }}
                    />
                    <button className="btn-xs btn-approve" onClick={() => handleRename(item.id)}>{t('Save')}</button>
                    <button className="btn-xs btn-ghost" onClick={() => setEditingId(null)}>{t('Cancel')}</button>
                  </div>
                ) : (
                  <span className="et-name">{item.name}</span>
                )}
                {!item.is_active && <span className="status-badge-inactive">{t('Inactive')}</span>}
              </div>

              <div className="et-actions">
                {!isOther && (
                  <button
                    type="button"
                    className="btn-outline btn-sm"
                    onClick={() => handleToggleActive(item)}
                  >
                    {t(item.is_active ? 'Deactivate' : 'Activate')}
                  </button>
                )}
                {!isOther && editingId !== item.id && (
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => { setEditingId(item.id); setEditName(item.name) }}
                  >
                    {t('Edit')}
                  </button>
                )}
                {!isOther && (
                  confirmDeleteId === item.id ? (
                    <div className="inline-confirm">
                      <span>{t('Delete?')}</span>
                      <button className="btn-danger btn-sm" onClick={() => handleDelete(item)}>{t('Yes')}</button>
                      <button className="btn-ghost btn-sm" onClick={() => setConfirmDeleteId(null)}>{t('No')}</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn-ghost btn-sm danger-text"
                      onClick={() => setConfirmDeleteId(item.id)}
                    >
                      {t('Delete')}
                    </button>
                  )
                )}
              </div>
            </div>
          )
        })}
        {types.length === 0 && <div className="empty-state">{t('No event types found')}</div>}
        {types.length > 0 && types.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
          <div className="empty-state">{t('No matching event types')}</div>
        )}
      </div>
    </div>
  )
}
