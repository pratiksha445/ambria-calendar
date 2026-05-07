import { useState, useEffect } from 'react'
import {
  fetchCategories, createCategory, updateCategory,
  deleteCategory, reorderCategories,
} from '../lib/categories.js'
import { applyDynamic, contrastText } from '../config/venues.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const SYSTEM_IDS = new Set(['ap', 'am', 'ae', 'ar', 'villa', 'add', 'ac', 'aee', 'tender'])

const CATEGORY_TYPES = ['venue', 'service', 'villa', 'tender', 'custom']

const PRESET_COLORS = [
  '#fadb50', '#f28a3a', '#7d3639', '#222da3', '#855b7a',
  '#51c6fc', '#fa6eb2', '#5a1a96', '#0f6132', '#6f9164',
  '#E85D75', '#7CB9E8', '#B4A7D6',
]

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export default function CategoryManagement({ currentUser, showToast, onMenu }) {
  const { t } = useLanguage()
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // Form state
  const [fVenueId, setFVenueId] = useState('')
  const [fName, setFName] = useState('')
  const [fShortCode, setFShortCode] = useState('')
  const [fColor, setFColor] = useState(PRESET_COLORS[0])
  const [fCustomColor, setFCustomColor] = useState('')
  const [fCategoryType, setFCategoryType] = useState('custom')
  const [fSubVenues, setFSubVenues] = useState([])
  const [fIsActive, setFIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const rows = await fetchCategories()
      setCategories(rows)
      // Sync global VENUES/VENUE_BY_ID so BookingForm picks up changes
      applyDynamic(rows.filter((r) => r.is_active))
    } catch (e) { console.error(e) }
  }

  const resetForm = () => {
    setFVenueId(''); setFName(''); setFShortCode(''); setFColor(PRESET_COLORS[0])
    setFCustomColor(''); setFCategoryType('custom'); setFSubVenues([]); setFIsActive(true)
    setEditItem(null); setFormOpen(false)
  }

  const openAdd = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (cat) => {
    setEditItem(cat)
    setFVenueId(cat.venue_id)
    setFName(cat.name)
    setFShortCode(cat.short_code)
    setFColor(cat.color)
    setFCustomColor(PRESET_COLORS.includes(cat.color) ? '' : cat.color)
    setFCategoryType(cat.category_type)
    setFSubVenues(cat.sub_venues || [])
    setFIsActive(cat.is_active)
    setFormOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const code = fShortCode.trim().toUpperCase()
    const name = fName.trim()
    if (!name || !code) return

    const color = fCustomColor.trim() || fColor
    const fields = {
      name,
      short_code: code,
      color,
      sub_venues: fSubVenues,
      category_type: fCategoryType,
      is_active: fIsActive,
    }

    setSaving(true)
    try {
      if (editItem) {
        await updateCategory(editItem.id, fields, currentUser)
        showToast?.(t('Category updated'))
      } else {
        const venueId = fVenueId.trim().toLowerCase().replace(/\s+/g, '-') || code.toLowerCase()
        await createCategory({ ...fields, venue_id: venueId }, currentUser)
        showToast?.(t('Category added'))
      }
      resetForm()
      await load()
    } catch (err) {
      const msg = err?.message ?? String(err)
      if (msg.includes('duplicate') || msg.includes('unique')) showToast?.(t('Category ID already exists'))
      else showToast?.(t('Error:') + ' ' + msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cat) => {
    try {
      await deleteCategory(cat.id, currentUser)
      setConfirmDeleteId(null)
      showToast?.(t('Category deleted'))
      await load()
    } catch (err) { console.error(err) }
  }

  const handleToggleActive = async (cat) => {
    try {
      await updateCategory(cat.id, { is_active: !cat.is_active }, currentUser)
      showToast?.(t(cat.is_active ? 'Deactivated' : 'Activated'))
      await load()
    } catch (err) { console.error(err) }
  }

  const moveUp = async (index) => {
    if (index <= 0) return
    const ids = categories.map((c) => c.id)
    ;[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]
    await reorderCategories(ids, currentUser)
    await load()
  }

  const moveDown = async (index) => {
    if (index >= categories.length - 1) return
    const ids = categories.map((c) => c.id)
    ;[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]
    await reorderCategories(ids, currentUser)
    await load()
  }

  const addSubVenue = () => setFSubVenues([...fSubVenues, ''])
  const removeSubVenue = (i) => setFSubVenues(fSubVenues.filter((_, idx) => idx !== i))
  const updateSubVenue = (i, val) => {
    const next = [...fSubVenues]
    next[i] = val
    setFSubVenues(next)
  }
  const moveSubUp = (i) => {
    if (i <= 0) return
    const next = [...fSubVenues]
    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
    setFSubVenues(next)
  }
  const moveSubDown = (i) => {
    if (i >= fSubVenues.length - 1) return
    const next = [...fSubVenues]
    ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
    setFSubVenues(next)
  }

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.short_code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="panel-page">
      <div className="panel-header">
        <button className="icon-btn header-menu" onClick={onMenu} aria-label="Open menu">
          <MenuIcon />
        </button>
        <h2>{t('Categories')}</h2>
        <button className="btn-save cat-add-top" onClick={openAdd}>+ {t('Add Category')}</button>
      </div>

      <div className="panel-search">
        <input
          type="search"
          placeholder={t('Search categories…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category form modal */}
      {formOpen && (
        <div className="modal-root" role="dialog" aria-modal="true">
          <div className="modal-backdrop" onClick={resetForm} />
          <div className="cat-form-card">
            <h3>{editItem ? t('Edit Category') : t('Add Category')}</h3>
            <form onSubmit={handleSave}>
              <div className="cat-form-row">
                <label>{t('Short Code')}</label>
                <input
                  type="text"
                  value={fShortCode}
                  onChange={(e) => setFShortCode(e.target.value.toUpperCase().slice(0, 5))}
                  placeholder="e.g. ABQ"
                  maxLength={5}
                  required
                  disabled={!!editItem && SYSTEM_IDS.has(editItem.venue_id)}
                />
              </div>
              <div className="cat-form-row">
                <label>{t('Name')}</label>
                <input
                  type="text"
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  placeholder="e.g. Ambria Banquets"
                  required
                />
              </div>
              <div className="cat-form-row">
                <label>{t('Color')}</label>
                <div className="cat-color-swatches">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`cat-swatch ${fColor === c && !fCustomColor ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => { setFColor(c); setFCustomColor('') }}
                      aria-label={c}
                    />
                  ))}
                </div>
                <input
                  type="text"
                  value={fCustomColor}
                  onChange={(e) => setFCustomColor(e.target.value)}
                  placeholder="#hex custom"
                  className="cat-custom-color"
                />
              </div>
              <div className="cat-form-row">
                <label>{t('Category Type')}</label>
                <select value={fCategoryType} onChange={(e) => setFCategoryType(e.target.value)}>
                  {CATEGORY_TYPES.map((ct) => (
                    <option key={ct} value={ct}>{ct.charAt(0).toUpperCase() + ct.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="cat-form-row">
                <label>{t('Sub-Venues')}</label>
                <div className="cat-subvenues">
                  {fSubVenues.map((sv, i) => (
                    <div key={i} className="cat-subvenue-row">
                      <button type="button" className="et-arrow" onClick={() => moveSubUp(i)} disabled={i === 0}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
                      </button>
                      <button type="button" className="et-arrow" onClick={() => moveSubDown(i)} disabled={i === fSubVenues.length - 1}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                      </button>
                      <input
                        type="text"
                        value={sv}
                        onChange={(e) => updateSubVenue(i, e.target.value)}
                        placeholder={t('Sub-venue name')}
                      />
                      <button type="button" className="btn-ghost btn-sm danger-text" onClick={() => removeSubVenue(i)}>×</button>
                    </div>
                  ))}
                  <button type="button" className="btn-outline btn-sm" onClick={addSubVenue}>+ {t('Add Sub-Venue')}</button>
                </div>
              </div>
              <div className="cat-form-row">
                <label className="cat-toggle-label">
                  <input type="checkbox" checked={fIsActive} onChange={(e) => setFIsActive(e.target.checked)} />
                  {t('Active')}
                </label>
              </div>
              <div className="cat-form-actions">
                <button type="button" className="btn-ghost" onClick={resetForm}>{t('Cancel')}</button>
                <button type="submit" className="btn-save" disabled={saving || !fName.trim() || !fShortCode.trim()}>
                  {saving ? t('Saving…') : (editItem ? t('Save Changes') : t('Add Category'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category list */}
      <div className="cat-list">
        {filtered.map((cat, index) => {
          const isSystem = SYSTEM_IDS.has(cat.venue_id)
          return (
            <div key={cat.id} className={`cat-card ${!cat.is_active ? 'inactive' : ''}`}>
              <div className="cat-card-top">
                <div className="et-reorder">
                  <button type="button" className="et-arrow" onClick={() => moveUp(index)} disabled={index === 0} aria-label="Move up">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                  </button>
                  <button type="button" className="et-arrow" onClick={() => moveDown(index)} disabled={index === categories.length - 1} aria-label="Move down">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                </div>
                <span className="cat-pill" style={{ background: cat.color, color: contrastText(cat.color) }}>
                  {cat.short_code}
                </span>
                <div className="cat-info">
                  <span className="cat-name" title={cat.name}>{t(cat.name)}</span>
                  <div className="cat-meta">
                    <span className="cat-type-badge">{cat.category_type}</span>
                    {cat.sub_venues?.length > 0 && (
                      <span className="cat-sub-count">{cat.sub_venues.length} {t('Sub-Venues').toLowerCase()}</span>
                    )}
                    {!cat.is_active && <span className="status-badge-inactive">{t('Inactive')}</span>}
                  </div>
                </div>
                <div className="et-actions">
                  <button type="button" className="btn-outline btn-sm" onClick={() => handleToggleActive(cat)}>
                    {t(cat.is_active ? 'Deactivate' : 'Activate')}
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(cat)}>
                    {t('Edit')}
                  </button>
                  {!isSystem && (
                    confirmDeleteId === cat.id ? (
                      <div className="inline-confirm">
                        <span>{t('Delete?')}</span>
                        <button className="btn-danger btn-sm" onClick={() => handleDelete(cat)}>{t('Yes')}</button>
                        <button className="btn-ghost btn-sm" onClick={() => setConfirmDeleteId(null)}>{t('No')}</button>
                      </div>
                    ) : (
                      <button type="button" className="btn-ghost btn-sm danger-text" onClick={() => setConfirmDeleteId(cat.id)}>
                        {t('Delete')}
                      </button>
                    )
                  )}
                </div>
              </div>
              {cat.sub_venues?.length > 0 && (
                <div className="cat-subvenue-list">
                  {cat.sub_venues.map((sv, i) => (
                    <span key={i} className="cat-subvenue-tag">{t(sv)}</span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {categories.length === 0 && <div className="empty-state">{t('No categories found')}</div>}
        {categories.length > 0 && filtered.length === 0 && (
          <div className="empty-state">{t('No matching categories')}</div>
        )}
      </div>
    </div>
  )
}
