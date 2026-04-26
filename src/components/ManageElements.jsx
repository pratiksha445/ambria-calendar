import { useState, useEffect } from 'react'
import {
  fetchElements, createElement, updateElement,
  deleteElement, reorderElements,
} from '../lib/elements.js'
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

export default function ManageElements({ currentUser, showToast, onMenu }) {
  const { t } = useLanguage()
  const [elements, setElements] = useState([])
  const [newName, setNewName] = useState('')
  const [newNameHi, setNewNameHi] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editNameHi, setEditNameHi] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoadError(null)
    try {
      setElements(await fetchElements())
    } catch (e) {
      console.error('[ManageElements] load error:', e)
      setLoadError(e?.message ?? String(e))
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    try {
      await createElement(name, newNameHi.trim(), currentUser)
      setNewName('')
      setNewNameHi('')
      showToast?.(t('Element added'))
      await load()
    } catch (err) {
      const msg = err?.message ?? String(err)
      if (msg.includes('duplicate') || msg.includes('unique')) showToast?.(t('Element already exists'))
      else showToast?.(t('Error:') + ' ' + msg)
    }
    setSaving(false)
  }

  const handleSaveEdit = async (id) => {
    const name = editName.trim()
    if (!name) return
    try {
      await updateElement(id, { name, name_hi: editNameHi.trim() || null }, currentUser)
      setEditingId(null)
      showToast?.(t('Element updated'))
      await load()
    } catch (err) {
      const msg = err?.message ?? String(err)
      if (msg.includes('duplicate') || msg.includes('unique')) showToast?.(t('Element already exists'))
      else showToast?.(t('Error:') + ' ' + msg)
    }
  }

  const handleDelete = async (item) => {
    try {
      await deleteElement(item.id, currentUser)
      setConfirmDeleteId(null)
      showToast?.(t('Element deleted'))
      await load()
    } catch (err) {
      showToast?.(t('Error:') + ' ' + (err?.message ?? String(err)))
    }
  }

  const moveUp = async (index) => {
    if (index <= 0) return
    const ids = elements.map((e) => e.id)
    ;[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]
    await reorderElements(ids, currentUser)
    await load()
  }

  const moveDown = async (index) => {
    if (index >= elements.length - 1) return
    const ids = elements.map((e) => e.id)
    ;[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]
    await reorderElements(ids, currentUser)
    await load()
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setEditName(item.name)
    setEditNameHi(item.name_hi || '')
  }

  const filtered = elements.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    (item.name_hi || '').includes(search)
  )

  return (
    <div className="panel-page">
      <div className="panel-header">
        <button className="icon-btn header-menu" onClick={onMenu} aria-label="Open menu">
          <MenuIcon />
        </button>
        <h2>{t('Manage Elements')}</h2>
        <div className="panel-header-spacer" />
      </div>

      <div className="panel-search">
        <input
          type="search"
          placeholder={t('Search elements…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <form className="et-add-form element-add-form" onSubmit={handleAdd}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('Element Name')}
          className="et-add-input"
        />
        <input
          type="text"
          value={newNameHi}
          onChange={(e) => setNewNameHi(e.target.value)}
          placeholder={t('Hindi Name')}
          className="et-add-input"
        />
        <button type="submit" className="btn-save et-add-btn" disabled={saving || !newName.trim()}>
          {saving ? t('Adding…') : t('Add')}
        </button>
      </form>

      {loadError && (
        <div className="et-error-banner">
          {t('Error:')} {loadError}
          <button type="button" className="btn-ghost btn-sm" onClick={load}>{t('Retry')}</button>
        </div>
      )}

      <div className="et-list">
        {filtered.map((item, index) => (
          <div key={item.id} className="et-row">
            <div className="et-reorder">
              <button
                type="button"
                className="et-arrow"
                onClick={() => moveUp(elements.indexOf(item))}
                disabled={elements.indexOf(item) === 0}
                aria-label="Move up"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>
              <button
                type="button"
                className="et-arrow"
                onClick={() => moveDown(elements.indexOf(item))}
                disabled={elements.indexOf(item) === elements.length - 1}
                aria-label="Move down"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>

            <div className="et-name-col">
              {editingId === item.id ? (
                <div className="et-inline-edit element-inline-edit">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    placeholder={t('Element Name')}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(item.id) }}
                  />
                  <input
                    type="text"
                    value={editNameHi}
                    onChange={(e) => setEditNameHi(e.target.value)}
                    placeholder={t('Hindi Name')}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(item.id) }}
                  />
                  <button className="btn-xs btn-approve" onClick={() => handleSaveEdit(item.id)}>{t('Save')}</button>
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
              {editingId !== item.id && (
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => startEdit(item)}
                >
                  {t('Edit')}
                </button>
              )}
              {confirmDeleteId === item.id ? (
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
              )}
            </div>
          </div>
        ))}
        {elements.length === 0 && !loadError && <div className="empty-state">{t('No elements found')}</div>}
        {elements.length > 0 && filtered.length === 0 && (
          <div className="empty-state">{t('No matching elements')}</div>
        )}
      </div>
    </div>
  )
}
